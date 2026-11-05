#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`)
  return value.trim()
}

function requiredIndex(value, label) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`)
  return value
}

export function validatePolicy(policy) {
  if (policy?.schemaVersion !== 1) throw new Error('Canva lane policy schemaVersion 1 is required')
  requiredString(policy.masterDesignId, 'masterDesignId')
  for (const key of ['inProgressTemplates', 'drafts', 'postedScheduled']) {
    requiredString(policy.headers?.[key]?.pageId, `headers.${key}.pageId`)
  }
  if (policy.masterRules?.contentEditsAllowed !== false
    || policy.masterRules?.moveExistingPagesAllowed !== false
    || policy.masterRules?.deleteExistingPagesAllowed !== false) {
    throw new Error('Master content edits, existing-page moves and deletion must remain disabled')
  }
  if (policy.masterRules?.freshBoundaryReadRequired !== true
    || policy.masterRules?.explicitApprovalRequiredPerMerge !== true) {
    throw new Error('Fresh boundary reads and per-merge approval are mandatory')
  }
  return policy
}

export function resolveBoundaries(policy, snapshot) {
  validatePolicy(policy)
  if (requiredString(snapshot?.designId, 'snapshot.designId') !== policy.masterDesignId) {
    throw new Error('Snapshot does not belong to the protected master Canva design')
  }
  if (!Array.isArray(snapshot.pages) || !snapshot.pages.length) throw new Error('snapshot.pages[] is required')
  const byId = new Map(snapshot.pages.map((page) => [requiredString(page.id, 'page.id'), requiredIndex(page.index, 'page.index')]))
  const inProgressHeader = byId.get(policy.headers.inProgressTemplates.pageId)
  const draftsHeader = byId.get(policy.headers.drafts.pageId)
  const postedScheduledHeader = byId.get(policy.headers.postedScheduled.pageId)
  if (!inProgressHeader || !draftsHeader || !postedScheduledHeader) {
    throw new Error('Canva workflow boundary drift: one or more protected header page IDs are missing')
  }
  if (!(inProgressHeader < draftsHeader && draftsHeader < postedScheduledHeader)) {
    throw new Error('Canva workflow boundary order is unsafe')
  }
  if (postedScheduledHeader !== draftsHeader + 1) {
    throw new Error('Drafts and Posted / Scheduled headers are no longer adjacent; human review is required')
  }
  return {
    inProgressHeader,
    writableStart: inProgressHeader + 1,
    writableEnd: draftsHeader - 1,
    draftsHeader,
    postedScheduledHeader,
    protectedStart: draftsHeader,
  }
}

export function classifyMasterPage(policy, snapshot, pageIndex) {
  const index = requiredIndex(pageIndex, 'pageIndex')
  const boundaries = resolveBoundaries(policy, snapshot)
  if (index === boundaries.inProgressHeader) return 'workflow-header-read-only'
  if (index >= boundaries.writableStart && index <= boundaries.writableEnd) return 'existing-working-page-read-only'
  if (index >= boundaries.protectedStart) return 'protected-drafts-posted-scheduled'
  return 'unresolved-master-zone-read-only'
}

export function assertMasterContentEditForbidden(policy, snapshot, pageIndex) {
  const classification = classifyMasterPage(policy, snapshot, pageIndex)
  throw new Error(`Direct master content edits are forbidden (${classification}); copy to a separate working design first`)
}

export function planApprovedInsert(policy, snapshot, request) {
  const boundaries = resolveBoundaries(policy, snapshot)
  const sourceDesignId = requiredString(request?.sourceDesignId, 'request.sourceDesignId')
  if (sourceDesignId === policy.masterDesignId) throw new Error('Source must be a separate working design, never the protected master')
  if (!Array.isArray(request.pageNumbers) || !request.pageNumbers.length) throw new Error('request.pageNumbers[] is required')
  const pageNumbers = [...new Set(request.pageNumbers.map((page) => requiredIndex(page, 'request.pageNumbers[]')))]
  const approval = request.approval
  if (approval?.approved !== true
    || requiredString(approval.approvedBy, 'approval.approvedBy').length < 1
    || requiredString(approval.approvedAt, 'approval.approvedAt').length < 1
    || approval.operation !== 'insert-new-pages-before-drafts') {
    throw new Error('Exact per-merge approval for insert-new-pages-before-drafts is required')
  }
  return {
    policyVersion: policy.schemaVersion,
    masterDesignId: policy.masterDesignId,
    boundaryReceipt: {
      inProgressHeaderPageId: policy.headers.inProgressTemplates.pageId,
      draftsHeaderPageId: policy.headers.drafts.pageId,
      draftsHeaderIndex: boundaries.draftsHeader,
      postedScheduledHeaderPageId: policy.headers.postedScheduled.pageId,
      observedPageCount: snapshot.pages.length,
    },
    mergeDesignsArgs: {
      type: 'modify_existing_design',
      design_id: policy.masterDesignId,
      operations: [{
        type: 'insert_pages',
        after_page_number: boundaries.writableEnd,
        source: { type: 'design', design_id: sourceDesignId, page_numbers: pageNumbers },
      }],
    },
    forbiddenOperations: ['replace_text_on_master', 'update_fill_on_master', 'move_pages', 'delete_pages'],
    approval,
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'))
}

function main() {
  const [command, policyPath, snapshotPath, requestPath] = process.argv.slice(2)
  if (!command || !policyPath || !snapshotPath) {
    console.error('Usage: node canva-lane-guard.mjs audit <policy.json> <snapshot.json>')
    console.error('       node canva-lane-guard.mjs plan-insert <policy.json> <snapshot.json> <request.json>')
    process.exitCode = 2
    return
  }
  const policy = readJson(policyPath)
  const snapshot = readJson(snapshotPath)
  const result = command === 'audit'
    ? resolveBoundaries(policy, snapshot)
    : command === 'plan-insert' && requestPath
      ? planApprovedInsert(policy, snapshot, readJson(requestPath))
      : null
  if (!result) throw new Error(`Unsupported command: ${command}`)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
