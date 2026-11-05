"""One-off PSG November V8 seasonal review render. Protected inputs."""
from __future__ import annotations

import hashlib
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

HERE = Path(__file__).resolve().parent.parent / "output" / "psg-872" / "v8"
OCT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\PSG-Oct-2026")
NOV = Path(r"C:\Users\chris\Videos\CG-AI-Editing\PSG-Nov-2026")
PRIVATE = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\PSG-Nov-V8")
FONT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Client-Libraries\PSG\brand\fonts\Montserrat-wght.ttf")
PHOTO = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\PSG-Nov-V7\headshot-screen\0L8A0422.JPG")
LOGO = NOV / "brand" / "PSG_Official_Landscape_Logo_Animation.mp4"
MUSIC = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\PSG-Nov-V6\Mixkit_77_Running_Out_of_Time.mp3")
SWOOSH = NOV / "audio" / "SFX_Flying_Swoosh_1469.wav"
TRACTOR = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\PSG-Nov-V6\Mixkit_1597_Tractors_Working_Field.wav")
W, H, FPS = 1080, 1920, 30
CYAN, MAGENTA, WHITE, CHARCOAL = (0, 173, 239), (212, 5, 93), (255, 255, 255), (54, 63, 68)


def run(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def font(size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONT), size)
    f.set_variation_by_name("Bold")
    return f


def put_centered(im: Image.Image, value: str, y: int, size: int, colour: tuple[int, int, int], width: int = 930) -> None:
    d = ImageDraw.Draw(im)
    while d.textbbox((0, 0), value, font=font(size))[2] > width:
        size -= 2
    f = font(size)
    box = d.textbbox((0, 0), value, font=f)
    x = round((W - (box[2] - box[0])) / 2) - box[0]
    baseline = y - box[1]
    d.text((x + 3, baseline + 4), value, font=f, fill=(0, 0, 0, 120))
    d.text((x, baseline), value, font=f, fill=(*colour, 255))


def branded_title(name: str, top: str, bottom: str, *, y: int = 1210, brackets: bool = False, layer: int = 1) -> Path:
    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    # Approved October treatment: feathered lower field, clean Montserrat,
    # coloured hairlines. No text stroke or invented brand colour.
    if layer == 1:
        for yy in range(790, H):
            phase = (yy - 790) / (H - 791)
            alpha = round(162 * math.sin(math.pi * phase) ** 1.2)
            if alpha:
                d.line((0, yy, W, yy), fill=(*CHARCOAL, alpha))
    if brackets and layer == 1:
        d.line((118, y - 100, 820, y - 100), fill=(*MAGENTA, 255), width=6)
        d.line((931, y - 100, 967, y - 100, 967, y - 42), fill=(*CYAN, 255), width=5)
        d.line((118, y + 180, 118, y + 230, 183, y + 230), fill=(*MAGENTA, 255), width=5)
        d.line((255, y + 230, 884, y + 230), fill=(*MAGENTA, 255), width=5)
    if layer == 1:
        put_centered(im, top, y, 89, WHITE)
    else:
        put_centered(im, bottom, y + 111, 96, CYAN)
    if not brackets and layer == 2:
        d.rounded_rectangle((473, y + 245, 607, y + 252), radius=3, fill=(*MAGENTA, 255))
    out = HERE / f"{name}-title-{layer}.png"
    im.save(out)
    return out


def crop_filter() -> str:
    return "fps=30,scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,setsar=1,eq=contrast=1.045:saturation=1.055"


