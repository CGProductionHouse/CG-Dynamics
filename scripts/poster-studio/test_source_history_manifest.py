"""Local evidence-binding regression tests; no network, client media or face data."""
import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image
import numpy as np

spec = importlib.util.spec_from_file_location("history_audit", Path(__file__).with_name("source-history-audit.py"))
audit_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit_module)


class ReferenceManifestTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.history = self.root / "history"
        self.history.mkdir()
        self.now = datetime(2026, 11, 26, 9, 0, tzinfo=timezone.utc)
        self.image = self.history / "first.png"
        Image.new("RGB", (40, 40), "red").save(self.image)
        self.manifest_path = self.root / "manifest.json"
        self.manifest = {
            "captureMode": "read-only-transaction", "readOnlyTransactionId": "synthetic-read-only",
            "designId": "synthetic-design", "designUpdatedAt": 123,
            "captureMode": "read-only-transaction", "readOnlyTransactionId": "synthetic-read-only",
            "observedAt": self.now.isoformat(), "pageCount": 1,
            "pages": [{"page": 1, "pageId": "stable-page-a", "file": self.image.name,
                       "sha256": audit_module.digest(self.image)}],
        }

    def verify(self):
        self.manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        return audit_module.verify_reference_manifest(
            self.history, self.manifest_path, "synthetic-design", 123, self.now)

    def test_valid_bindings_keep_stable_id_without_claiming_server_authentication(self):
        pages, receipt = self.verify()
        self.assertEqual(pages["first.png"]["pageId"], "stable-page-a")
        self.assertTrue(receipt["bindingsValidatedLocally"])
        self.assertFalse(receipt["externallyAuthenticated"])

    def test_same_count_but_changed_revision_is_refused(self):
        self.manifest["designUpdatedAt"] = 124
        with self.assertRaisesRegex(ValueError, "design/revision"):
            self.verify()

    def test_other_design_is_refused(self):
        self.manifest["designId"] = "different-client"
        with self.assertRaisesRegex(ValueError, "design/revision"):
            self.verify()

    def test_index_cache_cannot_be_relabelled_as_current_capture(self):
        self.manifest["captureMode"] = "cached-thumbnail-index"
        with self.assertRaisesRegex(ValueError, "capture provenance"):
            self.verify()

    def test_changed_preview_bytes_are_refused(self):
        Image.new("RGB", (40, 40), "blue").save(self.image)
        with self.assertRaisesRegex(ValueError, "changed reference"):
            self.verify()

    def test_fresh_date_does_not_replace_transaction_identity(self):
        self.manifest["readOnlyTransactionId"] = ""
        with self.assertRaisesRegex(ValueError, "capture provenance"):
            self.verify()

    def test_duplicate_stable_id_is_refused(self):
        self.manifest["pageCount"] = 2
        self.manifest["pages"].append(dict(self.manifest["pages"][0], page=2, file="second.png"))
        with self.assertRaisesRegex(ValueError, "Unique"):
            self.verify()

    def test_path_outside_evidence_folder_is_refused(self):
        self.manifest["pages"][0]["file"] = "../first.png"
        with self.assertRaisesRegex(ValueError, "contained"):
            self.verify()

    def test_missing_or_extra_preview_is_refused(self):
        self.image.unlink()
        with self.assertRaisesRegex(ValueError, "Missing"):
            self.verify()
        Image.new("RGB", (40, 40), "red").save(self.image)
        Image.new("RGB", (40, 40), "red").save(self.history / "untracked.png")
        with self.assertRaisesRegex(ValueError, "inventory"):
            self.verify()

    def test_incomplete_page_numbers_are_refused(self):
        self.manifest["pages"][0]["page"] = 2
        with self.assertRaisesRegex(ValueError, "sequence"):
            self.verify()

    def test_stale_future_and_naive_times_are_refused(self):
        for value in [(self.now - timedelta(hours=25)).isoformat(),
                      (self.now + timedelta(minutes=1)).isoformat(), "2026-11-26T09:00:00"]:
            with self.subTest(value=value):
                self.manifest["observedAt"] = value
                with self.assertRaisesRegex(ValueError, "stale"):
                    self.verify()

    def test_real_synthetic_match_keeps_page_identity_without_certifying_nonuse(self):
        pattern = np.random.default_rng(42).integers(0, 256, (240, 240), dtype=np.uint8)
        Image.fromarray(pattern).save(self.image)
        self.manifest["pages"][0]["sha256"] = audit_module.digest(self.image)
        self.manifest["observedAt"] = datetime.now(timezone.utc).isoformat()
        self.manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        result = audit_module.audit([self.image], self.history, self.manifest_path,
                                    "synthetic-design", 123)
        self.assertEqual(result["pages"][0]["canvaPageId"], "stable-page-a")
        self.assertTrue(result["pages"][0]["sourceMatches"][0]["suspectedReuse"])
        self.assertFalse(result["unusedCertified"])
        self.assertFalse(result["faceRecognitionUsed"])

    def test_missing_hash_cannot_validate_current_evidence(self):
        self.manifest["pages"][0].pop("sha256", None)
        with self.assertRaisesRegex(ValueError, "changed reference"):
            self.verify()

    def test_unbound_audit_remains_exploratory(self):
        result = audit_module.audit([self.image], self.history)
        self.assertEqual(result["referenceProvenance"]["mode"], "legacy-unbound")
        self.assertFalse(result["referenceProvenance"]["bindingsValidatedLocally"])
        self.assertFalse(result["unusedCertified"])

    def test_partial_authority_arguments_are_refused(self):
        with self.assertRaisesRegex(ValueError, "together"):
            audit_module.audit([self.image], self.history, manifest_path=self.manifest_path)


if __name__ == "__main__":
    unittest.main()
