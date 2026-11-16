import importlib.util
from pathlib import Path
import tempfile
import unittest
import cv2
import numpy as np

spec = importlib.util.spec_from_file_location("source_history", Path(__file__).parents[1] / "scripts/poster-studio/source-history-audit.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class HistoryMatchTests(unittest.TestCase):
    def test_resized_photo_in_poster_is_found_and_unrelated_texture_is_rejected(self):
        rng = np.random.default_rng(82)
        source = rng.integers(0, 256, (600, 800), dtype=np.uint8)
        source = cv2.GaussianBlur(source, (3, 3), 0)
        for i in range(70):
            x, y = rng.integers(30, 560, 2)
            cv2.circle(source, (int(x), int(y)), int(rng.integers(3, 25)), int(rng.integers(0, 255)), 2)
        poster = np.full((700, 600), 210, dtype=np.uint8)
        poster[120:420, 90:490] = cv2.resize(source, (400, 300))
        unrelated = rng.integers(0, 256, (700, 600), dtype=np.uint8)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, pixels in [("source.png", source), ("poster.png", poster), ("other.png", unrelated)]:
                cv2.imwrite(str(root / name), pixels)
            detector = cv2.SIFT_create(nfeatures=2400)
            features = module.features(root / "source.png", detector)
            positive = module.compare(features, module.features(root / "poster.png", detector))
            negative = module.compare(features, module.features(root / "other.png", detector))
            self.assertTrue(positive["suspectedReuse"], positive)
            self.assertFalse(negative["suspectedReuse"], negative)


if __name__ == "__main__":
    unittest.main()
