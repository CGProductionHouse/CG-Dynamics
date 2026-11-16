# CG Production House "We build websites and apps" 30 s 16:9, version 6 (R06, 11 Nov 2026).
# Assets (not in Git): shots/*.jpg website screenshots from the project company-Drive folder
# (part-screens zips). Font: Inter Display 900 installed locally.
import base64, json
from PIL import Image
SH={}
for n in ['dyn_integrations','dyn_performance','redoak_menu','piek_brands','piek_home','bouwer_firm','bouwer_home','wise_midas','wise_approach','wise_home','redoak_fav','redoak_hero']:
    im=Image.open(f'shots/{n}.jpg'); SH[n]={'w':im.size[0],'h':im.size[1],'b64':base64.b64encode(open(f'shots/{n}.jpg','rb').read()).decode()}

SW,SH_H=968,612
def macshot(key,d,dur,fade=None):
    im=SH[key]; h=im['h']*SW/im['w']; dy=-max(0,h-SH_H)
    f=f'animation:fadeIn .7s ease {fade}s both;' if fade is not None else ''
    return f'<div class="mlayer" style="{f}"><div class="mimg i-{key}" style="height:{h:.0f}px;--d:{d}s;--dur:{dur}s;--dy:{dy:.0f}px"></div></div>'
def mac(layers,flash=None):
    fl=f'<i class="pon" style="--pf:{flash}s"></i>' if flash is not None else ''
    return f'<div class="mbp"><div class="mlid"><div class="notch"></div><div class="mscreen">{layers}{fl}<i class="refl"></i><i class="glare"></i></div></div><div class="mbase"><i class="lip"></i></div><div class="mshadow"></div></div>'
PW=294
def crop(key,x,y,w,h):
    im=SH[key]; s=PW/w
    return f'<div class="crop i-{key}" style="height:{h*s:.0f}px;background-size:{im["w"]*s:.1f}px auto;background-position:{-x*s:.1f}px {-y*s:.1f}px"></div>'
STATUS='<div class="status"><span>9:41</span><span class="sicons"><i class="sig"><b></b><b></b><b></b><b></b></i><i class="bat"><b></b></i></span></div>'
def phone(crops,d,dur,dy,bg='#111'):
    return f'<div class="phone"><div class="btn b1"></div><div class="btn b2"></div><div class="btn b3"></div><div class="screen" style="background:{bg}"><div class="island"></div>{STATUS}<div class="pcontent" style="--d:{d}s;--dur:{dur}s;--dy:{dy}px;background:{bg}">{"".join(crops)}</div><div class="homebar"></div><i class="refl"></i><i class="glare"></i></div></div>'

def lines(ls, start, cls='', step=.12):
    out=[]; t=start
    for txt,c in ls:
        out.append(f'<div class="ln {c}"><span class="fit" data-max="{{MAX}}"><span class="m"><span class="rise" style="--d:{t:.2f}s">{txt}</span></span></span></div>'); t+=step
    return ''.join(out)

KF=[]
def kf(name,steps):
    KF.append('@keyframes '+name+'{'+''.join(f'{p}{{{v}}}' for p,v in steps)+'}')
OUT='cubic-bezier(.16,1,.3,1)'
def dev(html,left,top,w,h,anim,t,dur,g,halo=True):
    hl=f'<div class="halo" style="animation:fadeIn 1.2s ease {t+.2:.2f}s both"></div>' if halo else ''
    return f'<div class="abs" style="left:{left}px;top:{top}px;width:{w}px;height:{h}px;perspective:2400px">{hl}<div class="rig" style="animation:{anim} {dur:.2f}s linear {t:.2f}s both;--g:{g:.2f}s">{html}</div></div>'
def head(t,name,ls,left,top,width,maxw,align='left',td=None):
    td=t if td is None else td
    pill=f'<div class="pill glass pop" style="--d:{td:.2f}s">{name}</div>' if name else ''
    return f'<div class="abs" style="left:{left}px;top:{top}px;width:{width}px;text-align:{align}">{pill}<div class="head">{lines(ls,td+.15).replace("{MAX}",str(maxw))}</div></div>'
def scene(t0,t1,body):
    return f'<section class="scene" style="--in:{t0}s"><div class="out" style="--out:{t1-.35:.2f}s">{body}</div></section>'
LAP=(1000,690); PH=(320,668)

