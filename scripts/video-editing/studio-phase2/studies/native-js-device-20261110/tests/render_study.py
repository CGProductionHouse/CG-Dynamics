#!/usr/bin/env python3
"""Isolated proof harness for the existing Nolan seek(t) browser contract.

No client release, user-browser profile, package installation or live runtime change.
Playwright and FFmpeg are execution dependencies; the HTML itself has none.
"""
from __future__ import annotations
import argparse, hashlib, json, os, shutil, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright

def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def main() -> None:
    parser=argparse.ArgumentParser(description=__doc__)
    root=Path(__file__).resolve().parents[1]
    parser.add_argument('--html',type=Path,default=root/'demo/composition.html')
    parser.add_argument('--output',type=Path,default=root/'evidence/NOLAN-NATIVE-JS-18S.mp4')
    parser.add_argument('--chromium',default=os.getenv('NOLAN_CHROME') or shutil.which('chromium'))
    parser.add_argument('--ffmpeg',default=os.getenv('NOLAN_FFMPEG') or shutil.which('ffmpeg'))
    parser.add_argument('--tests-only',action='store_true')
    args=parser.parse_args()
    if not args.chromium or not args.ffmpeg:
        raise SystemExit('Supply --chromium and --ffmpeg paths to existing executables. No auto-install.')
    html=args.html.read_text(encoding='utf8');out=args.output
    out.parent.mkdir(parents=True,exist_ok=True)
    if out.exists() and not args.tests_only:
        raise SystemExit('Output exists. Use a new output path instead of overwriting a review.')
    report={'purpose':'technical_proof','state':'RUNNING','source_sha256':sha(html.encode()),'runtime_dependencies_in_html':0,'page_errors':[],'external_requests':[],'tests':{},'creative_approval':False,'sound':'SILENT_VISUAL_STUDY','user_profile_used':False}
    start=time.monotonic()
    def save_report():
        (out.parent/'QA-REPORT.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions'])
        try:
            ctx=browser.new_context(viewport={'width':1920,'height':1080},device_scale_factor=1,service_workers='block')
            page=ctx.new_page()
            page.on('pageerror',lambda e:report['page_errors'].append(str(e)))
            def block(route):
                report['external_requests'].append(route.request.url)
                route.abort()
            page.route('**/*',block)
            page.set_content(html,wait_until='load')
            page.evaluate("document.body.classList.add('capture')")
            page.wait_for_function('window.NOLAN_READY === true',timeout=5000)
            report['browser']=browser.version
            report['scene_metadata']=page.evaluate('window.NOLAN_SCENE')
            assert report['scene_metadata']['duration']==18
            assert report['scene_metadata']['renderContract']=='window.seek(seconds)'
            report['tests']['metadata_and_existing_seek_contract']=True
            def capture(t: float) -> bytes:
                page.evaluate('(t)=>window.seek(t)',t)
                return page.screenshot(type='png')
            hashes=[sha(capture(t)) for t in [2.75,9.1,2.75]]
            assert hashes[0]==hashes[2] and hashes[0]!=hashes[1],hashes
            report['tests']['out_of_order_seek_pixel_identical']=True
            report['seek_hashes']=hashes
            early=capture(2.75);late=capture(16.7)
            for t in [0,1.6,4.9,8.9,12.7,16.7,17.966667]:
                data=capture(t);(out.parent/f'FRAME-{round(t*30):04}.png').write_bytes(data)
            # One narrowly scoped copy revision must not alter the earlier story.
            changed=html.replace("title(['MADE','WITH CODE']","title(['CRAFTED','WITH CODE']")
            assert changed!=html
            page.set_content(changed,wait_until='load');page.evaluate("document.body.classList.add('capture')")
            assert sha(capture(2.75))==sha(early)
            assert sha(capture(16.7))!=sha(late)
            report['tests']['late_copy_revision_preserves_early_frames']=True
            page.set_content(html,wait_until='load');page.evaluate("document.body.classList.add('capture')")
            err=page.evaluate('(()=>{try{window.seek(NaN);return false}catch(e){return e instanceof TypeError}})()')
            assert err
            report['tests']['invalid_time_is_rejected']=True
            assert page.evaluate('window.seek(-3).time')==0
            assert page.evaluate('window.seek(90).time')==18
            report['tests']['timeline_clamps_at_boundaries']=True
            # Explicitly broken contract is rejected rather than papering over it.
            page.evaluate('window.seek=undefined')
            missing=page.evaluate("typeof window.seek!=='function'")
            assert missing
            report['tests']['missing_seek_negative_control_detected']=True
            page.set_content(html,wait_until='load');page.evaluate("document.body.classList.add('capture')")
            # Full frame-clock checking, not just headline bounding at one timestamp.
            geometry=[]
            for n in range(540):
                state=page.evaluate('(n)=>{window.seek(n/30);return window.NOLAN_QA}',n)
                for b in state['textBoxes']:
                    if b['alpha']>.05 and (b['x']<24 or b['y']<24 or b['x']+b['width']>1896 or b['y']+b['height']>1056):
                        geometry.append({'frame':n,'box':b})
            assert not geometry,geometry[:5]
            report['tests']['all_540_main_title_bounds']=True
            report['geometry_errors']=geometry
            # Interactive preview is separate from the render clock.
            page.evaluate("document.body.classList.remove('capture');window.seek(3)")
            page.click('#play');page.wait_for_timeout(120)
            current=page.evaluate('window.NOLAN_QA.time')
            assert current>3,current
            page.evaluate("window.seek(0);document.body.classList.add('capture')")
            report['tests']['play_pause_control_advances']=True
            assert not report['external_requests']
            assert not report['page_errors']
            report['tests']['no_external_requests_or_page_errors']=True
            if not args.tests_only:
                cmd=[args.ffmpeg,'-v','error','-nostdin','-f','image2pipe','-vcodec','png','-r','30','-i','-','-frames:v','540','-an','-c:v','libx264','-preset','medium','-crf','17','-pix_fmt','yuv420p','-vf','scale=in_range=pc:out_range=tv:out_color_matrix=bt709','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-threads','2','-movflags','+faststart',str(out)]
                enc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
                try:
                    for n in range(540):
                        data=capture(n/30)
                        enc.stdin.write(data)
                        if n%60==0:print(f'CAPTURE {n}/540',flush=True)
                finally:
                    enc.stdin.close()
                errors=enc.stderr.read().decode(errors='replace')
                if enc.wait():raise RuntimeError(errors[-1500:])
                fp=str(Path(args.ffmpeg).with_name('ffprobe'+('.exe' if args.ffmpeg.lower().endswith('.exe') else '')))
                probe=json.loads(subprocess.check_output([fp,'-v','error','-show_format','-show_streams','-of','json',str(out)]))
                vs=[s for s in probe['streams'] if s.get('codec_type')=='video']
                assert len(vs)==1 and vs[0]['width']==1920 and vs[0]['height']==1080 and int(vs[0]['nb_frames'])==540
                decoded=subprocess.run([args.ffmpeg,'-v','error','-nostdin','-i',str(out),'-f','null','-'],capture_output=True)
                assert decoded.returncode==0,decoded.stderr[-600:]
                report.update({'probe':probe,'output_sha256':sha(out.read_bytes()),'output_bytes':out.stat().st_size,'full_decode_passed':True})
                report['tests']['native_1080p_540_frame_export_and_full_decode']=True
            report['state']='TECHNICAL_PROOF_RENDERED_NOT_CREATIVE_APPROVAL' if not args.tests_only else 'CONTRACT_TESTS_PASS_NOT_CREATIVE_APPROVAL'
        except Exception as exc:
            report['state']='FAILED'
            report['failure']=str(exc)
            raise
        finally:
            report['elapsed_seconds']=round(time.monotonic()-start,2)
            save_report();browser.close()
    print(json.dumps({'state':report['state'],'tests':len(report['tests']),'output':str(out),'sha256':report.get('output_sha256')}),flush=True)
if __name__=='__main__':main()
