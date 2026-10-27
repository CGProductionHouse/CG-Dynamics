"""A gallery replacement must preserve every untouched JPEG and source hash."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageCms


SPEC = importlib.util.spec_from_file_location("assemble_gallery_revision", Path(__file__).with_name("assemble_gallery_revision.py"))
tool = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(tool)


class AssembleRevisionTest(unittest.TestCase):
    def test_replacement_is_hash_bound_and_idempotent(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            originals, base, candidates = (root / name for name in ("originals", "base", "candidates"))
            for folder in (originals, base, candidates):
                folder.mkdir()
            profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
            items = []
            for number in range(2):
                name = f"frame-{number}.jpg"
                source, output = originals / name, base / name
                Image.new("RGB", (32, 24), (50, 80, 90)).save(source, "JPEG", quality=95)
                Image.new("RGB", (32, 24), (55, 85, 95)).save(output, "JPEG", quality=92, icc_profile=profile)
                items.append({"key": f"frame:{number}", "file": name, "group": "Fight 01", "route": "original grade",
                              "source": str(source), "source_sha256": tool.sha256(source),
                              "output_sha256": tool.sha256(output), "dimensions": [32, 24]})
            replacement = candidates / "new.jpg"
            Image.new("RGB", (32, 24), (60, 75, 85)).save(replacement, "JPEG", quality=92, icc_profile=profile)
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"count": 2, "items": items}), encoding="utf-8")
            changes = root / "changes.json"
            changes.write_text(json.dumps({"replacements": [{"file": "frame-1.jpg", "path": str(replacement),
                               "route": "stage mono", "reason": "blue cast"}]}), encoding="utf-8")
            target = root / "revision"
            result = tool.assemble(manifest, base, changes, target)
            self.assertEqual(result["replaced"], 1)
            revised = json.loads((target / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(tool.sha256(target / "images" / "frame-0.jpg"), items[0]["output_sha256"])
            self.assertEqual(tool.sha256(target / "images" / "frame-1.jpg"), tool.sha256(replacement))
            self.assertEqual(revised["items"][1]["editorial_decision"], "REVIEW")
            self.assertEqual(revised["items"][1]["revision_reason"], "blue cast")
            with self.assertRaises(FileExistsError):
                tool.assemble(manifest, base, changes, target)


if __name__ == "__main__":
    unittest.main()
