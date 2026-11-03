"""Classifier regressions from actual public control scores; no listening claims."""
import math
import unittest
from local_audio_evidence import classify, gpu_budget


class AcousticHierarchy(unittest.TestCase):
    def test_specific_music_prototypes_do_not_compete_against_their_parent(self):
        # Actual held-out electronic music: the old flat classifier chose beeps.
        scores = [.00339778, .11315076, .12753540, -.03646, .09882961,
                  .16830969, .29541892, .03606551, .45231158, .27073562, .20940048]
        self.assertEqual(classify(scores)["kind"], "music")

    def test_known_mixed_speech_music_is_not_confident_instrumental_clearance(self):
        # Actual held-out mixture. ASR independently recovered the spoken sentence.
        scores = [.36178383, .22452812, .05127782, -.07429460, .42139372,
                  .17204593, .37840390, .05927958, .43787178, .37849975, .26948720]
        self.assertEqual(classify(scores)["kind"], "uncertain")

    def test_invalid_model_output_cannot_be_a_classification(self):
        for scores in ([0.0] * 10, [math.nan] + [0.0] * 10):
            with self.assertRaises(ValueError):
                classify(scores)

    def test_windows_graphics_usage_is_not_hidden_by_cuda_free_memory(self):
        self.assertEqual(gpu_budget(15 * 1024 ** 3, "7003\n"), 7003 * 1024 ** 2)
        self.assertEqual(gpu_budget(3 * 1024 ** 3, "7003\n"), 3 * 1024 ** 3)
        for value in ("N/A", "", "-1", "0", "7003\n4000"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                gpu_budget(15 * 1024 ** 3, value)


if __name__ == "__main__":
    unittest.main()
