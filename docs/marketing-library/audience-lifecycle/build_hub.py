"""Build a self-contained reading/brief-exploration view. No network or app writes."""
import html, json, re, subprocess
from pathlib import Path
ROOT = Path(__file__).resolve().parent

def inline(s):
    s = html.escape(s)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'(https?://[^\s<>]+)', r'<a href="\1" target="_blank" rel="noopener noreferrer">\1</a>', s)
    return s

def md(text):
    """Small renderer for this controlled Markdown subset; raw HTML is escaped."""
    lines=text.splitlines(); out=[]; i=0
    while i<len(lines):
        s=lines[i].strip()
        if not s: i+=1; continue
        if s.startswith('```'):
            block=[]; i+=1
            while i<len(lines) and not lines[i].strip().startswith('```'):
                block.append(lines[i]); i+=1
            out.append('<pre><code>'+html.escape('\n'.join(block))+'</code></pre>'); i+=1; continue
        h=re.match(r'^(#{1,6}) (.+)$',s)
        if h:
            level=min(len(h[1])+1,6)
            out.append(f'<h{level}>'+inline(h[2])+f'</h{level}>'); i+=1; continue
        if s.startswith('|'):
            rows=[]
            while i<len(lines) and lines[i].strip().startswith('|'):
                row=lines[i].strip(); i+=1
                if re.fullmatch(r'[|\s:\-]+', row): continue
                rows.append([c.strip() for c in row.strip('|').split('|')])
            out.append('<div class="tablewrap"><table>')
            for j,row in enumerate(rows):
                tag='th' if j==0 else 'td'; out.append('<tr>'+''.join(f'<{tag}>'+inline(c)+f'</{tag}>' for c in row)+'</tr>')
            out.append('</table></div>'); continue
        if s.startswith('> '):
            block=[]
            while i<len(lines) and lines[i].strip().startswith('>'):
                block.append(inline(lines[i].strip().lstrip('> '))); i+=1
            out.append('<blockquote>'+'<br>'.join(block)+'</blockquote>'); continue
        if s.startswith('- '):
            block=[]
            while i<len(lines) and lines[i].strip().startswith('- '):
                block.append('<li>'+inline(lines[i].strip()[2:])+'</li>'); i+=1
            out.append('<ul>'+''.join(block)+'</ul>'); continue
        block=[s]; i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r'^(#|\||>|```|- )',lines[i].strip()):
            block.append(lines[i].strip()); i+=1
        out.append('<p>'+inline(' '.join(block))+'</p>')
    return '\n'.join(out)

pack=json.loads((ROOT/'sources.json').read_text())
run=subprocess.run(['node','--test',str(ROOT/'reference.test.mjs')],capture_output=True,text=True,check=False)
(ROOT/'test-results.txt').write_text(run.stdout+run.stderr)
if run.returncode: raise SystemExit('Reference tests failed; refusing to build a passing-status hub. See test-results.txt.')
passed=int(re.search(r'^# pass (\d+)',run.stdout,re.M)[1])
sections=re.split(r'^## ',(ROOT/'README.md').read_text(),flags=re.M)[1:]
assert len(sections)==10, 'Master document structure changed; update view mapping.'
nav=[('start','Start here'),('audience','Audience lab'),('creative','Creative production'),('platforms','Platform playbooks'),('industries','Industry scenarios'),('monthly','Monthly client plan'),('learning','Learning & economics'),('implementation','Implementation'),('evidence','Sources & review')]
views={
 'start':md('## '+sections[0]+'\n## '+sections[1]),
 'audience':md('## '+sections[2]),
 'creative':md('## '+sections[3]),
 'platforms':md('## '+sections[4]),
 'industries':md('## '+sections[5]),
 'monthly':md('## '+sections[8]),
 'learning':md('## '+sections[6]+'\n## '+sections[7]),
 'implementation':md((ROOT/'IMPLEMENTATION.md').read_text()),
 'evidence':md('## '+sections[9])}
source_cards=[]
for s in pack['sources']:
    state='Full page read' if s['sourceAccess']=='full_read' else 'Verification blocked'
    source_cards.append('<article class="source" data-publisher="'+html.escape(s['publisher'])+'" data-access="'+s['sourceAccess']+'"><div class="eyebrow">'+s['key']+' · '+s['publisher']+'</div><h3>'+html.escape(s['title'])+'</h3><span class="tag '+('ok' if s['sourceAccess']=='full_read' else 'warn')+'">'+state+'</span><span class="tag">Needs review</span><p>'+html.escape(s['finding'] or 'No product claim taken from this page.')+'</p><p class="muted">'+html.escape(s['limitation'])+'</p><p class="tiny">Page date: '+html.escape(s['pageDate'] or 'Not stated')+' · Access: '+s['accessedAt']+'</p><a href="'+html.escape(s['canonicalUrl'],quote=True)+'" target="_blank" rel="noopener noreferrer">Open official source ↗</a></article>')