def shot(name: str, source: Path, start: float, frames: int, top: str = "", bottom: str = "", *, brackets: bool = False, y: int = 1210) -> Path:
    assert source.exists(), source
    out = HERE / f"{name}.mp4"
    args: list[object] = ["-ss", start, "-i", source]
    graph = f"[0:v]{crop_filter()},format=yuv420p"
    if top:
        title1 = branded_title(name, top, bottom, y=y, brackets=brackets, layer=1)
        title2 = branded_title(name, top, bottom, y=y, brackets=brackets, layer=2)
        args += ["-loop", 1, "-framerate", FPS, "-i", title1,
                 "-loop", 1, "-framerate", FPS, "-i", title2]
        dur = frames / FPS
        graph += (
            "[base];[1:v]format=rgba,"
            "fade=t=in:st=0.02:d=0.14:alpha=1,"
            f"fade=t=out:st={dur-.24:.3f}:d=0.2:alpha=1[first];"
            "[base][first]overlay=x='if(lt(t,0.26),-115*pow(1-t/0.26,2),0)':y=0:eval=frame:shortest=1[mid];"
            "[2:v]format=rgba,fade=t=in:st=0.27:d=0.13:alpha=1,"
            f"fade=t=out:st={dur-.24:.3f}:d=0.2:alpha=1[second];"
            "[mid][second]overlay=x='if(lt(t,0.52),95*pow(1-t/0.52,2),0)':y=0:eval=frame:shortest=1,format=yuv420p[v]"
        )
    else:
        graph += "[v]"
    run(*args, "-filter_complex", graph, "-map", "[v]", "-frames:v", frames,
        "-an", "-r", FPS, "-c:v", "libx264", "-preset", "fast", "-crf", 19,
        "-pix_fmt", "yuv420p", out)
    return out


def opening(source: Path) -> Path:
    masks = HERE / "opening-masks"
    masks.mkdir(parents=True, exist_ok=True)
    for n in range(60):
        t = n / FPS
        u = max(0.0, min(1.0, (t - .42) / 1.0))
        eased = 1 - (1 - u) ** 3
        f = font(round(185 * (1 + 6.5 * eased)))
        mask = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(mask)
        x = (W - f.getlength("CROP")) / 2 - 40 * eased
        d.text((x, 785 - 200 * eased), "CROP", font=f, fill=255)
        if t > 1.27:
            mask = Image.blend(mask, Image.new("L", (W, H), 255), min(1.0, (t - 1.27) / .42))
        mask.save(masks / f"{n:04d}.png")
    out = HERE / "opening-crop-matte.mp4"
    graph = (
        f"[0:v]{crop_filter()},format=rgba[picture];"
        "[1:v]format=gray[alpha];[picture][alpha]alphamerge[aperture];"
        "color=c=0x363f44:s=1080x1920:r=30:d=2.0[back];"
        "[back][aperture]overlay=0:0:format=auto,format=yuv420p[v]"
    )
    run("-ss", .4, "-i", source, "-framerate", FPS, "-i", masks / "%04d.png",
        "-filter_complex", graph, "-map", "[v]", "-frames:v", 60,
        "-an", "-r", FPS, "-c:v", "libx264", "-preset", "fast", "-crf", 19,
        "-pix_fmt", "yuv420p", out)
    return out


def still(source: Path, at: float, name: str) -> Image.Image:
    dest = HERE / f"{name}.jpg"
    run("-ss", at, "-i", source, "-frames:v", 1, "-q:v", 2, dest)
    return Image.open(dest).convert("RGB")


def cover_crop(im: Image.Image, w: int, h: int) -> Image.Image:
    return ImageOps.fit(im, (w, h), method=Image.Resampling.LANCZOS)


