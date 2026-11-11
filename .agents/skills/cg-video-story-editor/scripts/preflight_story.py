#!/usr/bin/env python3
"""Fail an edit handoff when its story brief or source ledger is incomplete.

Usage: python preflight_story.py path/to/story-plan.json
This checks explicit editorial inputs; visual similarity still needs a human
phone-size review of the moving cut.
"""

import json
import sys
from collections import Counter
from pathlib import Path


REQUIRED_TEXT = (
    "client",
    "month",
    "audience",
    "viewer_situation",
    "why_now",
    "objective",
    "desired_action",
    "single_message",
    "closest_prior_comparison",
    "comparison_result",
    "improvement_hypothesis",
    "opening_tension",
    "development",
    "proof",
    "payoff",
    "cta",
)


def validate(plan):
    errors = []
    if plan.get("status") != "ready_for_edit":
        errors.append("status must be ready_for_edit before timeline assembly")
    for field in REQUIRED_TEXT:
        if not isinstance(plan.get(field), str) or not plan[field].strip():
            errors.append(f"missing {field}")

    hooks = plan.get("hooks")
    if not isinstance(hooks, list) or len(hooks) < 3:
        errors.append("provide at least three hook candidates")
        hooks = []
    for i, hook in enumerate(hooks, 1):
        if not isinstance(hook, dict):
            errors.append(f"hook {i} must be an object")
            continue
        for field in ("id", "first_frame", "first_3_seconds", "sound", "why_viewer_stops"):
            if not isinstance(hook.get(field), str) or not hook[field].strip():
                errors.append(f"hook {i} missing {field}")
    ids = [h.get("id") for h in hooks if isinstance(h, dict)]
    if plan.get("chosen_hook_id") not in ids:
        errors.append("chosen_hook_id must select one documented candidate")

    shots = plan.get("shots")
    if not isinstance(shots, list) or not shots:
        errors.append("provide a selected-shot ledger")
        shots = []
    sources, clusters = [], []
    for i, shot in enumerate(shots, 1):
        if not isinstance(shot, dict):
            errors.append(f"shot {i} must be an object")
            continue
        for field in ("source", "visual_cluster", "story_role", "in", "out", "rights", "prior_use"):
            value = shot.get(field)
            if value is None or (isinstance(value, str) and not value.strip()):
                errors.append(f"shot {i} missing {field}")
        if shot.get("source"):
            sources.append(shot["source"].casefold())
        if shot.get("visual_cluster"):
            clusters.append(shot["visual_cluster"].casefold())
        if isinstance(shot.get("in"), (int, float)) and isinstance(shot.get("out"), (int, float)):
            if shot["out"] <= shot["in"]:
                errors.append(f"shot {i} has nonpositive duration")
    for source, count in Counter(sources).items():
        if count > 1:
            errors.append(f"source clip reused {count} times: {source}")
    for cluster, count in Counter(clusters).items():
        if count > 1:
            errors.append(f"visual cluster repeated {count} times: {cluster}")
    return errors


def main():
    if len(sys.argv) != 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    try:
        plan = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Cannot read plan: {exc}", file=sys.stderr)
        return 2
    errors = validate(plan)
    if errors:
        print("STORY PREFLIGHT FAILED")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Story preflight passed; still screen moving footage and review at phone size.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
