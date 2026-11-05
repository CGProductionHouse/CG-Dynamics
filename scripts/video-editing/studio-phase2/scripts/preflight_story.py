"""Check that a video story brief has the evidence fields needed before editing.

This is a completeness screen. A person still judges the hook, source fit and
truth of every claim against the cited material.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


FIELDS = (
    "client",
    "release_month",
    "audience",
    "why_now",
    "location_and_season_source",
    "service_source",
    "viewer_goal",
    "single_sentence_message",
    "cta",
    "brand_source",
    "delivery_ratio",
)


def check(brief: dict) -> list[str]:
    problems = [f"missing {key}" for key in FIELDS if not str(brief.get(key, "")).strip()]
    hooks = brief.get("hooks", [])
    if not isinstance(hooks, list) or len(hooks) < 3:
        problems.append("three hook candidates with first-frame, sound and first-three-second ideas required")
    else:
        for number, hook in enumerate(hooks[:3], 1):
            if not isinstance(hook, dict) or any(not str(hook.get(k, "")).strip() for k in ("first_frame", "sound", "first_three_seconds", "buyer_reason")):
                problems.append(f"hook {number} is incomplete")
    shots = brief.get("shots", [])
    if not isinstance(shots, list) or not shots:
        problems.append("at least one planned shot with source and story job required")
    else:
        ids = [shot.get("source_id") for shot in shots if isinstance(shot, dict)]
        clusters = [shot.get("visual_cluster") for shot in shots if isinstance(shot, dict)]
        if len(ids) != len(shots) or any(not value for value in ids + clusters):
            problems.append("every shot needs source_id and visual_cluster")
        if len(ids) != len(set(ids)) or len(clusters) != len(set(clusters)):
            problems.append("repeated source_id or visual_cluster requires a new story decision")
        for number, shot in enumerate(shots, 1):
            if not isinstance(shot, dict) or any(not str(shot.get(k, "")).strip() for k in ("source_path", "in_out", "story_job", "ratio_plan", "audio_role", "rights")):
                problems.append(f"shot {number} lacks source, range, role, ratio, audio or rights")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("brief", type=Path)
    args = parser.parse_args()
    try:
        brief = json.loads(args.brief.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"HOLD: cannot read brief: {exc}")
        return 2
    problems = check(brief)
    for problem in problems:
        print(f"HOLD: {problem}")
    if problems:
        return 1
    print("Brief fields complete; editorial and source truth still need human review")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
