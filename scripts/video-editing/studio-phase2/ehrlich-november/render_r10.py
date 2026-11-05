"""Protected R10 EHP chronological story test; no raw client media enters Git."""
from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\Ehrlich-Nov-2026")
FONT = ROOT / "brand" / "Anton-Regular.ttf"
STOCK = ROOT / "stock"
MAY = ROOT / "source" / "2026_05_MAY"
JULY = ROOT / "source" / "2026_07_JUL"
FEB = ROOT / "source" / "2026_02_FEB"
BRAND = ROOT / "brand"

# R10 follows Mixkit #281's measured 0.557s pulse after its 2.86s opening.
# Fire/grill/finished steak are illustrative stock; source/* is Ehrlich camera.
# Creative sound fit and complete public-use clearance still require review.
SHOTS = [
    # Sound-led sensory rush; the 0.76s saw image at the end gives the viewer a reset.
    ("fire", STOCK / "mixkit-2780-fire-full-hd.mp4", 1.00, .27, .50, ""),
    ("saw", JULY / "199A1394.MP4", .65, .33, .50, ""),
    ("grill", STOCK / "coverr-meat-on-grill.mp4", 2.00, .30, .50, ""),
    ("cut", MAY / "199A1367.MP4", 7.45, .30, .50, ""),
    ("fire", STOCK / "mixkit-2780-fire-full-hd.mp4", 3.70, .30, .50, ""),
    ("pack", JULY / "199A1387.MP4", 3.40, .30, .52, ""),
    ("saw", JULY / "199A1394.MP4", 2.10, .30, .50, ""),
    ("saw", JULY / "199A1394.MP4", 2.40, .76, .50, ""),
    ("saw", JULY / "199A1394.MP4", 4.30, 1.67, .50, "THE BRAAI\\nSTARTS HERE"),
    ("shop", FEB / "0L8A4456.MP4", .08, .56, .55, ""),
    ("cut", MAY / "199A1367.MP4", 5.55, 1.11, .50, "CUT BY HAND"),
    ("cut", MAY / "199A1365.MP4", 8.70, 1.12, .43, ""),
    ("pack", JULY / "199A1387.MP4", 4.30, 1.11, .52, "READY FOR FIRE"),
    ("pack", JULY / "199A1386.MP4", 14.05, 1.12, .53, ""),
    ("cut", MAY / "199A1362.MP4", 4.20, .55, .50, ""),
    ("fire", STOCK / "mixkit-2780-fire-full-hd.mp4", 8.00, 1.11, .50, ""),
    ("grill", STOCK / "mixkit-2774-steak-full-hd.mp4", 0.40, .99, .50, ""),
    ("grill", STOCK / "coverr-meat-on-grill.mp4", 4.50, 1.67, .50, "ON THE COALS"),
    ("grill", STOCK / "coverr-sausages-chicken-1396.mp4", 8.20, 1.60, .50, ""),
    ("grill", STOCK / "coverr-grilled-steak-8580.mp4", 4.20, 1.97, .50, ""),
    ("grill", STOCK / "coverr-cutting-steak-1062.mp4", 5.50, 1.65, .50, ""),
    ("grill", STOCK / "coverr-meat-on-grill.mp4", 9.70, 2.23, .50, "FIRE UP YOUR\\nNEXT BRAAI"),
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
        "knife": cv2.VideoCapture(str(MAY / "199A1367.MP4")),
    }
    def frame(key: str, time: float, w: int = width, h: int = height) -> np.ndarray:
        cap = sources[key]
        cap.set(cv2.CAP_PROP_POS_MSEC, time * 1000)
        ok, data = cap.read()
        if not ok:
            raise RuntimeError(f"opening source missing {key} at {time:.3f}s")
        return cover(data, w, h)

    pipe = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24",
         "-s", f"{width}x{height}", "-r", "30", "-i", "-", "-an",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
         "-pix_fmt", "yuv420p", str(path)], stdin=subprocess.PIPE)
    try:
        assert pipe.stdin
        for i in range(86):
            if i < 9:
                picture = frame("fire", 1.0 + i / 30)
            elif i < 18:
                picture = frame("saw", .65 + (i-9) / 30)
            elif i < 27:
                picture = frame("grill", 2.0 + (i-18) / 30)
            elif i < 36:
                picture = frame("knife", 7.45 + (i-27) / 30)
            elif i < 47:
                picture = np.zeros((height, width, 3), np.uint8)
                top = round(height * .60)
                half = width // 2
                picture[:top-4] = frame("saw", 2.0 + (i-36)/30, width, top-4)
                picture[top+4:, :half-3] = frame("fire", 3.8 + (i-36)/30, half-3, height-top-4)
                picture[top+4:, half+3:] = frame("knife", 5.9 + (i-36)/30, width-half-3, height-top-4)
                picture[top-4:top+4] = (40, 43, 198)
                picture[top+4:, half-3:half+3] = (40, 43, 198)
            elif i < 53:
                picture = frame("fire", 4.2 + (i-47)/30)
                # Small radial contraction and channel offset for the light pulse.
                strength = max(0., 1. - abs(i-49.5)/3.5)
                scale = 1. + .10*strength
                enlarged = cv2.resize(picture, None, fx=scale, fy=scale)
                y = (enlarged.shape[0]-height)//2
                x = (enlarged.shape[1]-width)//2
                picture = enlarged[y:y+height, x:x+width].copy()
                if strength:
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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    width, height = (540, 960) if args.preview else (1080, 1920)
    out = ROOT / ("EHRLICH-NOVEMBER-private-preview-r10.mp4" if args.preview else "EHRLICH-NOVEMBER-private-r10.mp4")
    work = ROOT / ("segments-preview-r10" if args.preview else "segments-final-r10")
    work.mkdir(exist_ok=True)
    opening = work / "opening.mp4"
    make_opening(opening, width, height)
    segments: list[Path] = [opening]
    for n, (kind, src, start, dur, xpos, title) in enumerate(SHOTS[8:], start=8):
        if not src.exists():
            raise FileNotFoundError(src)
        segment = work / f"{n:02d}.mp4"
        rotate = "transpose=2," if kind == "shop" else ""
        vf = (f"{rotate}scale={width}:{height}:force_original_aspect_ratio=increase,"
              f"crop={width}:{height}:(in_w-out_w)*{xpos}:0,setsar=1,"
              f"fps=30,eq=contrast=1.075:saturation=.90,format=yuv420p")
        if title:
            vf += (f",drawbox=x={int(width*.08)}:y={int(height*.72)}:"
                   f"w={int(width*.84)}:h={max(4,int(height*.004))}:color=0xC62B2D@.96:t=fill")
            lines = title.split("\\n")
            for j, line in enumerate(lines):
                color = "0xF5F3F0" if j == 0 else "0xB52B2B"
                y = int(height * (.53 + .085 * j))
                font_path = FONT.as_posix().replace(":", r"\:")
                vf += (f",drawtext=fontfile='{font_path}':text='{line}':"
                       f"fontsize={int(width * (.165 if len(line) < 13 else .124))}:"
                       f"fontcolor={color}:x=(w-text_w)/2:y='{y}+{int(height*.055)}*exp(-max(0,t-{j*.11})*11)':"
                       f"alpha='min(1,max(0,t-{j*.11})*9)'")
        run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(dur),
             "-i", str(src), "-an", "-vf", vf, "-c:v", "libx264", "-preset", "veryfast" if args.preview else "medium", "-crf", "24" if args.preview else "18", "-r", "30", str(segment)])
        segments.append(segment)
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
    music = ROOT / "music" / "mixkit-281-complicated.mp3"
    fire = ROOT / "music" / "mixkit-1330-campfire-crackles.wav"
    whoosh = ROOT / "music" / "mixkit-1492-cinematic-whoosh.wav"
    sizzle = ROOT / "music" / "mixkit-frying-fish-on-a-hot-pan-123.wav"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(silent), "-i", str(music), "-stream_loop", "1", "-i", str(fire), "-i", str(whoosh), "-i", str(sizzle),
         "-filter_complex", (f"[1:a]atrim=0:{duration:.3f},asetpts=N/SR/TB,"
                             f"volume='if(between(t,16.5,18.5),0.34,0.55)':eval=frame,afade=t=in:st=0:d=0.25,"
                             f"afade=t=out:st={duration-1.2:.3f}:d=1.2[m];"
                             f"[2:a]atrim=0:{duration:.3f},asetpts=N/SR/TB,"
                             f"volume='if(lt(t,1.8),0.18,if(between(t,13.0,20.5),0.12,if(gt(t,22),0.07,0.015)))':eval=frame,"
                             f"afade=t=out:st={duration-1.2:.3f}:d=1.2[s];"
                             f"[3:a]volume=0.18,adelay=710|710[w];"
                             f"[4:a]atrim=0:4,asetpts=N/SR/TB,volume=0.14,asplit=2[si1][si2];"
                             f"[si1]adelay=13400|13400[sl1];[si2]adelay=18100|18100[sl2];"
                             f"[m][s][w][sl1][sl2]amix=inputs=5:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=8,alimiter=limit=0.89,volume=0.80[a]"),
         "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
         "-t", f"{duration:.6f}", "-movflags", "+faststart", str(out)])
    print(f"{out}\n{duration:.3f} seconds")


if __name__ == "__main__":
    main()
