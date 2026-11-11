"""M08 source/negative/structural tests; no Adobe client or session activity."""
import copy
import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path
from unittest.mock import patch
from urllib.parse import unquote
import nolan_m08_fcp7_xml as m

ROOT = Path(__file__).resolve().parent
PROBE = Path(r"C:\Users\info\Documents\Codex\2026-10-27\n\work\tools\ffmpeg-9.0.2-essentials_build\bin\ffprobe.exe")

class M08Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads((ROOT/"M08-INPUT-MANIFEST.json").read_text(encoding="utf-8"))
        cls.sources = m.validate(cls.manifest, PROBE)

    def bad(self, mutator):
        item = copy.deepcopy(self.manifest)
        mutator(item)
        with self.assertRaises((m.Blocked, KeyError, ValueError)):
            m.validate(item, PROBE)

    def test_01_real_two_source_hash(self):
        self.assertEqual(set(self.sources), {"base", "overlay"})
        self.assertEqual(self.sources["overlay"]["probe"]["stream"]["pix_fmt"], "yuva444p12le")

    def test_02_xml_valid_fcp7_and_two_tracks(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d)/"handoff.xml"
            result = m.emit(self.manifest, PROBE, out)
            tree = ET.parse(out)
            r = tree.getroot()
            self.assertEqual((r.tag, r.attrib["version"]), ("xmeml", "5"))
            self.assertEqual(r.findtext("sequence/duration"), "90")
            self.assertEqual(r.findtext("sequence/rate/timebase"), "30")
            self.assertEqual(r.findtext("sequence/timecode/string"), "00:00:00:00")
            tracks = r.findall("sequence/media/video/track")
            self.assertEqual(len(tracks), 2)
            for role, tr in zip(("base", "overlay"), tracks):
                clip = tr.find("clipitem")
                self.assertEqual(clip.attrib["id"], "clip-"+role)
                self.assertEqual([clip.findtext(x) for x in ("start", "end", "in", "out")], ["0","90","0","90"])
                f = clip.find("file")
                self.assertEqual(f.attrib["id"], "file-"+role)
                self.assertTrue(unquote(f.findtext("pathurl")).startswith("file://localhost/"))
                self.assertIn(self.sources[role]["path"].name, unquote(f.findtext("pathurl")))
            self.assertEqual(result["status"], "INTERCHANGE_CANDIDATE_HOST_UNVERIFIED")
            self.assertEqual(result["xml_sha256"], m.digest(out))
            self.assertIn("Adobe native Premiere import", result["not_qualified"])

    def test_03_protect_existing_handoff(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"existing.xml"; p.write_text("DO NOT REPLACE", encoding="utf-8")
            with self.assertRaises(m.Blocked):
                m.emit(self.manifest, PROBE, p)
            self.assertEqual(p.read_text(), "DO NOT REPLACE")

    def test_04_owner_approval_cannot_be_invented(self):
        self.bad(lambda x: x.update(owner_review_status="APPROVED"))

    def test_05_wrong_purpose(self):
        self.bad(lambda x: x.update(purpose="CLIENT_FILM"))

    def test_06_rights_not_guessed(self):
        self.bad(lambda x: x.update(source_rights="STOCK_UNVERIFIED"))

    def test_07_client_asset_rejected(self):
        self.bad(lambda x: x["sources"]["base"].update(client_asset=True))

    def test_08_role_mismatch(self):
        self.bad(lambda x: x["sources"]["overlay"].update(role="base"))

    def test_09_bad_hash_rejected(self):
        self.bad(lambda x: x["sources"]["base"].update(sha256="0"*64))

    def test_10_missing_file_rejected(self):
        self.bad(lambda x: x["sources"]["base"].update(path=r"C:\missing-Nolan-source-20261111.mp4"))

    def test_11_reused_same_source_rejected(self):
        self.bad(lambda x: x["sources"].update(overlay=copy.deepcopy(x["sources"]["base"])|{"role":"overlay"}))

    def test_12_wrong_timeline_fps(self):
        self.bad(lambda x: x.update(fps=25))

    def test_13_wrong_timeline_length(self):
        self.bad(lambda x: x.update(frames=89))

    def test_14_fake_overlay_alpha_rejected(self):
        fake=copy.deepcopy(self.sources["overlay"]["probe"])
        fake["stream"]=copy.deepcopy(fake["stream"])
        fake["stream"]["pix_fmt"]="yuv420p"
        true=m.probe
        def injected(p,ff):
            if str(p)==self.manifest["sources"]["overlay"]["path"]:
                return fake
            return true(p,ff)
        with patch.object(m, "probe", side_effect=injected):
            with self.assertRaises(m.Blocked):
                m.validate(self.manifest, PROBE)

    def test_15_wrong_encoded_fps_rejected(self):
        fake=copy.deepcopy(self.sources["base"]["probe"])
        fake["stream"]=copy.deepcopy(fake["stream"])
        fake["stream"]["avg_frame_rate"]="25/1"
        original=m.probe
        with patch.object(m, "probe", side_effect=lambda p,ff: fake if str(p)==self.manifest["sources"]["base"]["path"] else original(p,ff)):
            with self.assertRaises(m.Blocked):
                m.validate(self.manifest, PROBE)

    def test_16_missing_audio_clearance_evidence_is_not_assumed(self):
        self.assertFalse(self.sources["base"]["probe"]["has_audio"])
        self.assertEqual(self.sources["base"]["probe"]["has_audio"], False)
        self.assertEqual(self.sources["overlay"]["probe"]["has_audio"], False)

if __name__=="__main__":
    unittest.main(verbosity=2)
