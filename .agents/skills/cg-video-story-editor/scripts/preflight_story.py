#!/usr/bin/env python3
"""Fail an edit handoff when its story brief or source ledger is incomplete.

Usage: python preflight_story.py path/to/story-plan.json
This checks explicit editorial inputs; visual similarity still needs a human
phone-size review of the moving cut.
"""

import json
import sys
from pathlib import Path
import math
from load_client_library import verify as verify_client_library
from edit_contract import validate_edit
from ui_motion import validate_ui_plan


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
    if not isinstance(plan, dict):
        return ['story plan must be an object']
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
    ids = [h.get("id") for h in hooks if isinstance(h, dict) and isinstance(h.get('id'), str)]
    signatures = [(str(h.get('first_frame','')).strip().casefold(),str(h.get('first_3_seconds','')).strip().casefold()) for h in hooks if isinstance(h,dict)]
    if len(set(ids)) != len(ids) or len(set(signatures)) != len(signatures):
        errors.append('hook candidates must be distinct concepts, not copies with different IDs')
    if plan.get("chosen_hook_id") not in ids:
        errors.append("chosen_hook_id must select one documented candidate")

    shots = plan.get("shots")
    if not isinstance(shots, list) or not shots:
        errors.append("provide a selected-shot ledger")
        shots = []
    selected = []
    for i, shot in enumerate(shots, 1):
        if not isinstance(shot, dict):
            errors.append(f"shot {i} must be an object")
            continue
        for field in ("source", "visual_cluster", "story_role", "in", "out", "rights", "prior_use"):
            value = shot.get(field)
            if value is None or (isinstance(value, str) and not value.strip()):
                errors.append(f"shot {i} missing {field}")
        a, b = shot.get('in'), shot.get('out')
        if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in (a,b)) or b <= a or a < 0:
            errors.append(f"shot {i} needs positive, finite source in/out seconds")
            continue
        if not isinstance(shot.get('source'), str) or not isinstance(shot.get('visual_cluster'), str):
            errors.append(f"shot {i} needs explicit source/cluster strings")
            continue
        for previous in selected:
            same = previous['source'].casefold() == shot['source'].casefold()
            if same and max(previous['in'], a) < min(previous['out'], b):
                errors.append(f"shot {i} repeats an overlapping source moment")
            if previous['visual_cluster'].casefold() == shot['visual_cluster'].casefold() and previous.get('story_role') == shot.get('story_role'):
                errors.append(f"shot {i} repeats a visual cluster with the same story job")
        selected.append(shot)
    if plan.get('research_only') is not True:
        errors.extend(validate_edit(plan))
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
    if isinstance(plan, dict) and plan.get('research_only') is not True:
        if not plan.get('client_id') or not plan.get('client_context_snapshot'):
            errors.append('CG production requires exact client_id and the current loaded client_context_snapshot; load the existing library first')
        else:
            try:
                context=verify_client_library(plan['client_context_snapshot'])
                if context['client_id']!=plan['client_id']:errors.append('Story client does not match loaded client library')
                if not context['brand_ready']:errors.append('Saved brand baseline has specifically unresolved fields; resolve those fields from the saved source, not a generic substitute')
                if any(rule.get('id')=='UI-01' for rule in context.get('owner_rules',[])):
                    errors.extend(validate_ui_plan(plan))
            except (ValueError,KeyError,FileNotFoundError) as exc:
                errors.append('Client library load invalid: '+str(exc))
    if errors:
        print("STORY PREFLIGHT FAILED")
        for error in errors:
            print(f"- {error}")
        return 1
    print("PLAN_INPUTS_COMPLETE — not creative approval. Render the selected treatments and bind their real output before release.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
