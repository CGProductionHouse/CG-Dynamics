import hashlib
import json
import tempfile
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import numpy as np
from PIL import Image, ImageCms

from picasso import (amend, approve_review, classify, export_srgb_icc, face_boxes,
                     face_model_ready, finish, preflight, prepare_review, run, verify)


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class PicassoJobTest(unittest.TestCase):
    def test_pinned_local_face_model_loads_without_network(self):
        self.assertTrue(face_model_ready())
        boxes, scores, detector = face_boxes(np.zeros((320, 320, 3), dtype=np.uint8))
        self.assertEqual(detector, "opencv_yunet_2026may")
        self.assertEqual(boxes, [])
        self.assertEqual(scores, [])

    def test_export_profile_is_valid_and_stable(self):
        profile = export_srgb_icc()
        self.assertEqual(profile[24:36], bytes.fromhex("07d000010001000000000000"))
        self.assertIn("srgb", ImageCms.getProfileName(ImageCms.ImageCmsProfile(BytesIO(profile))).lower())

    def test_bright_jpeg_detail_is_not_newly_clipped_by_exposure(self):
        gradient = np.linspace(30, 252, 223, dtype=np.uint8)
        pixels = np.repeat(gradient[np.newaxis, :, np.newaxis], 24, axis=0)
        pixels = np.repeat(pixels, 3, axis=2)
        source = Image.fromarray(pixels, "RGB")
        settings = {"exposure_ev": .22, "shadow_lift": .02, "highlight_pull": 0,
                    "red_blue_balance": 0, "contrast": 0, "saturation": 0}
        edited = np.asarray(finish(source, settings, {}))
        self.assertGreater(int(edited[0, 20, 0]), int(pixels[0, 20, 0]))
        self.assertEqual(int(np.count_nonzero(edited >= 253)), 0)

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
            self.assertEqual(verify(job)["verified"], 1)
            another_job = base / "another-job"
            self.assertEqual(run(source, another_job, None), 0)
            self.assertEqual(sha(another_job / "output" / "0001.jpg"), output_hash)
            quality = verify(job, quality=True)
            self.assertEqual(len(quality["highlight_quality"]), 1)
            self.assertEqual(quality["highlight_review_ids"], [])
            self.assertEqual(quality["face_detector_unavailable_images"], 0)

            classify(job, "0001", "ALTERNATE", "Staff reviewer", "Near duplicate of stronger moment")
            self.assertEqual(run(source, job, None), 0)
            again = json.loads((job / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(again["items"][0]["classification"], "ALTERNATE")
            self.assertEqual(len(again["classification_history"]), 1)
            self.assertEqual(sha(exported), output_hash)
            self.assertEqual(sha(original), source_hash)

            self.assertTrue(classify(job, "0001", "ALTERNATE", "Staff reviewer",
                                     "Near duplicate of stronger moment")["reused"])
            classify(job, "0001", "KEEP", "Staff reviewer", "Unique documentary moment")
            restored = json.loads((job / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(restored["items"][0]["classification"], "KEEP")
            self.assertEqual([x["decision"] for x in restored["classification_history"]],
                             ["ALTERNATE", "KEEP"])

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

    def test_similarity_hint_survives_colour_review_and_resume(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            source, job = base / "source", base / "job"
            source.mkdir()
            first = source / "a.jpg"
            Image.new("RGB", (48, 32), (92, 82, 71)).save(first)
            (source / "b.jpg").write_bytes(first.read_bytes())
            self.assertEqual(run(source, job, None), 0)
            self.assertEqual(run(source, job, None), 0)
            rows = json.loads((job / "manifest.json").read_text(encoding="utf-8"))["items"]
            self.assertEqual(rows[1]["classification"], "REVIEW")
            self.assertEqual(rows[1]["similarity_hint"],
                             {"nearest_id": "0001", "dhash_distance": 0})

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
            stage = prepare_review(job)
            self.assertEqual(stage["staged_count"], 1)
            staged = Path(stage["stage_folder"]) / "0001_frame.jpg"
            self.assertEqual(sha(staged), sha(job / "output" / "0001.jpg"))
            self.assertEqual(prepare_review(job)["staged_count"], 1)
            classify(job, "0001", "REVIEW", "Staff reviewer", "Check expression")
            with self.assertRaisesRegex(ValueError, "human must approve"):
                prepare_review(job)
            approve_review(job, "Staff reviewer", ["0001"])
            self.assertEqual(prepare_review(job)["staged_count"], 1)
            (job / "output" / "0001.jpg").write_bytes(b"tampered")
            with self.assertRaisesRegex(ValueError, "changed or is missing"):
                prepare_review(job)
            self.assertEqual(verify(job)["failures"], [{"id": "0001", "reason": "hash_mismatch"}])

    def test_amendment_restarts_from_source_and_requires_new_review_approval(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            source, job = base / "source", base / "job"
            source.mkdir()
            original = source / "frame.jpg"
            Image.new("RGB", (40, 30), (80, 90, 100)).save(original)
            original_hash = sha(original)
            self.assertEqual(run(source, job, None), 0)
            base_hash = sha(job / "output" / "0001.jpg")
            approve_review(job, "Staff reviewer", ["0001"])
            first_stage = Path(prepare_review(job)["stage_folder"])
            result = amend(job, "0001", "Staff reviewer", "Lift face gently", {"exposure_ev": .1})
            self.assertEqual(result["revision"], 1)
            self.assertFalse(result["internal_review_approved"])
            self.assertEqual(sha(original), original_hash)
            self.assertEqual(sha(job / "output" / "0001.jpg"), base_hash)
            self.assertTrue((first_stage / "0001_frame.jpg").exists())
            with self.assertRaisesRegex(ValueError, "human must approve"):
                prepare_review(job)
            self.assertTrue(amend(job, "0001", "Staff reviewer", "Lift face gently",
                                  {"exposure_ev": .1})["reused"])
            approve_review(job, "Staff reviewer", ["0001"], latest_revisions=True)
            new_stage = Path(prepare_review(job)["stage_folder"])
            self.assertNotEqual(first_stage, new_stage)
            self.assertEqual(sha(new_stage / "0001_frame.jpg"), sha(Path(result["output"])))
            with self.assertRaisesRegex(ValueError, "exceeds"):
                amend(job, "0001", "Staff reviewer", "Too bright", {"exposure_ev": 1.0})


if __name__ == "__main__":
    unittest.main()
