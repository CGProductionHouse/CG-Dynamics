/* eslint-disable react-refresh/only-export-components -- Standalone offline test bundle; no Vite HMR or production imports. */
import React, {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {MemoryRouter,useNavigate,useLocation} from 'react-router-dom'
import NolanOverview from '../../../src/pages/admin/NolanOverview'
import {ADMIN,REVIEWER,TASK,setActor,setMode,setLostReceipt,changeRevision} from './adapters'
declare const __NOLAN_REVIEW_PROVENANCE__: string
function Review(){
 const navigate=useNavigate(), location=useLocation()
 const [notice,setNotice]=useState('')
 const refresh=()=>window.dispatchEvent(new Event('focus'))
 return <><section className="review-banner">
 <strong>Interactive review preview · sample data · not connected to live Dynamics</strong>
 <p>PR #990 candidate {__NOLAN_REVIEW_PROVENANCE__} · actual Nolan components and CSS. All records, identities, receipts and mutations here are fictional and held in memory. Production activation remains off. This is not signed-in, backend or device acceptance.</p>
 <div className="review-controls"><label>Sample account <select onChange={e=>{setActor(e.target.value);refresh()}}><option value={ADMIN}>Sample Administrator</option><option value={REVIEWER}>Sample Reviewer</option></select></label>
 <label>Sample source <select onChange={e=>{setMode(e.target.value);refresh()}}><option value="healthy">Available</option><option value="unavailable">Unavailable — retain last-known rows</option><option value="empty">Empty result</option></select></label>
 <button onClick={()=>navigate(-1)}>Back in preview</button><button onClick={()=>navigate(1)}>Forward</button>
 <button onClick={()=>{changeRevision();refresh();setNotice('Sample source revision changed. In Needs You, click Refresh requests.')}}>Change sample source revision</button>
 <label><input type="checkbox" onChange={e=>setLostReceipt(e.target.checked)}/>Lose next creation receipt (retry demo)</label></div>
 <details><summary>How to review</summary><ol><li>Navigate lanes, search “storyboard”, filter statuses, and open Details &amp; source.</li><li>Open Client packages &amp; schedule, then Package evidence &amp; reconciliation gaps.</li><li>Change Sample source to Unavailable after rows load, then restore Available. Clear filters to see all rows.</li><li>In Needs You, respond to the current question; the stale question is blocked. As Administrator, paste <code>{TASK}</code> to create a question for Sample Reviewer, then switch accounts and refresh requests.</li><li>Enable “Lose next creation receipt”, create once, then retry the frozen draft: one sample request is retained. Reload the file to reset everything. Resize your browser for narrow-width review.</li></ol><p>Source destinations and external links are intentionally unavailable offline. Existing component wording about Dynamics describes the intended product, not a live connection. Website reports and app-repository inventory are not populated.</p></details>
 {notice&&<p role="status">{notice}</p>}</section>
 <div onClickCapture={e=>{const anchor=(e.target as HTMLElement).closest('a');if(anchor){e.preventDefault();e.stopPropagation();setNotice('Source destination is outside this offline review. No navigation or network request was made.')}}}>
 {location.pathname==='/admin/work'?<NolanOverview/>:<><p>Source workspace is outside this sample review.</p><button onClick={()=>navigate('/admin/work')}>Return to workbook</button></>}
 </div></>
}
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/admin/work?nolan_view=work']}><Review/></MemoryRouter>)
