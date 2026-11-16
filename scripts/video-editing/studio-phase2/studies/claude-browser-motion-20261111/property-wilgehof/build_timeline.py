# Wilgehof vacant stand, Property Gain: 30 s portrait (1080x1920) motion video.
# Assets (not in Git): img/hero1.jpg hero2.jpg lorraine.jpg logo.png grain.png and three
# driveway/gate thumbnails, from the project's company-Drive folder. Set AGENT_PHONE for the CTA.
# Fonts: Poppins (system) + npm @fontsource/cormorant-garamond@5 in ./node_modules.
# Everything is driven by window.seek(t) -> tick(t) so frames render deterministically.
import base64, json, math, os
import mapdata

def b64(p, mime):
    return f"data:{mime};base64," + base64.b64encode(open(p, 'rb').read()).decode()
IMG = {k: b64(f'img/{k}.jpg', 'image/jpeg') for k in ['hero1', 'hero2', 'lorraine', 'e4fa9f84', '9fdd03b9', '1ee04c17']}
LOGO = b64('img/logo.png', 'image/png'); GRAIN = b64('img/grain.png', 'image/png')
FD = 'node_modules/@fontsource/cormorant-garamond/files/'
CORM = ''.join(
    f"@font-face{{font-family:'Corm';font-style:{st};font-weight:{w};src:url({b64(FD+f'cormorant-garamond-latin-{w}-{st}.woff2','font/woff2')}) format('woff2')}}"
    for w in (500, 600, 700) for st in ('normal', 'italic'))

# ---- map svg (real OSM streets) ----
STYLE = {'R': ('#3a5488', 2.2, .9), 'T': ('#aab4c8', 4.5, 1), 'P': ('#d02128', 6, 1), 'M': ('#ffffff', 7, 1)}
paths = []
for c, pts in sorted(mapdata.ways(), key=lambda w: 'RTPM'.index(w[0])):
    col, wdt, op = STYLE[c]
    d = 'M' + ' L'.join(f'{x},{y}' for x, y in pts)
    paths.append(f'<path class="st st{c}" d="{d}" stroke="{col}" stroke-width="{wdt}" opacity="{op}" pathLength="1"/>')
MAPSVG = ''.join(paths)
# edge landmarks: true direction from Wilgehof centre, straight-line distance
EDGE = [('Mimosa Mall', 638, -380, 2.5), ('University of the Free State', -114, -495, 3.3),
        ('Willows Centre', 891, 185, 1.3), ('Life Rosepark Hospital', -178, 1268, 2.7), ('Fleurdal Mall', 282, 1667, 3.1)]

