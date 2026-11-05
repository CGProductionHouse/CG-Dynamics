"""Protected R14 EHP owner revision: remove sausage repeat, improve type and end in-store."""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\Ehrlich-Nov-2026")
FONT = ROOT / "brand" / "Anton-Regular.ttf"
SCRIPT_FONT = Path(r"C:\Windows\Fonts\BRUSHSCI.TTF")
STOCK = ROOT / "stock"
MAY = ROOT / "source" / "2026_05_MAY"
JULY = ROOT / "source" / "2026_07_JUL"
FEB = ROOT / "source" / "2026_02_FEB"
MARCH = ROOT / "source" / "2026_03_MAR"
BRAND = ROOT / "brand"
PAN = STOCK / "adobe-free-385373316.mov"

# All selected Ehrlich camera files were physically recorded portrait but saved
# as 3840x2160 landscape without rotation metadata. R12 failed to rotate them.
# The two cooking inserts are licensed illustration, never Ehrlich premises.
# Beat spacing follows Mixkit 1188's measured ~105.5 BPM grid; sound/music fit
# still needs normal-speed human listening before a client-facing release.
SHOTS = [
    ("saw", JULY / "199A1394.MP4", 4.30, 1.71, .50, "GOOD FOOD|starts here"),
    ("cut", MAY / "199A1365.MP4", 8.60, 1.14, .50, "CUT WITH CARE|by hand"),
    ("saw", JULY / "199A1394.MP4", 7.35, .94, .50, ""),
    ("display", JULY / "199A1386.MP4", 5.70, 1.14, .50, ""),
    ("steak", MAY / "199A1362.MP4", 0.30, 1.71, .50, "YOUR CUT|your way"),
    ("meat_case", MARCH / "0L8A4475.MP4", 0.18, .94, .50, ""),
    ("pan", PAN, 2.40, 1.51, .50, "BRING THE HEAT|to the table"),
    ("grill", STOCK / "coverr-meat-on-grill.mp4", 4.50, 1.71, .50, ""),
    ("store", FEB / "0L8A4456.MP4", 0.15, 1.14, .50, ""),
    ("steak", MAY / "199A1367.MP4", 2.10, 1.71, .50, ""),
    ("cut", MAY / "199A1365.MP4", 10.10, 1.14, .50, ""),
    ("store", FEB / "0L8A4459.MP4", 0.25, 1.71, .50, "EHRLICH PARK|Bloemfontein"),
]


def run(args: list[str]) -> None:
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL)