def photo_wheel(source: Path, frames: int) -> Path:
    """Three real media windows orbit briefly beside a frame-anchored staff photo."""
    frames_dir = HERE / "wheel-frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    farm = still(OCT / "source" / "stock" / "pexels_37018575_wheat_hand.mp4", 1.5, "wheel-crop")
    sprayer = still(NOV / "source" / "adobe-stock" / "AdobeStock_603365266_4K.mov", 2.5, "wheel-sprayer")
    field = still(NOV / "source" / "psg-originals" / "pexels_8659244_corn_field.mp4", 2.4, "wheel-field")
    thumbs = [cover_crop(x, 268, 268) for x in (farm, sprayer, field)]
    adviser = cover_crop(ImageOps.exif_transpose(Image.open(PHOTO)).convert("RGB"), 566, 980)
    mask = Image.new("L", (268, 268), 0)
    ImageDraw.Draw(mask).ellipse((2, 2, 266, 266), fill=255)
    for n in range(frames):
        t = n / FPS
        im = Image.new("RGBA", (W, H))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle((0, 560, 1080, 1510), radius=0, fill=(28, 38, 44, 175))
        # The full portrait card touches both the right and bottom edges of the
        # graphic field; no isolated or floating person cutout.
        card_x = round(1080 - 566 + 45 * max(0, 1 - t / .32))
        im.paste(adviser, (card_x, 560))
        d = ImageDraw.Draw(im)
        d.line((card_x, 560, card_x, 1510), fill=(*CYAN, 255), width=7)
        d.line((0, 560, 1080, 560), fill=(*MAGENTA, 255), width=5)
        center = (292, 1020)
        for k, thumb in enumerate(thumbs):
            # A real rotating arrangement, with a gentle settle and visible
            # picture in each circle. It references TBS's motion idea only.
            theta = -1.25 + k * 2 * math.pi / 3 + 1.1 * (1 - min(1, t / 1.1)) ** 2 + .23 * t
            x = round(center[0] + 150 * math.cos(theta) - 134)
            yy = round(center[1] + 185 * math.sin(theta) - 134)
            im.paste(thumb, (x, yy), mask)
            d = ImageDraw.Draw(im)
            d.ellipse((x, yy, x + 268, yy + 268), outline=(*CYAN, 255) if k == 0 else (*MAGENTA, 255), width=8)
        d.arc((82, 810, 502, 1230), 20, 325, fill=(*WHITE, 205), width=3)
        # Upper and lower bands are inside social safe area; no fake icon kit.
        put_centered(im, "CROP COVER", 309 + round(70 * (1 - min(1, t / .45)) ** 2), 81, WHITE)
        if t >= .55:
            put_centered(im, "STARTS WITH A CONVERSATION",
                         1620 + round(75 * (1 - min(1, (t - .55) / .5)) ** 2), 53, CYAN)
        im.save(frames_dir / f"{n:04d}.png")
    out = HERE / "06-adviser-wheel.mp4"
    run("-ss", 1.4, "-i", source, "-framerate", FPS, "-i", frames_dir / "%04d.png",
        "-filter_complex", f"[0:v]{crop_filter()},format=yuv420p[base];[1:v]format=rgba[art];[base][art]overlay=0:0:shortest=1,format=yuv420p[v]",
        "-map", "[v]", "-frames:v", frames, "-an", "-r", FPS, "-c:v", "libx264", "-preset", "fast", "-crf", 19,
        "-pix_fmt", "yuv420p", out)
    return out


def outro() -> Path:
    contact = Image.new("RGBA", (W, H))
    put_centered(contact, "ASK ABOUT CROP INSURANCE", 1400, 49, WHITE)
    put_centered(contact, "051 813 9300", 1490, 81, WHITE)
    put_centered(contact, "PSG DONALD MURRAY", 1610, 38, CYAN)
    contact_path = HERE / "outro-contact.png"
    contact.save(contact_path)
    out = HERE / "12-official-logo.mp4"
    graph = (
        "[0:v]fps=30,split=2[b][f];"
        "[b]scale=1080:1920:flags=lanczos,gblur=sigma=75[bg];"
        "[f]scale=1640:923:flags=lanczos,crop=1080:923:280:0[fg];"
        "[bg][fg]overlay=0:400:shortest=1[x];"
        "[1:v]format=rgba,fade=t=in:st=2.25:d=0.4:alpha=1[type];"
        "[x][type]overlay=0:0:shortest=1,setsar=1,format=yuv420p[v]"
    )
    run("-i", LOGO, "-loop", 1, "-framerate", FPS, "-i", contact_path,
        "-filter_complex", graph, "-map", "[v]", "-frames:v", 165,
        "-an", "-r", FPS, "-c:v", "libx264", "-preset", "fast", "-crf", 19, "-pix_fmt", "yuv420p", out)
    return out