S=[]
# HOOK 0-3.6: punch-in beats
S.append(scene(0,3.6,'''
 <div class="abs vc"><div class="punch" style="--d:.05s"><div class="beat" style="--a:.05s;--b:1.0s"><div class="ln"><span class="fit" data-max="1500">BEFORE THEY CALL</span></div></div></div></div>
 <div class="abs vc"><div class="punch" style="--d:1.05s"><div class="beat" style="--a:1.05s;--b:2.05s"><div class="ln"><span class="fit" data-max="1600">THEY CHECK</span></div><div class="ln og"><span class="fit" data-max="1600" style="--sd:1.4s">YOUR WEBSITE</span></div></div></div></div>
 <div class="abs vc"><div class="slab glass pop" style="--d:2.1s"><div class="ln"><span class="fit" data-max="1480">WHAT DO THEY</span></div><div class="ln og"><span class="fit" data-max="1480" style="--sd:2.5s">SEE?</span></div></div></div>'''))
# WE BUILD 3.6-6.6: blueprint grid + scan light
S.append(scene(3.6,6.6,f'''
 <div class="grid" style="animation:fadeIn 1s ease 3.6s both"></div><div class="scan" style="--d:3.8s"></div>
 <div class="abs vc"><div class="drift">{lines([("WE BUILD WEBSITES",""),("THAT MAKE",""),("THEM CALL","og")],3.75,step=.14).replace("{MAX}","1600")}</div></div>'''))

# WISEMAN 6.6-9.8: laptop swings in from the right, phone rises
kf('lapW',[('0%',f'opacity:0;transform:translateX(560px) rotateY(-50deg) rotateX(10deg) scale(.86);animation-timing-function:{OUT}'),('32%','opacity:1;transform:translateX(0) rotateY(-17deg) rotateX(5deg) scale(.88);animation-timing-function:ease-in-out'),('100%','opacity:1;transform:translateX(-40px) rotateY(-7deg) rotateX(3deg) scale(.9)')])
kf('phW',[('0%',f'opacity:0;transform:translateY(720px) rotate(16deg) scale(.8);animation-timing-function:{OUT}'),('35%','opacity:1;transform:translateY(0) rotate(-6deg) scale(.8);animation-timing-function:ease-in-out'),('100%','opacity:1;transform:translateY(-26px) rotate(-3deg) scale(.8)')])
S.append(scene(6.6,9.8,
 dev(mac(macshot('wise_home',7.0,1.0)+macshot('wise_midas',8.3,1.0,fade=7.9)),860,220,*LAP,'lapW',6.6,3.2,7.5)+
 dev(phone([crop('wise_home',40,230,560,560),crop('wise_approach',60,150,540,470),crop('wise_approach',640,120,570,520)],7.4,1.8,-420,'#151515'),1500,390,*PH,'phW',6.85,2.95,8.1,False)+
 head(6.6,'Wiseman Group',[("FOR BOLD","sm"),("BRANDS","og")],110,330,740,720,td=6.7)))

# PIEK 9.8-13.0: start inside the screen, pull back to reveal the laptop
kf('lapP',[('0%','opacity:1;transform:translate(-400px,22px) scale(2.5) rotateY(0deg);animation-timing-function:cubic-bezier(.7,0,.2,1)'),('38%','transform:translate(0,0) scale(.88) rotateY(-14deg) rotateX(4deg);animation-timing-function:ease-in-out'),('100%','opacity:1;transform:translate(-30px,-10px) scale(.9) rotateY(-8deg) rotateX(3deg)')])
kf('phP',[('0%',f'opacity:0;transform:translateX(520px) rotate(14deg) scale(.8);animation-timing-function:{OUT}'),('35%','opacity:1;transform:translateX(0) rotate(-6deg) scale(.8);animation-timing-function:ease-in-out'),('100%','opacity:1;transform:translateY(-22px) rotate(-4deg) scale(.8)')])
S.append(scene(9.8,13.0,
 dev(mac(macshot('piek_home',10.0,1.0)+macshot('piek_brands',11.6,1.0,fade=11.2)),860,220,*LAP,'lapP',9.8,3.2,11.2)+
 dev(phone([crop('piek_home',30,140,620,560),crop('piek_brands',560,490,677,472),crop('piek_brands',20,90,900,380)],11.3,1.6,-330,'#141a2a'),1500,390,*PH,'phP',10.9,2.1,11.8,False)+
 head(9.8,'Piek Group',[("FOR GROWING","sm"),("GROUPS","og")],110,330,740,720,td=11.0)))

