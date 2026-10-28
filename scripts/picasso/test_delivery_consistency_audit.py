"""Release gate proof: a clean JPEG alone cannot authorize an event upload."""

import csv
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image, ImageCms

SPEC = importlib.util.spec_from_file_location("delivery_consistency_audit", Path(__file__).with_name("delivery_consistency_audit.py"))
audit_tool = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit_tool)


class DeliveryConsistencyAuditTest(unittest.TestCase):
    def test_reuse_only_unchanged_hash_bound_measurements(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            originals, uploads = root / "source", root / "upload"
            originals.mkdir()
            uploads.mkdir()
            profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
            items = []
            for index in range(2):
                source = originals / f"camera-{index}.jpg"
                output = uploads / f"edit-{index}.jpg"
                Image.new("RGB", (40, 30), (30, 50, 70)).save(source, "JPEG")
                Image.new("RGB", (40, 30), (50 + index * 10, 70, 90)).save(
                    output, "JPEG", icc_profile=profile)
                items.append({"key": f"frame:{index}", "group": "Stage", "source": str(source),
                              "source_sha256": audit_tool.digest(source), "file": output.name,
                              "output_sha256": audit_tool.digest(output), "dimensions": [40, 30],
                              "route": "review grade"})
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"count": 2, "items": items}), encoding="utf-8")
            first = root / "first"
            self.assertEqual(audit_tool.audit(manifest, uploads, first, sheets=False)["reused_metrics"], 0)
            changed = uploads / "edit-1.jpg"
            Image.new("RGB", (40, 30), (90, 60, 90)).save(changed, "JPEG", icc_profile=profile)
            items[1]["output_sha256"] = audit_tool.digest(changed)
            manifest.write_text(json.dumps({"count": 2, "items": items}), encoding="utf-8")
            second = root / "second"
            summary = audit_tool.audit(manifest, uploads, second, sheets=False,
                                       reuse_review=first / "review.csv")
            self.assertEqual(summary["reused_metrics"], 1)
            with (second / "review.csv").open(newline="", encoding="utf-8-sig") as stream:
                rows = list(csv.DictReader(stream))
            self.assertNotEqual(rows[0]["sha256"], rows[1]["sha256"])
            self.assertEqual(rows[1]["editorial_decision"], "REVIEW")

    def test_review_and_source_hashes_gate_release(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            originals, uploads, output = root / "source", root / "upload", root / "audit"
            originals.mkdir()
            uploads.mkdir()
            profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
            items = []
            for n in range(25):
                source = originals / f"camera-{n:02}.jpg"
                target = uploads / f"edit-{n:02}.jpg"
                Image.new("RGB", (40, 30), (35 + n, 55 + n, 75 + n)).save(source, "JPEG", quality=95)
                Image.new("RGB", (40, 30), (40 + n, 60 + n, 80 + n)).save(target, "JPEG", quality=92, icc_profile=profile)
                items.append({"key": f"frame:{n:02}", "group": f"Light {n % 3}",
                              "source": str(source), "file": target.name, "route": "Lightroom preset A"})
            manifest = root / "manifest.json"
            manifest.write_text(json.dumps({"count": len(items), "items": items}), encoding="utf-8")
            summary = audit_tool.audit(manifest, uploads, output, sheets=False)
            self.assertEqual(summary["count"], 25)
            review = output / "review.csv"
            acceptance = output / "acceptance.json"
            with self.assertRaisesRegex(ValueError, "Editorial decision incomplete"):
                audit_tool.check_release(review, root / "missing-acceptance.json", uploads, manifest)
            with review.open(newline="", encoding="utf-8-sig") as stream:
                rows = list(csv.DictReader(stream))
            acceptance.write_text(json.dumps({"status": "ACCEPTED", "reviewer": "staff", "accepted_at": "2026-10-27T15:00:00+02:00",
                                             "sample_keys": [item["key"] for item in items],
                                             "sample_sha256": {row["key"]: row["sha256"] for row in rows}}), encoding="utf-8")
            for row in rows:
                row.update(subject_focus="PASS", grade_vs_reference="PASS", scene_consistency="PASS",
                           editorial_decision="KEEP", reviewer="staff", reason="examined at native size")
            with review.open("w", newline="", encoding="utf-8-sig") as stream:
                writer = csv.DictWriter(stream, audit_tool.FIELDS)
                writer.writeheader()
                writer.writerows(rows)
            audit_tool.check_release(review, acceptance, uploads, manifest)
            accepted = json.loads(acceptance.read_text(encoding="utf-8"))
            accepted["sample_sha256"]["frame:01"] = "0" * 64
            acceptance.write_text(json.dumps(accepted), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Accepted sample hashes differ"):
                audit_tool.check_release(review, acceptance, uploads, manifest)
            accepted["sample_sha256"]["frame:01"] = rows[1]["sha256"]
            acceptance.write_text(json.dumps(accepted), encoding="utf-8")
            # An export changed after the photographic decision cannot silently pass.
            Image.new("RGB", (40, 30), (0, 0, 0)).save(uploads / "edit-01.jpg", "JPEG")
            with self.assertRaisesRegex(ValueError, "Changed JPEG"):
                audit_tool.check_release(review, acceptance, uploads, manifest)


if __name__ == "__main__":
    unittest.main()
