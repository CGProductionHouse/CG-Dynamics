import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import sys

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import picasso_mcp


class PicassoMcpTest(unittest.TestCase):
    def test_exact_minimal_tool_surface_and_protocol(self):
        response = picasso_mcp.dispatch({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
        names = {tool["name"] for tool in response["result"]["tools"]}
        self.assertEqual(names, {
            "picasso_inspect_folder", "picasso_analyze_shoot", "picasso_review_previews",
            "picasso_edit_jpegs", "picasso_export_review", "picasso_job_status",
        })
        self.assertNotIn("shell", json.dumps(response).lower())

    def test_paths_are_confined_to_explicit_roots(self):
        with tempfile.TemporaryDirectory() as root, tempfile.TemporaryDirectory() as outside:
            with patch.dict(os.environ, {"PICASSO_ALLOWED_ROOTS": root}, clear=False):
                self.assertEqual(picasso_mcp.private_path(root), Path(root).resolve())
                with self.assertRaisesRegex(ValueError, "outside"):
                    picasso_mcp.private_path(outside)

    def test_job_cannot_be_inside_source_tree(self):
        with tempfile.TemporaryDirectory() as root:
            source = Path(root) / "source"
            source.mkdir()
            with patch.dict(os.environ, {"PICASSO_ALLOWED_ROOTS": root}, clear=False):
                with self.assertRaisesRegex(ValueError, "separate"):
                    picasso_mcp.edit_jpegs({"folder": str(source), "job": str(source / "output")})

    def test_inspect_and_edit_are_local_and_separate_from_originals(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            source, job = base / "source", base / "job"
            source.mkdir()
            original = source / "photo.jpg"
            Image.new("RGB", (180, 120), (100, 75, 50)).save(original, "JPEG")
            before = original.read_bytes()
            with patch.dict(os.environ, {"PICASSO_ALLOWED_ROOTS": root}, clear=False):
                readiness = picasso_mcp.inspect_folder({"folder": str(source), "job": str(job)})
                self.assertTrue(readiness["ready"])
                edited = picasso_mcp.edit_jpegs({"folder": str(source), "job": str(job)})
                self.assertFalse(edited["delivery_ready"])
                status = picasso_mcp.job_status({"job": str(job)})
                self.assertEqual(status["complete"], 1)
            self.assertEqual(original.read_bytes(), before)
            self.assertTrue((job / "output" / "0001.jpg").is_file())

    def test_export_requires_human_approval(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            source, job = base / "source", base / "job"
            source.mkdir()
            Image.new("RGB", (180, 120), (100, 75, 50)).save(source / "photo.jpg", "JPEG")
            with patch.dict(os.environ, {"PICASSO_ALLOWED_ROOTS": root}, clear=False):
                picasso_mcp.edit_jpegs({"folder": str(source), "job": str(job)})
                with self.assertRaisesRegex(RuntimeError, "approve"):
                    picasso_mcp.export_review({"job": str(job)})

    def test_export_can_record_exact_human_approval_and_stage(self):
        with tempfile.TemporaryDirectory() as root:
            base = Path(root)
            source, job = base / "source", base / "job"
            source.mkdir()
            Image.new("RGB", (180, 120), (100, 75, 50)).save(source / "photo.jpg", "JPEG")
            with patch.dict(os.environ, {"PICASSO_ALLOWED_ROOTS": root}, clear=False):
                picasso_mcp.edit_jpegs({"folder": str(source), "job": str(job)})
                staged = picasso_mcp.export_review({
                    "job": str(job), "reviewer": "CG reviewer", "approved_ids": ["0001"]})
            self.assertEqual(staged["staged_count"], 1)
            self.assertFalse(staged["published"])


if __name__ == "__main__":
    unittest.main()
