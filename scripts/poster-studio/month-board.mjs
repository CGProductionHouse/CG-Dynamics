#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function list(values) {
  return (values ?? []).map((value) => `<li>${escapeHtml(value)}</li>`).join('')
}

export function renderMonthBoard(plan) {
  const clientName = plan.clientName ?? 'Piek Group'
  const strategySummary = plan.strategySummary ?? plan.portfolioRule ?? ''
  const cards = plan.briefs.map((brief, index) => `
    <article class="card scope-${escapeHtml(brief.brandScope.toLowerCase())}" data-brief-id="${escapeHtml(brief.provisionalId)}">
      <div class="eyebrow"><span>${String(index + 1).padStart(2, '0')}</span><span>${escapeHtml(brief.brandScope)}</span></div>
      <h2>${escapeHtml(brief.headlineCandidates[0])}</h2>
      <p class="reason">${escapeHtml(brief.whyItExists)}</p>
      <dl>
        <div><dt>Objective</dt><dd>${escapeHtml(brief.businessObjective)}</dd></div>
        <div><dt>Audience tension</dt><dd>${escapeHtml(brief.audienceTension)}</dd></div>
        <div><dt>Proposition</dt><dd>${escapeHtml(brief.proposition)}</dd></div>
        <div><dt>Distinct mechanism</dt><dd>${escapeHtml(brief.mechanism)}</dd></div>
        <div><dt>January proof</dt><dd>${escapeHtml(brief.januaryRelevance)}</dd></div>
        <div><dt>Source need</dt><dd>${escapeHtml(brief.sourceRequirement)}</dd></div>
      </dl>
      <details><summary>Headline routes</summary><ul>${list(brief.headlineCandidates)}</ul></details>
      <div class="gate"><strong>${escapeHtml(brief.qaState)}</strong><span>${escapeHtml(brief.sourceStatus)}</span></div>
    </article>`).join('')

  const counts = Object.entries(plan.briefs.reduce((result, brief) => {
    result[brief.brandScope] = (result[brief.brandScope] ?? 0) + 1
    return result
  }, {})).map(([scope, count]) => `<span>${escapeHtml(scope)} ${count}</span>`).join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(clientName)} — ${escapeHtml(plan.month)} creative grid</title>
  <style>
    :root { color-scheme:dark; --ink:#f3efe3; --muted:#aaa99f; --line:#34363b; --panel:#181a1f; --bg:#0e1013; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.45 Inter,Arial,sans-serif; }
    header { padding:48px clamp(20px,5vw,72px) 32px; border-bottom:1px solid var(--line); }
    h1 { max-width:900px; margin:0 0 12px; font-size:clamp(32px,5vw,72px); line-height:.96; letter-spacing:-.045em; }
    header p { max-width:820px; color:var(--muted); }
    .meta { display:flex; gap:8px; flex-wrap:wrap; margin-top:22px; }
    .meta span { padding:6px 10px; border:1px solid var(--line); border-radius:999px; font-size:12px; }
    main { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:1px; background:var(--line); border-bottom:1px solid var(--line); }
    .card { min-height:640px; padding:28px; background:var(--panel); border-top:6px solid #8c8d92; }
    .scope-piek_group { border-color:#d8c49a; }
    .scope-engen { border-color:#1672c4; }
    .scope-sasol { border-color:#4cc7e8; }
    .scope-get_together { border-color:#de8e67; }
    .eyebrow { display:flex; justify-content:space-between; color:var(--muted); font-size:11px; letter-spacing:.12em; }
    h2 { margin:42px 0 14px; font-size:clamp(28px,3vw,44px); line-height:1; letter-spacing:-.035em; }
    .reason { min-height:72px; color:#d9d8d2; }
    dl { margin:28px 0; }
    dl div { padding:10px 0; border-top:1px solid var(--line); }
    dt { color:var(--muted); font-size:11px; text-transform:uppercase; letter-spacing:.08em; }
    dd { margin:4px 0 0; }
    details { color:var(--muted); }
    details ul { padding-left:18px; color:var(--ink); }
    .gate { display:grid; gap:4px; margin-top:24px; padding:12px; background:#271a1a; color:#f1b6ae; font-size:12px; }
    footer { padding:28px clamp(20px,5vw,72px); color:var(--muted); }
    @media (max-width:1000px) { main { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:680px) { main { grid-template-columns:1fr; } .card { min-height:0; } }
    @media print { body,header,.card,footer { background:white; color:black; } main { grid-template-columns:repeat(3,1fr); } .card { break-inside:avoid; min-height:0; } }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(clientName)}<br>${escapeHtml(plan.month)} creative grid</h1>
    <p>${escapeHtml(strategySummary)}</p>
    <div class="meta"><span>${plan.briefs.length} proposed posters</span>${counts}<span>${escapeHtml(plan.status)}</span></div>
  </header>
  <main>${cards}</main>
  <footer>Planning evidence only. Exact brand, source, factual and schedule gates must clear before artwork or publication.</footer>
</body>
</html>`
}

function main() {
  const [planPath, outPath] = process.argv.slice(2)
  if (!planPath || !outPath) {
    console.error('Usage: node month-board.mjs <month-plan.json> <output.html>')
    process.exitCode = 2
    return
  }
  const plan = JSON.parse(readFileSync(resolve(planPath), 'utf8'))
  const output = resolve(outPath)
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, renderMonthBoard(plan))
  process.stdout.write(`${output}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
