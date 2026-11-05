#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const REQUIRED_BRIEF_FIELDS = [
  'provisionalId', 'brandScope', 'businessObjective', 'buyingSituation', 'audience',
  'audienceTension', 'proposition', 'proof', 'emotion', 'nextAction', 'januaryRelevance',
  'headlineCandidates', 'mechanism', 'sourceRequirement', 'sourceStatus', 'avoid',
  'whyItExists', 'qaState',
]

function present(value) {
  return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && String(value).trim() !== ''
}

function words(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2)
}

function jaccard(left, right) {
  const a = new Set(left)
  const b = new Set(right)
  let intersection = 0
  for (const word of a) if (b.has(word)) intersection += 1
  return a.size && b.size ? intersection / (a.size + b.size - intersection) : 0
}

export function validateMonthPlan(plan, brandPack) {
  const errors = []
  const warnings = []
  if (plan.schemaVersion !== 1) errors.push('plan.schemaVersion must be 1')
  if (!/^\d{4}-\d{2}-01$/.test(plan.month ?? '')) errors.push('plan.month must be YYYY-MM-01')
  if (!Array.isArray(plan.briefs) || !plan.briefs.length) errors.push('plan.briefs must not be empty')
  if (plan.briefs?.length > (plan.packageBaseline?.designPosters ?? 0)) errors.push('brief count exceeds verified package baseline')
  const scopeMap = new Map((brandPack.scopes ?? []).map((scope) => [scope.key, scope]))
  const brandKitIds = new Set()
  for (const scope of brandPack.scopes ?? []) {
    if (!present(scope.key)) errors.push('brand scope key is required')
    if (!present(scope.canvaBrandKitId)) errors.push(`${scope.key}: Canva Brand Kit ID is required`)
    if (brandKitIds.has(scope.canvaBrandKitId)) errors.push(`${scope.key}: duplicate Canva Brand Kit ID`)
    brandKitIds.add(scope.canvaBrandKitId)
    if (!Array.isArray(scope.fonts) || scope.fonts.length === 0) errors.push(`${scope.key}: exact Brand Kit font labels are required`)
    if (!Array.isArray(scope.colours) || scope.colours.length === 0) errors.push(`${scope.key}: exact Brand Kit colours are required`)
    for (const colour of scope.colours ?? []) {
      if (!/^#[A-F0-9]{6}$/i.test(colour)) errors.push(`${scope.key}: invalid colour token ${colour}`)
    }
    if (scope.productionBlocked === false && scope.fontStatus !== 'local-render-verified') {
      errors.push(`${scope.key}: production cannot clear until local font rendering is verified`)
    }
    if (scope.productionBlocked === false && !String(scope.exactLogoStatus ?? '').includes('verified')) {
      errors.push(`${scope.key}: production cannot clear without an exact verified logo`)
    }
  }
  const ids = new Set()
  const mechanisms = new Set()
  const headlines = []
  const windows = plan.creativeWindows ?? []
  if (plan.productionLane && windows.length !== (plan.briefs?.length ?? 0)) errors.push('execution requires one proposed creative window per brief')
  const windowIds = new Set()
  for (const window of windows) {
    if (windowIds.has(window.provisionalId)) errors.push(`${window.provisionalId}: duplicate creative window`)
    windowIds.add(window.provisionalId)
    if (!plan.briefs?.some((brief) => brief.provisionalId === window.provisionalId)) errors.push(`${window.provisionalId}: creative window has no brief`)
    for (const field of ['start', 'end']) {
      const value = window[field]
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '') || !Number.isFinite(Date.parse(value))
        || new Date(value).toISOString().slice(0, 10) !== value || value.slice(0, 7) !== plan.month?.slice(0, 7)) {
        errors.push(`${window.provisionalId}: ${field} must be a real date within the planned month`)
      }
    }
    if (window.start > window.end) errors.push(`${window.provisionalId}: creative window ends before it starts`)
    if (!present(window.occasion) || !present(window.evidenceType)) errors.push(`${window.provisionalId}: occasion and evidenceType are required`)
    if (window.scheduled_date || window.monthlyDeliverableId) errors.push(`${window.provisionalId}: a creative window cannot create a schedule assignment`)
  }

  for (const [index, brief] of (plan.briefs ?? []).entries()) {
    const label = brief.provisionalId || `brief[${index}]`
    for (const field of REQUIRED_BRIEF_FIELDS) if (!present(brief[field])) errors.push(`${label}: missing ${field}`)
    if (ids.has(brief.provisionalId)) errors.push(`${label}: duplicate provisionalId`)
    ids.add(brief.provisionalId)
    const scope = scopeMap.get(brief.brandScope)
    if (!scope) errors.push(`${label}: unknown brandScope ${brief.brandScope}`)
    if (scope?.productionBlocked && !String(brief.qaState).startsWith('blocked')) errors.push(`${label}: cannot pass QA while brand pack is blocked`)
    const mechanism = String(brief.mechanism ?? '').toLowerCase()
    if (mechanisms.has(mechanism)) errors.push(`${label}: duplicate creative mechanism`)
    mechanisms.add(mechanism)
    if (plan.status === 'proposal-unmatched-to-schedule' && brief.monthlyDeliverableId) {
      errors.push(`${label}: proposal must not invent monthlyDeliverableId`)
    }
    for (const headline of brief.headlineCandidates ?? []) {
      for (const prior of headlines) {
        const similarity = jaccard(words(headline), words(prior.headline))
        if (similarity >= 0.72) warnings.push(`${label}: headline resembles ${prior.id} (${similarity.toFixed(2)})`)
      }
      headlines.push({ id: label, headline })
    }
  }

  const countsByScope = Object.fromEntries([...scopeMap.keys()].map((key) => [key, plan.briefs?.filter((brief) => brief.brandScope === key).length ?? 0]))
  if (Object.values(countsByScope).some((count) => count === 0)) warnings.push('At least one verified brand scope has no proposed poster')
  return {
    valid: errors.length === 0,
    status: plan.status,
    briefCount: plan.briefs?.length ?? 0,
    countsByScope,
    uniqueMechanismCount: mechanisms.size,
    errors,
    warnings,
  }
}

function main() {
  const [planPath, brandPackPath] = process.argv.slice(2)
  if (!planPath || !brandPackPath) {
    console.error('Usage: node month-plan.mjs <month-plan.json> <brand-pack-index.json>')
    process.exitCode = 2
    return
  }
  const report = validateMonthPlan(
    JSON.parse(readFileSync(resolve(planPath), 'utf8')),
    JSON.parse(readFileSync(resolve(brandPackPath), 'utf8')),
  )
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  if (!report.valid) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
