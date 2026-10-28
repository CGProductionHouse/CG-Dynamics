"""Protected client correction: spell out TBS Brokers on the sign card only."""
from __future__ import annotations

import importlib.util
import json
import math
import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026")
PREVIOUS = ROOT / "work" / "equipment-v10"
OUT = ROOT / "work" / "equipment-v11"
REVIEW = ROOT / "review-package-equipment-v10" / "2026_11_TBS_VIDEO_01_EQUIPMENT_COVER_V10_REVIEW.mp4"
FONT = Path(r"C:\Windows\Fonts\bahnschrift.ttf")
FPS = 30


def run(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def frames(path: Path) -> int:
    return int(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames",
        "-show_entries", "stream=nb_read_frames", "-of", "default=nw=1:nk=1", str(path),
    ], text=True).strip())


def card(path: Path, kind: str) -> None:
    im = Image.new("RGBA", (1080, 1920))
    d = ImageDraw.Draw(im)
    if kind == "field":
        for y in range(150, 550):
            q = (y - 150) / 400
            alpha = round(218 * math.sin(math.pi * q) ** 1.4)
            d.line((0, y, 1080, y), fill=(15, 20, 15, alpha))
        d.rounded_rectangle((90, 215, 210, 222), radius=4, fill=(158, 175, 31, 255))
    else:
        words, y, initial, rgb = (
            ("CHECK WITH", 250, 84, (255, 255, 255)) if kind == "lead"
            else ("TBS BROKERS", 340, 122, (158, 175, 31))
        )
        size = initial
        font = ImageFont.truetype(str(FONT), size)
        while d.textbbox((0, 0), words, font=font)[2] > 900:
            size -= 2
            font = ImageFont.truetype(str(FONT), size)
        d.text((90, y), words, font=font, fill=(*rgb, 255), stroke_width=0)
    im.save(path)


def main() -> None:
    assert REVIEW.exists() and PREVIOUS.exists()
    OUT.mkdir(parents=True, exist_ok=True)
    ledger = json.loads((PREVIOUS / "source-ledger.json").read_text(encoding="utf-8"))
    for item in ledger:
        target = OUT / f"{item['name']}.mp4"
        if item["name"] != "10-broker":
            shutil.copy2(PREVIOUS / target.name, target)
        else:
            spec = importlib.util.spec_from_file_location("tbs_shot", Path(__file__).with_name("render.py"))
            module = importlib.util.module_from_spec(spec)
            assert spec.loader is not None
            spec.loader.exec_module(module)
            art = [OUT / f"10-broker-{x}.png" for x in ("field", "lead", "accent")]
            for image, kind in zip(art, ("field", "lead", "accent")):
                card(image, kind)
            duration = 68 / FPS
            module.shot(target, ROOT / "work" / "equipment-v5" / "09-sign-card-source.mp4",
                        0, duration, "scale=1080:1920:flags=lanczos",
                        [(art[0], .03, duration - .15),
                         (art[1], .08, duration - .15),
                         (art[2], .43, duration - .15)])
            item["lead"] = "CHECK WITH"
            item["accent"] = "TBS BROKERS"
        item["source"] = str(target)
    assert frames(OUT / "10-broker.mp4") == 68
    assert sum(frames(OUT / f"{x['name']}.mp4") for x in ledger) == 893
    (OUT / "source-ledger.json").write_text(json.dumps(ledger, indent=2), encoding="utf-8")
    (OUT / "concat.txt").write_text("".join(
        f"file '{(OUT / (x['name'] + '.mp4')).as_posix()}'\n" for x in ledger), encoding="utf-8")
    run("-f", "concat", "-safe", "0", "-i", OUT / "concat.txt",
        "-c", "copy", OUT / "picture.mp4")
    assert frames(OUT / "picture.mp4") == 893
    # Keep the previously delivered V10 soundtrack without re-encoding it.
    run("-i", OUT / "picture.mp4", "-i", REVIEW, "-map", "0:v:0", "-map", "1:a:0",
        "-c", "copy", "-map_metadata", "-1", "-map_chapters", "-1",
        "-movflags", "+faststart", OUT / "TBS_EQUIPMENT_PRIVATE_V11_MIX.mp4")
    assert frames(OUT / "TBS_EQUIPMENT_PRIVATE_V11_MIX.mp4") == 893
    print(OUT / "TBS_EQUIPMENT_PRIVATE_V11_MIX.mp4")


if __name__ == "__main__":
    main()
