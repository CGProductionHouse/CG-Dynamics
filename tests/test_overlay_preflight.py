import importlib.util
import tempfile
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location('overlay_preflight', Path(__file__).parents[1] / 'scripts/poster-studio/overlay_preflight.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class OverlayPreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.manifest = {
            'schemaVersion': 1, 'canvas': {'width': 100, 'height': 100},
            'regions': [{'id': 'live-caption', 'pageId': 'p1', 'rect': [20, 20, 60, 40]}],
            'overlays': [{'id': 'new-panel', 'pageId': 'p1', 'path': 'graphic.png', 'rect': [0, 0, 100, 100], 'declaredOrder': 'above-existing-content'}],
        }

    def tearDown(self):
        self.temp.cleanup()

    def save(self, alpha):
        Image.new('RGBA', (100, 100), (30, 50, 80, alpha)).save(self.root / 'graphic.png')

    def test_opaque_panel_reproduces_hidden_live_caption_failure(self):
        self.save(255)
        result = module.audit(self.manifest, self.root)
        self.assertEqual(result['blockerCount'], 1)
        self.assertEqual(result['findings'][0]['opaqueCoverage'], 1)

    def test_open_frame_does_not_obscure_inner_copy(self):
        im = Image.new('RGBA', (100, 100))
        ImageDraw.Draw(im).rectangle((10, 10, 90, 70), outline='red', width=3)
        im.save(self.root / 'graphic.png')
        self.assertEqual(module.audit(self.manifest, self.root)['findings'], [])

    def test_translucent_panel_can_still_dull_most_of_a_caption(self):
        self.save(90)
        self.assertEqual(module.audit(self.manifest, self.root)['blockerCount'], 1)
        self.manifest['overlays'][0]['opacity'] = .5
        result = module.audit(self.manifest, self.root)
        self.assertEqual(result['blockerCount'], 0)
        self.assertEqual(result['reviewCount'], 1)

    def test_actual_placement_and_exact_page_limit_the_check(self):
        self.save(255)
        self.manifest['overlays'][0]['rect'] = [-10, -10, 20, 20]
        self.assertEqual(module.audit(self.manifest, self.root)['findings'], [])
        self.manifest['overlays'][0]['rect'] = [0, 0, 100, 100]
        self.manifest['overlays'][0]['pageId'] = 'different-page'
        self.assertEqual(module.audit(self.manifest, self.root)['measuredPairs'], 0)
        self.manifest['overlays'][0]['pageId'] = 74
        with self.assertRaises(ValueError):
            module.audit(self.manifest, self.root)

    def test_thin_decoration_still_blocks_strict_photo_feature_clearance(self):
        im = Image.new('RGBA', (100, 100))
        ImageDraw.Draw(im).line((20, 40, 80, 40), fill='white', width=1)
        im.save(self.root / 'graphic.png')
        self.assertEqual(module.audit(self.manifest, self.root)['findings'], [])
        self.manifest['regions'][0]['strictClearance'] = True
        result = module.audit(self.manifest, self.root)
        self.assertEqual(result['blockerCount'], 1)
        self.assertTrue(result['findings'][0]['strictClearance'])

    def test_background_assertion_and_review_reason_are_not_auto_approval(self):
        self.save(255)
        self.manifest['overlays'][0]['declaredOrder'] = 'background-plane'
        result = module.audit(self.manifest, self.root)
        self.assertEqual(result['declaredBackgroundPlanesNotChecked'], 1)
        self.manifest['overlays'][0]['declaredOrder'] = 'above-existing-content'
        self.manifest['overlays'][0]['reviewedOcclusions'] = {'live-caption': 'Owner requested source silhouette/type overlap; native preview reviewed.'}
        result = module.audit(self.manifest, self.root)
        self.assertEqual(result['reviewedOcclusionCount'], 1)
        self.assertIn('No glyph', result['meaning'])
        self.manifest['overlays'][0]['reviewedOcclusions'] = {'live-caption': 'fine'}
        with self.assertRaises(ValueError):
            module.audit(self.manifest, self.root)


if __name__ == '__main__':
    unittest.main()
