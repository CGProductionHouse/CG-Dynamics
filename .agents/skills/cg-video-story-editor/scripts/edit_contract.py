"""Connect the existing story plan, selected recipes and exact rendered delivery.

Checks implementation/identity/timing, not whether a story or effect is good.
No rendering, model calls, network access or new job database.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
from fractions import Fraction


def sha(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def binding(value):
    if not isinstance(value, dict) or not value.get('path') or not value.get('sha256'):
        raise ValueError('missing path/SHA-256 binding')
    path = Path(value['path'])
    if not path.is_file() or sha(path) != value['sha256']:
        raise ValueError('missing or changed bound file: '+str(path))
    return path


def frame(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or int(value) != value:
        raise ValueError('frame must be a finite whole number')
    return int(value)


def duration_bounds(plan):
    """Keep the30s default; bind a genuinely different owner brief per client.

    This checks recorded evidence, not whether its author granted permission.
    The editor must retain the actual owner's format instruction and scope.
    """
    contract = plan.get('duration_contract')
    if contract is None:
        return 27.0, 33.0
    if not isinstance(contract, dict) or contract.get('kind') != 'owner_assigned_format':
        raise ValueError('duration change needs an owner-assigned format contract')
    if not plan.get('client_id') or contract.get('client_id') != plan['client_id']:
        raise ValueError('duration authority belongs to another or unknown client')
    evidence = binding(contract.get('evidence'))
    excerpt = contract.get('instruction_excerpt')
    if not isinstance(excerpt, str) or not excerpt.strip() or excerpt not in evidence.read_text(encoding='utf-8-sig'):
        raise ValueError('duration authority excerpt missing from the bound owner brief')
    if not contract.get('authority'):
        raise ValueError('duration contract needs its actual owner/message authority')
    bounds = [contract.get('minimum_seconds'), contract.get('maximum_seconds')]
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in bounds):
        raise ValueError('duration bounds must be finite numeric seconds')
    minimum, maximum = map(float, bounds)
    if not 0 < minimum <= maximum <= 600:
        raise ValueError('owner format duration bounds must be positive, ordered and bounded')
    return minimum, maximum


def validate_edit(plan):
    """Pre-render feasibility, with no pretend creative verdict."""
    errors = []
    try:
        fps = float(plan['fps'])
        if isinstance(plan['fps'], bool) or not math.isfinite(fps) or not 1 <= fps <= 120:
            raise ValueError('invalid fps')
        shots = plan['shots']
        cursor = 0
        cuts = []
        for shot in shots:
            start, end = frame(shot['timeline_in_frame']), frame(shot['timeline_out_frame'])
            if start != cursor or end <= start:
                raise ValueError('shot timeline must be contiguous, ordered and positive')
            cursor = end
            if start:
                cuts.append(start)
            intent = shot['intent']
            if any(not isinstance(intent.get(k), str) or not intent[k].strip()
                   for k in ('visible_action', 'viewer_inference', 'graphic_job', 'sound_job')):
                raise ValueError('every shot needs visible action, viewer inference, graphic and sound jobs')
        minimum, maximum = duration_bounds(plan)
        if not minimum <= cursor/fps <= maximum:
            if plan.get('duration_contract') is None:
                raise ValueError('planned picture must develop roughly30s (27–33s), before rendering')
            raise ValueError(f'planned picture must meet its recorded duration ({minimum:g}–{maximum:g}s), before rendering')
        beats = plan['story_beats']
        previous = 0
        for role in ('hook', 'development', 'payoff'):
            beat = beats[role]
            a, b = map(frame, beat['frames'])
            if a != previous or b <= a or not beat.get('viewer_change') or not beat.get('visible_proof'):
                raise ValueError('hook/development/payoff must cover the timeline with visible proof and a viewer change')
            previous = b
        if previous != cursor or beats['hook']['frames'][0] != 0:
            raise ValueError('story beats must cover the actual planned picture')
        music = binding(plan['music'])
        probe = subprocess.run([plan.get('ffprobe_path','ffprobe'),'-v','error','-select_streams','a',
            '-show_entries','stream=codec_type','-of','json',str(music)],capture_output=True,text=True,check=True,timeout=30)
        if not json.loads(probe.stdout).get('streams'):
            raise ValueError('selected music has no actual audio stream')
        anchors = plan['cut_anchors']
        if len(anchors) != len(cuts):
            raise ValueError('each picture cut needs its own audible timing anchor')
        for cut, anchor in zip(cuts, anchors):
            if frame(anchor['cut_frame']) != cut or abs(frame(anchor['anchor_frame'])-cut) > 1:
                raise ValueError('cut is more than one frame from its selected audible anchor')
            if anchor.get('kind') not in ('music_beat', 'source_action', 'dialogue', 'designed_sound'):
                raise ValueError('unknown cut timing basis')
            if not anchor.get('reason'):
                raise ValueError('timing anchor needs its source/action reason')
        choices = plan['skill_applications']
        if not choices:
            raise ValueError('no shared editing technique selected for this production')
        root = Path(plan['skill_library_root'])
        ids = set()
        for choice in choices:
            if not re.fullmatch(r'[a-z0-9-]+', choice['skill_id']):
                raise ValueError('invalid skill id')
            card = root/choice['skill_id']/'SKILL.md'
            if sha(card) != choice['card_sha256']:
                raise ValueError('selected skill card changed or is not in the shared library')
            binding(choice['implementation'])
            if not isinstance(choice.get('parameters'), dict) or not choice['parameters']:
                raise ValueError('selected treatment must bind its actual layout/timing parameters')
            if not choice.get('purpose') or not choice.get('mechanism') or choice['id'] in ids:
                raise ValueError('technique needs a unique application, mechanism and story purpose')
            ids.add(choice['id'])
            a, b = map(frame, choice['frames'])
            if not 0 <= a < b <= cursor:
                raise ValueError('technique range outside the planned picture')
        # Logo, stabilisation or audio alone cannot stand in for the requested visual craft.
        if not any(c.get('role') in ('type', 'composition', 'transition', 'scene_depth', 'motivated_motion', 'ui')
                   and frame(c['frames'][0]) < beats['payoff']['frames'][0] for c in choices):
            raise ValueError('no intended visual craft in the story body/opening; logo/basic correction alone is insufficient')
    except (KeyError, TypeError, ValueError, AttributeError, IndexError, OverflowError, OSError, subprocess.SubprocessError) as exc:
        errors.append('Production edit plan: '+str(exc))
    return errors


def picture_hashes(path, start, end, ffmpeg='ffmpeg'):
    result = subprocess.run([ffmpeg, '-nostdin', '-v', 'error', '-i', str(path), '-an',
        '-vf', f'trim=start_frame={start}:end_frame={end},setpts=PTS-STARTPTS,format=rgb24',
        '-fps_mode', 'passthrough', '-f', 'framemd5', '-'], capture_output=True, text=True, check=True, timeout=90)
    rows = [r for r in result.stdout.splitlines() if r and not r.startswith('#')]
    if len(rows) != end-start:
        raise ValueError('effect proof range is truncated or uses a different frame clock')
    return [r.split(',')[-1].strip() for r in rows]


def video_clock(path, ffprobe='ffprobe'):
    result = subprocess.run([ffprobe,'-v','error','-select_streams','v:0','-count_frames',
        '-show_entries','stream=width,height,r_frame_rate,avg_frame_rate,nb_read_frames',
        '-of','json',str(path)],capture_output=True,text=True,check=True,timeout=90)
    stream = json.loads(result.stdout)['streams'][0]
    rate, average = float(Fraction(stream['r_frame_rate'])), float(Fraction(stream['avg_frame_rate']))
    if abs(rate-average) > .001:
        raise ValueError('export has no stable constant frame clock')
    return (stream['width'],stream['height'],average,int(stream['nb_read_frames']))


def check_render(record, actual_seconds, story_validator):
    """Revalidate the actual plan and compare each claimed application to a plain control.

    A decoded difference proves only a picture change. It cannot certify a hook,
    meaningful motion, tasteful effects, good music or independent review.
    """
    errors = []
    try:
        plan_path = binding(record['story_plan'])
        plan = json.loads(plan_path.read_text(encoding='utf-8-sig'))
        if plan.get('research_only') or plan.get('client_id') != record['client_id']:
            raise ValueError('research/different-client plan cannot release a client film')
        if plan.get('client_context_snapshot') != record['client_context_snapshot']:
            raise ValueError('story and delivery use different client snapshots')
        errors.extend(story_validator(plan))
        if errors:
            return errors
        manifest = json.loads(binding(record['edit_manifest']).read_text(encoding='utf-8-sig'))
        if manifest['plan_sha256'] != sha(plan_path) or manifest['video_sha256'] != record['video_sha256']:
            raise ValueError('render manifest is not bound to this plan and exact export')
        if manifest['fps'] != plan['fps'] or manifest['shots'] != plan['shots']:
            raise ValueError('rendered timeline differs from the planned source/time decisions')
        if abs(actual_seconds-plan['shots'][-1]['timeline_out_frame']/plan['fps']) > 1/plan['fps']:
            raise ValueError('actual duration differs from the planned timeline')
        clock = video_clock(record['video'],record.get('ffprobe_path','ffprobe'))
        if abs(clock[2]-plan['fps']) > .001 or clock[3] != plan['shots'][-1]['timeline_out_frame']:
            raise ValueError('actual export frame clock/count differs from the plan')
        applications = manifest['applied_skills']
        if len(applications) != len(plan['skill_applications']):
            raise ValueError('planned techniques were dropped or unexpected techniques added')
        by_id = {x['id']: x for x in applications}
        if len(by_id) != len(applications):
            raise ValueError('duplicate application evidence')
        for choice in plan['skill_applications']:
            applied = by_id[choice['id']]
            if applied['choice'] != choice:
                raise ValueError('rendered technique does not match the selected recipe/parameters')
            plain = binding(applied['plain_control'])
            control_clock = video_clock(plain,record.get('ffprobe_path','ffprobe'))
            if clock[:2] != control_clock[:2] or abs(clock[2]-control_clock[2]) > .001:
                raise ValueError('plain control uses different dimensions or frame clock')
            a, b = map(frame, choice['frames'])
            control_start = frame(applied['control_start_frame'])
            if control_start < 0:
                raise ValueError('plain control frame range must start at or after zero')
            changed = picture_hashes(record['video'], a, b, record.get('ffmpeg_path', 'ffmpeg'))
            control = picture_hashes(plain, control_start, control_start+b-a, record.get('ffmpeg_path', 'ffmpeg'))
            if changed == control:
                raise ValueError('claimed visual technique is absent: final picture equals its plain control')
    except (KeyError, TypeError, ValueError, AttributeError, IndexError, ZeroDivisionError, OverflowError, OSError, subprocess.SubprocessError) as exc:
        errors.append('Plan-to-render binding: '+str(exc))
    return errors
