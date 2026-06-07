#!/usr/bin/env bun
// pdf-ops — deterministic structural PDF page operations for Weft.
//
// One engine, two consumers: the Weft dashboard editor (web/src/lib/pdfOps.ts
// mirrors these calls in the browser) and the agent (this CLI, allowlisted in
// Mode A and reachable in Mode B/ACP via the claude_code bridge).
//
// Pure structural ops only (merge / split / extract / delete / rotate /
// reorder / stamp / info) via @cantoo/pdf-lib — no text extraction, no OCR,
// no LLM. For extraction/OCR/create-from-scratch use the `pdf` skill instead.
//
// Output lands in the shared workspace (~/.hermes/weft/pdf/ by default) and the
// absolute path is printed on stdout, so an assistant message that mentions it
// auto-renders a PdfCard in the Weft chat that deep-links to the visual editor.

import { PDFDocument, degrees, rgb, StandardFonts } from "@cantoo/pdf-lib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

// ── workspace + output naming ────────────────────────────────────────────────

export function workspaceDir(): string {
  return process.env.WEFT_PDF_DIR || join(homedir(), ".hermes", "weft", "pdf");
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/\.pdf$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "pdf"
  );
}

/** Build a timestamped output path in the workspace. */
function defaultOut(verb: string, hint: string): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .replace(/\..+$/, "")
    .replace(/(\d{8})(\d{6})/, "$1-$2");
  const dir = workspaceDir();
  mkdirSync(dir, { recursive: true });
  return join(dir, `${ts}-${verb}-${slugify(hint)}.pdf`);
}

// ── page-spec parsing ────────────────────────────────────────────────────────

/** Parse a 1-based page spec ("1,3,5-8" or "all") into a sorted unique list of
 *  0-based indices, validated against `pageCount`. */
export function parsePages(spec: string, pageCount: number): number[] {
  if (!spec || spec.trim().toLowerCase() === "all") {
    return Array.from({ length: pageCount }, (_, i) => i);
  }
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const seg = part.trim();
    if (!seg) continue;
    const m = seg.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      for (let p = lo; p <= hi; p++) out.add(p - 1);
    } else if (/^\d+$/.test(seg)) {
      out.add(parseInt(seg, 10) - 1);
    } else {
      throw new Error(`bad page spec segment: ${seg}`);
    }
  }
  const idx = [...out].sort((a, b) => a - b);
  for (const i of idx) {
    if (i < 0 || i >= pageCount) {
      throw new Error(`page ${i + 1} out of range (1-${pageCount})`);
    }
  }
  return idx;
}

// ── pure ops: Uint8Array → Uint8Array ────────────────────────────────────────

export async function mergePdfs(buffers: Uint8Array[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return out.save();
}

/** Keep `keepIdx` (0-based, in the given order) and drop the rest. Used for
 *  extract, delete (as the complement), and reorder. */
export async function selectPages(buf: Uint8Array, keepIdx: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(buf);
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, keepIdx);
  for (const p of pages) out.addPage(p);
  return out.save();
}

export async function deletePages(buf: Uint8Array, dropIdx: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(buf);
  const drop = new Set(dropIdx);
  const keep = src.getPageIndices().filter((i) => !drop.has(i));
  if (keep.length === 0) throw new Error("refusing to delete every page");
  return selectPages(buf, keep);
}

export async function rotatePages(
  buf: Uint8Array,
  idx: number[],
  deltaDeg: number,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(buf);
  const pages = doc.getPages();
  for (const i of idx) {
    const cur = pages[i].getRotation().angle || 0;
    const next = (((cur + deltaDeg) % 360) + 360) % 360;
    pages[i].setRotation(degrees(next));
  }
  return doc.save();
}

const STAMP_POS = ["top-left", "top-right", "bottom-left", "bottom-right", "center"] as const;
export type StampPos = (typeof STAMP_POS)[number];

export async function stampText(
  buf: Uint8Array,
  text: string,
  opts: { idx?: number[]; pos?: StampPos; size?: number; opacity?: number } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(buf);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const size = opts.size ?? 24;
  const opacity = opts.opacity ?? 0.35;
  const pos: StampPos = opts.pos ?? "bottom-right";
  const pages = doc.getPages();
  const targets = opts.idx ?? pages.map((_, i) => i);
  const m = 24; // margin
  for (const i of targets) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const tw = font.widthOfTextAtSize(text, size);
    const th = font.heightAtSize(size);
    let x = m;
    let y = m;
    if (pos === "top-left") { x = m; y = height - m - th; }
    else if (pos === "top-right") { x = width - m - tw; y = height - m - th; }
    else if (pos === "bottom-left") { x = m; y = m; }
    else if (pos === "bottom-right") { x = width - m - tw; y = m; }
    else { x = (width - tw) / 2; y = (height - th) / 2; }
    page.drawText(text, { x, y, size, font, color: rgb(0.85, 0.1, 0.1), opacity });
  }
  return doc.save();
}

export async function pageCount(buf: Uint8Array): Promise<number> {
  return (await PDFDocument.load(buf)).getPageCount();
}

// ── CLI ──────────────────────────────────────────────────────────────────────

interface Flags {
  out?: string;
  pages?: string;
  pos?: string;
  size?: string;
  opacity?: string;
  outDir?: string;
  positional: string[];
}

