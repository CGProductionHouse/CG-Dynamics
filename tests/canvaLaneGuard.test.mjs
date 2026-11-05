import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertMasterContentEditAllowed,
  classifyMasterPage,
  planApprovedInsert,
  resolveBoundaries,
} from '../scripts/poster-studio/canva-lane-guard.mjs'

const policy = {
  schemaVersion: 1,
  masterDesignId: 'DAGcXGWhDhI',
  headers: {
    inProgressTemplates: { pageId: 'in-progress' },
    drafts: { pageId: 'drafts' },
    postedScheduled: { pageId: 'posted' },
  },
  masterRules: {
    contentEditsAllowed: true,
    contentEditScope: 'registered-new-work-pages-in-verified-working-lanes',
    moveExistingPagesAllowed: false,
    deleteExistingPagesAllowed: false,
    freshBoundaryReadRequired: true,
    explicitApprovalRequiredPerMerge: true,
  },
  workingRules: { editablePageIds: ['page-24'] },
}

function snapshot() {
  const pages = Array.from({ length: 352 }, (_, index) => ({ index: index + 1, id: `page-${index + 1}` }))
  pages[22].id = 'in-progress'
  pages[49].id = 'drafts'
  pages[50].id = 'posted'
  return { designId: 'DAGcXGWhDhI', pages }
}

test('permits registered new work inside the official file while protecting history', () => {
  const boundaries = resolveBoundaries(policy, snapshot())
  assert.deepEqual(boundaries, {
    inProgressHeader: 23,
    writableStart: 24,
    writableEnd: 49,
    draftsHeader: 50,
    postedScheduledHeader: 51,
    protectedStart: 50,
  })
  assert.equal(classifyMasterPage(policy, snapshot(), 24), 'in-progress-templates')
  assert.equal(classifyMasterPage(policy, snapshot(), 50), 'protected-drafts-posted-scheduled')
  assert.equal(assertMasterContentEditAllowed(policy, snapshot(), ['page-24']).allowed, true)
  assert.throws(() => assertMasterContentEditAllowed(policy, snapshot(), ['page-25']), /not registered/)
  assert.throws(() => assertMasterContentEditAllowed(policy, snapshot(), ['page-52']), /outside the verified working lane/)
  assert.throws(() => assertMasterContentEditAllowed(policy, snapshot(), ['drafts']), /outside the verified working lane/)
  const moved = snapshot()
  moved.pages.find((page) => page.id === 'page-24').index = 52
  assert.throws(() => assertMasterContentEditAllowed(policy, moved, ['page-24']), /outside the verified working lane/)
})

test('plans only an approved insert from a separate working design before Drafts', () => {
  const result = planApprovedInsert(policy, snapshot(), {
    sourceDesignId: 'DWORKING123',
    pageNumbers: [1, 2],
    approval: {
      approved: true,
      approvedBy: 'CA',
      approvedAt: '2026-11-05T12:00:00.000Z',
      operation: 'insert-new-pages-before-drafts',
    },
  })
  assert.equal(result.mergeDesignsArgs.operations[0].after_page_number, 49)
  assert.deepEqual(result.mergeDesignsArgs.operations[0].source.page_numbers, [1, 2])
  assert.ok(result.forbiddenOperations.includes('delete_pages'))
})

test('fails closed on missing approval, master-as-source or boundary drift', () => {
  assert.throws(() => planApprovedInsert(policy, snapshot(), {
    sourceDesignId: 'DWORKING123', pageNumbers: [1], approval: {},
  }), /per-merge approval/)
  assert.throws(() => planApprovedInsert(policy, snapshot(), {
    sourceDesignId: 'DAGcXGWhDhI',
    pageNumbers: [1],
    approval: { approved: true, approvedBy: 'CA', approvedAt: 'now', operation: 'insert-new-pages-before-drafts' },
  }), /separate working design/)
  const drifted = snapshot()
  drifted.pages[50].id = 'moved-posted'
  assert.throws(() => resolveBoundaries(policy, drifted), /boundary drift/)
})