def cover(frame: np.ndarray, width: int, height: int) -> np.ndarray:
    h, w = frame.shape[:2]
    aspect = width / height
    if w / h > aspect:
        crop = round(h * aspect)
        frame = frame[:, (w-crop)//2:(w+crop)//2]
    else:
        crop = round(w / aspect)
        frame = frame[(h-crop)//2:(h+crop)//2, :]
    return cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)


def make_opening(path: Path, width: int, height: int) -> None:
    """One source-led rush, then registered panels and a bounded fire lens pulse.

    This is a client-specific application of the two 4 November local A/B
    mechanisms. All four inputs remain moving footage and share output time.
    """
    sources = {
        "fire": cv2.VideoCapture(str(STOCK / "mixkit-2780-fire-full-hd.mp4")),
        "saw": cv2.VideoCapture(str(JULY / "199A1394.MP4")),
        "grill": cv2.VideoCapture(str(STOCK / "coverr-meat-on-grill.mp4")),
        "steak": cv2.VideoCapture(str(MAY / "199A1367.MP4")),
    }
    def frame(key: str, time: float, w: int = width, h: int = height) -> np.ndarray:
        cap = sources[key]
        cap.set(cv2.CAP_PROP_POS_MSEC, time * 1000)
        ok, data = cap.read()
        if not ok:
            raise RuntimeError(f"opening source missing {key} at {time:.3f}s")
        if key in {"saw"}:
            data = cv2.rotate(data, cv2.ROTATE_90_COUNTERCLOCKWISE)
        return cover(data, w, h)

    pipe = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
         "-s", f"{width}x{height}", "-r", "30", "-i", "-", "-an",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
         "-pix_fmt", "yuv420p", str(path)], stdin=subprocess.PIPE)
    try:
        assert pipe.stdin
        for i in range(90):
            if i < 7:
                picture = frame("fire", 1.0 + i / 30)
            elif i < 17:
                picture = frame("saw", .65 + (i-7) / 30)
            elif i < 27:
                picture = frame("grill", 2.0 + (i-17) / 30)
            elif i < 37:
                picture = frame("steak", .25 + (i-27) / 30)
            elif i < 47:
                picture = np.zeros((height, width, 3), np.uint8)
                top = round(height * .60)
                half = width // 2
                picture[:top-4] = frame("saw", 2.0 + (i-37)/30, width, top-4)
                picture[top+4:, :half-3] = frame("grill", 3.8 + (i-37)/30, half-3, height-top-4)
                picture[top+4:, half+3:] = frame("steak", .75 + (i-37)/30, width-half-3, height-top-4)
                picture[top-4:top+4] = (40, 43, 198)
                picture[top+4:, half-3:half+3] = (40, 43, 198)
            elif i < 53:
                picture = frame("saw", 3.0 + (i-47)/30)
                flame = frame("fire", 4.2 + (i-47)/30)
                # Fire is a short light texture over an Ehrlich action, not a
                # disconnected full-frame stock insert.
                strength = max(0., 1. - abs(i-49.5)/3.5)
                scale = 1. + .10*strength
                enlarged = cv2.resize(picture, None, fx=scale, fy=scale)
                y = (enlarged.shape[0]-height)//2
                x = (enlarged.shape[1]-width)//2
                picture = enlarged[y:y+height, x:x+width].copy()
                if strength:
                    picture = cv2.addWeighted(picture, 1-.28*strength, flame, .28*strength, 0)
                    shift = round(3*strength)
                    picture[:,:,0] = np.roll(picture[:,:,0], shift, axis=1)
                    picture[:,:,2] = np.roll(picture[:,:,2], -shift, axis=1)
            else:
                picture = frame("saw", 3.2 + (i-53)/30)
            pipe.stdin.write(picture.tobytes())
        pipe.stdin.close()
        if pipe.wait():
            raise RuntimeError("opening encode failed")
    finally:
        for cap in sources.values():
            cap.release()


def make_heat_transition(path: Path, width: int, height: int) -> None:
    """Twelve-frame, source-aligned ember wipe from packed meat into heat.

    The edge tracks left to right. The Mixkit flame video modulates only that
    edge, while the two recognisable pictures remain the dominant layer.
    """
    shop = cv2.VideoCapture(str(JULY / "199A1386.MP4"))
    pan = cv2.VideoCapture(str(PAN))
    fire = cv2.VideoCapture(str(STOCK / "mixkit-2780-fire-full-hd.mp4"))
    pipe = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
         "-s", f"{width}x{height}", "-r", "30", "-i", "-", "-an",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-pix_fmt", "yuv420p", str(path)], stdin=subprocess.PIPE)
    def get(cap: cv2.VideoCapture, sec: float, rotate: bool = False) -> np.ndarray:
        cap.set(cv2.CAP_PROP_POS_MSEC, sec * 1000)
        ok, f = cap.read()
        if not ok:
            raise RuntimeError(f"heat transition source missing at {sec:.3f}")
        if rotate:
            f = cv2.rotate(f, cv2.ROTATE_90_COUNTERCLOCKWISE)
        return cover(f, width, height)
    try:
        assert pipe.stdin
        xx = np.arange(width, dtype=np.float32)[None, :] / width
        for i in range(12):
            a = get(shop, 16.74 + i/30, True).astype(np.float32)
            b = get(pan, 2.20 + i/30).astype(np.float32)
            flame = get(fire, 6.2 + i/30)
            heat = cv2.cvtColor(flame, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
            progress = (i + .5) / 12
            boundary = xx + .10*(heat-.5)
            mask = np.clip((progress-boundary)/.075 + .5, 0, 1)
            mask = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 2.0)
            edge = np.exp(-((progress-boundary)/.045)**2)[..., None]
            picture = a*(1-mask[..., None]) + b*mask[..., None]
            picture += edge*np.array([8, 52, 105], np.float32)[None, None, :]*.6
            pipe.stdin.write(np.clip(picture, 0, 255).astype(np.uint8).tobytes())
        pipe.stdin.close()
        if pipe.wait():
            raise RuntimeError("heat transition encode failed")
    finally:
        for cap in (shop, pan, fire):
            cap.release()


