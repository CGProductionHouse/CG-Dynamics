"""Self-authored Lottie-web 5.13.0 desktop technical proof, not a client or source-reference replication."""
from pathlib import Path
import json,hashlib,copy
ROOT=Path(__file__).resolve().parent
RUNTIME=ROOT.parent
PY=RUNTIME.parent/'editor-python/Scripts/python.exe'
FF=RUNTIME.parent/'ffmpeg-9.0.2-essentials_build/bin'
MODES=('effect','plain','late')
FPS=30
FRAMES=90

def scalar(k):return {'a':0,'k':k}
def animated(items):
    return {'a':1,'k':[{'t':t,'s':s,'e':e,'o':{'x':0.28,'y':0.18},'i':{'x':0.72,'y':0.82}} for t,s,e in items[:-1]]+[{'t':items[-1][0],'s':items[-1][1]}]}
def transform(pos):
    return {'o':scalar(100),'r':scalar(0),'p':pos,'a':scalar([0,0,0]),'s':scalar([100,100,100])}
def ellipse(size):return {'ty':'el','d':1,'p':scalar([0,0]),'s':scalar(size),'nm':'Authored circle'}
def group(items):return {'ty':'gr','it':items+[{'ty':'tr','p':scalar([0,0]),'a':scalar([0,0]),'s':scalar([100,100]),'r':scalar(0),'o':scalar(100),'sk':scalar(0),'sa':scalar(0),'nm':'Group transform'}],'nm':'Authored ring'}
def layer(ind,name,shapes,pos):
    return {'ddd':0,'ind':ind,'ty':4,'nm':name,'sr':1,'ks':transform(pos),'ao':0,'shapes':shapes,'ip':0,'op':90,'st':0,'bm':0}
