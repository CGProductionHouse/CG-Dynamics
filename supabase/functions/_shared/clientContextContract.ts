// Deno edge copy of src/lib/clientContextContract.ts — keep in sync (drift-guarded by tests).
//
// Canonical client-intelligence task-type contract (#241/#248/#294), OWNED by the
// client-intelligence runtime. `get-client-context` is the canonical implementation.
// Any other consumer (e.g. the private Dynamics MCP, #311) should import THIS contract
// rather than redefining task types, so there is exactly one canonical taxonomy.

export const CLIENT_CONTEXT_TASK_TYPES = [
  'caption',
  'content_idea',
  'poster_copy',
  'image_edit',
  'factual_lookup',
  'campaign',
  'seo_hashtags',
] as const

export type ClientContextTaskType = typeof CLIENT_CONTEXT_TASK_TYPES[number]
