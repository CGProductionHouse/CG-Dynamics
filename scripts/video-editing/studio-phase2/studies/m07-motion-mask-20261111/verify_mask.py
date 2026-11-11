"""Execute source and encoded positive/negative controls, preserving actual failures."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
import cv2
import numpy as np
from track_lens import SOURCE,EXPECTED,CENTRE,source_frames,track,initial_features
from render_tracked_mask import add_lens_mask,eased,OUTPUT
ROOT=Path(__file__).parent
FRAMES=source_frames()
TRACK=track(FRAMES)
REC=json.loads((OUTPUT/"RENDER-RECEIPT.json").read_text(encoding="utf-8"))

def decode(path):
    v=cv2.VideoCapture(str(path))
    result=[]
    while True:
        good,f=v.read()
        if not good:break
        result.append(f)
    meta=(v.get(cv2.CAP_PROP_FRAME_WIDTH),v.get(cv2.CAP_PROP_FRAME_HEIGHT),v.get(cv2.CAP_PROP_FPS))
    v.release()
    return result,meta

VIDEOS={}
for v in REC["videos"]:
    p=Path(v["path"])
    if p.stat().st_size!=v["bytes"] or hashlib.sha256(p.read_bytes()).hexdigest()!=v["sha256"]:
        raise ValueError("ENCODED_BYTES_CHANGED")
    VIDEOS[v["kind"]]=decode(p)
def mean_abs(a,b,mask):
    diff=cv2.absdiff(a,b).astype(np.float32).mean(axis=2)
    return float(diff[mask].mean())
def roi_mask(position,rad,inside=True):
    h,w=FRAMES[0].shape[:2]
    x,y=np.ogrid[:h,:w];cx,cy=position["center"]
    dist=(x-cy)**2+(y-cx)**2
    b=dist < (rad*position["scale"])**2
    return b if inside else ~b

class MotionMaskEvidence(unittest.TestCase):
    def test_01_existing_source_hash(self):self.assertEqual(hashlib.sha256(SOURCE.read_bytes()).hexdigest(),EXPECTED)
    def test_02_rights_record_exact(self):self.assertEqual(REC["source_rights"],"Poly Haven Camera 01 original CC0 .blend verified M03")
    def test_03_live_action_not_claimed(self):self.assertIn("NOT live-action",REC["source_type"])
    def test_04_source_video_metadata(self):self.assertEqual((len(FRAMES),FRAMES[0].shape),(90,(1080,1920,3)))
    def test_05_no_loop_or_same_frame(self):self.assertGreater(float(np.abs(FRAMES[0].astype(float)-FRAMES[-1]).mean()),5)
    def test_06_initial_feature_count(self):self.assertGreaterEqual(TRACK["initial_features"],25)
    def test_07_track_real_motion(self):self.assertGreater(TRACK["end_to_start_px"],40)
    def test_08_real_inlier_ratio(self):self.assertGreater(TRACK["min_inlier_fraction"],.9)
    def test_09_no_tracking_dropout(self):self.assertGreaterEqual(min(p["features"] for p in TRACK["positions"]),25)
    def test_10_source_missing_block(self):
        with self.assertRaises(ValueError):source_frames(ROOT/"missing.mp4")
    def test_11_source_tamper_block(self):
        with tempfile.TemporaryDirectory(dir=ROOT) as td:
            q=Path(td)/"modified.mp4";q.write_bytes(SOURCE.read_bytes()+b"tamper")
            with self.assertRaises(ValueError):source_frames(q)
    def test_12_blank_track_negative(self):
        with self.assertRaises(ValueError):initial_features(np.zeros((540,960),np.uint8))
    def test_13_invalid_anchor_negative(self):
        with self.assertRaises(ValueError):add_lens_mask(FRAMES[44],{"center":[1.,1.],"scale":1},1.5)
    def test_14_static_track_would_fail_motion(self):
        static=[TRACK["positions"][0]["center"]]*90
        self.assertLess(np.linalg.norm(np.array(static[-1])-np.array(static[0])),1)
        self.assertGreater(TRACK["end_to_start_px"],40)
    def test_15_empty_at_beginning(self):
        a,mask=add_lens_mask(FRAMES[0],TRACK["positions"][0],0)
        self.assertTrue(np.array_equal(a,FRAMES[0]))
        self.assertEqual(int(mask.max()),0)
    def test_16_mask_lens_local_only(self):
        a,mask=add_lens_mask(FRAMES[44],TRACK["positions"][44],44/30)
        self.assertGreater(int(mask.max()),160)
        self.assertTrue(np.array_equal(a[mask==0],FRAMES[44][mask==0]))
        self.assertGreater(float(np.abs(a.astype(float)-FRAMES[44].astype(float))[mask>200].mean()),5)
    def test_17_unrelated_top_left_unchanged_raw(self):
        a,_=add_lens_mask(FRAMES[44],TRACK["positions"][44],44/30)
        self.assertTrue(np.array_equal(a[:240,:650],FRAMES[44][:240,:650]))
    def test_18_plain_source_controls_are_distinct_files(self):self.assertEqual(len({v["sha256"] for v in REC["videos"]}),3)
    def test_19_all_90_encoded_frames(self):
        for kind,(frames,meta) in VIDEOS.items():
            with self.subTest(kind=kind):
                self.assertEqual(len(frames),90)
                self.assertEqual(meta[:2],(1920.,1080.))
                self.assertAlmostEqual(meta[2],30.,places=2)
    def test_20_no_black_encoded_frames(self):
        for kind,(frames,_) in VIDEOS.items():
            self.assertGreater(min(float(f.mean()) for f in frames),10,kind)
    def test_21_plain_matches_source(self):
        p=VIDEOS["PLAIN"][0][44];self.assertLess(float(np.abs(p.astype(float)-FRAMES[44].astype(float)).mean()),9)
    def test_22_effect_inside_tracked_boundary(self):
        idx=44;p=TRACK["positions"][idx];effect=VIDEOS["TRACKED"][0][idx];plain=VIDEOS["PLAIN"][0][idx]
        self.assertGreater(mean_abs(effect,plain,roi_mask(p,58)),2.1)
    def test_23_effect_protected_far_field(self):
        e=VIDEOS["TRACKED"][0][44];p=VIDEOS["PLAIN"][0][44]
        self.assertLess(float(np.abs(e[:260,:680].astype(float)-p[:260,:680].astype(float)).mean()),1.5)
    def test_24_negative_lag_visible_at_mid(self):
        at=TRACK["positions"][44]["center"];base=TRACK["positions"][0]["center"]
        self.assertGreater(float(np.linalg.norm(np.array(at)-np.array(base))),45)
        a=VIDEOS["TRACKED"][0][44];b=VIDEOS["NEGATIVE_STATIC"][0][44]
        self.assertGreater(float(np.abs(a.astype(float)-b.astype(float)).mean()),.03)
    def test_25_ends_dont_develop_new_motion(self):
        self.assertLess(eased(2.99),.003)
    def test_26_full_encoded_deviation(self):
        e=VIDEOS["TRACKED"][0];p=VIDEOS["PLAIN"][0]
        self.assertGreater(sum(float(np.abs(e[k].astype(float)-p[k].astype(float)).mean()) for k in [25,44,70]),.05)
    def test_27_source_and_outputs_separate(self):
        self.assertTrue(all(Path(v["path"]).parent==OUTPUT and Path(v["path"])!=SOURCE for v in REC["videos"]))
    def test_28_not_client_approved(self):self.assertEqual(REC["purpose"],"TECHNICAL_PROOF_ONLY")
    def test_29_not_sound_ready(self):self.assertEqual(REC["sound"],"SILENT")
    def test_30_no_network_source(self):
        self.assertTrue(SOURCE.is_file());self.assertFalse(str(SOURCE).startswith("http"))

def contact_sheet():
    cells=[]
    for k in [25,44,70]:
        src=VIDEOS["PLAIN"][0][k]
        eff=VIDEOS["TRACKED"][0][k]
        neg=VIDEOS["NEGATIVE_STATIC"][0][k]
        imgs=[]
        for name,frm in [("PLAIN",src),("TRACKED",eff),("NEGATIVE STATIC",neg)]:
            sub=cv2.resize(frm,(720,405),interpolation=cv2.INTER_AREA)
            cv2.putText(sub,name+f" / F{k}",(13,30),cv2.FONT_HERSHEY_SIMPLEX,.6,(230,240,255),2,cv2.LINE_AA)
            imgs.append(sub)
        cells.append(np.hstack(imgs))
    cv2.imwrite(str(OUTPUT/"motion-mask-encoded-contact.jpg"),np.vstack(cells),[cv2.IMWRITE_JPEG_QUALITY,90])

if __name__=="__main__":
    import sys,io
    runner=unittest.TextTestRunner(stream=sys.stdout,verbosity=1)
    result=runner.run(unittest.defaultTestLoader.loadTestsFromTestCase(MotionMaskEvidence))
    status={"tests":result.testsRun,"failures":[x.id() for x,_ in result.failures],"errors":[x.id() for x,_ in result.errors],"passed":result.testsRun-len(result.errors)-len(result.failures),"encoded_outputs":{k:len(v[0]) for k,v in VIDEOS.items()},"source_sha256":EXPECTED}
    (OUTPUT/"TEST-RESULTS.json").write_text(json.dumps(status,indent=2),encoding="utf-8")
    if not result.wasSuccessful():sys.exit(2)
    contact_sheet()
    print(json.dumps(status))