# BOUWER 13.0-16.2: mirrored; laptop orbits in from the left, phone flips like a card
kf('lapB',[('0%',f'opacity:0;transform:translateX(-420px) rotateY(75deg) scale(.86);animation-timing-function:{OUT}'),('38%','opacity:1;transform:translateX(0) rotateY(18deg) rotateX(4deg) scale(.88);animation-timing-function:ease-in-out'),('100%','opacity:1;transform:translateX(30px) rotateY(9deg) rotateX(3deg) scale(.9)')])
kf('phB',[('0%',f'opacity:0;transform:translateX(-140px) rotateY(-100deg) scale(.78);animation-timing-function:{OUT}'),('40%','opacity:1;transform:translateX(0) rotateY(0deg) rotate(5deg) scale(.78);animation-timing-function:ease-in-out'),('100%','opacity:1;transform:translateY(-22px) rotateY(0deg) rotate(3deg) scale(.78)')])
S.append(scene(13.0,16.2,
 dev(mac(macshot('bouwer_home',13.4,1.0)+macshot('bouwer_firm',14.7,1.0,fade=14.3)),170,220,*LAP,'lapB',13.0,3.2,14.0)+
 dev(phone([crop('bouwer_firm',600,105,636,722),crop('bouwer_home',20,280,700,420)],13.9,1.8,-330,'#161516'),110,400,*PH,'phB',13.3,2.9,14.6,False)+
 head(13.0,'Bouwer Coetzee Attorneys',[("FOR TRUSTED","sm"),("FIRMS","og")],1180,330,660,660,td=13.15)))

# RED OAK 16.2-19.4: laptop rises out of focus, phone drops in and lands
kf('lapR',[('0%',f'opacity:0;filter:blur(14px);transform:translateY(420px) rotateX(38deg) rotateY(-20deg) scale(.78);animation-timing-function:{OUT}'),('40%','opacity:1;filter:blur(0px);transform:translateY(0) rotateX(5deg) rotateY(-18deg) scale(.8);animation-timing-function:ease-in-out'),('100%','opacity:1;filter:blur(0px);transform:translateY(-10px) rotateX(3deg) rotateY(-10deg) scale(.82)')])
kf('phR',[('0%','opacity:0;transform:translateY(-1000px) rotate(-28deg);animation-timing-function:cubic-bezier(.5,0,.75,0)'),('1%','opacity:1'),('22%','opacity:1;transform:translateY(24px) rotate(5deg);animation-timing-function:ease-out'),('32%','transform:translateY(-8px) rotate(2deg);animation-timing-function:ease-in-out'),('100%','opacity:1;transform:translateY(-24px) rotate(3deg)')])
S.append(scene(16.2,19.4,
 dev(mac(macshot('redoak_hero',16.6,1.0)+macshot('redoak_fav',17.9,1.0,fade=17.5)),700,300,*LAP,'lapR',16.2,3.2,17.4)+
 dev(phone([crop('redoak_menu',685,170,490,740),crop('redoak_menu',40,120,600,600)],17.3,1.8,-420,'#121110'),1450,150,*PH,'phR',16.5,2.9,17.9,False)+
 head(16.2,'Red Oak',[("FOR LOCAL","sm"),("FAVOURITES","og")],110,330,640,620,td=16.35)))

