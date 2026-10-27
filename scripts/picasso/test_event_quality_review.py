"""Safety checks for the private event review sheet builder."""

import csv
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
            with (result / "focus-and-grade-review.csv").open(newline="", encoding="utf-8-sig") as stream:
                row = next(csv.DictReader(stream))
            self.assertEqual(row["source_crop_median_luma"], "74.0")
            self.assertEqual(row["output_crop_nearwhite_any_channel_pct"], "0.0")
            self.assertEqual(row["editorial_decision"], "REVIEW")

            edited.write_bytes(b"tampered")
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                review.run(manifest, root / "tampered-review", None)

    def test_flat_gallery_revision_builds_original_and_output_comparison(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            images = root / "images"
            images.mkdir()
            source = root / "camera.jpg"
            edited = images / "fight-01.jpg"
            Image.new("RGB", (800, 600), (60, 70, 90)).save(source, quality=95)
            Image.new("RGB", (800, 600), (75, 75, 75)).save(edited, quality=95)
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"count": 1, "items": [{
                "key": "card1:001", "group": "Fight 01", "source": str(source),
                "source_sha256": digest(source), "file": edited.name,
                "output_sha256": digest(edited), "route": "stage-monochrome-v1",
            }]}), encoding="utf-8")
            result = root / "review"
            review.run(manifest, result, {"card1:001"})
            self.assertEqual(len(list((result / "crops").glob("Fight-01-*-p01.jpg"))), 1)
            self.assertIn("card1:001", (result / "focus-and-grade-review.csv").read_text(encoding="utf-8-sig"))
            manual = root / "manual"
            review.run(manifest, manual, {"card1:001"}, {"card1:001": [100, 100, 500, 500]})
            self.assertIn("reviewer-selected subject box", (manual / "focus-and-grade-review.csv").read_text(encoding="utf-8-sig"))
            with self.assertRaisesRegex(ValueError, "outside original"):
                review.run(manifest, root / "bad-box", {"card1:001"}, {"card1:001": [100, 100, 900, 500]})
            with self.assertRaisesRegex(ValueError, "Missing camera keys"):
                review.run(manifest, root / "missing", {"card1:002"})

    def test_crop_tone_metrics_separates_channel_clipping_from_white(self):
        image = Image.new("RGB", (200, 200), (255, 25, 20))
        values = review.crop_tone_metrics(image, (0, 0, 200, 200))
        self.assertEqual(values["nearwhite_any_channel_pct"], 100.0)
        self.assertEqual(values["nearwhite_all_channels_pct"], 0.0)
        blue = review.crop_tone_metrics(Image.new("RGB", (200, 200), (20, 25, 255)), (0, 0, 200, 200))
        yellow = review.crop_tone_metrics(Image.new("RGB", (200, 200), (255, 240, 20)), (0, 0, 200, 200))
        self.assertLess(blue["median_lab_b"], 0)
        self.assertGreater(yellow["median_lab_b"], 0)


if __name__ == "__main__":
    unittest.main()
