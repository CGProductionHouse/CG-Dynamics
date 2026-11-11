"""Large-shoot intake must stay reversible, resumable and separate from originals."""

import csv
import hashlib
import json
import os
from datetime import datetime, timedelta
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from shoot_index import burst_sheets, classify, connect, group_bursts, review_bursts, run_index, stage_selected, status


class ShootIndexTest(unittest.TestCase):
    def test_calibration_cannot_stage_unbounded_selection(self):
        with tempfile.TemporaryDirectory() as temp:
            job = Path(temp)
            connection = connect(job)
            connection.executemany(
                "INSERT INTO photos (id,root,relative,source,bytes,mtime_ns,source_sha256,status,decision,reviewer,reason) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                ((f"p{n}", 1, f"p{n}.jpg", f"X:/p{n}.jpg", 1, 1, "0" * 64,
                  "indexed", "KEEP", "Reviewer", "pilot") for n in range(26)))
            connection.commit()
            connection.close()
            with self.assertRaisesRegex(ValueError, "limited to 25"):
                stage_selected(job, calibration=True)

    def test_six_thousand_rows_group_without_auto_selecting(self):
        with tempfile.TemporaryDirectory() as temp:
            job = Path(temp)
            connection = connect(job)
            base = datetime(2026, 10, 28, 9, 0)
            visual = json.dumps({"dhash": "0" * 56})
            connection.executemany("""INSERT INTO photos
                (id,root,relative,source,bytes,mtime_ns,analysis,status,capture_time)
                VALUES (?,?,?,?,?,?,?,?,?)""",
                ((f"image-{n:05}", 1, f"image-{n:05}.jpg", f"X:/{n:05}.jpg", 1, 1,
                  visual, "indexed", (base + timedelta(milliseconds=n * 200)).isoformat())
                 for n in range(6000)))
            connection.commit()
            group_bursts(connection)
            result = status(connection)
            self.assertEqual(result["total"], 6000)
            self.assertEqual(result["bursts"], 150)
            self.assertEqual(result["decisions"], {"REVIEW": 6000})
            connection.close()

    def test_burst_inventory_resume_and_reversible_decisions(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            source, job = base / "camera", base / "private-index"
            source.mkdir()
            files = []
            for number, (colour, offset) in enumerate((((50, 70, 90), 0),
                                                       ((50, 70, 90), 1),
                                                       ((200, 80, 45), 8)), 1):
                path = source / f"frame-{number}.jpg"
                Image.new("RGB", (800, 600), colour).save(path, "JPEG", quality=93)
                os.utime(path, (1_700_000_000 + offset, 1_700_000_000 + offset))
                files.append(path)
            hashes = [hashlib.sha256(path.read_bytes()).hexdigest() for path in files]
            first = run_index([source], job, sheets=False)
            self.assertEqual((first["total"], first["processed"], first["bursts"]), (3, 3, 2))
            self.assertEqual(first["near_duplicate_hints"], 1)
            self.assertEqual(first["decisions"], {"REVIEW": 3})
            with (job / "review.csv").open(newline="", encoding="utf-8-sig") as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual([row["source_sha256"] for row in rows], hashes)
            self.assertEqual(rows[0]["burst"], rows[1]["burst"])
            self.assertNotEqual(rows[1]["burst"], rows[2]["burst"])
            self.assertEqual(rows[1]["near_duplicate_of"], rows[0]["id"])

            comparison = burst_sheets(job, [rows[0]["burst"]], (0.1, 0.1, 0.8, 0.8))
            self.assertEqual((comparison["frames"], len(comparison["pages"])), (2, 1))
            with Image.open(comparison["pages"][0]) as sheet:
                self.assertEqual(sheet.size, (2000, 1440))
            with self.assertRaisesRegex(ValueError, "Crop"):
                burst_sheets(job, [rows[0]["burst"]], (0.8, 0.1, 0.5, 0.5))
            with self.assertRaisesRegex(ValueError, "Unknown"):
                burst_sheets(job, ["B99999"])

            self.assertEqual(run_index([source], job, sheets=False)["reused"], 3)
            classify(job, [rows[0]["id"]], "KEEP", "Reviewer", "strong opening moment")
            with self.assertRaisesRegex(ValueError, "no human review"):
                stage_selected(job)
            pilot = stage_selected(job, calibration=True)
            self.assertEqual(pilot["scope"], "calibration")
            review_bursts(job, [rows[0]["burst"], rows[2]["burst"]], "Reviewer", "inspected all adjacent frames")
            staged = stage_selected(job)
            self.assertEqual(staged["count"], 1)
            self.assertFalse(staged["reused"])
            self.assertTrue(stage_selected(job)["reused"])
            staged_file = next(path for path in Path(staged["folder"]).glob("*.jpg"))
            self.assertEqual(hashlib.sha256(staged_file.read_bytes()).hexdigest(), hashes[0])
            classify(job, [rows[0]["id"]], "REVIEW", "Reviewer", "reconsider after adjacent frame")
            connection = connect(job)
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM decisions").fetchone()[0], 2)
            self.assertEqual(status(connection)["decisions"], {"REVIEW": 3})
            connection.close()
            self.assertEqual([hashlib.sha256(path.read_bytes()).hexdigest() for path in files], hashes)
            with self.assertRaisesRegex(ValueError, "separate"):
                run_index([source], source / "index-job", sheets=False)
            os.utime(files[0], (1_700_000_100, 1_700_000_100))
            with self.assertRaisesRegex(ValueError, "Source changed"):
                run_index([source], job, sheets=False)


if __name__ == "__main__":
    unittest.main()