def make_flicker(path: Path, width: int, height: int) -> None:
    """Six-frame blade flicker at the saw-to-selection punctuation.

    It alternates the real blade image with restrained contrast and one warm
    light frame. The source motion continues through the effect; no frozen
    frame or unrelated stock appears.
    """
    cap = cv2.VideoCapture(str(JULY / "199A1394.MP4"))
    pipe = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
         "-s", f"{width}x{height}", "-r", "30", "-i", "-", "-an",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-pix_fmt", "yuv420p", str(path)], stdin=subprocess.PIPE)
    try:
        assert pipe.stdin
        for i in range(6):
            cap.set(cv2.CAP_PROP_POS_MSEC, (8.29 + i/30) * 1000)
            ok, raw = cap.read()
            if not ok:
                raise RuntimeError("saw flicker source missing")
            raw = cv2.rotate(raw, cv2.ROTATE_90_COUNTERCLOCKWISE)
            frame = cover(raw, width, height)
            if i in (1, 3):
                mono = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                frame = cv2.cvtColor(cv2.convertScaleAbs(mono, alpha=1.17, beta=-16), cv2.COLOR_GRAY2BGR)
            elif i == 2:
                frame = cv2.convertScaleAbs(frame, alpha=1.04, beta=30)
                frame[:, :, 2] = np.clip(frame[:, :, 2].astype(np.int16)+20, 0, 255).astype(np.uint8)
            pipe.stdin.write(frame.tobytes())
        pipe.stdin.close()
        if pipe.wait():
            raise RuntimeError("blade flicker encode failed")
    finally:
        cap.release()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    width, height = (540, 960) if args.preview else (1080, 1920)
    out = ROOT / ("EHRLICH-NOVEMBER-private-preview-r14.mp4" if args.preview else "EHRLICH-NOVEMBER-private-r14.mp4")
    work = ROOT / ("segments-preview-r14" if args.preview else "segments-final-r14")
    work.mkdir(exist_ok=True)
    opening = work / "opening.mp4"
    make_opening(opening, width, height)
    segments: list[Path] = [opening]
    for n, (kind, src, start, dur, xpos, title) in enumerate(SHOTS):
        if not src.exists():
            raise FileNotFoundError(src)
        segment = work / f"{n:02d}.mp4"
        rotate = "transpose=2," if kind in {"saw", "cut", "display", "store"} else ""
        vf = (f"{rotate}scale={width}:{height}:force_original_aspect_ratio=increase,"
              f"crop={width}:{height}:(in_w-out_w)*{xpos}:0,setsar=1,"
              f"fps=30,eq=contrast=1.075:saturation=.90,format=yuv420p")
        if title:
            # The client's recent Canva posts use bold condensed red/white
            # headlines with a smaller handwritten accent. Keep that existing
            # grammar, add an animated poster panel, and remove the R13 rule.
            headline, accent = title.split("|")
            left = n % 2 == 0
            target = f"{int(width*.10)}" if left else f"w-text_w-{int(width*.10)}"
            font_path = FONT.as_posix().replace(":", r"\:")
            script_path = SCRIPT_FONT.as_posix().replace(":", r"\:")
            vf += (f",drawbox=x=0:y={int(height*.49)}:w={width}:h={int(height*.24)}:"
                   "color=0x141212@0.68:t=fill:enable='gte(t,0.08)'"
                   f",drawbox=x={int(width*.075) if left else int(width*.91)}:"
                   f"y={int(height*.535)}:w={max(8,int(width*.012))}:h={int(height*.13)}:"
                   "color=0xC62B2D@1:t=fill:enable='gte(t,0.19)'")
            vf += (f",drawtext=fontfile='{font_path}':text='{headline}':"
                   f"fontsize={int(width*(.16 if len(headline)<12 else .115))}:"
                   f"fontcolor=0xE7312E:x='if(lt(t,0.15),-text_w,"
                   f"min({target},-text_w+(t-0.15)*w*6))':"
                   f"y={int(height*.54)}:alpha='min(1,max(0,t-0.12)*12)'"
                   f",drawtext=fontfile='{script_path}':text='{accent}':"
                   f"fontsize={int(width*.125)}:fontcolor=0xFFF8EE:"
                   f"x='{target}':y={int(height*.63)}:"
                   "alpha='min(1,max(0,t-0.35)*9)'")
        input_args = ["-ss", str(start), "-t", str(dur), "-i", str(src)]
        run(["ffmpeg", "-v", "error", "-y", *input_args,
             "-t", str(dur), "-an", "-vf", vf, "-c:v", "libx264", "-preset", "veryfast" if args.preview else "medium", "-crf", "24" if args.preview else "18", "-r", "30", str(segment)])
        segments.append(segment)
        if n == 2:
            flicker = work / "blade-flicker.mp4"
            make_flicker(flicker, width, height)
            segments.append(flicker)
        if n == 5:
            heat = work / "heat-transition.mp4"
            make_heat_transition(heat, width, height)
            segments.append(heat)
    # Only the official resolved-logo tail; original logo audio is discarded.
    logo = work / "logo.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-ss", "4.8", "-t", "2.50", "-i", str(BRAND / "Forged Titanium Intro_1080p.mp4"),
         "-an", "-vf", f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},fps=30,tpad=stop_mode=clone:stop_duration=0.70,format=yuv420p",
         "-c:v", "libx264", "-preset", "veryfast" if args.preview else "medium", "-crf", "24" if args.preview else "18", "-r", "30", str(logo)])
    segments.append(logo)
    concat = work / "concat.txt"
    concat.write_text("\n".join(f"file '{p.as_posix()}'" for p in segments), encoding="utf-8")
    silent = work / "picture.mp4"
    run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-c", "copy", str(silent)])
    # The official logo source contains 2.2 s of resolved tail, not the 2.5 s
    # requested above. Bind the sound fade to the encoded picture clock.
    duration = float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=duration", "-of", "default=nk=1:nw=1", str(silent)],
        text=True).strip())
    music = ROOT / "music" / "mixkit-1188-on-parole.mp3"
    fire = ROOT / "music" / "mixkit-1330-campfire-crackles.wav"
    whoosh = ROOT / "music" / "mixkit-1492-cinematic-whoosh.wav"
    sizzle = ROOT / "music" / "mixkit-frying-fish-on-a-hot-pan-123.wav"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(music), "-i", str(fire), "-i", str(whoosh), "-i", str(sizzle),
         "-filter_complex", (f"[1:a]atrim=0:{duration:.3f},asetpts=N/SR/TB,volume=0.57,"
                             f"afade=t=in:st=0:d=0.22,afade=t=out:st={duration-1.2:.3f}:d=1.2[m];"
                             "[2:a]atrim=0:0.80,asetpts=N/SR/TB,volume=0.10,"
                             "afade=t=in:st=0:d=0.10,afade=t=out:st=0.52:d=0.28[f];"
                             "[3:a]asplit=2[wf][wh];"
                             "[wf]atrim=0:1.33,asetpts=N/SR/TB,volume=0.09,"
                             "afade=t=out:st=1.13:d=0.20,adelay=5760|5760[w1];"
                             "[wh]atrim=0:1.33,asetpts=N/SR/TB,volume=0.12,"
                             "afade=t=out:st=1.13:d=0.20,adelay=9800|9800[w2];"
                             "[4:a]atrim=0:4.60,asetpts=N/SR/TB,volume=0.16,"
                             "afade=t=in:st=0:d=0.65,afade=t=out:st=3.85:d=0.75,"
                             "adelay=10580|10580[si];"
                             "[m][f][w1][w2][si]amix=inputs=5:normalize=0,"
                             "loudnorm=I=-15:TP=-1.5:LRA=8,alimiter=limit=0.89,volume=0.80[a]"),
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
         "-t", f"{duration:.6f}", "-movflags", "+faststart", str(out)])
    print(f"{out}\n{duration:.3f} seconds")


if __name__ == "__main__":
    main()
