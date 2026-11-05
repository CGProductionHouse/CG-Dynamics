"""Two private, bounded EHP picture/SFX studies from 4 Nov owner references.

Uses already verified originals and previously licensed cues. This is not a
client release renderer and does not copy creator/template media.
"""
from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\Ehrlich-Nov-2026")
OUT = ROOT / "reference-proofs-20261104"
KNIFE = ROOT / "source/2026_05_MAY/199A1367.MP4"
HANDS = ROOT / "source/2026_07_JUL/199A1386.MP4"
FIRE = ROOT / "stock/mixkit-2780-fire-full-hd.mp4"
CRACKLE = ROOT / "music/mixkit-1330-campfire-crackles.wav"
WHOOSH = ROOT / "music/mixkit-1492-cinematic-whoosh.wav"
W, H, FPS = 540, 960, 30
FONT = ROOT / "brand/Anton-Regular.ttf"


def run(argv: list[str]) -> None:
    subprocess.run(argv, check=True, stdout=subprocess.DEVNULL)


def verify() -> None:
    known = {
        KNIFE: "3095465B581648DBD49C80531B1AC843EEE7AD52E4AA1245F7B59DF9F7BDD997",
        HANDS: "FDE67F09FE013FB1A562FE1C70E69BB82F5EF011570AF350658E4938D9075660",
    }
    for path, expected in known.items():
        actual = hashlib.sha256(path.read_bytes()).hexdigest().upper()
        if actual != expected:
            raise RuntimeError(f"Original identity changed: {path}")
    for path in (FIRE, CRACKLE, WHOOSH):
        if not path.is_file():
            raise FileNotFoundError(path)


def portrait(frame: np.ndarray) -> np.ndarray:
    h, w = frame.shape[:2]
    crop_w = round(h * W / H)
    left = max(0, (w - crop_w) // 2)
    return cv2.resize(frame[:, left:left + crop_w], (W, H), interpolation=cv2.INTER_AREA)


def cover(frame: np.ndarray, width: int, height: int) -> np.ndarray:
    """Fill a panel with a center crop; never stretch the filmed action."""
    h, w = frame.shape[:2]
    target = width / height
    if w / h > target:
        cut = round(h * target)
        frame = frame[:, (w-cut)//2:(w+cut)//2]
    else:
        cut = round(w / target)
        frame = frame[(h-cut)//2:(h+cut)//2, :]
    return cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)


def frames(path: Path, start: float, count: int) -> list[np.ndarray]:
    cap = cv2.VideoCapture(str(path))
    result = []
    for i in range(count):
        cap.set(cv2.CAP_PROP_POS_MSEC, (start + i / FPS) * 1000)
        ok, frame = cap.read()
        if not ok:
            raise RuntimeError(f"Missing source frame {path.name} {start+i/FPS:.3f}")
        result.append(portrait(frame))
    cap.release()
    return result


def encode(path: Path, seq: list[np.ndarray]) -> None:
    pipe = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
         "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", str(path)],
        stdin=subprocess.PIPE,
    )
    assert pipe.stdin
    for frame in seq:
        pipe.stdin.write(frame.tobytes())
    pipe.stdin.close()
    if pipe.wait():
        raise RuntimeError(f"Encode failed: {path}")


