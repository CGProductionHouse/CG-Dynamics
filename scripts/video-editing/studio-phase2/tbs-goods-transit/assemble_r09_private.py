"""Assemble protected R09 with grounded Kevin panel and corrected client name."""
from pathlib import Path
import subprocess

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
R06, R08, R09 = (ROOT / f"film-r{i:02d}-private" for i in (6, 8, 9))
subprocess.run(["python", str(Path(__file__).with_name("check_tbs_brand_r09.py"))], check=True)
names = ["01-doors", "02-scan", "03-kevin-panel", "04-pallet", "05-driver",
         "06-road", "07-depot", "08-inventory", "09-seal", "10-local", "11-official-logo"]
use08 = {"02-scan", "04-pallet", "06-road", "07-depot"}
use09 = {"03-kevin-panel", "09-seal"}
parts = [(R09 if n in use09 else R08 if n in use08 else R06) / f"{n}.mp4" for n in names]
assert all(p.exists() for p in parts), [str(p) for p in parts if not p.exists()]
R09.mkdir(exist_ok=True)
listing = R09 / "concat.txt"
listing.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
picture = R09 / "TBS_FESTIVE_TRANSIT_R09_PRIVATE_PICTURE.mp4"
final = R09 / "TBS_FESTIVE_TRANSIT_R09_PRIVATE_MIX.mp4"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat",
                "-safe", "0", "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(picture)], check=True)
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(picture),
                "-i", str(R08 / "TBS_FESTIVE_TRANSIT_R08_PRIVATE_MIX.mp4"),
                "-map", "0:v:0", "-map", "1:a:0", "-c", "copy", "-shortest", "-movflags", "+faststart", str(final)], check=True)
print(final)
