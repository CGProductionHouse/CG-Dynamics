import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image, ImageCms

from picasso import approve_review, preflight, prepare_review, run


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class PicassoJobTest(unittest.TestCase):
    def test_preserves_original_and_resumes_without_reencoding(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            source, job = base / "source", base / "job"
            source.mkdir()
            image = Image.new("RGB", (113, 71), (84, 72, 64))
            exif = Image.Exif()
            exif[274] = 6  # display rotated 90 degrees
            exif[271] = "Private camera name"
            original = source / "frame.jpg"
            image.save(original, "JPEG", quality=96, exif=exif)
            source_hash = sha(original)

            self.assertEqual(run(source, job, None), 0)
            data = json.loads((job / "manifest.json").read_text(encoding="utf-8"))
            row = data["items"][0]
            exported = job / row["output"]
            output_hash = sha(exported)
            with Image.open(exported) as result:
                self.assertEqual(result.size, (71, 113))
                self.assertTrue(result.info.get("icc_profile"))
                self.assertEqual(len(result.getexif()), 0)
            self.assertEqual(sha(original), source_hash)
            self.assertTrue((job / "contact-sheet.jpg").exists())

            data["items"][0]["classification"] = "ALTERNATE"
            (job / "manifest.json").write_text(json.dumps(data), encoding="utf-8")
            self.assertEqual(run(source, job, None), 0)
            again = json.loads((job / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(again["items"][0]["classification"], "ALTERNATE")
            self.assertEqual(sha(exported), output_hash)
            self.assertEqual(sha(original), source_hash)

    def test_corrupt_file_is_reported_and_other_files_finish(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            source, job = base / "source", base / "job"
            source.mkdir()
            (source / "a.jpg").write_bytes(b"not a JPEG")
            Image.new("RGB", (32, 32), (10, 15, 20)).save(source / "b.jpg")
            self.assertEqual(run(source, job, None), 1)
            rows = json.loads((job / "manifest.json").read_text(encoding="utf-8"))["items"]
            self.assertEqual([r["status"] for r in rows], ["error", "complete"])

    def test_onedrive_preflight_refuses_placeholder_without_reading_media(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            drive, shoot, job = base / "OneDrive", base / "OneDrive" / "shoot", base / "job"
            shoot.mkdir(parents=True)
            (shoot / "frame.jpg").write_bytes(b"placeholder")
            with patch("picasso.online_only", return_value=True), patch("picasso.digest") as digest_mock:
                report = preflight(shoot, job, onedrive_root=drive)
                self.assertEqual(report["online_only_count"], 1)
                self.assertFalse(report["ready"])
                with self.assertRaisesRegex(ValueError, "online-only"):
                    run(shoot, job, None, drive)
                digest_mock.assert_not_called()
            self.assertFalse(job.exists())

    def test_onedrive_preflight_requires_specific_folder_within_root(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            drive, outside = base / "OneDrive", base / "elsewhere"
            drive.mkdir()
            outside.mkdir()
            (outside / "frame.jpg").write_bytes(b"x")
            with self.assertRaisesRegex(ValueError, "outside"):
                preflight(outside, onedrive_root=drive)
            (drive / "frame.jpg").write_bytes(b"x")
            with self.assertRaisesRegex(ValueError, "one shoot folder"):
                preflight(drive, onedrive_root=drive)

    def test_internal_review_staging_requires_human_selection_and_valid_hashes(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            source, job = base / "source", base / "job"
            source.mkdir()
            Image.new("RGB", (40, 30), (80, 90, 100)).save(source / "frame.jpg")
            self.assertEqual(run(source, job, None), 0)
            with self.assertRaisesRegex(ValueError, "human must approve"):
                prepare_review(job)
            self.assertEqual(approve_review(job, "Staff reviewer", ["0001"])["approved_count"], 1)
            self.assertEqual(prepare_review(job)["staged_count"], 1)
            staged = job / "review-upload" / "0001_frame.jpg"
            self.assertEqual(sha(staged), sha(job / "output" / "0001.jpg"))
            self.assertEqual(prepare_review(job)["staged_count"], 1)
            (job / "output" / "0001.jpg").write_bytes(b"tampered")
            with self.assertRaisesRegex(ValueError, "changed or is missing"):
                prepare_review(job)


if __name__ == "__main__":
    unittest.main()