def sound(picture: Path, out: Path, peak_at: float, length: float) -> None:
    # Identical picture to the silent control. Cue's actual onset/peak remain
    # objective timing evidence, not a claim that the effect sounds right.
    # Measured 20 ms window RMS peak of original Mixkit #1492 is 1.06 s.
    # Preserve that peak and place it on the picture change.
    delay = max(0, round((peak_at - 1.06) * 1000))
    graph = (
        f"[1:a]atrim=0:{length},asetpts=N/SR/TB,volume=0.16,"
        f"afade=t=out:st={length-0.4}:d=0.4[c];"
        f"[2:a]atrim=0:1.33,asetpts=N/SR/TB,volume=0.22,"
        f"adelay={delay}|{delay}[w];"
        f"[c][w]amix=inputs=2:normalize=0,alimiter=limit=0.89[a]"
    )
    run(["ffmpeg", "-v", "error", "-y", "-i", str(picture), "-i", str(CRACKLE),
         "-i", str(WHOOSH), "-filter_complex", graph, "-map", "0:v", "-map", "[a]",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", str(length), str(out)])


def radial(frame: np.ndarray, strength: float) -> np.ndarray:
    if strength <= 0:
        return frame
    yy, xx = np.mgrid[:H, :W].astype(np.float32)
    dx, dy = xx - W / 2, yy - H / 2
    radius = (dx / (W * .7)) ** 2 + (dy / (H * .8)) ** 2
    base = 1 - .13 * strength * radius
    mixed = np.empty_like(frame)
    # BGR channel offsets, deliberately bounded; no border extrapolation.
    for channel, offset in enumerate((-.0025, 0, .0025)):
        scale = base + offset * strength
        mx = np.clip(W / 2 + dx * scale, 0, W - 1).astype(np.float32)
        my = np.clip(H / 2 + dy * scale, 0, H - 1).astype(np.float32)
        mixed[:, :, channel] = cv2.remap(frame[:, :, channel], mx, my,
                                          cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
    return mixed


def title(frame: np.ndarray, index: int) -> np.ndarray:
    """Same approved-brand copy on both visual controls after pane release."""
    if index < 50:
        return frame
    base = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).convert("RGBA")
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for words, size, y, color in (
        ("THE BRAAI", 82, 597, (249, 247, 245, 255)),
        ("STARTS HERE", 66, 693, (206, 43, 45, 255)),
    ):
        font = ImageFont.truetype(str(FONT), size)
        box = draw.textbbox((0, 0), words, font=font, stroke_width=2)
        x = (W - (box[2] - box[0])) // 2
        draw.text((x, y), words, font=font, fill=color,
                  stroke_width=2, stroke_fill=(20, 15, 12, 220))
    visible = min(W, max(0, round((index - 49) / 9 * W)))
    alpha = layer.getchannel("A")
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rectangle((0, 0, visible, H), fill=255)
    layer.putalpha(Image.fromarray(np.minimum(np.array(alpha), np.array(mask)).astype("uint8")))
    return cv2.cvtColor(np.array(Image.alpha_composite(base, layer).convert("RGB")), cv2.COLOR_RGB2BGR)


def main() -> None:
    verify()
    OUT.mkdir(parents=True, exist_ok=True)
    fire = frames(FIRE, 1.0, 90)
    # At output 1.5 s the full-frame release reaches the visible cut near 6.75 s.
    knife = frames(KNIFE, 5.25, 90)
    hands = frames(HANDS, 5.15, 90)

    # Reference 1: changing three-pane picture grammar, then one real action
    # takes the whole frame. Plain control shows the same three sources in turn.
    plain = fire[:18] + hands[18:36] + knife[36:90]
    mosaic: list[np.ndarray] = []
    for i in range(90):
        if i >= 45:
            mosaic.append(knife[i].copy())
            continue
        panel = np.full((H, W, 3), (30, 30, 150), np.uint8)
        panel[0:545, :] = cover(knife[i], W, 545)
        panel[549:H, 0:268] = cover(fire[i], 268, H - 549)
        panel[549:H, 272:W] = cover(hands[i], W - 272, H - 549)
        # Short red line resolves the tiled geometry into the full knife shot.
        if 40 <= i < 45:
            y = round(549 + (i - 40) * (H - 549) / 5)
            panel[max(0, y-6):min(H, y+6), :] = (28, 40, 197)
        mosaic.append(panel)
    plain = [title(frame, i) for i, frame in enumerate(plain)]
    mosaic = [title(frame, i) for i, frame in enumerate(mosaic)]
    encode(OUT / "01-plain-silent.mp4", plain)
    encode(OUT / "01-mosaic-silent.mp4", mosaic)
    sound(OUT / "01-mosaic-silent.mp4", OUT / "01-mosaic-designed.mp4", 1.50, 3.0)

    # Reference 2: heat motivates an optical push, then the knife lands clean.
    # Compare the same source times with a straight cut at 1.2 s.
    cut = fire[:36] + knife[36:90]
    pulse = []
    for i, frame in enumerate(cut):
        amp = max(0.0, 1 - abs(i - 35) / 8) if i < 36 else 0.0
        pulse.append(radial(frame, amp * 1.6))
    encode(OUT / "02-hardcut-silent.mp4", cut)
    encode(OUT / "02-lens-push-silent.mp4", pulse)
    sound(OUT / "02-lens-push-silent.mp4", OUT / "02-lens-push-designed.mp4", 1.20, 3.0)
    print(OUT)


if __name__ == "__main__":
    main()