views['evidence']='<div class="filters"><label>Filter sources <input id="sourceSearch" placeholder="Search topic or publisher"></label><label>Access <select id="sourceAccess"><option value="all">All references</option><option value="full_read">Fully read</option><option value="blocked">Blocked verification</option></select></label></div><div class="sourcegrid">'+''.join(source_cards)+'</div>'+views['evidence']
candidate_rows = ''.join('<tr><td>'+html.escape(c['title'])+'</td><td>'+html.escape(c['principle'])+'<br><span class="muted">'+html.escape(c['limitation'])+'</span></td><td>'+html.escape(', '.join(c['sourceKeys']) or 'CG proposal; research required')+'</td><td>Needs review<br>'+html.escape(c['evidenceLabel'])+'</td></tr>' for c in pack['candidates'])
views['evidence'] += '<h3>Proposed knowledge cards</h3><p>Preparation records only. None is an activated production Library card.</p><div class="tablewrap"><table><tr><th>Card</th><th>Proposed guidance and limitation</th><th>Sources</th><th>Status / evidence</th></tr>'+candidate_rows+'</table></div>'
lab='''<div class="lab"><div class="eyebrow">BRIEF EXPLORER · HYPOTHETICAL SCENARIOS</div><h2>Change the audience. Change the creative decision.</h2><p>These are starting points for staff review, not approved client briefs or evidence of performance.</p><div class="filters"><label>Industry<select id="industry"></select></label><label>Relationship<select id="stage"><option value="cold">Cold / unfamiliar</option><option value="warm" selected>Warm / considering</option><option value="customer">Customer / return</option></select></label></div><div id="briefPreview"></div><button id="copyBrief" class="primary">Copy this reference brief</button><span id="copyStatus" role="status"></span></div>'''
views['audience']=lab+views['audience']
count_read=sum(s['sourceAccess']=='full_read' for s in pack['sources'])
hero=f'''<header class="hero"><div class="eyebrow">CG MARKETING INTELLIGENCE / 19 SEPTEMBER 2026</div><h1>A clear reason behind<br>every creative decision.</h1><p class="lead">Audience understanding, production briefs and commercial learning, connected to the existing CG Dynamics architecture.</p><div class="notice">Research and tested reference implementation. <strong>Not live in Dynamics.</strong> No campaign creation, spend, production changes or client data.</div><div class="stats"><div><b>{count_read}</b><span>Official references read</span></div><div><b>{passed}</b><span>Reference tests passed</span></div><div><b>{len(pack['scenarios'])}</b><span>Industry scenarios</span></div><div><b>{len(pack['candidates'])}</b><span>Review candidates</span></div></div></header>'''
body=''.join('<section id="'+key+'" class="view"'+(' hidden' if key!='start' else '')+'><div class="sectiontitle"><span class="eyebrow">'+str(i+1).zfill(2)+' / RESEARCH WORKSPACE</span><h2>'+label+'</h2></div>'+views[key]+'</section>' for i,(key,label) in enumerate(nav))
css='''*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#0b1117;color:#e7edf1;font:15px/1.65 system-ui,-apple-system,Segoe UI,sans-serif}a{color:#66dfc3;overflow-wrap:anywhere}button,input,select{font:inherit}button{cursor:pointer}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #83efd7;outline-offset:3px}.sidebar{position:fixed;inset:0 auto 0 0;width:240px;background:#101921;border-right:1px solid #253440;padding:32px 22px;display:flex;flex-direction:column}.logo{font-size:30px;font-weight:850;letter-spacing:-2px}.logo span{font-size:13px;letter-spacing:1px;font-weight:600;display:block;color:#89a0ac}.nav{display:grid;gap:5px;margin-top:35px}.nav button{border:0;background:none;text-align:left;color:#a8b8c4;padding:12px 14px;border-radius:8px;font-size:13px}.nav button[aria-current=true]{background:#183b36;color:#85f4d7;font-weight:750}.sidebar small{color:#879ca7;margin-top:auto;font-size:11px}.pill{border:1px solid #526343;color:#d8e8b6;padding:6px 9px;font-size:10px;font-weight:700;letter-spacing:1px;display:inline-block;margin:20px 0 0;border-radius:5px}.main{max-width:1440px;margin-left:240px;padding:45px 56px 65px}.hero{padding:16px 0 42px;border-bottom:1px solid #263641}.eyebrow{font-size:10px;font-weight:800;letter-spacing:1.7px;color:#75d9c3}.hero h1{font-size:clamp(36px,4.5vw,65px);letter-spacing:-2.5px;line-height:1.09;margin:21px 0}.lead{font-size:18px;line-height:1.65;color:#aabcC8;max-width:770px}.notice{padding:15px 19px;background:#19262f;border-left:3px solid #64cbb3;color:#b9cad3;font-size:12px;margin:25px 0}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:30px}.stats b{display:block;font-size:32px;line-height:1.1;color:#f1f7f6}.stats span{color:#8fa4b2;font-size:11px}.view{padding-top:35px;max-width:1120px}.view[hidden]{display:none}.sectiontitle{margin-bottom:26px}.sectiontitle>h2{font-size:28px;margin:3px 0;letter-spacing:-.8px}.view h3{font-size:23px;margin-top:36px;letter-spacing:-.4px;line-height:1.35}.view h4{font-size:17px;margin-top:28px;color:#d6e8e8}.view p,.view li{color:#b9c8d1}.view strong{color:#f0f6f7}.view li{margin-bottom:9px}.view code{font-size:12px;background:#1b2a34;color:#b9e7dd;border-radius:4px;padding:2px 5px;overflow-wrap:anywhere}.view pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:20px;background:#101c25;border:1px solid #2d414e;border-radius:9px}.view pre code{padding:0;background:none}.view blockquote{border-left:3px solid #6cd6bd;margin:25px 0;padding:22px;background:#142c2a;color:#d5eeea}.tablewrap{overflow-x:auto;margin:25px 0;border:1px solid #2a3b48;border-radius:9px}table{width:100%;border-collapse:collapse;font-size:12px;min-width:640px}td,th{text-align:left;vertical-align:top;padding:14px 15px;border-bottom:1px solid #293b46}th{color:#bcebdd;background:#172c32;font-size:11px;font-weight:750}td{color:#b9c8d1;min-width:135px}.lab{border:1px solid #356557;background:linear-gradient(125deg,#173c35,#162733);padding:26px;border-radius:14px;margin-bottom:38px}.lab h2{font-size:26px;line-height:1.3;margin:12px 0;letter-spacing:-.8px}.filters{display:flex;flex-wrap:wrap;gap:16px;margin:20px 0}label{display:grid;gap:6px;font-size:11px;color:#93b2ba;min-width:200px;flex:1}input,select{max-width:100%;background:#0c1b22;border:1px solid #44605d;border-radius:7px;padding:10px;color:#eff9f6;width:100%}.briefgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}.briefcell{border:1px solid #36504f;border-radius:9px;padding:15px;background:#112923}.briefcell.wide{grid-column:1/-1}.briefcell h4{font-size:10px;color:#78d9c3;letter-spacing:1px;margin:0 0 6px;text-transform:uppercase}.briefcell p{font-size:13px;margin:0}.primary{border:0;border-radius:6px;padding:11px 16px;background:#72d9c0;color:#08271f;font-weight:750;font-size:12px}#copyStatus{font-size:11px;margin-left:12px;color:#b7dccf}.sourcegrid{display:grid;grid-template-columns:1fr 1fr;gap:17px;margin-bottom:40px}.source{background:#13202a;border:1px solid #293f4c;border-radius:10px;padding:22px;min-width:0}.source[hidden]{display:none}.source h3{font-size:17px;margin:8px 0 13px}.source p{font-size:12px}.source a{font-size:12px}.tag{display:inline-block;padding:3px 7px;background:#283442;color:#bfccd5;border-radius:4px;font-size:9px;margin:0 5px 4px 0}.tag.ok{background:#1b443a;color:#8fe3c7}.tag.warn{background:#4b3a21;color:#ecd199}.muted{color:#8fa5b2!important}.tiny{font-size:10px!important}.footer{margin-top:50px;border-top:1px solid #263742;padding-top:20px;font-size:11px;color:#7f99a8}@media(max-width:1000px){.main{padding:30px;margin-left:200px}.sidebar{width:200px;padding:25px 15px}.hero h1{font-size:44px}.stats{gap:10px}.sourcegrid{grid-template-columns:1fr}}@media(max-width:700px){.sidebar{position:static;width:auto;display:block;padding:20px;border-right:0;border-bottom:1px solid #2a3b46}.logo{font-size:24px}.logo span{display:inline;margin-left:15px;font-size:10px}.pill{position:absolute;top:20px;right:20px;margin:0;font-size:8px}.nav{display:flex;overflow-x:auto;margin-top:18px;gap:5px}.nav button{white-space:nowrap;font-size:11px;padding:9px 11px}.sidebar small{display:none}.main{margin:0;padding:23px 20px}.hero{padding-top:10px}.hero h1{font-size:37px;letter-spacing:-1.5px}.lead{font-size:15px}.stats{grid-template-columns:1fr 1fr;row-gap:22px}.stats b{font-size:28px}.briefgrid{grid-template-columns:1fr}.briefcell.wide{grid-column:auto}.lab{padding:19px}.lab h2{font-size:23px}.view h3{font-size:21px}.sourcegrid{grid-template-columns:1fr}}@media print{body{background:white;color:black}.sidebar,.hero,.filters,.primary,#copyStatus{display:none}.main{margin:0;padding:0}.view,.view[hidden]{display:block;max-width:none}.view p,.view li,.view strong,td,th{color:black}.view{break-before:page}.source{break-inside:avoid}.lab{background:white}.tablewrap{overflow:visible}table{min-width:0}}'''
js=r'''const scenarios=__DATA__;
const industry=document.getElementById('industry'),stage=document.getElementById('stage');
for(const item of scenarios){const o=document.createElement('option');o.value=item.key;o.textContent=item.name;industry.append(o)}
let briefText='';
function renderBrief(){const s=scenarios.find(x=>x.key===industry.value);const entries=[['Creative decision',s.angles[stage.value]],['What to capture',s.shots],['Destination',s.destination],['Success',s.outcome],['Evidence boundary',s.limit]];const preview=document.getElementById('briefPreview');preview.replaceChildren();const grid=document.createElement('div');grid.className='briefgrid';for(const [i,[key,value]] of entries.entries()){const cell=document.createElement('div');cell.className='briefcell'+(i===0||i===4?' wide':'');const h=document.createElement('h4');h.textContent=key;const p=document.createElement('p');p.textContent=value;cell.append(h,p);grid.append(cell)}preview.append(grid);briefText='CG reference brief / hypothetical / needs review\nIndustry: '+s.name+'\nRelationship: '+stage.value+'\nDelivery: organic mixed unless separately verified\n\n'+entries.map(([k,v])=>k+': '+v).join('\n\n');document.getElementById('copyStatus').textContent=''}
industry.addEventListener('change',renderBrief);stage.addEventListener('change',renderBrief);renderBrief();
document.getElementById('copyBrief').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(briefText);document.getElementById('copyStatus').textContent='Copied. Still a review-only reference.'}catch{const a=document.createElement('a'),url=URL.createObjectURL(new Blob([briefText],{type:'text/plain'}));a.href=url;a.download='CG_reference_brief.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);document.getElementById('copyStatus').textContent='Reference brief saved as text.'}});
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{for(const v of document.querySelectorAll('.view'))v.hidden=v.id!==b.dataset.view;for(const n of document.querySelectorAll('[data-view]'))n.setAttribute('aria-current',String(n===b));history.replaceState(null,'','#'+b.dataset.view);document.querySelector('.view:not([hidden])').scrollIntoView({block:'start',behavior:'smooth'})});
function filterSources(){const q=document.getElementById('sourceSearch').value.toLowerCase(),access=document.getElementById('sourceAccess').value;for(const card of document.querySelectorAll('.source'))card.hidden=!(card.textContent.toLowerCase().includes(q)&&(access==='all'||access==='full_read'&&card.dataset.access==='full_read'||access==='blocked'&&card.dataset.access!=='full_read'))}
document.getElementById('sourceSearch').addEventListener('input',filterSources);document.getElementById('sourceAccess').addEventListener('change',filterSources);
const initial=location.hash.slice(1);const target=[...document.querySelectorAll('[data-view]')].find(b=>b.dataset.view===initial);if(target)target.click();
'''.replace('__DATA__',json.dumps(pack['scenarios'],ensure_ascii=False).replace('<','\\u003c'))
nav_html=''.join('<button data-view="'+key+'" aria-current="'+str(key=='start').lower()+'">'+label+'</button>' for key,label in nav)
page='<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>CG Marketing Intelligence | Audience & Creative</title><style>'+css+'</style></head><body><aside class="sidebar"><div class="logo">CG<span>MARKETING INTELLIGENCE</span></div><div class="pill">REFERENCE · NOT LIVE</div><nav class="nav" aria-label="Research sections">'+nav_html+'</nav><small>Version 2026-09-19.1<br>Issue #426<br>One Library. No duplicate authority.<br>Generic scenarios only.</small></aside><main class="main">'+hero+body+'<footer class="footer">Generated from versioned research and reference files. No external scripts, fonts, trackers, APIs or client data. Sources remain review-gated.</footer></main><script>'+js+'</script></body></html>'
(ROOT/'CG_Marketing_Intelligence_Hub.html').write_text(page,encoding='utf-8')
print(f'Built hub: {len(page.encode())} bytes; {passed} reference tests passed; {count_read} full-read sources.')