html = r'''<!doctype html><html><head><meta charset="utf-8"><title>Wilgehof Stand</title><style>
''' + CORM + r'''
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:#050b1a}
#stage{position:relative;width:1080px;height:1920px;overflow:hidden;font-family:Poppins,sans-serif;color:#fff;
 background:radial-gradient(ellipse 90% 55% at 50% 0%,#132a57 0%,#0a1630 45%,#050b1a 80%)}
.sc{position:absolute;inset:0;visibility:hidden}
.abs{position:absolute}
.ph{position:absolute;inset:0;background-repeat:no-repeat;will-change:transform}
.cam{position:absolute;inset:0;transform-origin:540px 900px}
.shadeB{position:absolute;left:0;right:0;bottom:0;height:1100px;background:linear-gradient(180deg,rgba(5,11,26,0) 0%,rgba(5,11,26,.72) 38%,rgba(5,11,26,.96) 72%)}
.shadeT{position:absolute;left:0;right:0;top:0;height:420px;background:linear-gradient(180deg,rgba(5,11,26,.75),rgba(5,11,26,0))}
.ln{display:block;overflow:hidden;padding:.08em .04em .1em;margin:-.08em 0 -.1em}
.ln>span{display:inline-block;will-change:transform}
.kick{font-weight:600;font-size:46px;letter-spacing:.28em;color:#c9cfdb;text-transform:uppercase}
.big{font-weight:700;text-transform:uppercase;letter-spacing:-.02em;line-height:.92}
.serif>span{padding-right:.14em}
.serif{font-family:Corm,serif;font-style:italic;font-weight:600;letter-spacing:-.01em;line-height:.9}
.silver>span,.silver.solo{background:linear-gradient(180deg,#ffffff 0%,#e4e8f0 45%,#a9b2c4 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.red{color:#e0262e}
.pill{display:inline-block;padding:16px 30px;border-radius:999px;font-weight:600;font-size:28px;letter-spacing:.24em;text-transform:uppercase}
.pill.redbg{background:linear-gradient(180deg,#e0262e,#b51920);box-shadow:0 10px 30px rgba(208,33,40,.35),inset 0 1px 0 rgba(255,255,255,.35)}
.pill.line{border:2px solid rgba(220,226,238,.7);color:#e7ebf3}
.glass{background:linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.03) 50%,rgba(255,255,255,.07));
 border:1.5px solid rgba(255,255,255,.22);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 30px 60px rgba(0,0,0,.45);
 backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);border-radius:34px}
.stat{padding:30px 34px 26px}
.stat .l{font-size:23px;font-weight:600;letter-spacing:.26em;color:#aeb7c8;text-transform:uppercase}
.stat .v{font-size:84px;font-weight:700;letter-spacing:-.02em;margin-top:6px;white-space:nowrap}
.rule{height:2px;background:linear-gradient(90deg,rgba(255,255,255,0),#dfe4ee 20%,#dfe4ee 80%,rgba(255,255,255,0))}
#wm{position:absolute;left:50%;top:58px;width:170px;margin-left:-85px;opacity:0;filter:drop-shadow(0 6px 18px rgba(0,0,0,.5));z-index:30}
#grain{position:absolute;inset:-50px;background-image:url(''' + GRAIN + r''');opacity:.07;mix-blend-mode:overlay;z-index:40;pointer-events:none}
#vig{position:absolute;inset:0;background:radial-gradient(ellipse 85% 70% at 50% 50%,transparent 55%,rgba(2,6,16,.75) 100%);z-index:39;pointer-events:none}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(150,175,225,.07) 1.5px,transparent 1.5px),linear-gradient(90deg,rgba(150,175,225,.07) 1.5px,transparent 1.5px);background-size:60px 60px}
.card{position:absolute;width:470px;padding:12px;border-radius:30px}
.card img{display:block;width:100%;border-radius:20px}
.chip{position:absolute;white-space:nowrap;padding:14px 22px;border-radius:22px}
.chip b{display:block;font-weight:600;font-size:28px}
.chip i{display:block;font-family:Corm,serif;font-style:italic;font-weight:700;font-size:40px;color:#e0262e;line-height:1}
.foot{font-size:22px;letter-spacing:.06em;color:rgba(220,226,238,.6)}
.st{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1 1}
</style></head><body><div id="stage">

<!-- S1 hook -->
<section class="sc" id="s1">
 <div class="ph" id="p1" style="background-image:url(''' + IMG['hero1'] + r''');background-size:auto 1920px;background-position:-640px 0"></div>
 <div class="shadeB" id="s1shade"></div>
 <svg class="abs" id="hk" width="1080" height="1920" viewBox="0 0 1080 1920" style="left:0;top:0"></svg>
 <div class="abs" style="left:70px;right:70px;bottom:250px;text-align:center">
  <div class="ln kick"><span data-r="1.55">What would you</span></div>
  <div class="ln serif silver" style="margin-top:6px"><span class="fit" data-max="940" style="font-size:200px" data-r="1.7">use this space</span></div>
  <div class="ln big"><span data-r="1.9" style="font-size:250px">FOR<span class="red">?</span></span></div>
 </div>
</section>

<!-- S2 price -->
<section class="sc" id="s2">
 <div class="cam" id="c2"><div class="ph" id="p2" style="background-image:url(''' + IMG['hero2'] + r''');background-size:auto 1920px"></div></div>
 <div class="shadeB" style="height:1250px"></div>
 <div class="abs" style="left:70px;width:940px;top:880px">
  <div data-r="3.35"><span class="pill redbg">Vacant stand for sale</span></div>
  <div class="ln big silver" style="margin-top:34px"><span class="fit" data-max="940" style="font-size:200px" data-r="3.5">WILGEHOF</span></div>
  <div class="ln serif" style="font-size:72px;color:#d9deea;margin-top:6px"><span data-r="3.7">Bloemfontein, Free State</span></div>
  <div class="rule" id="rule2" style="margin:42px 0 36px;transform-origin:left"></div>
  <div style="display:flex;gap:30px">
   <div class="glass stat" style="flex:1" data-r="4.1"><div class="l">Asking price</div><div class="v" id="price">R 0</div></div>
   <div class="glass stat" style="flex:.82" data-r="4.25"><div class="l">Stand size</div><div class="v"><span id="size">0</span> m²</div></div>
  </div>
  <div style="margin-top:34px" data-r="4.9"><span class="pill line">Cash buyers only</span></div>
 </div>
</section>

<!-- S3 panhandle plan -->
<section class="sc" id="s3">
 <div class="grid"></div>
 <div class="abs" style="left:70px;right:70px;top:190px">
  <div class="ln big silver"><span class="fit" data-max="720" style="font-size:190px" data-r="7.05">PRIVATE</span></div>
  <div class="ln serif" style="font-size:150px;margin-top:-4px"><span data-r="7.25">&amp; secure</span></div>
 </div>
 <svg class="abs" id="plan" width="1080" height="900" viewBox="0 0 1080 900" style="left:0;top:560px"></svg>
 <div class="glass card" id="cardA" style="left:52px;top:1470px"><img src="''' + IMG['e4fa9f84'] + r'''"></div>
 <div class="glass card" id="cardB" style="left:558px;top:1470px"><img src="''' + IMG['9fdd03b9'] + r'''"></div>
</section>

<!-- S4 dream home -->
<section class="sc" id="s4">
 <div class="cam" id="c4"><div class="ph" style="background-image:url(''' + IMG['hero1'] + r''');background-size:auto 1920px;background-position:-651px 0"></div>
 <svg class="abs" id="h4" width="1080" height="1920" viewBox="0 0 1080 1920" style="left:0;top:0"></svg></div>
 <div class="shadeT"></div>
 <div class="shadeB" style="height:900px"></div>
 <div class="abs" style="left:70px;right:70px;bottom:230px;text-align:center">
  <div class="ln kick"><span data-r="11.05">Building your</span></div>
  <div class="ln serif silver" style="margin-top:6px"><span class="fit" data-max="900" style="font-size:210px" data-r="11.2">dream home?</span></div>
 </div>
</section>

<!-- S5 salon -->
<section class="sc" id="s5">
 <div class="cam" id="c5"><div class="ph" style="background-image:url(''' + IMG['hero2'] + r''');background-size:auto 1920px;background-position:-560px 0"></div>
 <svg class="abs" id="h5" width="1080" height="1920" viewBox="0 0 1080 1920" style="left:0;top:0"></svg></div>
 <div class="shadeT"></div>
 <div class="shadeB" style="height:900px"></div>
 <div class="abs" style="left:70px;right:70px;bottom:230px;text-align:center">
  <div class="ln kick"><span data-r="16.65">Or opening your</span></div>
  <div class="ln serif silver" style="margin-top:6px"><span class="fit" data-max="900" style="font-size:210px" data-r="16.8">own business?</span></div>
 </div>
 <div class="abs foot" style="left:0;right:0;bottom:120px;text-align:center" data-r="17.4">*Business use subject to zoning approval</div>
</section>

<!-- S6 area map -->
<section class="sc" id="s6">
 <div class="abs" style="left:70px;right:70px;top:190px;text-align:center">
  <div class="ln big silver"><span class="fit" data-max="900" style="font-size:150px" data-r="22.05">EVERYTHING</span></div>
  <div class="ln serif" style="font-size:140px;margin-top:-2px"><span data-r="22.2">within reach</span></div>
 </div>
 <svg class="abs" id="map" width="1080" height="1920" viewBox="0 0 1080 1920" style="left:0;top:0">
  <defs><clipPath id="mc"><circle cx="540" cy="1120" r="430"/></clipPath>
   <radialGradient id="mg"><stop offset="0" stop-color="#14306a"/><stop offset="1" stop-color="#071127"/></radialGradient>
   <filter id="gl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <circle cx="540" cy="1120" r="430" fill="url(#mg)" id="mdisc"/>
  <g clip-path="url(#mc)"><g id="mstreets" transform="translate(0,580)" filter="url(#gl)">''' + MAPSVG + r'''</g></g>
  <g id="mring"></g><g id="mlead"></g><g id="mpins"></g>
 </svg>
 <div id="chips"></div>
 <div class="abs foot" style="left:0;right:0;bottom:70px;text-align:center" data-r="23.6">Map: OpenStreetMap streets · straight-line distances, approximate</div>
</section>

<!-- S7 agent CTA -->
<section class="sc" id="s7">
 <div class="cam" id="c7"><img class="abs" id="lor" src="''' + IMG['lorraine'] + r'''" style="left:0;top:-60px;width:1080px;
  -webkit-mask-image:radial-gradient(ellipse 62% 58% at 50% 34%,#000 52%,transparent 92%);mask-image:radial-gradient(ellipse 62% 58% at 50% 34%,#000 52%,transparent 92%)"></div>
 <div class="abs" style="left:0;right:0;top:0;height:1920px;background:linear-gradient(180deg,rgba(5,11,26,0) 40%,rgba(5,11,26,.85) 58%,#050b1a 70%)"></div>
 <div class="abs" style="left:60px;right:60px;top:1000px;text-align:center">
  <div class="ln kick"><span data-r="25.65">Book your</span></div>
  <div class="ln serif silver" style="margin-top:4px"><span class="fit" data-max="960" style="font-size:170px" data-r="25.8">private viewing</span></div>
  <div class="ln" style="margin-top:28px;font-weight:700;font-size:50px;letter-spacing:.12em"><span data-r="26.2">LORRAINE OOSTHUIZEN</span></div>
  <div style="margin-top:28px" data-r="26.5"><div class="kick" style="font-size:26px;margin-bottom:14px">Call or WhatsApp</div><span class="pill redbg" id="phone" style="font-size:52px;letter-spacing:.08em;padding:18px 46px">''' + os.environ.get('AGENT_PHONE', 'AGENT PHONE') + r'''</span></div>
  <div class="foot" style="margin-top:24px;font-size:24px" data-r="26.8">Cash buyers only &nbsp;·&nbsp; Ref P24-117797458</div>
 </div>
 <img class="abs" id="logoEnd" src="''' + LOGO + r'''" style="left:50%;width:290px;margin-left:-145px;top:1675px">
</section>

<img id="wm" src="''' + LOGO + r'''">
<div id="vig"></div><div id="grain"></div>
</div>
<script>
const CHIPPOS=[[700,560,'c'],[40,690,'l'],[1040,640,'r'],[40,1640,'l'],[620,1700,'c']];
const MAPEDGE=''' + json.dumps(EDGE) + r''';
const cl=(x,a=0,b=1)=>Math.min(b,Math.max(a,x)), lerp=(a,b,k)=>a+(b-a)*k;
const E={o:x=>1-Math.pow(1-x,4), io:x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2, b:x=>{const c=1.5;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)}};
const P=(t,a,b,e=E.o)=>e(cl((t-a)/(b-a)));
const $=id=>document.getElementById(id);
function vis(el,t,a,b,fi=.45,fo=.45){const o=Math.min(P(t,a,a+fi,E.io),1-P(t,b-fo,b,E.io));el.style.opacity=o;el.style.visibility=o>0.001?'visible':'hidden';return o;}
const REV=[...document.querySelectorAll('[data-r]')].map(el=>({el,r:+el.dataset.r,ln:el.parentElement.classList.contains('ln')}));
function reveals(t){for(const o of REV){const k=P(t,o.r,o.r+.95);
  if(o.ln){o.el.style.transform=`translateY(${(1-k)*105}%)`;}
  else{o.el.style.opacity=k;o.el.style.transform=`translateY(${(1-k)*46}px)`;o.el.style.filter=k<1?`blur(${(1-k)*10}px)`:'none';}}}
function fit(){document.querySelectorAll('.fit').forEach(el=>{const m=+el.dataset.max;let fs=parseFloat(getComputedStyle(el).fontSize);el.style.whiteSpace='nowrap';
  for(let i=0;i<4;i++){const w=el.getBoundingClientRect().width;if(!w)break;fs=fs*m/w;el.style.fontSize=fs+'px';}});}
const housePts=(cx,cy,s)=>[[cx-s*.8,cy+s*.78],[cx-s*.8,cy-s*.12],[cx,cy-s*.9],[cx+s*.8,cy-s*.12],[cx+s*.8,cy+s*.78]];
const pl=pts=>pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');

/* ---------- S1 ---------- */
function S1(t){const s=$('s1');if(vis(s,t,-1,3.35,.01,.45)<=0)return;
 const k=P(t,1.0,2.05,E.io); const S=lerp(190,3400,k);
 const pts=housePts(540,840+k*300,S); $('p1').style.clipPath=`polygon(${pts.map(p=>p[0]+'px '+p[1]+'px').join(',')})`;
 $('p1').style.transform=`scale(${lerp(1.18,1.0,P(t,1.0,3.3,E.o))})`;$('p1').style.transformOrigin='540px 900px';
 $('s1shade').style.opacity=P(t,1.4,2.2);
 const d=P(t,.05,.95,E.io), fo=1-P(t,1.0,1.5);
 const L=[[350,880,140,'#ffffff',d*1.15-.15],[730,880,140,'#8a8b90',d*1.15-.08],[540,840,190,'#d02128',d]];
 let h='';for(const [x,y,ss,c,dd] of L){const big=c==='#d02128';const sz=big?S:ss;const yy=big?y+k*300:y;
  const op=big?1-P(t,1.75,2.05):fo;
  h+=`<polyline points="${pl(housePts(x,yy,sz))}" fill="none" stroke="${c}" stroke-width="${big?30+k*60:26}" stroke-linejoin="miter" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${1-cl(dd)}" opacity="${op}"/>`;}
 h+=`<path d="M300,${1075+k*400} Q540,${985+k*400} 780,${1075+k*400}" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${1-P(t,.45,1.0,E.io)}" opacity="${t<.47?0:fo}"/>`;
 $('hk').innerHTML=h;}

/* ---------- S2 ---------- */
const fmt=n=>'R '+Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,' ');
function S2(t){const s=$('s2');if(vis(s,t,3.0,7.05,.5,.45)<=0)return;
 $('p2').style.backgroundPosition=`${lerp(-780,-520,P(t,3,7.1,x=>x))}px 0`;$('c2').style.transform=`scale(${lerp(1.12,1.0,P(t,3,7.1,E.o))})`;
 $('rule2').style.transform=`scaleX(${P(t,3.95,4.9,E.io)})`;
 $('price').textContent=fmt(550000*P(t,4.2,5.5,E.o));$('size').textContent=Math.round(501*P(t,4.35,5.5,E.o));}

/* ---------- S3 plan ---------- */
function S3(t){const s=$('s3');if(vis(s,t,6.8,11.05,.45,.45)<=0)return;
 const stand=[[250,60],[900,60],[900,460],[330,460],[330,790],[250,790]];
 const dr=P(t,7.55,8.75,E.io), fill=P(t,8.4,9.0), fence=P(t,8.8,9.3);
 let h='';
 h+=`<rect x="0" y="796" width="1080" height="80" fill="#0d1a38" opacity="${P(t,7.2,7.7)}"/><line x1="0" y1="836" x2="${1080*P(t,7.2,8.0,E.io)}" y2="836" stroke="#c9cfdb" stroke-width="3" stroke-dasharray="26 22" opacity=".7"/>`;
 h+=`<text x="1040" y="865" text-anchor="end" font-family="Poppins" font-weight="600" font-size="24" letter-spacing="7" fill="#aeb7c8" opacity="${P(t,7.6,8.2)}">QUIET STREET</text>`;
 const nb=P(t,7.4,8.0);
 h+=`<rect x="350" y="482" width="560" height="292" rx="6" fill="rgba(255,255,255,.035)" stroke="rgba(255,255,255,.16)" stroke-width="2" stroke-dasharray="10 10" opacity="${nb}"/>`;
 h+=`<rect x="30" y="60" width="200" height="714" rx="6" fill="rgba(255,255,255,.035)" stroke="rgba(255,255,255,.16)" stroke-width="2" stroke-dasharray="10 10" opacity="${nb}"/>`;
 h+=`<polyline points="${pl(housePts(790,600,60))}" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="8" opacity="${nb}"/>`;
 h+=`<polygon points="${pl(stand)}" fill="rgba(208,33,40,${.16*fill})" stroke="none"/>`;
 h+=`<polygon points="${pl(stand)}" fill="none" stroke="#fff" stroke-width="5" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${1-dr}" filter="drop-shadow(0 0 10px rgba(255,255,255,.5))"/>`;
 const ins=[[268,78],[882,78],[882,442],[312,442],[312,772],[268,772]];
 h+=`<polygon points="${pl(ins)}" fill="none" stroke="#e0262e" stroke-width="4" stroke-dasharray="14 12" stroke-dashoffset="${-t*40}" opacity="${fence}"/>`;
 const a=P(t,8.9,9.6,E.b);
 h+=`<g transform="translate(575 255) scale(${.6+.4*a})" opacity="${P(t,8.9,9.4)}"><text text-anchor="middle" font-family="Poppins" font-weight="700" font-size="130" fill="#fff" y="20">501 m²</text>
  <text text-anchor="middle" font-family="Corm" font-style="italic" font-weight="600" font-size="52" fill="#d9deea" y="88">of fully fenced land</text></g>`;
 // car path: street -> handle -> stand
 const c=P(t,9.0,10.3,E.io); let cx,cy; if(c<.55){const k=c/.55;cx=290;cy=lerp(836,430,k);}else{const k=(c-.55)/.45;cx=lerp(290,470,k);cy=lerp(430,330,k);}
 if(t>9.0){h+=`<line x1="290" y1="836" x2="290" y2="${Math.max(cy,430)}" stroke="#e0262e" stroke-width="6" opacity=".5"/>`;
  h+=`<circle cx="${cx}" cy="${cy}" r="16" fill="#fff" opacity="${1-P(t,10.4,10.8)}" filter="drop-shadow(0 0 18px #e0262e)"/>`;}
 const lb=P(t,9.3,9.9);
 h+=`<g opacity="${lb}" transform="translate(${lerp(380,360,lb)} 640)"><line x1="-60" y1="0" x2="0" y2="0" stroke="#fff" stroke-width="2.5"/>
  <rect x="0" y="-36" width="390" height="72" rx="36" fill="rgba(5,11,26,.7)" stroke="rgba(255,255,255,.4)" stroke-width="2"/>
  <text x="195" y="10" text-anchor="middle" font-family="Poppins" font-weight="600" font-size="25" letter-spacing="4" fill="#fff">PANHANDLE ENTRY</text></g>`;
 $('plan').innerHTML=h;
 for(const [id,r,rot] of [['cardA',9.55,-3.5],['cardB',9.75,3.5]]){const k=P(t,r,r+.9,E.o);const el=$(id);el.style.opacity=k;
  el.style.transform=`translateY(${(1-k)*160+Math.sin((t-r)*1.6)*6}px) rotate(${rot*k}deg)`;}}

/* ---------- 3D projection (for S4/S5) ---------- */
function makeCam(f,yh,ch){return (X,Y,Z)=>[540+f*X/Z, yh+f*(ch-Y)/Z];}
function box(o){const c=Math.cos(o.yaw),s=Math.sin(o.yaw);const W=(lx,lz)=>[o.cx+lx*c-lz*s, o.cz+lx*s+lz*c];
 const x0=o.lx-o.w/2,x1=o.lx+o.w/2,z0=o.lz-o.d/2,z1=o.lz+o.d/2;
 const g=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(p=>W(p[0],p[1]));return g;}
// face list for a box footprint g (4 ground corners CCW from front-left), base y0, height h
function faces(g,y0,h){const F=[];const n=[[0,1],[1,2],[2,3],[3,0]];
 for(const [a,b] of n){F.push({q:[[g[a][0],y0,g[a][1]],[g[b][0],y0,g[b][1]],[g[b][0],y0+h,g[b][1]],[g[a][0],y0+h,g[a][1]]],side:a});}
 F.push({q:g.map(p=>[p[0],y0+h,p[1]]),side:'top'});return F;}
function visible(f,cy){const [a,b,c]=f.q;const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
 let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 if(f.side==='top') return cy>a[1];
 const m=[(a[0]+c[0])/2,(a[1]+c[1])/2,(a[2]+c[2])/2];
 return (n[0]*(0-m[0])+n[1]*(cy-m[1])+n[2]*(0-m[2]))<0;}
function shade(hex,k){const n=parseInt(hex.slice(1),16);const r=Math.min(255,(n>>16)*k),g=Math.min(255,((n>>8)&255)*k),b=Math.min(255,(n&255)*k);return `rgb(${r|0},${g|0},${b|0})`;}
function faceShade(f){if(f.side==='top')return 1.12;const [a,b]=[f.q[0],f.q[1]];const dx=b[0]-a[0],dz=b[2]-a[2];const L=Math.hypot(dx,dz);
 const nx=dz/L,nz=-dx/L; const lx=-.55,lz=-.65; return .62+.5*Math.max(0,(nx*lx+nz*lz));}
// point on a vertical face quad: u along base, v up (0..1 of face height)
function fp(f,u,v,inset=0){const [a,b,,d]=f.q;const x=a[0]+(b[0]-a[0])*u,z=a[2]+(b[2]-a[2])*u,y=a[1]+(d[1]-a[1])*v;
 if(!inset)return [x,y,z];const dx=b[0]-a[0],dz=b[2]-a[2],L=Math.hypot(dx,dz);return [x-dz/L*inset,y,z+dx/L*inset];}

/* ---------- S4 dream home ---------- */
const cam4=makeCam(983,767,1.5);
function S4(t){const s=$('s4');if(vis(s,t,10.8,16.75,.5,.45)<=0)return;
 $('c4').style.transform=`scale(${lerp(1.0,1.07,P(t,10.8,16.8,x=>x))})`;
 const pr=(p)=>cam4(p[0],p[1],p[2]);const poly=(pts,fill,extra='')=>`<polygon points="${pl(pts.map(pr))}" fill="${fill}" ${extra}/>`;
 const yaw=-.5, base={cx:-.4,cz:17.5,yaw};
 const A={...base,lx:-2.3,lz:.9,w:7.4,d:6,h:3.1,col:'#efebe3'}, B={...base,lx:3.1,lz:-.3,w:4.8,d:7,h:6.3,col:'#2b2f37'};
 const gA=box(A), gB=box(B);
 let h='';
 // blueprint footprint
 const bp=P(t,11.25,12.1,E.io), bpo=1-P(t,13.4,14.0);
 for(const g of [gA,gB]){h+=`<polygon points="${pl(g.map(p=>cam4(p[0],0,p[1])))}" fill="rgba(208,33,40,${.18*bp*bpo})" stroke="#fff" stroke-width="4" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${1-bp}" opacity="${bpo}" filter="drop-shadow(0 0 8px rgba(255,255,255,.8))"/>`;}
 const slab=P(t,11.95,12.4,E.o), pA=P(t,12.3,13.4,E.io), pB=P(t,12.6,13.85,E.io);
 const glass=P(t,13.5,14.15), roof=P(t,13.8,14.5,E.b), warm=P(t,14.6,15.3), shrub=P(t,14.3,15.0,E.b);
 // shadows
 const sh=(g,hh)=>{const off=[hh*.55,hh*.35];const all=g.concat(g.map(p=>[p[0]+off[0],p[1]+off[1]]));
   const c=all.reduce((a,p)=>[a[0]+p[0]/all.length,a[1]+p[1]/all.length],[0,0]);all.sort((p,q)=>Math.atan2(p[1]-c[1],p[0]-c[0])-Math.atan2(q[1]-c[1],q[0]-c[0]));
   return `<polygon points="${pl(all.map(p=>cam4(p[0],0,p[1])))}" fill="rgba(20,12,6,.42)" filter="blur(6px)"/>`;};
 if(slab>0){h+=sh(gA,A.h*pA)+sh(gB,B.h*pB);}
 // collect drawable faces with depth
 const items=[];
 const pushBox=(g,y0,hh,col,tag)=>{if(hh<=0.001)return;for(const f of faces(g,y0,hh)){if(!visible(f,1.5))continue;
   const z=f.q.reduce((a,p)=>a+p[2],0)/4;items.push({f,z,col,tag,hh});}};
 if(slab>0){pushBox(gA,0,.28*slab,'#d8d3c8','slab');pushBox(gB,0,.28*slab,'#d8d3c8','slab');}
 pushBox(gA,.28,(A.h-.28)*pA,A.col,'A');pushBox(gB,.28,(B.h-.28)*pB,B.col,'B');
 if(roof>0){const RA=box({...A,w:A.w+.9,d:A.d+.9}),RB=box({...B,w:B.w+.9,d:B.d+.9});const dy=(1-roof)*2.2;
  pushBox(RA,A.h+dy,.32,'#1c1f25','roof');pushBox(RB,B.h+dy,.32,'#1c1f25','roof');}
 items.sort((a,b)=>b.z-a.z);
 for(const it of items){const f=it.f;h+=poly(f.q,shade(it.col,faceShade(f)),'stroke="rgba(0,0,0,.18)" stroke-width="1"');
  if(glass>0 && f.side===0 && (it.tag==='A'||it.tag==='B')){
   const wins=it.tag==='A'?[[.06,.6,.02,.86]]:[[.12,.88,.04,.47],[.12,.88,.53,.95]];
   for(const [u0,u1,v0,v1] of wins){const q=[fp(f,u0,v0),fp(f,u1,v0),fp(f,u1,v1),fp(f,u0,v1)];
    h+=poly(q,`url(#gl4)`,`opacity="${glass}"`);h+=poly(q,`rgba(255,190,110,${.3*warm})`);
    h+=`<polyline points="${pl([fp(f,(u0+u1)/2,v0),fp(f,(u0+u1)/2,v1)].map(pr))}" stroke="#15171c" stroke-width="5" opacity="${glass}"/>`;}
   if(it.tag==='A'){const q=[fp(f,.66,0),fp(f,.95,0),fp(f,.95,1),fp(f,.66,1)];h+=poly(q,'#8a5a38',`opacity="${glass}"`);
    for(let i=1;i<9;i++){const u=.66+.29*i/9;h+=`<polyline points="${pl([fp(f,u,0),fp(f,u,1)].map(pr))}" stroke="rgba(0,0,0,.25)" stroke-width="2" opacity="${glass}"/>`;}}}
  if(glass>0 && f.side===1 && it.tag==='B'){const q=[fp(f,.15,.62),fp(f,.85,.62),fp(f,.85,.84),fp(f,.15,.84)];h+=poly(q,'url(#gl4)',`opacity="${glass}"`);h+=poly(q,`rgba(255,196,120,${.5*warm})`);}}
 // shrubs + lights
 if(shrub>0){for(const [x,z,r] of [[-6.2,13.6,.7],[-5.0,13.0,.5],[1.0,12.6,.55],[4.6,12.2,.7],[5.4,13.2,.5],[-2.0,13.0,.42]]){
   const [sx,sy]=cam4(x,0,z),rr=983*r/z*shrub;h+=`<ellipse cx="${sx}" cy="${sy-rr*.8}" rx="${rr}" ry="${rr*.85}" fill="#2f5a2c"/><ellipse cx="${sx-rr*.25}" cy="${sy-rr*1.05}" rx="${rr*.55}" ry="${rr*.45}" fill="#4f8a3f" opacity=".8"/>`;}}
 if(warm>0){const [gx,gy]=cam4(-.4,0,14);h+=`<ellipse cx="${gx}" cy="${gy}" rx="${520*warm}" ry="${70*warm}" fill="rgba(255,190,110,.18)" filter="blur(20px)"/>`;}
 $('h4').innerHTML=`<defs><linearGradient id="gl4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fb4d6"/><stop offset=".45" stop-color="#1a2a48"/><stop offset="1" stop-color="#0c1426"/></linearGradient></defs>`+h;}

/* ---------- S5 salon ---------- */
const cam5=makeCam(1300,745,1.5);
function S5(t){const s=$('s5');if(vis(s,t,16.4,22.05,.5,.45)<=0)return;
 $('c5').style.transform=`scale(${lerp(1.0,1.07,P(t,16.4,22.1,x=>x))})`;
 const pr=(p)=>cam5(p[0],p[1],p[2]);const poly=(pts,fill,extra='')=>`<polygon points="${pl(pts.map(pr))}" fill="${fill}" ${extra}/>`;
 const S={cx:-.2,cz:18,yaw:.32,lx:0,lz:0,w:8.6,d:6,h:3.7,col:'#f1ece3'}; const g=box(S);
 let h='';
 const bp=P(t,16.9,17.7,E.io), bpo=1-P(t,18.6,19.2);
 h+=`<polygon points="${pl(g.map(p=>cam5(p[0],0,p[1])))}" fill="rgba(208,33,40,${.18*bp*bpo})" stroke="#fff" stroke-width="4" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${1-bp}" opacity="${bpo}" filter="drop-shadow(0 0 8px rgba(255,255,255,.8))"/>`;
 const slab=P(t,17.6,18.0), pw=P(t,17.9,19.0,E.io), glass=P(t,18.9,19.45), aw=P(t,19.2,19.85,E.b), sign=P(t,19.6,20.6,E.io), lit=P(t,19.9,20.6), pots=P(t,20.2,20.8,E.b);
 if(slab>0){const hh=S.h*pw;const off=[hh*.55,hh*.35];const all=g.concat(g.map(p=>[p[0]+off[0],p[1]+off[1]]));const c=all.reduce((a,p)=>[a[0]+p[0]/8,a[1]+p[1]/8],[0,0]);
  all.sort((p,q)=>Math.atan2(p[1]-c[1],p[0]-c[0])-Math.atan2(q[1]-c[1],q[0]-c[0]));h+=`<polygon points="${pl(all.map(p=>cam5(p[0],0,p[1])))}" fill="rgba(20,12,6,.42)" filter="blur(6px)"/>`;}
 const items=[];const pushBox=(gg,y0,hh,col,tag)=>{if(hh<=.001)return;for(const f of faces(gg,y0,hh)){if(!visible(f,1.5))continue;items.push({f,z:f.q.reduce((a,p)=>a+p[2],0)/4,col,tag});}};
 if(slab>0)pushBox(g,0,.25*slab,'#d8d3c8','slab');
 pushBox(g,.25,(S.h-.25)*pw,S.col,'W');
 if(pw>.98)pushBox(box({...S,w:S.w+.5,d:S.d+.5}),S.h,.3,'#1b1f27','roof');
 items.sort((a,b)=>b.z-a.z);
 let front=null;
 for(const it of items){const f=it.f;h+=poly(f.q,shade(it.col,faceShade(f)),'stroke="rgba(0,0,0,.18)" stroke-width="1"');if(it.tag==='W'&&f.side===0)front=f;}
 if(front&&glass>0){const f=front;
  // interior (back plane) seen through the glass
  const back=(u,v)=>fp(f,u,v,2.4);
  h+=poly([fp(f,.05,.0),fp(f,.95,.0),fp(f,.95,.7),fp(f,.05,.7)],'#1d1712',`opacity="${glass}"`);
  h+=poly([back(.05,0),back(.95,0),back(.95,.7),back(.05,.7)],`rgba(255,214,170,${.25+.5*lit})`,`opacity="${glass}"`);
  for(const u of [.22,.47,.72]){ // round mirrors + chairs
   const m=[];for(let i=0;i<20;i++){const a=i/20*Math.PI*2;m.push(back(u+Math.cos(a)*.065,.42+Math.sin(a)*.13));}
   h+=poly(m,'#f6e7cf',`opacity="${glass}" stroke="#c9a46a" stroke-width="5"`);
   h+=poly([back(u-.05,.02),back(u+.05,.02),back(u+.05,.2),back(u-.05,.2)],'#2b1f22',`opacity="${glass}"`);
   h+=poly([back(u-.04,.2),back(u+.04,.2),back(u+.04,.32),back(u-.04,.32)],'#3a2a2e',`opacity="${glass}"`);
   const [lx,ly]=pr(back(u,.63));h+=`<circle cx="${lx}" cy="${ly}" r="${9+10*lit}" fill="#ffd9a0" opacity="${glass*(.4+.6*lit)}" filter="blur(${2+5*lit}px)"/>`;}
  h+=poly([fp(f,.05,0),fp(f,.95,0),fp(f,.95,.7),fp(f,.05,.7)],'url(#gl5)',`opacity="${.55*glass}"`);
  for(const u of [.05,.3,.405,.495,.7,.95])h+=`<polyline points="${pl([fp(f,u,0),fp(f,u,.7)].map(pr))}" stroke="#14161b" stroke-width="7" opacity="${glass}"/>`;
  h+=`<polyline points="${pl([fp(f,.05,.7),fp(f,.95,.7)].map(pr))}" stroke="#14161b" stroke-width="7" opacity="${glass}"/>`;
  // fascia + sign
  const fa=[fp(f,0,.76),fp(f,1,.76),fp(f,1,1),fp(f,0,1)];h+=poly(fa,'#161a22',`opacity="${glass}"`);
  // awning
  if(aw>0){const out=1.25*aw;const o=(u,v,k)=>{const p=fp(f,u,v);const [a,b]=[f.q[0],f.q[1]];const dx=b[0]-a[0],dz=b[2]-a[2],L=Math.hypot(dx,dz);return [p[0]+dz/L*k,p[1]-.5*aw*(k/1.25),p[2]-dx/L*k];};
   const q=[o(.08,.74,0),o(.92,.74,0),o(.92,.74,out),o(.08,.74,out)];h+=poly(q,'#d02128','stroke="#8e1217" stroke-width="2"');
   for(let i=1;i<8;i++){const u=.08+.84*i/8;h+=`<polyline points="${pl([o(u,.74,0),o(u,.74,out)].map(pr))}" stroke="#f3f3f3" stroke-width="7" opacity=".9"/>`;}
   h+=poly([o(.08,.74,out),o(.92,.74,out),o(.92,.74-.05,out),o(.08,.74-.05,out)],'#a8151b');}
  // sign text mapped onto the fascia with an affine transform
  const p0=pr(fp(f,.1,.97)),p1=pr(fp(f,.9,.97)),p2=pr(fp(f,.1,.79));const W=1000,H=100;
  const mtx=[(p1[0]-p0[0])/W,(p1[1]-p0[1])/W,(p2[0]-p0[0])/H,(p2[1]-p0[1])/H,p0[0],p0[1]];
  h+=`<g transform="matrix(${mtx.join(',')})"><clipPath id="sgc"><rect x="0" y="-200" width="${W*sign}" height="400"/></clipPath>
   <text x="${W/2}" y="${H*.8}" text-anchor="middle" font-family="Corm" font-style="italic" font-weight="700" font-size="128" fill="#fff4e4" clip-path="url(#sgc)" filter="drop-shadow(0 0 ${4+10*lit}px rgba(255,214,160,.9))">Nail &amp; Hair Studio</text></g>`;
  if(pots>0){for(const u of [.0,1.0]){const [x0,y0]=pr(fp(f,u,0,-.6));const r=40*pots;h+=`<rect x="${x0-r*.5}" y="${y0-r*1.1}" width="${r}" height="${r*1.1}" rx="6" fill="#20242c"/><ellipse cx="${x0}" cy="${y0-r*1.6}" rx="${r*.9}" ry="${r*.9}" fill="#3e7a39"/>`;}}}
 $('h5').innerHTML=`<defs><linearGradient id="gl5" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe0ff" stop-opacity=".7"/><stop offset=".4" stop-color="#ffffff" stop-opacity=".05"/><stop offset=".7" stop-color="#ffffff" stop-opacity=".25"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient></defs>`+h;}

/* ---------- S6 map ---------- */
const STREETS=[...document.querySelectorAll('#mstreets .st')];
function S6(t){const s=$('s6');if(vis(s,t,21.85,25.65,.45,.45)<=0)return;
 const disc=P(t,22.0,22.6,E.b);$('mdisc').setAttribute('r',430*disc);document.querySelector('#mc circle').setAttribute('r',430*disc);
 STREETS.forEach((p,i)=>{const c=p.classList[1];const st={stM:22.2,stP:22.3,stT:22.45,stR:22.6}[c]+(i%13)*.02;p.style.strokeDashoffset=1-P(t,st,st+1.0,E.io);});
 $('mstreets').setAttribute('transform',`translate(540 1120) scale(${lerp(1.25,1.0,P(t,22.0,25.6,E.o))}) translate(-540 -540)`);
 // ring with ticks and true north
 let r='';const rp=P(t,22.4,23.2,E.io);
 r+=`<circle cx="540" cy="1120" r="452" fill="none" stroke="rgba(220,226,238,.55)" stroke-width="2" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${1-rp}"/>`;
 for(let i=0;i<72;i++){const a=i/72*Math.PI*2, L=i%6===0?18:8;const o=rp>i/72?1:0;r+=`<line x1="${540+Math.sin(a)*462}" y1="${1120-Math.cos(a)*462}" x2="${540+Math.sin(a)*(462+L)}" y2="${1120-Math.cos(a)*(462+L)}" stroke="rgba(220,226,238,.6)" stroke-width="2" opacity="${o}"/>`;}
 r+=`<g opacity="${P(t,23.0,23.4)}"><path d="M540,632 l-14,26 h28 z" fill="#e0262e"/><text x="540" y="626" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="26" fill="#fff">N</text></g>`;
 $('mring').innerHTML=r;
 // pins
 let pn='';const pk=P(t,22.9,23.5,E.b);const pulse=(t*0.9)%1;
 pn+=`<circle cx="540" cy="1120" r="${20+pulse*120}" fill="none" stroke="#e0262e" stroke-width="4" opacity="${(1-pulse)*pk}"/>`;
 pn+=`<circle cx="540" cy="1120" r="${26*pk}" fill="#e0262e" stroke="#fff" stroke-width="6"/>`;
 pn+=`<g opacity="${P(t,23.1,23.6)}" transform="translate(540 1045)"><rect x="-150" y="-40" width="300" height="64" rx="32" fill="#e0262e"/><text y="5" text-anchor="middle" font-family="Poppins" font-weight="700" font-size="30" letter-spacing="5" fill="#fff">WILGEHOF</text></g>`;
 const sp=P(t,23.6,24.1,E.b);const [sx,sy]=[412,488+580];
 pn+=`<g opacity="${P(t,23.6,23.9)}"><circle cx="${sx}" cy="${sy}" r="${11*sp}" fill="#fff"/><g transform="translate(${sx-26} ${sy+44})"><rect x="-330" y="-30" width="345" height="88" rx="22" fill="rgba(5,11,26,.82)" stroke="rgba(255,255,255,.3)" stroke-width="2"/>
  <text x="-312" y="5" font-family="Poppins" font-weight="600" font-size="25" fill="#fff">Wilgehof Primary</text><text x="-312" y="44" font-family="Corm" font-style="italic" font-weight="700" font-size="32" fill="#e0262e">± 0.4 km</text></g></g>`;
 $('mpins').innerHTML=pn;
 // edge chips in their true compass direction
 let ch='',lines='';MAPEDGE.forEach(([n,x,y,km],i)=>{const a=Math.atan2(y-540,x-540);const k=P(t,23.4+i*.16,24.1+i*.16,E.o);
  const [cx,cy,al]=CHIPPOS[i];const ex=540+Math.cos(a)*478, ey=1120+Math.sin(a)*478;
  lines+=`<line x1="${ex}" y1="${ey}" x2="${lerp(ex,cx,k)}" y2="${lerp(ey,cy,k)}" stroke="rgba(255,255,255,.55)" stroke-width="2"/><circle cx="${ex}" cy="${ey}" r="${7*k}" fill="#e0262e"/>`;
  const tr=al==='l'?'translate(0,-50%)':al==='r'?'translate(-100%,-50%)':'translate(-50%,-50%)';
  ch+=`<div class="chip glass" style="left:${cx}px;top:${cy}px;transform:${tr} scale(${.85+.15*k});opacity:${k}"><b>${n}</b><i>± ${km} km</i></div>`;});
 $('mlead').innerHTML=lines;
 $('chips').innerHTML=ch;}

/* ---------- S7 CTA ---------- */
function S7(t){const s=$('s7');if(vis(s,t,25.4,31,.55,.1)<=0)return;
 $('c7').style.transform=`scale(${lerp(1.08,1.0,P(t,25.4,30,E.o))})`;$('c7').style.transformOrigin='540px 400px';
 const k=P(t,27.3,28.3,E.o);const lg=$('logoEnd');lg.style.opacity=k;lg.style.transform=`translateY(${(1-k)*40}px) scale(${.92+.08*k})`;lg.style.filter=`blur(${(1-k)*8}px) drop-shadow(0 10px 30px rgba(0,0,0,.6))`;}

function tick(t){S1(t);S2(t);S3(t);S4(t);S5(t);S6(t);S7(t);reveals(t);
 const w=Math.min(P(t,3.1,3.6),1-P(t,25.0,25.5));$('wm').style.opacity=.92*w;
 $('grain').style.transform=`translate(${(Math.sin(t*91)*40)|0}px,${(Math.cos(t*67)*40)|0}px)`;}
window.seek=t=>tick(t);
Promise.all([document.fonts.ready,...[...document.images].map(i=>i.decode().catch(()=>0))]).then(()=>{fit();tick(0);window.__ready=true;});
if(!location.search.includes('record')){const t0=performance.now();(function loop(){tick(((performance.now()-t0)/1000)%30);requestAnimationFrame(loop)})();}
</script></body></html>'''
html = html.replace('class="ln big"><span data-r="1.9" style="font-size:250px">', 'class="ln big"><span data-r="1.9" style="font-size:250px">')
open('wilgehof.html', 'w').write(html)
print(len(html) // 1024, 'KB')
