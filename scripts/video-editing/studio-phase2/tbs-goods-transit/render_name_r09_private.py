"""Repair the client-prohibited standalone TBS wording on the CTA scene."""
from pathlib import Path
import importlib.util

ROOT = Path(r"C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\TBS-Nov-2026-Goods-Transit")
R09 = ROOT / "film-r09-private"
R09.mkdir(exist_ok=True)
module_path = Path(__file__).with_name("render_r06_private.py")
spec = importlib.util.spec_from_file_location("tbs_r06_renderer", module_path)
assert spec is not None and spec.loader is not None
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
mod.OUT = R09
target = mod.render_scene("09-seal", ROOT / "source" / "pixabay-8686-box-taper.mp4",
                          1.00, 2.50, "ASK TBS BROKERS", "ABOUT YOUR COVER", "lift")
print(target)