function parseFlags(argv: string[]): Flags {
  const f: Flags = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-o" || a === "--out") f.out = argv[++i];
    else if (a === "--pages") f.pages = argv[++i];
    else if (a === "--pos") f.pos = argv[++i];
    else if (a === "--size") f.size = argv[++i];
    else if (a === "--opacity") f.opacity = argv[++i];
    else if (a === "--out-dir") f.outDir = argv[++i];
    else f.positional.push(a);
  }
  return f;
}

function readPdf(p: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(p)));
}

function writeOut(verb: string, hint: string, flags: Flags, bytes: Uint8Array): string {
  const out = flags.out ? resolve(flags.out) : defaultOut(verb, hint);
  mkdirSync(join(out, ".."), { recursive: true });
  writeFileSync(out, bytes);
  return out;
}

const USAGE = `pdf-ops — structural PDF page operations (output → ~/.hermes/weft/pdf/)

  info     <file>
  merge    <fileA> <fileB> [...]                 [-o OUT]   concatenate
  split    <file>                                [--out-dir DIR]   one file per page
  extract  <file> <pages>                        [-o OUT]   keep only these pages
  delete   <file> <pages>                        [-o OUT]   drop these pages
  rotate   <file> <pages|all> <deg>              [-o OUT]   deg ∈ 90,180,270,-90
  reorder  <file> <order>                        [-o OUT]   e.g. 3,1,2 (1-based, full perm)
  stamp    <file> <text> [--pages all] [--pos bottom-right] [--size 24] [--opacity .35] [-o OUT]

  <pages> = 1-based spec: "1,3,5-8" or "all".`;

async function main() {
  const [verb, ...rest] = process.argv.slice(2);
  if (!verb || verb === "-h" || verb === "--help") {
    console.log(USAGE);
    process.exit(verb ? 0 : 1);
  }
  const flags = parseFlags(rest);
  const pos = flags.positional;

  if (verb === "info") {
    const buf = readPdf(pos[0]);
    const doc = await PDFDocument.load(buf);
    const info = {
      file: resolve(pos[0]),
      pages: doc.getPageCount(),
      title: doc.getTitle() || null,
      author: doc.getAuthor() || null,
      sizes: doc.getPages().map((p) => {
        const { width, height } = p.getSize();
        return { w: Math.round(width), h: Math.round(height), rot: p.getRotation().angle };
      }),
    };
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  if (verb === "merge") {
    if (pos.length < 2) throw new Error("merge needs ≥2 input files");
    const bytes = await mergePdfs(pos.map(readPdf));
    console.log(writeOut("merge", basename(pos[0]), flags, bytes));
    return;
  }

  if (verb === "split") {
    const buf = readPdf(pos[0]);
    const n = await pageCount(buf);
    const dir = flags.outDir ? resolve(flags.outDir) : workspaceDir();
    mkdirSync(dir, { recursive: true });
    const stem = slugify(basename(pos[0]));
    const outs: string[] = [];
    for (let i = 0; i < n; i++) {
      const bytes = await selectPages(buf, [i]);
      const out = join(dir, `${stem}-p${String(i + 1).padStart(3, "0")}.pdf`);
      writeFileSync(out, bytes);
      outs.push(out);
    }
    console.log(outs.join("\n"));
    return;
  }

  if (verb === "extract" || verb === "delete") {
    const buf = readPdf(pos[0]);
    const n = await pageCount(buf);
    const idx = parsePages(pos[1] ?? "", n);
    if (idx.length === 0) throw new Error(`${verb} needs a page spec`);
    const bytes =
      verb === "extract" ? await selectPages(buf, idx) : await deletePages(buf, idx);
    console.log(writeOut(verb, basename(pos[0]), flags, bytes));
    return;
  }

  if (verb === "rotate") {
    const buf = readPdf(pos[0]);
    const n = await pageCount(buf);
    const idx = parsePages(pos[1] ?? "all", n);
    const deg = parseInt(pos[2] ?? "90", 10);
    if (![90, 180, 270, -90, -180, -270].includes(deg)) {
      throw new Error("rotate deg must be one of 90,180,270,-90");
    }
    const bytes = await rotatePages(buf, idx, deg);
    console.log(writeOut("rotate", basename(pos[0]), flags, bytes));
    return;
  }

  if (verb === "reorder") {
    const buf = readPdf(pos[0]);
    const n = await pageCount(buf);
    const order = (pos[1] ?? "").split(",").map((s) => parseInt(s.trim(), 10) - 1);
    const seen = new Set(order);
    if (order.length !== n || seen.size !== n || order.some((i) => i < 0 || i >= n)) {
      throw new Error(`reorder needs a full permutation of 1-${n} (got "${pos[1]}")`);
    }
    const bytes = await selectPages(buf, order);
    console.log(writeOut("reorder", basename(pos[0]), flags, bytes));
    return;
  }

  if (verb === "stamp") {
    const buf = readPdf(pos[0]);
    const text = pos[1];
    if (!text) throw new Error("stamp needs <text>");
    const n = await pageCount(buf);
    const idx = parsePages(flags.pages ?? "all", n);
    const bytes = await stampText(buf, text, {
      idx,
      pos: (flags.pos as StampPos) || "bottom-right",
      size: flags.size ? parseInt(flags.size, 10) : undefined,
      opacity: flags.opacity ? parseFloat(flags.opacity) : undefined,
    });
    console.log(writeOut("stamp", basename(pos[0]), flags, bytes));
    return;
  }

  throw new Error(`unknown verb: ${verb}\n\n${USAGE}`);
}

// Only run the CLI when executed directly (not when imported by tests).
if (import.meta.main) {
  main().catch((err) => {
    console.error(`pdf-ops error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
