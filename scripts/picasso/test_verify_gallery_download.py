"""Reject stale gallery files and unbound replacement claims."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("verify_gallery_download", Path(__file__).with_name("verify_gallery_download.py"))
tool = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(tool)


class DownloadVerificationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.old, self.new = self.root / "old.jpg", self.root / "new.jpg"
        self.old.write_bytes(b"old reviewed export")
        self.new.write_bytes(b"new reviewed export")
        self.base, self.revision = self.root / "base.json", self.root / "revision.json"
        item = {"file": "frame.jpg", "output_sha256": tool.digest(self.old),
                "source_sha256": "a" * 64, "dimensions": [6000, 4000]}
        self.base.write_text(json.dumps({"count": 1, "items": [item]}))
        item = dict(item, output_sha256=tool.digest(self.new))
        self.revision.write_text(json.dumps({"count": 1, "items": [item],
            "revision_from": tool.digest(self.base), "replaced_files": ["frame.jpg"]}))
        self.before = self.root / "before.json"
        tool.save_proof(self.before, tool.verify(self.base, "frame.jpg", self.old))

    def test_actual_before_after_and_idempotent_proof(self):
        proof = tool.verify(self.revision, "frame.jpg", self.new, self.before)
        self.assertEqual(proof["phase"], "after")
        self.assertFalse(proof["photographic_approval"])
        path = self.root / "after.json"
        tool.save_proof(path, proof)
        tool.save_proof(path, proof)
        self.assertEqual(json.loads(path.read_text()), proof)

    def test_newer_staff_edit_blocks_before_check(self):
        self.old.write_bytes(b"new staff edit")
        with self.assertRaisesRegex(ValueError, "Downloaded bytes differ"):
            tool.verify(self.base, "frame.jpg", self.old)

    def test_old_download_cannot_prove_replacement(self):
        with self.assertRaisesRegex(ValueError, "Downloaded bytes differ"):
            tool.verify(self.revision, "frame.jpg", self.old, self.before)

    def test_wrong_filename_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Exact photo filename"):
            tool.verify(self.base, "other.jpg", self.old)

    def test_before_file_cannot_change_after_check(self):
        self.old.write_bytes(b"overwritten download")
        with self.assertRaisesRegex(ValueError, "Before download or proof changed"):
            tool.verify(self.revision, "frame.jpg", self.new, self.before)

    def test_candidate_must_descend_from_checked_base(self):
        data = json.loads(self.revision.read_text())
        data["revision_from"] = "b" * 64
        self.revision.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "does not descend"):
            tool.verify(self.revision, "frame.jpg", self.new, self.before)

    def test_changed_camera_provenance_is_rejected(self):
        data = json.loads(self.revision.read_text())
        data["items"][0]["source_sha256"] = "c" * 64
        self.revision.write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "camera provenance"):
            tool.verify(self.revision, "frame.jpg", self.new, self.before)

    def test_cannot_replace_existing_proof_with_another_result(self):
        with self.assertRaises(FileExistsError):
            tool.save_proof(self.before, {"state": "different"})


if __name__ == "__main__":
    unittest.main()
