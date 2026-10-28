"""Bounded original option-carousel layout with imported, licensed Lucide vectors."""
from __future__ import annotations

import hashlib
import json
import math
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / "proof"
WORK = Path.home() / "Videos/CG-AI-Editing/Nolan-Skill-Proofs/vector-carousel-20261027"
INKSCAPE = Path(r"C:\Program Files\Inkscape\bin\inkscape.exe")
W, H, FPS, N = 540, 960, 24, 108
BG, FG, ACCENT = (16, 21, 26), (242, 241, 232), (200, 255, 85)
ITEMS = (("HOME", "house"), ("BUSINESS", "briefcase-business"), ("MOTOR", "car"))


def font(size: int, bold: bool = False):
    face = ImageFont.truetype(str(ROOT / "scene/assets/SpaceGrotesk.ttf"), size)
    if bold:
        face.set_variation_by_name("Bold")
    return face


def encode(path: Path, frames: list[Image.Image]) -> None:
    process = subprocess.Popen([
        "ffmpeg", "-nostdin", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{W}x{H}", "-r", str(FPS), "-i", "pipe:0", "-an", "-c:v", "libx264",
        "-crf", "18", "-pix_fmt", "yuv420p", str(path),
    ], stdin=subprocess.PIPE)
    assert process.stdin
    for frame in frames:
        process.stdin.write(frame.convert("RGB").tobytes())
    process.stdin.close()
    if process.wait():
        raise RuntimeError(path)


def main() -> None:
    manifest = json.loads((HERE / "assets/SOURCE-MANIFEST.json").read_text())
    for name, sha in manifest["files"].items():
        if hashlib.sha256((HERE / "assets" / name).read_bytes()).hexdigest() != sha:
            raise RuntimeError(f"Asset changed: {name}")
    if not INKSCAPE.exists():
        raise RuntimeError("Use an already approved SVG rasterizer; this study does not install one")
    OUT.mkdir(exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    icons = {}
    for _, name in ITEMS:
        derived = WORK / f"{name}-navy.svg"
        derived.write_text((HERE / "assets" / f"{name}.svg").read_text().replace("currentColor", "#10151a"))
        png = WORK / f"{name}.png"
        subprocess.run([str(INKSCAPE), str(derived), "--export-background-opacity=0",
                        "--export-width=256", f"--export-filename={png}"], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        icons[name] = Image.open(png).convert("RGBA")

    heading, small, active_font, option_font = font(48, True), font(22), font(44, True), font(19, True)

    def base() -> Image.Image:
        image = Image.new("RGBA", (W, H), (*BG, 255))
        draw = ImageDraw.Draw(image)
        for text, y in (("WHAT MATTERS", 150), ("TO YOU?", 207)):
            draw.text(((W - heading.getlength(text)) / 2, y), text, font=heading, fill=FG)
        draw.line((225, 300, 315, 300), fill=ACCENT, width=3)
        return image

    def chip(image: Image.Image, name: str, x: float, y: float, radius: float, depth: float):
        layer = Image.new("RGBA", (W, H))
        draw = ImageDraw.Draw(layer)
        blend = max(0, (depth - .55) / .45)
        fill = tuple(round(FG[i] * (1 - blend) + ACCENT[i] * blend) for i in range(3))
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(*fill, 255))
        size = round(radius * 1.12)
        icon = icons[name].resize((size, size), Image.Resampling.LANCZOS)
        layer.alpha_composite(icon, (round(x - size / 2), round(y - size / 2)))
        image.alpha_composite(layer)

    plain = base()
    draw = ImageDraw.Draw(plain)
    for (label, name), x in zip(ITEMS, (95, 270, 445)):
        chip(plain, name, x, 485, 57, 0)
        draw.text((x - option_font.getlength(label) / 2, 570), label, font=option_font, fill=FG)
    draw.text(((W - small.getlength("THREE OPTIONS")) / 2, 700), "THREE OPTIONS", font=small, fill=ACCENT)

    frames, keyframes = [], []
    for index in range(N):
        t = index / FPS
        stage = min(3, int(t / 1.25))
        local = t - stage * 1.25
        p = 0 if stage == 3 else max(0, min(1, (local - .75) / .5))
        eased = p * p * (3 - 2 * p)
        rotation = -120 * (stage + eased)
        image = base()
        draw = ImageDraw.Draw(image)
        draw.ellipse((110, 400, 430, 560), outline=(50, 64, 72), width=2)
        states = []
        for item, (_, name) in enumerate(ITEMS):
            angle = math.radians((90 + item * 120 + rotation) % 360)
            depth = (math.sin(angle) + 1) / 2
            states.append({"item": item, "name": name, "x": 270 + 160 * math.cos(angle),
                           "y": 480 + 80 * math.sin(angle), "radius": 48 + 27 * depth, "depth": depth})
        for state in sorted(states, key=lambda s: s["depth"]):
            chip(image, state["name"], state["x"], state["y"], state["radius"], state["depth"])
        selected = stage % 3
        opacity = min(1, local / .12) if stage > 0 else 1
        if local > .65 and stage < 3:
            opacity = max(0, 1 - (local - .65) / .1)
        assert opacity == 0 or p == 0 or stage == 3
        assert all(0 <= s["x"] - s["radius"] < s["x"] + s["radius"] <= W
                   and 0 <= s["y"] - s["radius"] < s["y"] + s["radius"] <= H for s in states)
        label = ITEMS[selected][0]
        if opacity > 0:
            layer = Image.new("RGBA", (W, H))
            ImageDraw.Draw(layer).text(((W - active_font.getlength(label)) / 2, 675), label,
                                       font=active_font, fill=(*FG, round(255 * opacity)))
            image.alpha_composite(layer)
        draw = ImageDraw.Draw(image)
        for dot in range(3):
            x = 240 + dot * 30
            draw.ellipse((x - 4, 780, x + 4, 788), fill=ACCENT if dot == selected else (70, 82, 90))
        frames.append(image)
        keyframes.append({"frame": index, "time": t, "rotation": rotation, "selected": selected,
                          "label_opacity": opacity, "items": states})
    encode(OUT / "static-options.mp4", [plain] * N)
    encode(OUT / "orbital-options.mp4", frames)
    capture = cv2.VideoCapture(str(OUT / "orbital-options.mp4"))
    capture.set(cv2.CAP_PROP_POS_FRAMES, 36)
    ok, decoded = capture.read()
    capture.release()
    if not ok:
        raise RuntimeError("Encoded settled frame is missing")
    cv2.imwrite(str(OUT / "encoded-business.png"), decoded)
    assert np.array_equal(np.asarray(frames[0]), np.asarray(frames[-1]))
    (OUT / "motion-keyframes.json").write_text(json.dumps(keyframes, indent=2))
    (OUT / "evidence.json").write_text(json.dumps({
        "fps": FPS, "frames": N, "size": [W, H], "asset_commit": manifest["commit"],
        "circle_bounds_checked_all_frames": True, "labels_only_when_settled": True,
        "first_last_preencode_pixels_equal": True, "audio": "none",
    }, indent=2))
    picks = (0, 18, 24, 36, 48, 66, 78, 96, 107)
    contact = Image.new("RGB", (9 * 180, 2 * 320), BG)
    for col, frame_index in enumerate(picks):
        contact.paste(plain.convert("RGB").resize((180, 320)), (col * 180, 0))
        contact.paste(frames[frame_index].convert("RGB").resize((180, 320)), (col * 180, 320))
    contact.save(OUT / "phone-contact.jpg", quality=93)
    frames[36].save(OUT / "business-full-size.png")
    print(OUT)


if __name__ == "__main__":
    main()
