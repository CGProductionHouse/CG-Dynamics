import io
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageCms

from sanitize_editor_jpeg import sanitize


class SanitizeEditorJpegTests(unittest.TestCase):
    def test_removes_private_metadata_without_reencoding(self):
        with tempfile.TemporaryDirectory() as root:
            source = Path(root) / "editor.jpg"
            clean = Path(root) / "clean.jpg"
            exif = Image.Exif()
            exif[271] = "Private camera"
            exif[34853] = {1: "N", 2: (1, 2, 3)}
            profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
            image = Image.new("RGB", (17, 13), (160, 90, 70))
            image.save(source, "JPEG", quality=95, exif=exif, icc_profile=profile,
                       comment=b"Private comment")

            result = sanitize(source, clean)
            with Image.open(source) as original, Image.open(clean) as output:
                self.assertEqual(original.tobytes(), output.tobytes())
                self.assertEqual(output.size, (17, 13))
                self.assertEqual(output.getexif(), {})
                self.assertEqual(output.info["icc_profile"], profile)
            self.assertGreaterEqual(result["removed_segments"], 1)
            self.assertTrue(source.exists())
            with self.assertRaises(FileExistsError):
                sanitize(source, clean)


if __name__ == "__main__":
    unittest.main()