rim=group([ellipse([520,520]),{'ty':'st','c':scalar([.14,.31,.39,1]),'o':scalar(100),'w':scalar(22),'lc':2,'lj':2,'nm':'Static guide'}])
arc=group([ellipse([520,520]),{'ty':'st','c':scalar([.22,.84,.82,1]),'o':scalar(100),'w':scalar(32),'lc':2,'lj':2,'nm':'Animated stroke'},{'ty':'tm','s':scalar(0),'e':animated([(0,[0],[94]),(62,[94],[94])]),'o':scalar(-90),'m':1,'nm':'Trim reveal'}])
dot=group([ellipse([64,64]),{'ty':'fl','c':scalar([.97,.57,.32,1]),'o':scalar(100),'r':1,'nm':'Amber fill'}])
data={'v':'5.13.0','fr':30,'ip':0,'op':90,'w':900,'h':900,'nm':'Original Nolan proof vector - orbiting dot and drawing ring','ddd':0,'assets':[],'layers':[
    layer(1,'Amber indicator - actual Lottie path animation',[dot],animated([(0,[450,175,0],[675,450,0]),(42,[675,450,0],[450,725,0]),(89,[450,725,0],[450,725,0])])),
    layer(2,'Teal progress arc - Lottie trim',[arc],scalar([450,450,0])),
    layer(3,'Stationary guide - constant shape',[rim],scalar([450,450,0]))
],'markers':[]}
HTML='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=1920"><title>Nolan Lottie 5.13.0 technical proof</title><style>
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;background:#0b1b26;overflow:hidden;color:#e8f0f2;font-family:Arial,Helvetica,sans-serif}
#scene{position:absolute;inset:0;background:radial-gradient(ellipse at 66% 45%,#183d4d 0%,#0b1b26 65%)}
.rule{position:absolute;background:#ffffff18}.h{top:130px;left:120px;width:1680px;height:1px}.v{top:150px;left:120px;height:750px;width:1px}
#eyebrow{position:absolute;left:125px;top:94px;font-size:24px;letter-spacing:5px;color:#8ebdc1}
#headline{position:absolute;left:125px;top:290px;font-size:106px;font-weight:850;letter-spacing:-6px;line-height:.94}
#headline em{font-style:normal;color:#41c8bd}#sub{position:absolute;top:590px;left:135px;font-size:31px;line-height:1.55;color:#a9bcc6}
#vector{position:absolute;left:970px;top:130px;width:810px;height:810px;overflow:hidden}
#tag{position:absolute;bottom:80px;left:130px;letter-spacing:4px;font-size:23px;color:#d7a37f}
#disclaimer{position:absolute;bottom:35px;right:128px;font-size:17px;color:#9eabb4}
</style></head><body><div id="scene"><div class="rule h"></div><div class="rule v"></div>
<div id="eyebrow">NOLAN STUDIO / VECTOR MOTION STUDY</div><div id="headline">FRAME<br>DRIVEN<br><em>MOTION.</em></div>
<div id="sub">Original Lottie vector geometry.<br>Deterministic frame-addressed reveal.<br>Private native-resolution test only.</div>
<div id="vector"></div><div id="tag">LOTTIE / ISOLATED ENGINEERING PROOF</div><div id="disclaimer">SILENT TECHNICAL STUDY · NOT CLIENT READY</div></div>
<script src="/vendor/lottie.js"></script><script src="assets/iris-data.js"></script><script src="mode.js"></script>
<script>
const animation=lottie.loadAnimation({container:document.getElementById('vector'),renderer:'svg',loop:false,autoplay:false,
rendererSettings:{progressiveLoad:false},animationData:structuredClone(window.NOLAN_VECTOR_DATA)});
const ready=new Promise((resolve,reject)=>{animation.addEventListener('DOMLoaded',resolve);animation.addEventListener('data_failed',()=>reject(new Error('Lottie data failed')));if(animation.isLoaded)resolve();});
window.seek=async function(t){if(!Number.isFinite(t)||t<0||t>3)throw new RangeError('Frame time must be 0..3s');
await ready;const n=Math.min(89,Math.floor(t*30));const frame=window.NOLAN_MODE==='plain'?0:(window.NOLAN_MODE==='late'?Math.max(0,n-45):n);
animation.goToAndStop(frame,true);window.NolanProof={mode:window.NOLAN_MODE,frame,loaded:animation.isLoaded,
sourceFrames:animation.getDuration(true),renderer:'svg',autoplay:false};};
window.seek(0);
</script></body></html>'''
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def source_bound(p,name):return {'id':name,'path':str(p),'sha256':sha(p),'rights_evidence':'Original CG Nolan synthetic procedural vector; private technical-only study'}
def create():
    assert not list(ROOT.glob('qualification-*')), 'Protected studies already exist'
    for mode in MODES:
        d=ROOT/('qualification-'+mode);assets=d/'assets';assets.mkdir(parents=True)
        html=d/'index.html';html.write_text(HTML,encoding='utf8')
        js=assets/'iris-data.js';js.write_text('window.NOLAN_VECTOR_DATA='+json.dumps(data,separators=(',',':'))+';',encoding='utf8')
        src=assets/'source.lottie.json';src.write_text(json.dumps(data,indent=2),encoding='utf8')
        modejs=d/'mode.js';modejs.write_text('window.NOLAN_MODE='+json.dumps(mode)+';',encoding='utf8')
        cfg={'schema':1,'purpose':'technical_proof','html':'index.html','watermark':'TECHNICAL PROOF - NOT CLIENT READY',
             'canvas':{'width':1920,'height':1080,'fps':FPS,'frames':FRAMES},
             'render_at_output_resolution':True,'headless_isolation':True,'require_layout_variety':False,
             'output_name':'NOLAN-M07-LOTTIE-'+mode.upper()+'-3S.mp4',
             'python':str(PY),'chrome':r'C:\Program Files\Google\Chrome\Application\chrome.exe',
             'ffmpeg':str(FF/'ffmpeg.exe'),'ffprobe':str(FF/'ffprobe.exe'),
             'scenes':[{'in_frame':0,'out_frame':90,'purpose':'Study actual vector trim and path animation; compare matched static and deliberately late controls',
                        'layout':'Left editorial text, central independent vector stage','mechanism':'Pinned lottie-web SVG goToAndStop/frame-accurate seek'}],
             'assets':[source_bound(p,p.relative_to(d).as_posix()) for p in (html,js,src,modejs)],
             'sample_frames':[0,10,35,45,65,89]}
        (d/'config.json').write_text(json.dumps(cfg,indent=2),encoding='utf8')
    (ROOT/'SOURCE-CHECKSUMS.json').write_text(json.dumps({'control_modes':list(MODES),'lottie_version':'installed pinned lottie-web 5.13.0','source':str(ROOT/'qualification-effect/assets/source.lottie.json'),'sha256':sha(ROOT/'qualification-effect/assets/source.lottie.json'),'created_by':'original procedural Nolan proof, no third party assets','source_timecode':'0 to 90 frames @30fps'},indent=2),encoding='utf8')
    print('JOBS_CREATED',len(MODES),'ORIGINAL_LOTTIE_SHA',sha(ROOT/'qualification-effect/assets/source.lottie.json'))
if __name__=='__main__':create()
