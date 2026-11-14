import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

TOOLS = Path(__file__).parents[1] / "scripts" / "poster-studio"
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location("local_cutout", TOOLS / "local-cutout.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class LocalCutoutTests(unittest.TestCase):
    def test_black_input_is_finite_model_shape(self):
        result = module.input_tensor(Image.new("RGB", (17, 23), "black"))
        self.assertEqual(result.shape, (1, 3, 320, 320))
        self.assertEqual(result.dtype, np.float32)
        self.assertTrue(np.isfinite(result).all())

    def test_alpha_preserves_colour_and_existing_transparency(self):
        image = Image.new("RGBA", (7, 11), (143, 98, 51, 128))
        image.info["exif"] = b"private"
        image.info["icc_profile"] = b"retained-profile"
        result = module.apply_alpha(image, Image.new("L", image.size, 128))
        self.assertEqual(result.convert("RGB").tobytes(), image.convert("RGB").tobytes())
        self.assertEqual(result.getchannel("A").getextrema(), (64, 64))
        self.assertNotIn("exif", result.info)
        self.assertEqual(result.info["icc_profile"], b"retained-profile")

    def test_bad_masks_fail_before_composition(self):
        image = Image.new("RGB", (4, 5))
        for mask in [Image.new("L", (5, 4)), Image.new("RGB", (4, 5))]:
            with self.assertRaisesRegex(ValueError, "same-size grayscale"):
                module.apply_alpha(image, mask)

    def test_invalid_predictions_are_not_saved_as_masks(self):
        invalid = [np.zeros((1, 1, 320, 320)), np.zeros((1, 320, 320)),
                   np.full((1, 1, 320, 320), np.nan), np.full((1, 1, 320, 320), np.inf)]
        for prediction in invalid:
            with self.assertRaises(ValueError):
                module.alpha_mask(prediction, (15, 21))

    def test_soft_mask_retains_input_dimensions_and_alpha_range(self):
        prediction = np.linspace(0, 1, 320 * 320, dtype=np.float32).reshape(1, 1, 320, 320)
        result = module.alpha_mask(prediction, (120, 180))
        self.assertEqual(result.size, (120, 180))
        self.assertEqual(result.mode, "L")
        self.assertLess(result.getextrema()[0], 3)
        self.assertGreater(result.getextrema()[1], 252)

    def test_collision_and_input_overwrite_are_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, model = root / "source.png", root / "model.onnx"
            source.write_bytes(b"original")
            model.write_bytes(b"model")
            for target in [source, model, root / "output.jpg"]:
                with self.assertRaises(ValueError):
                    module.destinations(source, model, target)
            output = root / "output.png"
            output.with_suffix(".receipt.json").write_text("prior receipt")
            with self.assertRaisesRegex(ValueError, "prior output"):
                module.destinations(source, model, output)
            self.assertEqual(source.read_bytes(), b"original")

    def test_unreviewed_model_cannot_start_inference_or_write_outputs(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, model, output = root / "source.jpg", root / "model.onnx", root / "output.png"
            source.write_bytes(b"original")
            model.write_bytes(b"unreviewed")
            with self.assertRaisesRegex(ValueError, "Unreviewed model hash"):
                module.run(source, model, output)
            self.assertFalse(output.exists())
            self.assertEqual(source.read_bytes(), b"original")


if __name__ == "__main__":
    unittest.main()