# DYNAMICS 19.4-22.8: centred; laptop powers on, screens fly out of it
kf('lapD',[('0%',f'opacity:0;transform:translateY(560px) rotateX(55deg) scale(.8);animation-timing-function:{OUT}'),('40%','opacity:1;transform:translateY(0) rotateX(6deg) scale(.82);animation-timing-function:ease-in-out'),('100%','opacity:1;transform:translateY(-12px) rotateX(2deg) scale(.84)')])
kf('flyL',[('0%',f'opacity:0;transform:translate(640px,60px) rotateY(40deg) scale(.2);animation-timing-function:{OUT}'),('45%','opacity:1;transform:translate(0,0) rotateY(12deg) rotate(-7deg) scale(.72);animation-timing-function:ease-in-out'),('100%','opacity:1;transform:translate(0,-22px) rotateY(8deg) rotate(-5deg) scale(.72)')])
kf('flyR',[('0%',f'opacity:0;transform:translate(-640px,60px) rotateY(-40deg) scale(.2);animation-timing-function:{OUT}'),('45%','opacity:1;transform:translate(0,0) rotateY(-12deg) rotate(7deg) scale(.8);animation-timing-function:ease-in-out'),('100%','opacity:1;transform:translate(0,-22px) rotateY(-8deg) rotate(5deg) scale(.8)')])
card=f'<div class="gcard glass">{crop("dyn_integrations",330,155,285,525)}<i class="glare"></i></div>'
S.append(scene(19.4,22.8,
 dev(mac(macshot('dyn_performance',20.1,1.1)+macshot('dyn_integrations',21.5,0.9,fade=21.1),flash=19.6),460,385,*LAP,'lapD',19.4,3.4,20.6)+
 dev(phone([crop('dyn_integrations',630,155,285,525),crop('dyn_performance',20,60,600,520)],20.6,1.6,-300,'#000'),150,410,*PH,'flyL',20.1,2.7,21.2,False)+
 dev(card,1480,440,322,569,'flyR',20.25,2.55,21.4,False)+
 head(19.4,'',[("AND THE APPS","sm"),("BEHIND THEM","og")],0,70,1920,1150,align='center',td=19.5)))

# CTA 22.8-26.6
S.append(scene(22.8,26.6,f'''
 <div class="abs vc"><div class="drift">{lines([("YOUR BUSINESS",""),("IS NEXT","og")],22.95,step=.15).replace("{MAX}","1500")}</div><div style="margin-top:60px;position:relative"><i class="ring" style="--d:24.3s"></i><i class="ring" style="--d:25.0s"></i><div class="cta glass pop" style="--d:23.9s">LET'S BUILD YOURS<span class="arrow">→</span></div></div><div style="margin-top:36px"><div class="url glass pop" style="--d:24.4s">cgproductionhouse.com</div></div></div>'''))
# LOGO 26.6-30
S.append('''<section class="scene" style="--in:26.6s"><div class="out" style="--out:99s">
 <div class="abs center" style="top:230px"><div class="appicon glass spin" style="--d:26.7s"><svg viewBox="0 0 400 400" width="400" height="400" aria-label="CG"><defs><linearGradient id="lg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e3a06c"/><stop offset="1" stop-color="#9b4f1b"/></linearGradient></defs><text x="200" y="262" text-anchor="middle" font-size="215" font-family="Inter Display" font-weight="900" letter-spacing="-12" fill="url(#lg)">CG</text></svg><i class="glare" style="--g:27.6s"></i></div></div>
 <div class="abs center" style="top:740px"><div class="ln brand"><span class="m"><span class="rise" style="--d:27.4s">CG PRODUCTION HOUSE</span></span></div></div>
</div></section>''')

# light: anamorphic streaks + light-leak flashes over the cuts
STREAKS=[(.12,540),(1.12,610),(2.18,520),(3.7,700),(4.5,420),(7.05,560),(10.6,500),(13.45,600),(16.75,470),(19.75,330),(23.9,790),(27.25,430)]
LEAKS=[(3.4,'l'),(6.4,'r'),(9.6,'l'),(12.8,'r'),(16.0,'l'),(19.2,'r'),(22.6,'l'),(26.4,'r')]
LIGHT=''.join(f'<div class="leak {side}" style="--t:{t}s"></div>' for t,side in LEAKS)

