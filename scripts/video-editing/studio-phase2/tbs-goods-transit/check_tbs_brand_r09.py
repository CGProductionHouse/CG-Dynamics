"""Block a TBS Brokers render if any authored copy uses the prohibited short name."""
import importlib.util
import re
from pathlib import Path

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location("tbs_r06", HERE / "render_r06_private.py")
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

# This list is the copy actually authored by the selected R09 scene renders.
# Scene 03 and 09 replace the R06 artwork; never validate stale R06 copy.
lines = []
for key, _path, _start, _seconds, lead, accent, _style in mod.SCENES:
    if key == "03-tbs-sign":
        lines.extend(["LOCAL ADVICE", "FOR THE LOAD", "AHEAD", "KEVIN", "TBS BROKERS"])
    elif key == "09-seal":
        lines.extend(["ASK TBS BROKERS", "ABOUT YOUR COVER"])
    else:
        lines.extend([lead, accent])

caption = (Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
           / "review-package-r08" / "proposed-caption.txt").read_text(encoding="utf-8")
lines.append(caption)
bad = [line for line in lines if re.search(r"\bTBS\b(?!\s+BROKERS\b)", line, re.I)]
if bad:
    raise SystemExit(f"Client naming gate failed: {bad}")
assert any("TBS BROKERS" in s.upper() for s in lines)
print(f"PASS: {len(lines)} authored copy fields use TBS Brokers, never TBS alone")
