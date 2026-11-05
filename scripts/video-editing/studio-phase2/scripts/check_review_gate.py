"""Fail closed on missing editorial evidence before calling a client video review-ready.

This checks a release record, not the creative quality of the film. A human must
inspect every piece of evidence and the exact export. No media is uploaded.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


REQUIRED = (
    "viewer_and_goal",
    "why_now_and_here",
    "client_offer_and_claims",
    "three_second_hook",
    "brand_assets",
    "source_and_prior_use",
    "format_and_moving_crop",
    "motion_and_story_links",
    "music_sound_and_rights",
    "exact_export_picture_sound_phone",
    "cover_caption_filename",
)


def check(record: dict) -> list[str]:
    problems: list[str] = []
    if not record.get("client") or not record.get("revision") or not record.get("export_sha256"):
        problems.append("client, revision and exact export_sha256 are required")
    gates = record.get("gates", {})
    if not isinstance(gates, dict):
        return problems + ["gates must be an object"]
    for name in REQUIRED:
        gate = gates.get(name)
        if not isinstance(gate, dict) or gate.get("status") != "pass":
            problems.append(f"{name}: requires an explicit pass")
        elif not isinstance(gate.get("evidence"), str) or len(gate["evidence"].strip()) < 20:
            problems.append(f"{name}: requires specific evidence, not a tick")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("record", type=Path)
    args = parser.parse_args()
    try:
        record = json.loads(args.record.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"HOLD: cannot read release record: {exc}")
        return 2
    problems = check(record)
    if problems:
        for problem in problems:
            print(f"HOLD: {problem}")
        return 1
    print("Evidence fields complete; human review of the cited export is still required")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