css='''
:root{--o:#9b4f1b;--t:#0a2f37;--ease:cubic-bezier(.16,1,.3,1);--sans:"Inter Display","Inter",system-ui,sans-serif;color-scheme:dark}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#000;overflow:hidden}
#stage{position:absolute;left:50%;top:50%;width:1920px;height:1080px;transform:translate(-50%,-50%) scale(var(--s,1));overflow:hidden;background:#000;font-family:var(--sans);color:#fff;-webkit-font-smoothing:antialiased}
.rec #stage{left:0;top:0;transform:none}
.abs{position:absolute}.center{left:0;right:0;text-align:center}.vc{inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
@keyframes rise{from{transform:translateY(115%)}to{transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pop{0%{opacity:0;transform:scale(.7) translateY(40px);filter:blur(12px)}60%{opacity:1;filter:blur(0)}100%{opacity:1;transform:none}}
@keyframes spin{0%{opacity:0;transform:scale(.4) rotate(-20deg);filter:blur(16px)}100%{opacity:1;transform:none;filter:blur(0)}}
@keyframes sceneIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}
@keyframes sceneOut{to{opacity:0;transform:scale(1.06);filter:blur(18px)}}
@keyframes beat{0%{opacity:0;transform:translateY(60px) scale(.96);filter:blur(14px)}12%{opacity:1;transform:none;filter:blur(0)}82%{opacity:1;transform:none;filter:blur(0)}100%{opacity:0;transform:translateY(-50px) scale(1.04);filter:blur(14px)}}
@keyframes scrollY{to{transform:translateY(var(--dy))}}
@keyframes enterR{from{opacity:0;transform:translateX(500px) scale(.9)}to{opacity:1;transform:none}}
@keyframes enterB{from{opacity:0;transform:translateY(600px) rotate(8deg)}to{opacity:1;transform:none}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}
@keyframes d1{0%{transform:translate(0,0) scale(1)}50%{transform:translate(420px,180px) scale(1.2)}100%{transform:translate(-160px,300px) scale(.9)}}
@keyframes d2{0%{transform:translate(0,0) scale(1)}50%{transform:translate(-460px,-140px) scale(1.25)}100%{transform:translate(200px,-240px) scale(1)}}
@keyframes d3{0%{transform:translate(0,0)}100%{transform:translate(-300px,-200px)}}
@keyframes sheen{0%{transform:translateX(-120%) skewX(-20deg)}100%{transform:translateX(320%) skewX(-20deg)}}
@keyframes shine{0%{background-position:100% 0,0 0}45%,100%{background-position:0% 0,0 0}}
@keyframes hue{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(25deg)}}
.rise{display:inline-block;animation:rise .9s var(--ease) var(--d,0s) both}
.m{display:inline-block;overflow:hidden;vertical-align:top;padding:.06em .04em .06em;margin:-.06em 0 -.06em}
.pop{animation:pop .9s var(--ease) var(--d) both}.spin{animation:spin 1.1s var(--ease) var(--d) both}
.scene{position:absolute;inset:0;animation:sceneIn .5s ease var(--in) both}
.scene>.out{position:absolute;inset:0;animation:sceneOut .45s cubic-bezier(.7,0,.84,0) var(--out) both}
.beat{animation:beat calc(var(--b) - var(--a)) linear var(--a) both}
/* background: never plain */
#bg{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% 115%,#2a1306 0%,#0d0603 45%,#000 80%),#000}
.orb{position:absolute;border-radius:50%;filter:blur(70px)}
.o1{width:1100px;height:1100px;left:-350px;top:430px;background:radial-gradient(circle,rgba(155,79,27,.85),rgba(155,79,27,.22) 45%,transparent 68%);animation:d1 15s ease-in-out infinite alternate}
.o2{width:900px;height:900px;left:1300px;top:-380px;background:radial-gradient(circle,rgba(200,110,45,.5),transparent 66%);animation:d2 12s ease-in-out infinite alternate}
.o3{width:900px;height:900px;left:900px;top:520px;background:radial-gradient(circle,rgba(10,47,55,.55),transparent 66%);animation:d2 17s ease-in-out infinite alternate-reverse}
.o4{width:1400px;height:700px;left:260px;top:620px;background:radial-gradient(ellipse,rgba(155,79,27,.45),transparent 65%);animation:d3 20s ease-in-out infinite alternate}
.grain{position:absolute;inset:0;opacity:.07;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.85) 100%)}
/* liquid glass */
.glass{position:relative;background:linear-gradient(135deg,rgba(255,230,210,.18),rgba(155,79,27,.10) 45%,rgba(255,255,255,.06));backdrop-filter:blur(30px) saturate(180%);-webkit-backdrop-filter:blur(30px) saturate(180%);box-shadow:inset 0 1.5px 0 rgba(255,255,255,.6),inset 0 -1px 0 rgba(255,255,255,.12),inset 0 0 0 1.5px rgba(255,255,255,.16),inset 0 20px 40px -20px rgba(255,255,255,.25),0 40px 90px rgba(0,0,0,.45);overflow:hidden}
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(120% 60% at 20% -10%,rgba(255,255,255,.35),transparent 55%);pointer-events:none}
.glass::after{content:"";position:absolute;top:-20%;bottom:-20%;width:22%;left:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);animation:sheen 3.2s ease-in-out infinite;pointer-events:none}
/* type */
.ln{font-weight:900;text-transform:uppercase;letter-spacing:-.045em;line-height:.9;white-space:nowrap}
.fit{display:inline-block;font-size:220px}
.og .fit:not(:has(.rise)),.og .rise{background-image:linear-gradient(100deg,transparent 42%,rgba(255,255,255,.95) 50%,transparent 58%),linear-gradient(100deg,#fff 0%,#ffd9bd 30%,#e8945a 70%,#c46a2c 100%);background-size:300% 100%,100% 100%;background-repeat:no-repeat;-webkit-background-clip:text;background-clip:text;color:transparent}
.sm .fit{font-size:120px}
.head .ln.sm{color:#fff}
.slab{display:inline-block;border-radius:64px;padding:50px 90px 60px}
.pill{display:inline-block;border-radius:999px;padding:16px 34px;font-size:40px;font-weight:700;letter-spacing:-.01em;margin-bottom:34px}
.leftcol{left:110px;top:300px;width:780px}
.cta{display:inline-flex;align-items:center;gap:26px;border-radius:999px;padding:30px 64px;font-size:68px;font-weight:900;letter-spacing:-.02em;background:linear-gradient(135deg,rgba(214,128,64,.75),rgba(155,79,27,.55) 55%,rgba(255,255,255,.15))}
.cta .arrow{font-size:72px}
.url{display:inline-block;border-radius:999px;padding:18px 54px;font-size:56px;font-weight:700;letter-spacing:-.01em}
.appicon{width:400px;height:400px;border-radius:96px;display:grid;place-items:center;margin:0 auto;background:linear-gradient(145deg,rgba(255,230,210,.22),rgba(12,6,3,.75) 50%,rgba(155,79,27,.45))}
.brand{font-size:104px;letter-spacing:-.015em}.brand .rise{padding:0 .02em}
/* devices */
.og .fit:not(:has(.rise)){animation:shine 3.2s ease-in-out var(--sd,0s) infinite}
.og .rise{animation:rise .9s var(--ease) var(--d,0s) both,shine 3.2s ease-in-out calc(var(--d,0s) + .6s) infinite}

/* MacBook Pro, front-on, real proportions (16:10.3 lid, thin base) */
.rig{position:absolute;inset:0;transform-origin:50% 50%;will-change:transform}
.mbp{position:relative;width:1000px;height:690px}
.mlid{position:absolute;left:0;top:0;width:1000px;height:650px;border-radius:26px 26px 9px 9px;background:#0b0b0c;padding:16px 16px 22px;box-shadow:0 0 0 2px #34353a,0 0 0 3.5px #121214,inset 0 0 0 1px rgba(255,255,255,.07)}
.notch{position:absolute;top:16px;left:50%;transform:translateX(-50%);width:118px;height:20px;background:#0b0b0c;border-radius:0 0 10px 10px;z-index:12}
.mscreen{position:relative;width:968px;height:612px;border-radius:10px 10px 3px 3px;overflow:hidden;background:#000}
.mbase{position:absolute;left:-46px;top:650px;width:1092px;height:24px;border-radius:3px 3px 26px 26px/3px 3px 20px 20px;background:linear-gradient(180deg,#5b5c61 0%,#2d2e31 16%,#1d1e20 55%,#0d0d0f 100%)}
.lip{position:absolute;top:0;left:50%;transform:translateX(-50%);width:170px;height:9px;border-radius:0 0 12px 12px;background:linear-gradient(180deg,#121214,#2a2b2e)}
.mshadow{position:absolute;left:20px;right:20px;top:668px;height:40px;background:radial-gradient(ellipse at center,rgba(0,0,0,.75),transparent 70%);filter:blur(8px);z-index:-1}
.halo{position:absolute;left:0;right:0;top:15%;bottom:0;border-radius:50%;background:radial-gradient(ellipse at center,rgba(232,148,90,.6),rgba(155,79,27,.3) 40%,transparent 70%);filter:blur(70px)}
.refl{position:absolute;inset:0;background:linear-gradient(118deg,rgba(255,255,255,.13) 0%,rgba(255,255,255,.04) 30%,transparent 31%,transparent 100%);pointer-events:none;z-index:9}
.glare{position:absolute;top:-40%;bottom:-40%;left:0;width:38%;background:linear-gradient(100deg,transparent 0%,rgba(255,255,255,.08) 30%,rgba(255,240,225,.42) 48%,rgba(255,255,255,.1) 60%,transparent 100%);transform:translateX(-160%) skewX(-18deg);animation:glare 1.5s cubic-bezier(.45,0,.25,1) var(--g,1s) both;pointer-events:none;z-index:10;mix-blend-mode:screen}
@keyframes glare{to{transform:translateX(420%) skewX(-18deg)}}
.pon{position:absolute;inset:0;z-index:11;animation:pon 1.1s ease-out var(--pf) both}
@keyframes pon{0%{opacity:1;background:#000}40%{opacity:1;background:#000}55%{opacity:.9;background:#fff6ee}100%{opacity:0;background:#fff6ee}}
.gcard{border-radius:40px;padding:14px;width:322px}.gcard .crop{border-radius:26px;margin:0}
/* light */
.rays{position:absolute;left:1500px;top:-120px;width:3000px;height:3000px;margin:-1500px 0 0 -1500px;background:repeating-conic-gradient(from 0deg,rgba(255,214,180,.07) 0deg 3deg,transparent 3deg 11deg);-webkit-mask:radial-gradient(circle,#000 0,rgba(0,0,0,.5) 25%,transparent 55%);mask:radial-gradient(circle,#000 0,rgba(0,0,0,.5) 25%,transparent 55%);mix-blend-mode:screen;animation:rot 60s linear infinite}
@keyframes rot{to{transform:rotate(360deg)}}
.streak{position:absolute;left:0;width:1920px;height:0;mix-blend-mode:screen;pointer-events:none;z-index:20;animation:streak 1.15s cubic-bezier(.3,0,.3,1) var(--t) both}
.streak::before{content:"";position:absolute;left:-200px;right:-200px;top:-3px;height:6px;background:linear-gradient(90deg,transparent 0%,rgba(110,200,215,.5) 22%,rgba(255,226,200,1) 50%,rgba(232,148,90,.6) 78%,transparent 100%);filter:blur(2px);box-shadow:0 0 30px 8px rgba(232,148,90,.35)}
.streak::after{content:"";position:absolute;left:50%;top:-160px;width:320px;height:320px;margin-left:-160px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.95) 0%,rgba(255,200,160,.55) 12%,rgba(232,148,90,.18) 35%,transparent 65%)}
@keyframes streak{0%{opacity:0;transform:translateX(-620px) scaleX(.5)}30%{opacity:1}100%{opacity:0;transform:translateX(620px) scaleX(1.35)}}
.leak{position:absolute;top:-300px;width:1500px;height:1700px;border-radius:50%;mix-blend-mode:screen;pointer-events:none;z-index:19;filter:blur(40px);animation:leak .8s ease-in-out var(--t) both}
.leak.l{left:-500px;background:radial-gradient(ellipse at center,rgba(255,170,110,.85),rgba(155,79,27,.5) 40%,transparent 70%)}
.leak.r{right:-500px;background:radial-gradient(ellipse at center,rgba(255,190,130,.75),rgba(155,79,27,.5) 45%,transparent 70%)}
@keyframes leak{0%,100%{opacity:0}50%{opacity:.7}}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(232,148,90,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(232,148,90,.09) 1px,transparent 1px);background-size:80px 80px;-webkit-mask:radial-gradient(ellipse 60% 60% at center,#000,transparent 75%);mask:radial-gradient(ellipse 60% 60% at center,#000,transparent 75%)}
.scan{position:absolute;left:0;right:0;top:0;height:220px;background:linear-gradient(180deg,transparent,rgba(232,148,90,.22) 80%,rgba(255,220,190,.7) 99%,transparent);mix-blend-mode:screen;animation:scan 2.2s cubic-bezier(.45,0,.55,1) var(--d) both}
@keyframes scan{from{transform:translateY(-240px)}to{transform:translateY(1100px)}}
.punch{animation:punch 1s cubic-bezier(.16,1,.3,1) var(--d) both}
@keyframes punch{from{transform:scale(1.45)}to{transform:none}}
.drift{animation:drift 3.4s ease-out both;animation-delay:inherit}
@keyframes drift{from{transform:scale(1.08)}to{transform:scale(1)}}
.ring{position:absolute;left:50%;top:50%;width:760px;height:150px;margin:-75px 0 0 -380px;border-radius:999px;border:3px solid rgba(255,214,180,.8);box-shadow:0 0 30px rgba(232,148,90,.6);opacity:0;animation:ring 1.3s ease-out var(--d) both}
@keyframes ring{0%{opacity:0;transform:scale(1)}8%{opacity:.9;transform:scale(1.01)}100%{opacity:0;transform:scale(1.18,1.4)}}
.appicon{position:relative}
.phone{position:relative;width:320px;height:668px;border-radius:58px;background:linear-gradient(135deg,#f3b58a 0%,#c56d2e 16%,#9b4f1b 38%,#56270a 58%,#b5622a 80%,#f0b083 100%);padding:5px;box-shadow:0 60px 120px rgba(0,0,0,.7),inset 0 0 0 1px rgba(255,220,190,.5)}
.phone::before{content:"";position:absolute;inset:5px;border-radius:53px;background:#050505}
.phone .screen{position:absolute;inset:13px;border-radius:46px;overflow:hidden}
.btn{position:absolute;width:4px;border-radius:2px;background:linear-gradient(90deg,#5a2a0c,#c87a44,#5a2a0c)}.b1{left:-3px;top:150px;height:36px}.b2{left:-3px;top:200px;height:60px}.b3{right:-3px;top:190px;height:90px}
.island{position:absolute;top:12px;left:50%;transform:translateX(-50%);width:104px;height:30px;border-radius:20px;background:#000;z-index:6}
.status{position:absolute;top:0;left:0;right:0;height:50px;display:flex;justify-content:space-between;align-items:center;padding:4px 30px 0 34px;font:600 15px var(--sans);z-index:5;color:#fff;mix-blend-mode:difference}
.sicons{display:flex;gap:7px;align-items:center}.sig{display:flex;gap:2px;align-items:flex-end;height:11px}.sig b{width:3px;background:#fff;border-radius:1px}
.sig b:nth-child(1){height:4px}.sig b:nth-child(2){height:6px}.sig b:nth-child(3){height:8px}.sig b:nth-child(4){height:11px}
.bat{width:24px;height:12px;border:1.5px solid #fff;border-radius:4px;padding:1.5px}.bat b{display:block;height:100%;width:78%;background:#fff;border-radius:1.5px}
.homebar{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:120px;height:5px;border-radius:3px;background:rgba(255,255,255,.8);z-index:6;mix-blend-mode:difference}
.pcontent{position:absolute;left:0;right:0;top:0;padding-top:52px;animation:scrollY var(--dur) cubic-bezier(.65,0,.35,1) var(--d) both}
.crop{width:294px;background-repeat:no-repeat;margin-bottom:10px}
.floaty{animation:float 4.5s ease-in-out infinite}
'''
for k,v in SH.items(): css+=f'.i-{k}{{background-image:url(data:image/jpeg;base64,{v["b64"]})}}\n'

