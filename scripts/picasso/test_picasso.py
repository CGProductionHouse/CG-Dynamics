import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageCms

from picasso import run


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


if __name__ == "__main__":
    unittest.main()
