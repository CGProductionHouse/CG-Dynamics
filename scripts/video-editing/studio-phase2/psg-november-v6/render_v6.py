"""Protected November PSG recut; one-off assembly, not a reusable engine."""
from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent.parent / "output" / "psg-872" / "v6"
ROOT = HERE.parent
OCT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\PSG-Oct-2026")
NOV = Path(r"C:\Users\chris\Videos\CG-AI-Editing\PSG-Nov-2026")
PRIVATE = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\PSG-Nov-V6")
FONT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Client-Libraries\PSG\brand\fonts\Montserrat-wght.ttf")
LOGO = NOV / "brand" / "PSG_Official_Landscape_Logo_Animation.mp4"
MUSIC = PRIVATE / "Mixkit_13_Summer_Fun.mp3"
TRACTOR = PRIVATE / "Mixkit_1597_Tractors_Working_Field.wav"
WIND = PRIVATE / "Mixkit_2658_Wind_Blowing_Ambience.wav"
W, H, FPS = 1080, 1920, 30
CYAN = (30, 184, 226)
WHITE = (255, 255, 255)
CHARCOAL = (6, 13, 19)


def run(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def font(size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_name("Bold")
    return f


def title_png(name: str, line1: str, line2: str, *, y: int = 1020) -> Path:
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for text, yy, size, colour in ((line1, y, 97, WHITE), (line2, y + 125, 83, CYAN)):
        if not text:
            continue
        while d.textlength(text, font=font(size)) > 920:
            size -= 2
        d.text((80, yy), text, font=font(size), fill=(*colour, 255),
               stroke_width=3, stroke_fill=(0, 11, 18, 230))
    path = HERE / f"{name}-type.png"
    im.save(path)
    return path


def crop_filter(*, rotate: bool = False, staff: bool = False, brightness: float = 0) -> str:
    turns = "transpose=2," if rotate else ""
    scale = ("scale=3240:5760:flags=lanczos,crop=1080:1920:1080:1650" if staff else
             "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920")
    return f"{turns}fps=30,{scale},setsar=1,eq=contrast=1.04:saturation=1.04:brightness={brightness}"


def opening(source: Path) -> Path:
    masks = HERE / "matte-frames"
    masks.mkdir(parents=True, exist_ok=True)
    label = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(label)
    word = "INSURANCE"
    size = 100
    x = round((W - ld.textlength(word, font=font(size))) / 2)
    ld.text((x, 1080), word, font=font(size), fill=(*WHITE, 255))
    label_path = HERE / "opening-insurance.png"
    label.save(label_path)

    for frame in range(90):
        t = frame / FPS
        u = max(0.0, min(1.0, (t - 1.05) / 1.62))
        eased = 1 - (1-u)**3
        size = round(230 * (1 + 6 * eased))
        f = font(size)
        m = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(m)
        # The R's solid stem becomes the visual doorway to full-frame footage.
        base_x = (W - f.getlength("CROP")) / 2
        x = base_x - 45 * eased
        y = 790 - 210 * eased
        d.text((x, y), "CROP", font=f, fill=255)
        if t > 1.90:
            amount = min(1.0, (t - 1.90) / 0.72)
            m = Image.blend(m, Image.new("L", (W, H), 255), amount)
        m.save(masks / f"{frame:04d}.png")

    out = HERE / "00-matte.mp4"
    graph = (
        f"[0:v]{crop_filter()},format=rgba[picture];"
        "[1:v]format=gray[alpha];[picture][alpha]alphamerge[aperture];"
        "color=c=0x060d13:s=1080x1920:r=30:d=3[back];"
        "[back][aperture]overlay=0:0:format=auto[base];"
        "[2:v]format=rgba,fade=t=in:st=0.26:d=0.22:alpha=1,"
            "fade=t=out:st=1.48:d=0.42:alpha=1[label];"
        "[base][label]overlay=0:0:shortest=1,format=yuv420p[v]"
    )
    run("-ss", 0.3, "-i", source,
        "-framerate", 30, "-i", masks / "%04d.png",
        "-loop", 1, "-framerate", 30, "-i", label_path,
        "-filter_complex", graph, "-map", "[v]", "-frames:v", 90,
        "-an", "-r", 30, "-c:v", "libx264", "-preset", "fast", "-crf", 19,
        "-pix_fmt", "yuv420p", out)
    return out


def shot(name: str, source: Path, start: float, frames: int,
         line1: str = "", line2: str = "", *, rotate: bool = False,
         staff: bool = False, brightness: float = 0, title_y: int = 1020) -> Path:
    out = HERE / f"{name}.mp4"
    graph = f"[0:v]{crop_filter(rotate=rotate, staff=staff, brightness=brightness)},format=yuv420p"
    inputs: list[object] = ["-ss", start, "-i", source]
    if line1 or line2:
        png = title_png(name, line1, line2, y=title_y)
        inputs += ["-loop", 1, "-framerate", 30, "-i", png]
        duration = frames / FPS
        graph += (
            "[base];[1:v]format=rgba,"
            "fade=t=in:st=0.10:d=0.16:alpha=1,"
            f"fade=t=out:st={max(0.4,duration-0.29):.3f}:d=0.20:alpha=1[type];"
            "[base][type]overlay=x='if(lt(t,0.30),-62*(1-t/0.30),0)':"
            "y=0:eval=frame:shortest=1,format=yuv420p[v]"
        )
        map_name = "[v]"
    else:
        graph += "[v]"
        map_name = "[v]"
    run(*inputs, "-filter_complex", graph, "-map", map_name,
        "-frames:v", frames, "-an", "-r", 30, "-c:v", "libx264",
        "-preset", "fast", "-crf", 20, "-pix_fmt", "yuv420p", out)
    return out


def outro() -> Path:
    # Portrait adaptation preserves the client's official animated landscape mark.
    mask = Image.new("L", (W, 923), 0)
    pix = mask.load()
    for y in range(923):
        a = min(255, round(255 * min(y, 922-y) / 90))
        for x in range(W):
            pix[x, y] = a
    mask_path = HERE / "outro-feather.png"
    mask.save(mask_path)
    contact = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(contact)
    for line, y, size in (("ASK ABOUT CROP INSURANCE", 1390, 49),
                          ("051 813 9300", 1484, 79),
                          ("PSG DONALD MURRAY", 1600, 36)):
        f = font(size)
        d.text(((W-d.textlength(line, font=f))/2, y), line, font=f, fill=(*WHITE, 255))
    contact_path = HERE / "outro-contact.png"
    contact.save(contact_path)
    out = HERE / "13-outro.mp4"
    graph = (
        "[0:v]fps=30,split=2[b][f];"
        "[b]scale=1080:1920:flags=lanczos,gblur=sigma=75[bg];"
        "[f]scale=1640:923:flags=lanczos,crop=1080:923:280:0,format=rgb24[fg];"
        "[1:v]format=gray[alpha];[fg][alpha]alphamerge[front];"
        "[bg][front]overlay=0:400:shortest=1[x];"
        "[2:v]format=rgba,fade=t=in:st=2.7:d=0.48:alpha=1[contact];"
        "[x][contact]overlay=0:0:shortest=1,setsar=1,format=yuv420p[v]"
    )
    run("-i", LOGO, "-loop", 1, "-framerate", 30, "-i", mask_path,
        "-loop", 1, "-framerate", 30, "-i", contact_path,
        "-filter_complex", graph, "-map", "[v]", "-frames:v", 180,
        "-an", "-r", 30, "-c:v", "libx264", "-preset", "fast", "-crf", 20,
        "-pix_fmt", "yuv420p", out)
    return out


def main() -> None:
    HERE.mkdir(parents=True, exist_ok=True)
    PRIVATE.mkdir(parents=True, exist_ok=True)
    oct_stock = OCT / "source" / "stock"
    nov_stock = NOV / "source" / "adobe-stock"
    nov_originals = NOV / "source" / "psg-originals"
    shots = [
        ("01-tractor", oct_stock / "pexels_26652765_tractor.mp4", 10.0, 45, "", "", False, False, 0.0, 1020),
        ("02-harvest", nov_stock / "AdobeStock_796400703_1080.mov", 1.0, 39, "", "", False, False, 0.0, 1020),
        ("03-sprayer", nov_stock / "AdobeStock_603365266_4K.mov", 2.0, 45, "", "", False, False, 0.0, 1020),
        ("04-corn", nov_originals / "pexels_8659244_corn_field.mp4", 1.0, 51, "", "", False, False, 0.0, 1020),
        ("05-weather", nov_stock / "AdobeStock_518406931_1080.mov", 5.8, 69, "BEFORE THE RUSH", "TALK CROP COVER", False, False, 0.0, 970),
        ("06-farmer", nov_stock / "AdobeStock_210329647.mov", 0.5, 54, "", "", False, False, 0.0, 1020),
        ("07-soil", nov_stock / "AdobeStock_566524463_1080.mov", 1.0, 42, "", "", False, False, 0.0, 1020),
        ("08-harvester", nov_originals / "pexels_32873028_wheat_harvest.mp4", 0.3, 51, "", "", False, False, 0.0, 1020),
        ("09-psg", ROOT / "older-screen" / "0L8A1826.MP4", 0.2, 42, "PSG", "DONALD MURRAY", True, True, 0.08, 1250),
        ("09b-psg-smile", ROOT / "library-0L8A1828.MP4", 16.6, 24, "PSG", "DONALD MURRAY", True, False, 0.03, 1250),
        ("11-sunset", nov_stock / "AdobeStock_710929741.mov", 2.0, 69, "", "", False, False, 0.0, 1020),
        ("12-hand", nov_stock / "AdobeStock_815213130.mov", 2.6, 69, "START THE", "CONVERSATION", False, False, 0.0, 1040),
    ]
    assert sum(s[3] for s in shots) == 600
    segments = [opening(oct_stock / "pexels_37018575_wheat_hand.mp4")]
    for name, source, start, frames, first, second, rotate, staff, bright, y in shots:
        segments.append(shot(name, source, start, frames, first, second,
                             rotate=rotate, staff=staff, brightness=bright, title_y=y))
    segments.append(outro())
    concat = HERE / "concat.txt"
    concat.write_text("".join(f"file '{p.as_posix()}'\n" for p in segments), encoding="utf-8")
    picture = HERE / "PSG-NOVEMBER-V6-PICTURE.mp4"
    run("-f", "concat", "-safe", 0, "-i", concat, "-c", "copy", picture)
    # New music is a licensed, previously unused cue. Its final excerpt still needs exact-export audition.
    final = PRIVATE / "PSG-NOVEMBER-STUDIO-V6-REVIEW.mp4"
    sound_graph = (
        "[1:a]atrim=start=0.4:duration=29,asetpts=PTS-STARTPTS,"
        "afade=t=in:st=0:d=0.35,afade=t=out:st=22.1:d=1.2,"
        "volume='0.78-0.23*exp(-pow((t-10.15)/0.94,2))':eval=frame[music];"
        "[2:a]atrim=start=5:duration=1.5,asetpts=PTS-STARTPTS,"
        "highpass=f=80,lowpass=f=3000,volume=0.09,"
        "afade=t=in:st=0:d=0.12,afade=t=out:st=1.22:d=0.25,"
        "adelay=3000|3000[engine];"
        "[3:a]atrim=start=5:duration=2.3,asetpts=PTS-STARTPTS,"
        "volume=0.10,afade=t=in:st=0:d=0.5,"
        "afade=t=out:st=1.9:d=0.4,adelay=9000|9000[weather];"
        "[4:a]atrim=start=0:duration=6,asetpts=PTS-STARTPTS,"
        "volume=0.44,afade=t=in:st=0:d=0.3,adelay=23000|23000[logo];"
        "[music][engine][weather][logo]amix=inputs=4:duration=longest:normalize=0,"
        "alimiter=limit=0.88,loudnorm=I=-16:TP=-1.5:LRA=8,aresample=48000[a]"
    )
    run("-i", picture, "-i", MUSIC, "-i", TRACTOR, "-i", WIND, "-i", LOGO,
        "-filter_complex", sound_graph,
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac",
        "-b:a", "256k", "-t", "29", "-movflags", "+faststart", final)
    receipt = {
        "output": str(final), "sha256": hashlib.sha256(final.read_bytes()).hexdigest(),
        "shots": [{"name": "00-matte", "source": str(oct_stock / "pexels_37018575_wheat_hand.mp4"), "in": .3, "frames": 90}]
                 + [{"name": n, "source": str(s), "in": t, "frames": f, "copy": [a, b]}
                    for n, s, t, f, a, b, *_ in shots],
        "outro": str(LOGO),
        "music": {"source": str(MUSIC), "in": 0, "license": "Mixkit Stock Music Free License", "track_url": "https://mixkit.co/free-stock-music/mood/friendly/"},
        "sound_design": [
            {"source": str(TRACTOR), "id": 1597, "entry": 3.0, "license": "Mixkit Sound Effects Free License"},
            {"source": str(WIND), "id": 2658, "entry": 9.0, "license": "Mixkit Sound Effects Free License"},
            {"source": str(LOGO), "entry": 23.0, "note": "original PSG logo-animation audio"},
        ],
        "status": "internal review candidate; no public/client approval; no human audio or phone review yet",
    }
    (PRIVATE / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(final), "sha256": receipt["sha256"]}))


if __name__ == "__main__":
    main()
