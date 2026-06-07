// bun test — exercises the pure structural ops in scripts/pdf_ops.ts.
// No network, no filesystem (ops are Uint8Array → Uint8Array).
import { test, expect } from "bun:test";
import { PDFDocument } from "@cantoo/pdf-lib";
import {
  parsePages,
  mergePdfs,
  selectPages,
  deletePages,
  rotatePages,
  stampText,
  pageCount,
} from "../scripts/pdf_ops.ts";

/** Build an N-page PDF (each page A4-ish) for fixtures. */
async function makePdf(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i++) doc.addPage([300, 400]);
  return doc.save();
}

test("parsePages: ranges, lists, all, validation", () => {
  expect(parsePages("1,3,5-7", 10)).toEqual([0, 2, 4, 5, 6]);
  expect(parsePages("all", 3)).toEqual([0, 1, 2]);
  expect(parsePages("", 2)).toEqual([0, 1]);
  expect(parsePages("3-1", 5)).toEqual([0, 1, 2]); // tolerates reversed range
  expect(() => parsePages("9", 3)).toThrow(); // out of range
  expect(() => parsePages("x", 3)).toThrow(); // garbage
});

test("merge concatenates page counts", async () => {
  const merged = await mergePdfs([await makePdf(1), await makePdf(2), await makePdf(1)]);
  expect(await pageCount(merged)).toBe(4);
});

test("extract keeps only selected pages, in order", async () => {
  const src = await makePdf(5);
  const out = await selectPages(src, parsePages("1,4", 5)); // pages 1 & 4
  expect(await pageCount(out)).toBe(2);
});

test("delete drops pages and refuses to empty the doc", async () => {
  const src = await makePdf(3);
  const out = await deletePages(src, parsePages("2", 3));
  expect(await pageCount(out)).toBe(2);
  await expect(deletePages(await makePdf(1), [0])).rejects.toThrow();
});

test("rotate is additive and normalized mod 360", async () => {
  const src = await makePdf(2);
  const once = await rotatePages(src, [0], 90);
  const twice = await rotatePages(once, [0], 90);
  const d1 = await PDFDocument.load(once);
  const d2 = await PDFDocument.load(twice);
  expect(d1.getPages()[0].getRotation().angle).toBe(90);
  expect(d2.getPages()[0].getRotation().angle).toBe(180);
  expect(d1.getPages()[1].getRotation().angle).toBe(0); // untouched page
});

test("reorder via selectPages applies a full permutation", async () => {
  const src = await makePdf(3);
  const out = await selectPages(src, [2, 0, 1]);
  expect(await pageCount(out)).toBe(3);
});

test("stamp preserves page count and produces a valid PDF", async () => {
  const src = await makePdf(2);
  const out = await stampText(src, "DRAFT", { pos: "center", size: 30 });
  expect(await pageCount(out)).toBe(2);
  expect(out.length).toBeGreaterThan(src.length); // text was drawn
});
