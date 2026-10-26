"""Safety checks for the private event review sheet builder."""

import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image


MODULE_PATH = Path(__file__).with_name("event_quality_review.py")
SPEC = importlib.util.spec_from_file_location("event_quality_review", MODULE_PATH)
review = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(review)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class EventQualityReviewTest(unittest.TestCase):
    def test_full_scene_and_crop_sheet_preserves_source_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            output = root / "renders"
            output.mkdir()
            source = root / "camera.jpg"
            edited = output / "edit.jpg"
            Image.new("RGB", (800, 600), (50, 70, 90)).save(source, quality=95)
            Image.new("RGB", (800, 600), (55, 75, 95)).save(edited, quality=95)
            source_hash, output_hash = digest(source), digest(edited)
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"output_root": str(output), "rows": [{
                "key": "test:01", "set": "Synthetic set", "source": str(source),
                "source_sha256": source_hash, "output": edited.name,
                "output_sha256": output_hash, "upload": True, "mode": "color"
            }]}), encoding="utf-8")
            result = root / "review"
            review.run(manifest, result, None)
            sheets = list((result / "crops").glob("Synthetic-set-*-p01.jpg"))
            self.assertEqual(len(sheets), 1)
            sheet = sheets[0]
            with Image.open(sheet) as image:
                self.assertEqual(image.size, (review.CELL * 4, review.CELL + review.LABEL))
            self.assertEqual(digest(source), source_hash)
            self.assertEqual(digest(edited), output_hash)
            self.assertIn("UNREVIEWED", (result / "summary.json").read_text())

            edited.write_bytes(b"tampered")
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                review.run(manifest, root / "tampered-review", None)


if __name__ == "__main__":
    unittest.main()
