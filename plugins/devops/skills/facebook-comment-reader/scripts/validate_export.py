#!/usr/bin/env python3
"""Validate and summarize a local Browser Tunnel Facebook comment export."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys


SCHEMA = "facebook-rendered-comments/v1"


def fail(message: str) -> int:
    print(f"invalid export: {message}", file=sys.stderr)
    return 2


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path)
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args()

    try:
        data = json.loads(args.path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return fail(str(exc))
    if data.get("schema") != SCHEMA:
        return fail(f"expected schema {SCHEMA!r}")
    for key in ("source", "post", "scope", "summary"):
        if not isinstance(data.get(key), dict):
            return fail(f"{key} must be an object")
    if not isinstance(data.get("capturedAt"), str) or not data["capturedAt"]:
        return fail("capturedAt must be a nonempty string")
    if not isinstance(data["source"].get("url"), str) or not data["source"]["url"]:
        return fail("source.url must be a nonempty string")
    comments = data.get("comments")
    if not isinstance(comments, list):
        return fail("comments must be a list")
    seen: set[str] = set()
    for index, comment in enumerate(comments):
        if not isinstance(comment, dict):
            return fail(f"comments[{index}] must be an object")
        comment_id = comment.get("id")
        if not isinstance(comment_id, str) or not comment_id:
            return fail(f"comments[{index}].id must be a nonempty string")
        if comment_id in seen:
            return fail(f"duplicate comment id {comment_id!r}")
        seen.add(comment_id)
        if not isinstance(comment.get("text"), str):
            return fail(f"comments[{index}].text must be a string")
        author = comment.get("author")
        if not isinstance(author, dict) or not isinstance(author.get("name"), str) or not author["name"]:
            return fail(f"comments[{index}].author.name must be a nonempty string")
        timestamp = comment.get("timestamp")
        if not isinstance(timestamp, dict) or not isinstance(timestamp.get("label"), str) or not timestamp["label"]:
            return fail(f"comments[{index}].timestamp.label must be a nonempty string")
        if not isinstance(comment.get("reactions"), dict):
            return fail(f"comments[{index}].reactions must be an object")
        if not isinstance(comment.get("permalink"), str) or not comment["permalink"]:
            return fail(f"comments[{index}].permalink must be a nonempty string")
        if not isinstance(comment.get("depth"), int) or comment["depth"] < 0:
            return fail(f"comments[{index}].depth must be a nonnegative integer")
        if comment.get("parentId") is not None and not isinstance(comment["parentId"], str):
            return fail(f"comments[{index}].parentId must be a string or null")
        if not isinstance(comment.get("media", []), list):
            return fail(f"comments[{index}].media must be a list")
        for media_index, media in enumerate(comment.get("media", [])):
            if not isinstance(media, dict):
                return fail(f"comments[{index}].media[{media_index}] must be an object")
            if media.get("type") not in {"image", "gif", "video"}:
                return fail(f"comments[{index}].media[{media_index}].type is unsupported")
            if not isinstance(media.get("url"), str) or not media["url"]:
                return fail(f"comments[{index}].media[{media_index}].url must be a nonempty string")

    declared_count = data["summary"].get("commentCount")
    if declared_count != len(comments):
        return fail(f"summary.commentCount {declared_count!r} does not match {len(comments)} comments")
    for index, comment in enumerate(comments):
        parent_id = comment.get("parentId")
        if parent_id is not None and parent_id not in seen:
            return fail(f"comments[{index}].parentId references missing id {parent_id!r}")

    summary = data["summary"]
    result = {
        "schema": SCHEMA,
        "capturedAt": data.get("capturedAt"),
        "sourceUrl": (data.get("source") or {}).get("url"),
        "commentCount": len(comments),
        "declaredCommentCount": summary.get("commentCount"),
        "uniqueAuthors": len({(c.get("author") or {}).get("name") for c in comments if (c.get("author") or {}).get("name")}),
        "mediaCount": sum(len(c.get("media", [])) for c in comments),
        "remainingExpansionControls": summary.get("remainingExpansionControls", []),
        "completeness": summary.get("completeness"),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
