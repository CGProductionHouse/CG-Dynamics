"""Replace only the generic sign beat with Kevin's protected motion insert."""
from pathlib import Path
import subprocess

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
R06 = ROOT / "film-r06-private"
R07 = ROOT / "film-r07-private"
names = ["01-doors", "02-scan", "03-kevin-motion", "04-pallet", "05-driver",
         "06-road", "07-depot", "08-inventory", "09-seal", "10-local", "11-official-logo"]
parts = [R07 / f"{name}.mp4" if name == "03-kevin-motion" else R06 / f"{name}.mp4" for name in names]
assert all(p.exists() for p in parts)
listing = R07 / "concat.txt"
listing.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
target = R07 / "TBS_FESTIVE_TRANSIT_R07_PRIVATE_PICTURE.mp4"
subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "concat",
                "-safe", "0", "-i", str(listing), "-c", "copy", "-movflags", "+faststart",
                str(target)], check=True)
print(target)
