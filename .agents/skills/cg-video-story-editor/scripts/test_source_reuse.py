"""Original-recording identity acceptance, including nested montage sources."""
import unittest
from preflight_story import validate_source_reuse

class SourceReuse(unittest.TestCase):
    def test_nonoverlapping_ranges_still_fail(self):
        self.assertTrue(validate_source_reuse([dict(source='C:/a.mp4',**{'in':0,'out':1}),dict(source='c:\\a.mp4',**{'in':8,'out':9})]))
    def test_renamed_identical_bytes_fail(self):
        self.assertTrue(validate_source_reuse([dict(source='a.mp4',source_sha256='AB'),dict(source='renamed.mp4',source_sha256='ab')]))
    def test_derivative_original_identity_fails(self):
        self.assertTrue(validate_source_reuse([dict(source='crop.mp4',original_source_id='recording1'),dict(source='grade.mp4',original_source_id='recording1')]))
    def test_nested_montage_source_fails(self):
        self.assertTrue(validate_source_reuse([dict(source='a.mp4'),dict(source='b.mp4',additional_sources=[dict(path='a.mp4')])]))
    def test_layers_within_one_occurrence_are_allowed(self):
        self.assertEqual([],validate_source_reuse([dict(source='a.mp4',additional_sources=[dict(path='a.mp4')]),dict(source='b.mp4')]))
    def test_distinct_sources_pass(self):
        self.assertEqual([],validate_source_reuse([dict(source='a.mp4',source_sha256='aa'),dict(source='b.mp4',source_sha256='bb')]))

if __name__=='__main__':unittest.main()
