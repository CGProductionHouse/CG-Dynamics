import unittest
from types import SimpleNamespace
from transcribe_voice_note import stamp, segment_rows


class VoiceNote(unittest.TestCase):
    def segment(self, **changes):
        data=dict(start=.9, end=6.91, text=' Sentence. ', avg_logprob=-.2, no_speech_prob=.01)
        data.update(changes)
        return SimpleNamespace(**data)

    def test_recognizer_padding_cannot_put_timestamps_beyond_original(self):
        row=segment_rows([self.segment()], 5.24)[0]
        self.assertEqual(row['end'], 5.24)
        self.assertEqual(row['raw_end'], 6.91)
        self.assertTrue(row['review_flag'])

    def test_invalid_recognizer_times_fail(self):
        for change in [dict(end=float('nan')), dict(start=2, end=1)]:
            with self.assertRaises(ValueError):segment_rows([self.segment(**change)], 5.24)

    def test_weak_or_no_speech_diagnostics_require_review(self):
        for change in [dict(avg_logprob=-1), dict(no_speech_prob=.8)]:
            self.assertTrue(segment_rows([self.segment(end=3, **change)], 5.24)[0]['review_flag'])
        self.assertEqual(segment_rows([], 3), [])

    def test_subtitle_rounding_carries_into_next_second(self):
        self.assertEqual(stamp(59.9996, True), '00:01:00,000')
        self.assertEqual(stamp(3600.125), '01:00:00.125')


if __name__=='__main__':unittest.main()
