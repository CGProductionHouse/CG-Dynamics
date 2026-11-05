"""Protected TBS V10 correction: keep the adviser's complete final words."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\TBS-Nov-2026")
PREVIOUS = ROOT / "work" / "equipment-v9"
OUT = ROOT / "work" / "equipment-v10"
OUT.mkdir(parents=True, exist_ok=True)
FPS = 30


def run(*args: object) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *map(str, args)], check=True)


def count_frames(path: Path) -> int:
    return int(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-count_frames",
        "-show_entries", "stream=nb_read_frames", "-of", "default=nw=1:nk=1", str(path),
    ], text=True).strip())


def main() -> None:
    ledger = json.loads((PREVIOUS / "source-ledger.json").read_text(encoding="utf-8"))
    for item in ledger:
        name = item["name"]
        target = OUT / f"{name}.mp4"
        if name != "11-adviser":
            shutil.copy2(PREVIOUS / f"{name}.mp4", target)
        else:
            # Same source and frame transform as V9; its 112-frame window
            # ended before the 4.02-second denoised voice had finished.
            run("-i", ROOT / "work" / "tbs-advisor-cta-original-sound-v1.mp4",
                "-vf", "fps=30,scale=1080:1920,eq=contrast=1.04:saturation=1.04,format=yuv420p",
                "-an", "-frames:v", 120, "-r", FPS,
                "-c:v", "libx264", "-preset", "fast", "-crf", 18, target)
            item["duration"] = 4.0
            item["picture_components"][0]["frames"] = 120
            item["picture_components"][0]["note"] = (
                "Visible source extended eight frames to retain the final TBS Brokers words; "
                "public July picture/audio overlap still needs independent clearance."
            )
        item["source"] = str(target)
    assert count_frames(OUT / "11-adviser.mp4") == 120
    total = sum(count_frames(OUT / f"{x['name']}.mp4") for x in ledger)
    assert total == 893, total
    cursor = 0
    for item in ledger:
        item["timeline_in"] = round(cursor / FPS, 3)
        item["duration"] = count_frames(OUT / f"{item['name']}.mp4") / FPS
        cursor += count_frames(OUT / f"{item['name']}.mp4")
    (OUT / "source-ledger.json").write_text(json.dumps(ledger, indent=2), encoding="utf-8")
    (OUT / "concat.txt").write_text("".join(
        f"file '{(OUT / (x['name'] + '.mp4')).as_posix()}'\n" for x in ledger
    ), encoding="utf-8")
    run("-f", "concat", "-safe", "0", "-i", OUT / "concat.txt", "-c", "copy", OUT / "picture.mp4")
    assert count_frames(OUT / "picture.mp4") == 893
    voice = PREVIOUS / "voice-rnnoise-75.wav"
    duration = total / FPS
    voice_at = next(x["timeline_in"] for x in ledger if x["name"] == "11-adviser")
    starts = {x["name"]: x["timeline_in"] for x in ledger}
    music = ROOT / "restart-source" / "mixkit-curiosity-480.mp3"
    typing = ROOT / "restart-source" / "mixkit-keyboard-typing-1386.wav"
    click = ROOT / "restart-source" / "mixkit-interface-click-2577.wav"
    slide = ROOT / "restart-source" / "mixkit-transition-slide-3120.wav"
    pocket_start, pocket_end = voice_at - .55, voice_at + 4.1
    list_at, typing_at, sign_at = starts["09-list"], starts["06-upgraded"], starts["10-broker"]
    graph = (
        f"[1:a]atrim=start=0.25:end={duration+.25:.5f},asetpts=PTS-STARTPTS,volume=0.40,"
        f"volume='1-0.68*clip((t-{pocket_start:.4f})/0.30\\,0\\,1)*clip(({pocket_end:.4f}-t)/0.30\\,0\\,1)':eval=frame,"
        f"afade=t=in:st=0:d=0.15,afade=t=out:st={duration-1.05:.4f}:d=1.0[m];"
        # Keep all 4.02 s; the last 20 ms can carry the natural voice tail
        # just into the picture-only logo while the music continues.
        f"[2:a]atrim=start=0:end=4.02,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.10,"
        f"afade=t=out:st=3.97:d=0.05,volume=0.90,adelay={round(voice_at*1000)}:all=1[v];"
        f"[3:a]atrim=0:1.50,asetpts=PTS-STARTPTS,volume=0.055,adelay={round(typing_at*1000)}:all=1[type];"
        "[4:a]asplit=6[c1][c2][c3][h1][h2][h3];"
        f"[c1]atrim=0:0.12,asetpts=PTS-STARTPTS,afade=t=out:st=0.06:d=0.06,volume=0.55,adelay={round((list_at+.80)*1000)}:all=1[click1];"
        f"[c2]atrim=0:0.12,asetpts=PTS-STARTPTS,afade=t=out:st=0.06:d=0.06,volume=0.55,adelay={round((list_at+1.55)*1000)}:all=1[click2];"
        f"[c3]atrim=0:0.12,asetpts=PTS-STARTPTS,afade=t=out:st=0.06:d=0.06,volume=0.55,adelay={round((list_at+2.30)*1000)}:all=1[click3];"
        "[h1]atrim=0:0.22,asetpts=PTS-STARTPTS,volume=0.035,adelay=20:all=1[hook1];"
        "[h2]atrim=0:0.22,asetpts=PTS-STARTPTS,volume=0.035,adelay=950:all=1[hook2];"
        "[h3]atrim=0:0.22,asetpts=PTS-STARTPTS,volume=0.035,adelay=1700:all=1[hook3];"
        f"[5:a]atrim=0:1.20,asetpts=PTS-STARTPTS,volume=0.085,adelay={round((sign_at-.15)*1000)}:all=1[slide];"
        "[m][v][type][click1][click2][click3][hook1][hook2][hook3][slide]"
        f"amix=inputs=10:duration=longest:normalize=0,atrim=0:{duration:.5f},"
        "alimiter=limit=0.78:level=0,aresample=48000[a]"
    )
    result = OUT / "TBS_EQUIPMENT_PRIVATE_V10_MIX.mp4"
    run("-i", OUT / "picture.mp4", "-i", music, "-i", voice, "-i", typing,
        "-i", click, "-i", slide, "-filter_complex", graph,
        "-map", "0:v:0", "-map", "[a]", "-dn", "-sn", "-map_metadata", "-1",
        "-map_chapters", "-1", "-vf", "scale=in_range=auto:out_range=tv:out_color_matrix=bt709,format=yuv420p",
        "-c:v", "libx264", "-preset", "medium", "-crf", 18,
        "-color_range", "tv", "-colorspace", "bt709", "-color_trc", "bt709",
        "-color_primaries", "bt709", "-c:a", "aac", "-b:a", "256k",
        "-t", f"{duration:.5f}", "-movflags", "+faststart", result)
    print(json.dumps({"result": str(result), "frames": total, "duration": duration,
                      "voice_at": voice_at, "voice_length": 4.02}))


if __name__ == "__main__":
    main()
