"""Independent exact 90-frame decode, motion and plain-vs-overlay checks."""
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path
import cv2
import numpy as np
from nolan_m08_fcp7_xml import digest

D=Path(__file__).resolve().parent
cfg=json.loads((D/"M08-INPUT-MANIFEST.json").read_text())
base=Path(cfg["sources"]["base"]["path"])
composite=D/"M08-BAKED-ALPHA-CONTROL-1080P.mp4"
xml=D/"M08-SOURCE-BOUND-TECHNICAL-FCP7.xml"
probe=Path(r"C:\Users\info\Documents\Codex\2026-10-27\n\work\tools\ffmpeg-9.0.2-essentials_build\bin\ffprobe.exe")
ff=probe.with_name("ffmpeg.exe")

def frames(path):
    cap=cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise AssertionError("OpenCV failed "+str(path))
    total=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total!=90:
        raise AssertionError(f"Not 90 frames: {total}")
    samples={}
    hashes=[]
    all_count=0
    while True:
        ok,frame=cap.read()
        if not ok: break
        if frame.shape!=(1080,1920,3):
            raise AssertionError("Wrong resolution")
        if float(frame.mean())<0.25:
            raise AssertionError("Black frame")
        if all_count in (0,22,44,66,89):
            samples[all_count]=frame
        hashes.append(digest_frame(frame))
        all_count+=1
    cap.release()
    if all_count!=90:
        raise AssertionError("Incomplete independent frame decode")
    return samples,hashes

def digest_frame(f):
    import hashlib
    return hashlib.sha256(f.tobytes()).hexdigest()

for media in (base,composite):
    subprocess.run([str(ff),"-v","error","-nostdin","-i",str(media),
                    "-f","null","NUL"],check=True,timeout=100)

b,bhash=frames(base)
v,vhash=frames(composite)
if len(set(vhash))!=90:
    raise AssertionError("Consecutive or other exact duplicate frames")
inside=[]
outside=[]
for k in b:
    delta=cv2.absdiff(v[k],b[k])
    inside.append(round(float(delta[:, :, :].mean()),3))
    # Source film has transparent corners; use independently encoded top-left.
    outside.append(round(float(delta[10:100,10:100].mean()),3))
if min(inside)<0.5:
    raise AssertionError("Compositing changed too little; alpha may be ignored")
if max(outside)>6.0:
    raise AssertionError("Upper-left far field unexpectedly changed")
xmltree=ET.parse(xml)
if xmltree.getroot().tag!="xmeml":
    raise AssertionError("Not an FCP7 XML")
if len(xmltree.findall(".//sequence/media/video/track"))!=2:
    raise AssertionError("Missing overlay track")
# Contact is for visual inspection only, not proof by itself.
frames_out=[]
for title, sample in (("PLAIN0",b[0]),("MERGE0",v[0]),
                     ("PLAIN44",b[44]),("MERGE44",v[44]),
                     ("PLAIN89",b[89]),("MERGE89",v[89])):
    im=cv2.resize(sample,(640,360),interpolation=cv2.INTER_AREA)
    cv2.putText(im,title,(12,35),cv2.FONT_HERSHEY_SIMPLEX,0.8,(255,255,255),2,cv2.LINE_AA)
    frames_out.append(im)
contact=np.vstack([np.hstack(frames_out[0:2]),np.hstack(frames_out[2:4]),np.hstack(frames_out[4:6])])
out=D/"M08-ENCODED-CONTACT.jpg"
if not cv2.imwrite(str(out),contact):
    raise AssertionError("Cannot write contact")
result={
 "status":"SOURCE_BOUND_ENCODED_CONTROL_PASS_NATIVE_HOST_UNVERIFIED",
 "source_plain_sha256":digest(base),
 "baked_sha256":digest(composite),
 "xml_sha256":digest(xml),
 "frames_decoded_each":90,
 "fps":30, "width":1920, "height":1080,
 "sampled_frames":sorted(b),
 "plain_vs_composite_mean_abs_rgb":dict(zip(map(str,b),inside)),
 "protected_top_left_mean_abs_rgb":dict(zip(map(str,b),outside)),
 "unique_decoded_composite_frame_hashes":len(set(vhash)),
 "reference_sources":[cfg["sources"]["base"]["sha256"],cfg["sources"]["overlay"]["sha256"]],
 "output_contact":out.name,
 "limitation":"Silent FFmpeg-baked control. Premiere import/save/reopen/export NOT tested; not a client edit."
}
(D/"M08-INDEPENDENT-ENCODED-VERIFICATION.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
print(json.dumps(result,indent=2))
