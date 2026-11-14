import importlib.util
import io
import unittest
from pathlib import Path
from PIL import Image, ImageCms

spec = importlib.util.spec_from_file_location("photo_colour", Path(__file__).parents[1] / "scripts/poster-studio/photo_colour.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PhotoColourTests(unittest.TestCase):
    def fixture(self, colour_space, interop=None):
        image = Image.new("RGB", (16, 24), (140, 110, 70))
        exif = Image.Exif()
        exif[34665] = {40961: colour_space}
        if interop:
            exif[34665][40965] = {1: interop}
        image.info["exif"] = exif.tobytes()
        return image

    def test_srgb_pixels_preserved_and_metadata_removed(self):
        image = self.fixture(1)
        result, receipt = module.prepare_srgb(image)
        self.assertEqual(result.tobytes(), image.tobytes())
        self.assertEqual(receipt["profileDecision"], "exif-srgb")
        self.assertNotIn("exif", result.info)
        profile = ImageCms.ImageCmsProfile(io.BytesIO(result.info['icc_profile']))
        self.assertIn("sRGB", ImageCms.getProfileName(profile))

    def test_unknown_and_uncalibrated_do_not_become_srgb(self):
        for image in [Image.new("RGB", (16, 24)), self.fixture(65535)]:
            with self.assertRaisesRegex(ValueError, "Unknown colour"):
                module.prepare_srgb(image)

    def test_r03_requires_actual_adobe_profile(self):
        with self.assertRaisesRegex(ValueError, "requires.*ICC"):
            module.prepare_srgb(self.fixture(65535, "R03"))

    def test_embedded_profile_has_precedence(self):
        image = self.fixture(65535, "R03")
        image.info["icc_profile"] = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
        result, receipt = module.prepare_srgb(image)
        self.assertEqual(receipt["profileDecision"], "embedded-icc")
        self.assertEqual(result.size, image.size)

    def test_orientation_applied_before_export(self):
        image = self.fixture(1)
        exif = image.getexif(); exif[274] = 6
        image.info['exif'] = exif.tobytes()
        result, _ = module.prepare_srgb(image)
        self.assertEqual(result.size, (24, 16))


if __name__ == "__main__":
    unittest.main()
