import gzip
from pathlib import Path
import tempfile
import unittest

from audit_local_pipeline import duplicate_project, inspect_project, inspect_interchange, decode_file_url, validate_output


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / 'source.prproj'
        self.source.write_bytes(gzip.compress(b'<PremiereData Version="3"><FilePath>missing.mov</FilePath></PremiereData>'))

    def test_copy_preserves_original_bytes_and_hash(self):
        before = self.source.read_bytes()
        result = duplicate_project(self.source, self.root / 'pilot/copy.prproj')
        self.assertTrue(result['original_unchanged'])
        self.assertEqual(before, self.source.read_bytes())
        self.assertEqual(before, (self.root / 'pilot/copy.prproj').read_bytes())

    def test_refuses_overwrite(self):
        target = self.root / 'existing.prproj'
        target.write_bytes(b'keep')
        with self.assertRaises(ValueError):
            duplicate_project(self.source, target)
        self.assertEqual(b'keep', target.read_bytes())

    def test_refuses_original_as_target(self):
        with self.assertRaises(ValueError):
            duplicate_project(self.source, self.source)

    def test_reports_offline_media_without_mutation(self):
        before = self.source.read_bytes()
        result = inspect_project(self.source)
        self.assertEqual(['missing.mov'], result['missing_media'])
        self.assertEqual(before, self.source.read_bytes())

    def test_rejects_nonlocal_reference(self):
        with self.assertRaises(ValueError):
            decode_file_url('https://example.com/private.mov')
        with self.assertRaises(ValueError):
            decode_file_url('file://unverified-share/private.mov')

    def test_native_graphic_identifier_stays_visible_without_false_offline_file(self):
        self.source.write_bytes(gzip.compress(b'<PremiereData><Media><FilePath>1196574294</FilePath><ActualMediaFilePath>1196574294</ActualMediaFilePath><Title>Graphic</Title><Infinite>true</Infinite></Media><FilePath>missing.mov</FilePath></PremiereData>'))
        result = inspect_project(self.source)
        self.assertEqual(2, result['media_count'])
        self.assertEqual(1, result['filesystem_media_count'])
        self.assertEqual(['1196574294'], result['generated_reference_candidates'])
        self.assertEqual(['missing.mov'], result['missing_media'])

    def test_detects_flattened_interchange(self):
        xml = self.root / 'edit.xml'
        xml.write_text('<xmeml version="4"><sequence><name>Pilot</name><duration>375</duration><rate><timebase>25</timebase></rate><media><video><format><samplecharacteristics><width>1080</width><height>1920</height></samplecharacteristics></format><track><clipitem/></track></video><audio><track/></audio></media></sequence></xmeml>')
        result = inspect_interchange(xml)['sequences'][0]
        self.assertEqual([1080, 1920], result['dimensions'])
        self.assertEqual(0, result['filter_nodes'])
        self.assertEqual(0, result['keyframe_nodes'])

    def test_rejects_private_report_inside_repo_or_over_input(self):
        with self.assertRaises(ValueError):
            validate_output(self.root / 'repo/private.json', self.root / 'repo', [])
        with self.assertRaises(ValueError):
            validate_output(self.source, self.root / 'repo', [self.source])

    def test_rejects_future_pilot_as_report_destination(self):
        pilot = self.root / 'pilot.prproj'
        with self.assertRaises(ValueError):
            validate_output(pilot, self.root / 'repo', [pilot])


if __name__ == '__main__':
    unittest.main()
