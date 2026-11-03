"""Actual plan -> portable operators -> encoded output -> existing release gate.

Synthetic regression inputs, never a client creative proof or a soundtrack audition.
"""
import copy
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import wave
from unittest.mock import patch

from PIL import Image, ImageDraw, ImageFont
from edit_contract import sha, check_render, validate_edit, picture_hashes
from preflight_story import validate, REQUIRED_TEXT
import check_client_release as release
from visual_treatments import type_reveal, registered_panels

REPO = Path(__file__).resolve().parents[4]
SCRIPTS = Path(__file__).resolve().parent


class EditContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not shutil.which('ffmpeg') or not shutil.which('ffprobe'):
            raise unittest.SkipTest('Actual encoded integration needs existing FFmpeg/ffprobe')
        cls.temp = tempfile.TemporaryDirectory(prefix='nolan-edit-contract-')
        cls.root = Path(cls.temp.name)
        cls.font = ImageFont.truetype(str(REPO/'scripts/video-editing/studio-phase2/scene/assets/SpaceGrotesk.ttf'),16)
        cls.plain = cls.root/'plain.mp4'; cls.final = cls.root/'2026_11_TEST_VIDEO_01.mp4'
        cls.cover=cls.root/'2026_11_TEST_VIDEO_01_COVER.png';Image.new('RGB',(128,224)).save(cls.cover)
        cls.caption=cls.root/'caption.txt';cls.caption.write_text('Synthetic test, not for delivery',encoding='utf-8')
        cls.evidence=cls.root/'review.json';cls.evidence.write_text('{}')
        cls.context=cls.root/'context.json';cls.context.write_text('{}')
        cls.music=cls.root/'test-signal.wav'
        with wave.open(str(cls.music),'wb') as signal:
            signal.setnchannels(1);signal.setsampwidth(2);signal.setframerate(8000)
            signal.writeframes(bytes(30*8000*2))  # Fixture signal only; audio acceptance remains separately mocked.
        # Generate first, then consume these actual planned spans/parameters in both encodes.
        cls.render_plan=cls('test_short_story_fails_before_a_render').plan()
        render=cls.render_plan
        for target, effect in [(cls.plain,False),(cls.final,True)]:
            process = subprocess.Popen(['ffmpeg','-nostdin','-v','error','-y','-f','rawvideo','-pix_fmt','rgb24',
                '-s','128x224','-r',str(render['fps']),'-i','-','-an','-c:v','libx264','-crf','18','-pix_fmt','yuv420p',str(target)],stdin=subprocess.PIPE)
            for i in range(render['shots'][-1]['timeline_out_frame']):
                shot_index=next(j for j,s in enumerate(render['shots']) if s['timeline_in_frame']<=i<s['timeline_out_frame'])
                image = Image.new('RGB',(128,224),[(12,25,40),(25,40,15),(40,15,25)][shot_index])
                ImageDraw.Draw(image).ellipse((i%90,120,i%90+20,140),fill=(130,140,150))
                for choice in render['skill_applications'] if effect else []:
                    a,b=choice['frames'];p=choice['parameters']
                    if not a<=i<b:continue
                    if choice['role']=='type':
                        font=ImageFont.truetype(str(REPO/'scripts/video-editing/studio-phase2/scene/assets'/p['font']),p['size'])
                        layer=type_reveal(image.size,list(zip(p['text'],map(tuple,p['rgb']))),font,tuple(p['position']),
                            (i-a)/render['fps'],p['start'],stagger=p['stagger'],entrance=p['entrance'],shutter=p['shutter'],fps=render['fps'])
                        image=Image.alpha_composite(image.convert('RGBA'),layer).convert('RGB')
                    elif choice['role']=='composition':
                        incoming=image
                        outgoing=Image.new('RGB',image.size,tuple(p['outgoing_rgb']))
                        ImageDraw.Draw(outgoing).ellipse((i%90,120,i%90+20,140),fill=(130,140,150))
                        image=registered_panels(outgoing,incoming,(i-a)/render['fps'],p['arrivals'],p['centres'],p['half_width'],p['shear'],p['resolve_at'])
                process.stdin.write(image.tobytes())
            process.stdin.close()
            if process.wait():raise RuntimeError('Fixture encode failed')

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def bind(self,p):return {'path':str(p),'sha256':sha(p)}

    def plan(self):
        plan={k:'Specific fixture description' for k in REQUIRED_TEXT}
        plan.update(status='ready_for_edit',client_id='fixture',client_context_snapshot=str(self.context),fps=25,
            hooks=[dict(id=str(i),first_frame=f'Visible source action {i}',first_3_seconds=f'Reveal specific proof {i}',sound='Selected phrase',why_viewer_stops='Viewer question') for i in range(3)],chosen_hook_id='0',
            shots=[dict(source=f'source-{i}',visual_cluster=f'cluster-{i}',story_role=role,**{'in':0,'out':(end-start)/25},rights='fixture',prior_use='synthetic',timeline_in_frame=start,timeline_out_frame=end) for i,(role,start,end) in enumerate([('setup',0,300),('development',300,500),('payoff',500,750)])],
            story_beats={role:{'frames':span,'viewer_change':role+' learning','visible_proof':role+' actual action'} for role,span in [('hook',[0,75]),('development',[75,625]),('payoff',[625,750])]},
            music=self.bind(self.music),cut_anchors=[dict(cut_frame=f,anchor_frame=f,kind='music_beat',reason='Fixture marker, not a listening verdict') for f in (300,500)],
            skill_library_root=str(REPO/'scripts/video-editing/studio-phase2/skills'))
        plan['skill_applications']=[]
        for shot in plan['shots']:
            shot['intent']=dict(visible_action='Synthetic moving circle',viewer_inference=shot['story_role'],graphic_job='Reveal or clean picture as planned',sound_job='Silent fixture; not a sound proof')
        for id,skill,role,frames in [('hook-type','graphic-transform-blur','type',[0,75]),('body-panels','registered-slanted-panels','composition',[300,325])]:
            card=Path(plan['skill_library_root'])/skill/'SKILL.md'
            parameters=({'text':['SEE','WHY'],'rgb':[[255,255,255],[40,190,220]],'font':'SpaceGrotesk.ttf','size':16,'position':[8,30],'start':.1,'stagger':.08,'entrance':.35,'shutter':180}
                if role=='type' else {'outgoing_rgb':[12,25,40],'arrivals':[0,.16,.32],'centres':[20,64,108],'half_width':18,'shear':.05,'resolve_at':.8})
            plan['skill_applications'].append(dict(id=id,skill_id=skill,card_sha256=sha(card),implementation=self.bind(SCRIPTS/'visual_treatments.py'),purpose='Show this story proof',mechanism=id,role=role,frames=frames,parameters=parameters))
        return plan

    def record(self,plan=None):
        plan=self.plan() if plan is None else plan
        p=self.root/'plan.json';p.write_text(json.dumps(plan),encoding='utf-8')
        manifest={'plan_sha256':sha(p),'video_sha256':sha(self.final),'fps':25,'shots':plan['shots'],
            'applied_skills':[{'id':c['id'],'choice':c,'plain_control':self.bind(self.plain),'control_start_frame':c['frames'][0]} for c in plan['skill_applications']]}
        m=self.root/'edit.json';m.write_text(json.dumps(manifest),encoding='utf-8')
        return {'client_id':'fixture','client_context_snapshot':str(self.context),'video':str(self.final),'video_sha256':sha(self.final),'story_plan':self.bind(p),'edit_manifest':self.bind(m)}

    def test_short_story_fails_before_a_render(self):
        p=self.plan();p['shots']=p['shots'][:1]
        self.assertIn('roughly30s',' '.join(validate(p)))

    def test_malformed_shapes_and_missing_scene_intent_fail_closed(self):
        self.assertTrue(validate([]))
        p=self.plan();p['hooks'][0]['id']=[]
        self.assertTrue(validate(p))
        p=self.plan();p['shots'][1]['intent'].pop('sound_job')
        self.assertIn('every shot needs',' '.join(validate(p)))
        p=self.plan();p['skill_applications'][0].pop('parameters')
        self.assertIn('actual layout/timing parameters',' '.join(validate(p)))

    def test_no_skill_and_late_cut_cannot_pass_preflight(self):
        p=self.plan();p['skill_applications']=[]
        self.assertIn('no shared editing technique',' '.join(validate(p)))
        p=self.plan();p['cut_anchors'][0]['anchor_frame']-=3
        self.assertIn('one frame',' '.join(validate(p)))

    def test_duplicate_hook_ids_and_non_audio_music_are_blocked(self):
        p=self.plan();p['hooks'][1]['first_frame']=p['hooks'][0]['first_frame'];p['hooks'][1]['first_3_seconds']=p['hooks'][0]['first_3_seconds']
        self.assertIn('distinct concepts',' '.join(validate(p)))
        p=self.plan();p['music']=self.bind(self.caption)
        self.assertTrue(validate_edit(p))

    def test_actual_frame_clock_cannot_be_changed_only_in_the_manifest(self):
        p=self.plan();p['fps']=30
        for shot in p['shots']:
            for k in ('timeline_in_frame','timeline_out_frame'):shot[k]=round(shot[k]*1.2)
        for beat in p['story_beats'].values():beat['frames']=[round(f*1.2) for f in beat['frames']]
        for a in p['cut_anchors']:
            for k in ('cut_frame','anchor_frame'):a[k]=round(a[k]*1.2)
        for c in p['skill_applications']:c['frames']=[round(f*1.2) for f in c['frames']]
        r=self.record(p);d=json.loads(Path(r['edit_manifest']['path']).read_text());d['fps']=30;Path(r['edit_manifest']['path']).write_text(json.dumps(d));r['edit_manifest']=self.bind(Path(r['edit_manifest']['path']))
        self.assertIn('frame clock/count',' '.join(check_render(r,30,validate)))

    def test_distinct_same_file_moments_are_not_blanket_banned(self):
        p=self.plan();p['shots'][1].update(source='source-0',visual_cluster='cluster-0',**{'in':13,'out':21})
        self.assertEqual(validate(p),[])
        p['shots'][1].update(**{'in':5,'out':15})
        self.assertIn('overlapping',' '.join(validate(p)))

    def test_outro_alone_is_not_the_requested_body_craft(self):
        p=self.plan()
        for c in p['skill_applications']:c.update(role='outro',frames=[700,750])
        self.assertIn('no intended visual craft',' '.join(validate(p)))

    def test_plan_operator_export_binding_uses_actual_decoded_picture(self):
        self.assertEqual(validate(self.plan()),[])
        self.assertEqual(check_render(self.record(),30,validate),[])
        self.assertNotEqual(picture_hashes(self.final,0,75),picture_hashes(self.plain,0,75))

    def test_research_plan_cannot_release_client_work(self):
        p=self.plan();p['research_only']=True
        self.assertIn('research/different-client',' '.join(check_render(self.record(p),30,validate)))

    def test_dropped_treatment_and_changed_plan_are_blocked(self):
        r=self.record();m=Path(r['edit_manifest']['path']);d=json.loads(m.read_text());d['applied_skills'].pop();m.write_text(json.dumps(d));r['edit_manifest']=self.bind(m)
        self.assertIn('dropped',' '.join(check_render(r,30,validate)))
        r=self.record();Path(r['story_plan']['path']).write_text('{}')
        self.assertIn('changed bound',' '.join(check_render(r,30,validate)))

    def test_all_pass_labels_cannot_clear_a_plain_export(self):
        r=self.record();r['video']=str(self.plain);r['video_sha256']=sha(self.plain)
        m=Path(r['edit_manifest']['path']);d=json.loads(m.read_text());d['video_sha256']=r['video_sha256'];m.write_text(json.dumps(d));r['edit_manifest']=self.bind(m)
        self.assertIn('equals its plain control',' '.join(check_render(r,30,validate)))

    def full_release(self):
        r=self.record();review=self.root/'creative.json'
        review.write_text(json.dumps({'video_sha256':r['video_sha256'],'cover_sha256':sha(self.cover),'reviewer':'fixture author','reviewer_kind':'author_editorial','reviewed_at':'fixture',
            'areas':{a:{'status':'pass','method':'fixture only','finding':'Fixture is not creative approval','evidence_file':str(self.evidence),'evidence_sha256':sha(self.evidence)} for a in release.AREAS}}))
        r.update(creative_status='creative_review_passed',cover=str(self.cover),cover_sha256=sha(self.cover),caption_path=str(self.caption),caption_sha256=sha(self.caption),exact_export_creative_review_evidence=str(review),audio_packet='fixture',audio_review='fixture',
            production_identity=dict(verified=True,year=2026,month=11,video_number=1,client_short_code='TEST',source_evidence=str(self.evidence),source_evidence_sha256=sha(self.evidence)))
        return r

    def test_existing_release_entry_point_now_requires_the_actual_plan(self):
        r=self.full_release();r.pop('story_plan');r.pop('edit_manifest')
        with patch.object(release,'verify',return_value={'client_id':'fixture','brand_ready':True}),patch.object(release,'audio_gate',return_value={'video_sha256':r['video_sha256'],'errors':[]}):
            out=release.check(r)
        self.assertEqual(out['status'],'BLOCKED')
        self.assertIn('Plan-to-render',' '.join(out['errors']))

    def test_full_contract_is_candidate_only_never_automatic_creative_pass(self):
        r=self.full_release()
        with patch.object(release,'verify',return_value={'client_id':'fixture','brand_ready':True}),patch.object(release,'audio_gate',return_value={'video_sha256':r['video_sha256'],'errors':[]}):
            out=release.check(r)
        self.assertEqual(out['errors'],[])
        self.assertEqual(out['status'],'CANDIDATE_FOR_INTERNAL_REVIEW')
        self.assertFalse(out['creative_approval_inferred'])

    def test_portable_type_has_real_resolve_and_no_font_fallback(self):
        args=((128,224),[('WHY',(255,255,255))],self.font,(8,30))
        empty=type_reveal(*args,time=-1,start=0,shutter=0)
        moving=type_reveal(*args,time=.1,start=0,shutter=0)
        hold=type_reveal(*args,time=2,start=0,shutter=0)
        self.assertIsNone(empty.getbbox());self.assertNotEqual(moving.tobytes(),hold.tobytes())
        with self.assertRaises(ValueError):type_reveal((10,10),[('TOO WIDE',(255,255,255))],self.font,(0,0),1,0)

    def test_panels_keep_one_source_coordinate_system_and_full_reveal(self):
        incoming=Image.new('RGB',(128,224));ImageDraw.Draw(incoming).rectangle((60,0,67,223),fill='red')
        plain=Image.new('RGB',incoming.size)
        frame=registered_panels(plain,incoming,.2,[0,.1,.3],[20,64,108],18,0,.5)
        self.assertEqual(frame.getpixel((64,100)),incoming.getpixel((64,100)))
        self.assertEqual(registered_panels(plain,incoming,.5,[0,.1,.3],[20,64,108],18,0,.5).tobytes(),incoming.tobytes())


if __name__=='__main__':unittest.main()
