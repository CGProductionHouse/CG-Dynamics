"""Private WiseRide valet R05 picture draft. No approval/clearance implied."""
from __future__ import annotations

import subprocess
import csv
import hashlib
import os
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\November-Queue-Prestage\WiseRide")
SOURCE = ROOT / "2026_10_OCT" / "VIDEO 2"
KIT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Client-Libraries\WiseRide")
OUT = ROOT / "private-r05"
OUT.mkdir(exist_ok=True)
W = int(os.environ.get("WISERIDE_RENDER_WIDTH", "540"))
if W not in (540, 1080):
    raise ValueError("Only the checked 540/1080 portrait layouts are supported")
H, FPS = W * 16 // 9, 25
SCALE = W / 540
BPM = 117.45  # Measured onset spacing for the provisional Mixkit 860 cue.
RED = (237, 28, 36)  # Median RGB from the supplied WiseRide mark.

# Full originals only. The 8472/8473/8481 partial transfers are excluded.
# Each row: original, source in, screen seconds, horizontal crop focus (0..1), role.
SHOTS = [
    ("8471", .55, .40, .48, "flash_mono"),
    ("8612", .22, .40, .53, "flash_red"),
    ("8643", .28, .40, .55, "flash_mono"),
    ("8480", .04, 2.40, .49, "question"),
    ("8509", .04, 1.50, .40, "glass"),
    ("8462", .45, 1.50, .50, "wash"),
    ("8445", .40, 1.50, .49, "mitt"),
    ("8454", .25, 1.50, .50, "wheel"),
    ("8543", .50, 1.50, .46, "window"),
    ("8550", .00, 1.35, .54, "rear"),
    ("8588", .12, 1.50, .60, "engine"),
    ("8619", .05, 1.35, .54, "wheel2"),
    ("8625", .00, 1.50, .48, "rear_cabin"),
    ("8633", .00, 1.50, .46, "door"),
    ("8638", .20, 1.50, .55, "front_cabin"),
    ("8640", .15, 1.50, .57, "wide_cabin"),
    ("8643", .40, 1.25, .54, "vacuum"),
    ("8631", .18, 1.50, .42, "payoff"),
    ("8547", .39, 1.50, .40, "final_rinse"),
]
# Vary the pace while keeping every edit on a measured beat or skipped beat.
BODY_BEATS = [3, 3, 2, 2, 5, 3, 3, 1, 4, 3, 4, 4, 1, 3, 4]
assert len(BODY_BEATS) == len(SHOTS) - 4 and sum(BODY_BEATS) == 45

FONT = KIT / "brand" / "fonts" / "Tomorrow-BoldItalic.ttf"
SMALL = KIT / "brand" / "fonts" / "Gruppo-Regular.ttf"


def crop(frame: np.ndarray, focus: float) -> np.ndarray:
    h, w = frame.shape[:2]
    target = round(h * W / H)
    x = max(0, min(w - target, round(focus * w - target / 2)))
    frame = frame[:, x:x + target]
    return cv2.resize(frame, (W, H), interpolation=cv2.INTER_AREA)


def wash_panels(t: float) -> np.ndarray:
    """Three actual simultaneously moving wash views, each kept near native 16:9."""
    canvas = np.zeros((H, W, 3), np.uint8)
    for index, (name, start) in enumerate((("8443", .18), ("8471", .55), ("8462", .43))):
        if name not in PANEL_CAPS:
            cap = cv2.VideoCapture(str(SOURCE / f"0L8A{name}.MP4"))
            fps = cap.get(cv2.CAP_PROP_FPS)
            first = round(start * fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, first)
            PANEL_CAPS[name] = [cap, first, fps]
        cap, next_frame, fps = PANEL_CAPS[name]
        wanted = round((start + min(t, 1.3)) * fps)
        while next_frame < wanted:
            cap.grab()
            next_frame += 1
        ok, frame = cap.read()
        PANEL_CAPS[name][1] = next_frame + 1
        if not ok:
            raise RuntimeError(f"Wash panel missing {name} at {t:.3f}s")
        ph = round(318 * SCALE)
        h, w = frame.shape[:2]
        target = round(h * W / ph)
        if target <= w:
            x = (w - target) // 2
            frame = frame[:, x:x + target]
        else:
            target_h = round(w * ph / W)
            y = (h - target_h) // 2
            frame = frame[y:y + target_h]
        frame = cv2.resize(frame, (W, ph), interpolation=cv2.INTER_AREA)
        # Exterior sources were captured under different shade. Lift shadow
        # detail within each panel before the three views share one frame.
        gamma = (.80, 1.0, .68)[index]
        if gamma != 1.0:
            lut = np.clip(255 * (np.arange(256) / 255) ** gamma, 0, 255).astype(np.uint8)
            frame = cv2.LUT(frame, lut)
        row = round(321 * SCALE)
        canvas[index * row:index * row + ph] = frame
    canvas[round(318*SCALE):round(321*SCALE)] = (36, 28, 237)
    canvas[round(639*SCALE):round(642*SCALE)] = (36, 28, 237)
    return canvas