def main() -> None:
    HERE.mkdir(parents=True, exist_ok=True)
    PRIVATE.mkdir(parents=True, exist_ok=True)
    oct_stock = OCT / "source" / "stock"
    nov_stock = NOV / "source" / "adobe-stock"
    nov_original = NOV / "source" / "psg-originals"
    # Cumulative cut frames are tied to the measured 129.2 BPM grid of Mixkit 77.
    # A shot may span several beats; the boundary still resolves on a beat.
    # November's harvest/planting visuals are illustrative, not a 2026 weather claim.
    plan = [
        ("00-harvest-burst", oct_stock / "pexels_32873028_wheat_harvest.mp4", .5, 14, "", ""),
        ("01-planter-burst", nov_stock / "AdobeStock_1553691006_1080.mov", 2.0, 14, "", ""),
        ("02-water-burst", nov_stock / "AdobeStock_805555577_1080.mov", .8, 14, "", ""),
        ("03-harvest", nov_stock / "AdobeStock_796400703_1080.mov", 1.0, 55, "WINTER GRAIN", "COMES OFF"),
        ("04-planting", nov_stock / "AdobeStock_1553691006_1080.mov", 3.0, 55, "SUMMER CROPS", "GO IN"),
        ("05-plan", nov_stock / "AdobeStock_815213130.mov", 2.0, 55, "THIS NOVEMBER", "PLAN THE COVER"),
    ]
    segments: list[Path] = [opening(oct_stock / "pexels_37018575_wheat_hand.mp4")]
    ledger: list[dict] = [dict(name="opening-crop-matte", source=str(oct_stock / "pexels_37018575_wheat_hand.mp4"), start=.4, frames=60)]
    for name, src, start, frames, a, b in plan:
        segments.append(shot(name, src, start, frames, a, b, brackets=name == "03-harvest"))
        ledger.append(dict(name=name, source=str(src), start=start, frames=frames, copy=[a, b]))
    segments.append(photo_wheel(nov_stock / "AdobeStock_603365266_4K.mov", 98))
    ledger.append(dict(name="06-adviser-wheel", source=str(PHOTO), background=str(nov_stock / "AdobeStock_603365266_4K.mov"), frames=98))
    tail = [
        ("07-sprayer", nov_stock / "AdobeStock_603365266_4K.mov", 2.8, 55, "", ""),
        ("08-irrigation", nov_stock / "AdobeStock_805555577_1080.mov", 1.5, 56, "FIELDWORK", "KEEPS MOVING"),
        ("09-harvest-action", oct_stock / "pexels_32873028_wheat_harvest.mp4", 4.0, 55, "", ""),
        ("10-field-tractor", oct_stock / "pexels_26652765_tractor.mp4", 10.0, 56, "MAKE COVER", "PART OF THE PLAN"),
        ("11-farmer", nov_stock / "AdobeStock_210329647.mov", 1.0, 55, "", ""),
        ("12-contact", nov_stock / "AdobeStock_1553691006_1080.mov", 5.0, 82, "CALL PSG", "DONALD MURRAY"),
    ]
    for name, src, start, frames, a, b in tail:
        segments.append(shot(name, src, start, frames, a, b, brackets=name == "12-contact"))
        ledger.append(dict(name=name, source=str(src), start=start, frames=frames, copy=[a, b]))
    segments.append(outro())
    duration = sum(x["frames"] for x in ledger) / FPS + 5.5
    listing = HERE / "concat.txt"
    listing.write_text("".join(f"file '{p.as_posix()}'\n" for p in segments), encoding="utf-8")
    picture = HERE / "PSG-NOVEMBER-V8-PICTURE.mp4"
    run("-f", "concat", "-safe", 0, "-i", listing, "-c", "copy", picture)
    final = PRIVATE / "PSG-NOVEMBER-STUDIO-V8-REVIEW.mp4"
    # The exact music cue differs from the posted October and rejected 580.
    # The client logo animation is picture-only. Carry one continuous score
    # across it and fade at the final frame; no original logo audio.
    logo_at = duration - 5.5
    graph = (
        f"[1:a]atrim=start=4.5:duration={duration:.3f},asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d=0.16,afade=t=out:st={duration-1.0:.3f}:d=0.95,"
        "volume=0.72[music];"
        "[2:a]atrim=start=0:duration=0.55,asetpts=PTS-STARTPTS,volume=0.075,"
        "afade=t=in:st=0:d=0.03,afade=t=out:st=0.4:d=0.15,adelay=1170|1170[reveal];"
        "[2:a]atrim=start=0:duration=0.55,asetpts=PTS-STARTPTS,volume=0.065,"
        "afade=t=in:st=0:d=0.03,afade=t=out:st=0.4:d=0.15,adelay=8900|8900[wheel];"
        "[3:a]atrim=start=4:duration=0.7,asetpts=PTS-STARTPTS,volume=0.10,"
        "afade=t=in:st=0:d=0.06,afade=t=out:st=0.48:d=0.2,adelay=2467|2467[tractor1];"
        "[3:a]atrim=start=8:duration=1.65,asetpts=PTS-STARTPTS,volume=0.09,"
        "afade=t=in:st=0:d=0.12,afade=t=out:st=1.25:d=0.35,adelay=5233|5233[tractor2];"
        "[3:a]atrim=start=11:duration=1.8,asetpts=PTS-STARTPTS,volume=0.07,"
        "afade=t=in:st=0:d=0.12,afade=t=out:st=1.35:d=0.4,adelay=21400|21400[tractor3];"
        "[music][reveal][wheel][tractor1][tractor2][tractor3]amix=inputs=6:duration=longest:normalize=0,"
        "alimiter=limit=0.88,loudnorm=I=-16:TP=-1.5:LRA=8,aresample=48000[a]"
    )
    run("-i", picture, "-i", MUSIC, "-i", SWOOSH, "-i", TRACTOR,
        "-filter_complex", graph, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac",
        "-b:a", "256k", "-t", duration, "-movflags", "+faststart", final)
    receipt = dict(output=str(final), sha256=hashlib.sha256(final.read_bytes()).hexdigest(), duration=duration,
                   shots=ledger, outro=str(LOGO), music=dict(source=str(MUSIC), in_point=4.5,
                   license="Mixkit Stock Music Free License", evidence="https://mixkit.co/license/modal/musicFree/"),
                   sfx=[dict(source=str(SWOOSH), license="Mixkit Sound Effects Free License", positions=[1.17, 8.9]),
                        dict(source=str(TRACTOR), license="Mixkit Sound Effects Free License", positions=[2.467, 5.233, 21.4])],
                   beat_grid=dict(tempo_bpm=129.199, analysed_music_in=4.5,
                                  cut_frames=[60,74,88,102,157,212,267,365,420,476,531,587,642,724],
                                  note="Boundaries quantized to the detected music beat or a skipped beat; onset detector requires perceptual confirmation"),
                   logo_audio="excluded by owner instruction; score continues over logo animation",
                   status="internal revision; picture/sound editorial review required; no client approval")
    (PRIVATE / "receipt.json").write_text(json.dumps(receipt, indent=2), encoding="utf-8")
    print(json.dumps(dict(output=str(final), sha256=receipt["sha256"], duration=duration)))


if __name__ == "__main__":
    main()