js='''
(function(){
 var rec=/[?&]record/.test(location.search); if(rec) document.documentElement.classList.add('rec');
 function fitAll(){ document.querySelectorAll('.fit').forEach(function(el){ var max=+el.getAttribute('data-max')||1500; var base=parseFloat(getComputedStyle(el).fontSize); var w=el.scrollWidth; if(w>max) el.style.fontSize=(base*max/w)+'px'; }); window.__ready=true; }
 (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(fitAll);
 function scale(){ var s=Math.min(innerWidth/1920,innerHeight/1080); document.getElementById('stage').style.setProperty('--s',s); }
 if(!rec){ scale(); addEventListener('resize',scale); }
 window.seek=function(t){ document.getAnimations().forEach(function(a){ a.pause(); a.currentTime=t*1000; }); };
 if(!rec){ var st=performance.now(); setInterval(function(){ if(performance.now()-st>30500){ st=performance.now(); document.getAnimations().forEach(function(a){a.currentTime=0;a.play();}); } },200); }
})();
'''
html=f'''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CG Production House: We build websites and apps (v6)</title><style>{css}{''.join(KF)}</style></head><body>
<div id="stage"><div id="bg"><i class="orb o1"></i><i class="orb o2"></i><i class="orb o3"></i><i class="orb o4"></i></div>
{"".join(S)}
{LIGHT}
<div class="grain"></div><div class="vig"></div></div>
<script>{js}</script></body></html>'''
open('cg-websites-apps-v6.html','w').write(html)
import re
txt=re.sub(r'<style>.*?</style>|<script>.*?</script>|<svg.*?</svg>','',html,flags=re.S); txt=re.sub(r'<[^>]+>',' ',txt)
print(len(html)//1024,'KB; full stops:',re.findall(r'[A-Za-z]\.(?=\s|$)',txt))