PANEL_CAPS: dict[str, list] = {}


def line(draw: ImageDraw.ImageDraw, text: str, y: int, size: int, red: bool = False) -> None:
    font = ImageFont.truetype(str(FONT), size)
    bbox = draw.textbbox((0, 0), text, font=font, stroke_width=0)
    tw = bbox[2] - bbox[0]
    x = max(20, (540 - tw) // 2)
    draw.text((x + 3, y + 4), text, font=font, fill=(8, 8, 8), stroke_width=2, stroke_fill=(8, 8, 8))
    draw.text((x, y), text, font=font, fill=RED if red else (255, 255, 255), stroke_width=1, stroke_fill=(30, 30, 30))


def payoff_stamp(frame: np.ndarray, tick: int) -> np.ndarray:
    """The clean cabin earns a brief, tilted inspection stamp on the score hit."""
    canvas = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).convert("RGBA")
    layer = Image.new("RGBA", (540, 960))
    badge = Image.new("RGBA", (455, 160))
    d = ImageDraw.Draw(badge)
    d.rounded_rectangle((5, 5, 450, 155), radius=10,
                        fill=(10, 10, 10, 215), outline=(*RED, 255), width=5)
    top = ImageFont.truetype(str(FONT), 39)
    bottom = ImageFont.truetype(str(FONT), 35)
    d.text((227, 27), "SKOONMA-", anchor="mt", font=top, fill="white")
    d.text((227, 84), "GOEDGEKEUR.", anchor="mt", font=bottom, fill=(*RED, 255))
    badge = badge.rotate(-4, resample=Image.Resampling.BICUBIC, expand=True)
    phase = min(1., tick / 7)
    scale = 1.0 + .20 * (1 - phase) ** 2
    badge = badge.resize((round(badge.width * scale), round(badge.height * scale)), Image.Resampling.LANCZOS)
    layer.alpha_composite(badge, ((540 - badge.width) // 2, 792 - badge.height // 2))
    if W != 540:
        layer = layer.resize((W, H), Image.Resampling.LANCZOS)
    return cv2.cvtColor(np.asarray(Image.alpha_composite(canvas, layer).convert("RGB")), cv2.COLOR_RGB2BGR)


def graphic(frame: np.ndarray, role: str, tick: int) -> np.ndarray:
    if role.startswith("flash_"):
        # One musical beat, split into three real-action triplets. The restrained
        # red/monochrome alternation sets up the return to full-colour craft.
        mono = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mono = cv2.convertScaleAbs(mono, alpha=1.18, beta=-10)
        if role == "flash_red":
            return np.stack((mono * .55, mono * .55, mono), axis=2).astype(np.uint8)
        return cv2.cvtColor(mono, cv2.COLOR_GRAY2BGR)
    if role not in {"question", "wash", "window", "wide_cabin", "payoff", "final_rinse"}:
        return frame
    if role == "payoff":
        return payoff_stamp(frame, tick)
    img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).convert("RGBA")
    wash = Image.new("RGBA", (540, 960), (0, 0, 0, 0))
    d = ImageDraw.Draw(wash)
    if role == "question":
        d.rectangle((0, 540, 540, 960), fill=(0, 0, 0, 96))
        # Short, deliberate stagger rather than a static title card.
        if tick >= 4:
            line(d, "GAAN JOU KAR", 576 + max(0, 13 - tick) * 3, 46)
        if tick >= 15:
            line(d, "DIE SKOONMA-", 656 + max(0, 24 - tick) * 3, 42, True)
        if tick >= 27:
            line(d, "TOETS SLAAG?", 738 + max(0, 36 - tick) * 3, 53)
    elif role == "wash":
        d.rectangle((0, 720, 540, 960), fill=(0, 0, 0, 75))
        line(d, "BUITE.", 773, 53)
    elif role == "window":
        d.rectangle((0, 735, 540, 960), fill=(0, 0, 0, 70))
        line(d, "ELKE DETAIL.", 782, 37)
    elif role == "wide_cabin":
        d.rectangle((0, 745, 540, 960), fill=(0, 0, 0, 75))
        line(d, "BINNE.", 797, 53)
    else:
        d.rectangle((0, 670, 540, 960), fill=(0, 0, 0, 110))
        line(d, "BRING JOU KAR", 700, 37)
        line(d, "VIR 'N VALET", 760, 41, True)
        line(d, "VOOR DIE FEESTYD.", 820, 31)
    if W != 540:
        wash = wash.resize((W, H), Image.Resampling.LANCZOS)
    return cv2.cvtColor(np.asarray(Image.alpha_composite(img, wash).convert("RGB")), cv2.COLOR_RGB2BGR)


def render() -> None:
    with (KIT / "footage" / "remote_inventory_20261105.csv").open(newline="", encoding="utf-8-sig") as f:
        inventory = {row["filename"]: row for row in csv.DictReader(f)}
    for name in {row[0] for row in SHOTS} | {"8443"}:
        source = SOURCE / f"0L8A{name}.MP4"
        expected = inventory[source.name]
        if source.stat().st_size != int(expected["remote_bytes"]):
            raise RuntimeError(f"Incomplete original: {source.name}")
        digest = hashlib.sha256()
        with source.open("rb") as f:
            for block in iter(lambda: f.read(8 * 1024 * 1024), b""):
                digest.update(block)
        if digest.hexdigest().upper() != expected["remote_sha256"].upper():
            raise RuntimeError(f"Changed original: {source.name}")
    picture = OUT / f"WiseRide_November_valet_R05_picture_only_{W}p.mp4"
    p = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
        "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
        "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", str(picture),
    ], stdin=subprocess.PIPE)
    assert p.stdin
    receipt = []
    cursor = 0
    try:
        elapsed_beats = 0
        for index, (name, start, seconds, focus, role) in enumerate(SHOTS):
            source = SOURCE / f"0L8A{name}.MP4"
            cap = cv2.VideoCapture(str(source))
            if not cap.isOpened():
                raise RuntimeError(f"Cannot open {source}")
            shot_beats = (1 / 3) if index < 3 else (5 if index == 3 else BODY_BEATS[index - 4])
            end_frame = round((elapsed_beats + shot_beats) * 60 / BPM * FPS)
            count = end_frame - cursor
            seconds = count / FPS
            source_fps = cap.get(cv2.CAP_PROP_FPS)
            source_len = cap.get(cv2.CAP_PROP_FRAME_COUNT) / source_fps
            speed = min(1.0, max(.65, (source_len - start - .04) / seconds))
            first_source_frame = round(start * source_fps)
            cap.set(cv2.CAP_PROP_POS_FRAMES, first_source_frame)
            next_source_frame = first_source_frame
            receipt.append((cursor / FPS, name, start, count / FPS, role))
            for i in range(count):
                wanted = round((start + i / FPS * speed) * source_fps)
                while next_source_frame < wanted:
                    cap.grab()
                    next_source_frame += 1
                ok, frame = cap.read()
                if not ok:
                    raise RuntimeError(f"Decode failed {name} at source frame {wanted}")
                next_source_frame += 1
                if role == "question":
                    # Follow Franco's wipe from the worker's face toward the
                    # moving mitt/bonnet, easing the portrait window across the
                    # 16:9 source instead of clipping his face for the full hook.
                    phase = min(1.0, i / max(1, count - 1))
                    phase = phase * phase * (3 - 2 * phase)
                    focus = .66 - .17 * phase
                frame = wash_panels(i / FPS) if role == "wash" else crop(frame, focus)
                frame = graphic(frame, role, i)
                p.stdin.write(frame.tobytes())
            cap.release()
            if role == "wash":
                for panel_cap, _, _ in PANEL_CAPS.values():
                    panel_cap.release()
                PANEL_CAPS.clear()
            cursor += count
            elapsed_beats += shot_beats
        logo = cv2.imread(str(KIT / "brand" / "RED & BLACK.png"), cv2.IMREAD_UNCHANGED)
        if logo is None:
            raise RuntimeError("Official logo unavailable")
        # The supplied 6000x3375 PNG has transparent top/bottom margins. Find
        # the actual full mark rather than interpreting transparent RGB as black.
        ys, xs = np.where(logo[:, :, 3] > 0)
        logo = logo[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        alpha = logo[:, :, 3:4].astype(np.float32) / 255
        logo = (logo[:, :, :3] * alpha + 255 * (1 - alpha)).astype(np.uint8)
        logo_end_frame = round((elapsed_beats + 6) * 60 / BPM * FPS)
        logo_frames = logo_end_frame - cursor
        for i in range(logo_frames):
            frame = np.full((H, W, 3), 255, np.uint8)
            zoom = .91 + .09 * min(1., i / (1.1 * FPS))
            lw = round(500 * SCALE * zoom)
            lh = round(lw * logo.shape[0] / logo.shape[1])
            mark = cv2.resize(logo, (lw, lh), interpolation=cv2.INTER_AREA)
            x, y = (W - lw) // 2, (H - lh) // 2
            frame[y:y + lh, x:x + lw] = mark
            p.stdin.write(frame.tobytes())
        cursor += logo_frames
    finally:
        p.stdin.close()
        if p.wait() != 0:
            raise RuntimeError("ffmpeg picture encode failed")
    (OUT / "receipt.tsv").write_text("output_s\tsource\tin_s\tused_s\trole\n" + "\n".join("\t".join(map(str, x)) for x in receipt))
    music = KIT / "audio" / "candidates" / "Year-2001.mp3"
    sfx = KIT / "audio" / "mixkit-flying-fast-swoosh-1469.wav"
    water = KIT / "audio" / "mixkit-spray-water-or-liquid-3215.wav"
    wash_start = next(row[0] for row in receipt if row[4] == "wash")
    # The licensed whoosh's measured RMS crest is 0.52 s into its source.
    # Its crest lands on the actual three-panel wash reveal, with a prelap.
    cue_delay_ms = round((wash_start - .52) * 1000)
    water_delay_ms = round((wash_start - .18) * 1000)
    review = OUT / f"WiseRide_November_valet_R05_PRIVATE_NOT_FOR_REVIEW_{W}p.mp4"
    subprocess.run([
        "ffmpeg", "-v", "error", "-y", "-i", str(picture), "-i", str(music), "-i", str(sfx), "-i", str(water),
        "-filter_complex", f"[1:a]atrim=start=0.07,asetpts=PTS-STARTPTS,afade=t=out:st={cursor/FPS-1.2:.3f}:d=1.2[m];"
                          f"[2:a]volume=0.35,afade=t=out:st=1.18:d=0.4,adelay={cue_delay_ms}|{cue_delay_ms}[fx];"
                          f"[3:a]atrim=0:2.1,asetpts=PTS-STARTPTS,volume=0.5,afade=t=in:d=0.1,"
                          f"afade=t=out:st=1.5:d=0.6,adelay={water_delay_ms}|{water_delay_ms}[water];"
                          "[m][fx][water]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.72:level=false[a]",
        "-map", "0:v", "-map", "[a]", "-t", f"{cursor/FPS:.3f}",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(review),
    ], check=True)
    print(review, cursor / FPS)


if __name__ == "__main__":
    render()




