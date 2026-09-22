// A small in-memory stand-in for the Supabase client, so #450's autopilot pass can be
// EXECUTED in tests rather than only inspected. It implements the narrow slice the pass
// uses, and the RPCs mirror the rules their SQL enforces — including the refusals.
//
// It is deliberately strict: an unknown RPC throws rather than silently succeeding, so a
// test can never "pass" against behaviour the database would not allow.

const matches = (row, filters) => filters.every(filter => {
  const value = row[filter.column]
  switch (filter.op) {
    case 'eq': return value === filter.value
    case 'neq': return value !== filter.value
    case 'gte': return value != null && value >= filter.value
    case 'lte': return value != null && value <= filter.value
    case 'in': return filter.value.includes(value)
    case 'notNull': return value !== null && value !== undefined
    default: throw new Error(`Unsupported filter ${filter.op}`)
  }
})

class Query {
  constructor(db, table) {
    this.db = db
    this.table = table
    this.filters = []
    this.columns = null
    this.sort = null
    this.max = null
    this.rangeFrom = null
    this.rangeTo = null
    this.pendingUpdate = null
  }

  select(columns, options) {
    this.columns = columns
    if (options?.count === 'exact' && options?.head) this.isCountHead = true
    return this
  }
  eq(column, value) { this.filters.push({ column, op: 'eq', value }); return this }
  neq(column, value) { this.filters.push({ column, op: 'neq', value }); return this }
  gte(column, value) { this.filters.push({ column, op: 'gte', value }); return this }
  lte(column, value) { this.filters.push({ column, op: 'lte', value }); return this }
  in(column, values) { this.filters.push({ column, op: 'in', value: values }); return this }
  is(column, value) {
    if (value !== null) throw new Error('Only is(column, null) is supported')
    this.filters.push({ column, op: 'eq', value: null })
    return this
  }

  not(column, operator, value) {
    if (operator !== 'is' || value !== null) throw new Error('Only not(column, "is", null) is supported')
    this.filters.push({ column, op: 'notNull' })
    return this
  }

  order(column, options = { ascending: true }) { this.sort = { column, ascending: options.ascending !== false }; return this }
  limit(count) { this.max = count; return this }
  range(from, to) { this.rangeFrom = from; this.rangeTo = to; return this }

  update(patch) { this.pendingUpdate = patch; return this }

  async insert(row) {
    this.db.recordWrite(this.table, 'insert')
    const table = this.db.tables[this.table] ?? (this.db.tables[this.table] = [])
    table.push({ ...row })
    return { data: null, error: null }
  }

  rows() {
    if (this.db.unreadable.has(this.table)) return null
    const table = this.db.tables[this.table] ?? []
    let rows = table.filter(row => matches(row, this.filters))
    if (this.sort) {
      const { column, ascending } = this.sort
      rows = [...rows].sort((a, b) => {
        const left = a[column] ?? ''
        const right = b[column] ?? ''
        return (left < right ? -1 : left > right ? 1 : 0) * (ascending ? 1 : -1)
      })
    }
    if (this.rangeFrom != null && this.rangeTo != null) {
      rows = rows.slice(this.rangeFrom, this.rangeTo + 1)
    } else if (this.max != null) {
      rows = rows.slice(0, this.max)
    }
    return rows
  }

  settle() {
    if (this.pendingUpdate) {
      this.db.recordWrite(this.table, 'update')
      const rows = this.rows() ?? []
      for (const row of rows) Object.assign(row, this.pendingUpdate)
      return { data: rows.map(row => ({ ...row })), count: rows.length, error: null }
    }
    const rows = this.rows()
    if (rows === null) return { data: null, count: null, error: { message: `${this.table} is not readable`, code: '42P01' } }
    if (this.isCountHead) return { data: null, count: rows.length, error: null }
    return { data: rows.map(row => ({ ...row })), count: rows.length, error: null }
  }

  async maybeSingle() {
    const result = this.settle()
    if (result.error) return result
    return { data: result.data[0] ?? null, error: null }
  }

  then(resolve, reject) { return Promise.resolve(this.settle()).then(resolve, reject) }
}

export class FakeSupabase {
  constructor(tables = {}) {
    this.tables = tables
    this.unreadable = new Set()
    this.writes = []
    this.rpcCalls = []
    this.nextId = 1
  }

  recordWrite(table, kind) { this.writes.push({ table, kind }) }

  /** Mark a relation as not installed/readable, to prove UNKNOWN is not read as "none". */
  makeUnreadable(table) { this.unreadable.add(table) }

  id(prefix) { return `${prefix}-${this.nextId++}` }

  from(table) { return new Query(this, table) }

  async rpc(fn, args = {}) {
    this.rpcCalls.push({ fn, args })
    const handler = this[`rpc_${fn}`]
    if (!handler) throw new Error(`Unsupported RPC in fixture: ${fn}`)
    return handler.call(this, args)
  }

  // Mirrors ensure_content_run_for_calendar_event: exact identity, never a title match.
  rpc_ensure_content_run_for_calendar_event({ p_calendar_event_id }) {
    const event = (this.tables.company_calendar_events ?? []).find(row => row.id === p_calendar_event_id)
    if (!event) return { data: null, error: { message: 'Calendar event not found.' } }
    if (event.event_type !== 'content_run') return { data: null, error: { message: 'That calendar event is not a content run.' } }
    if (!event.client_id) return { data: null, error: { message: 'That content-run event has no exact client.' } }
    if (event.status === 'cancelled') return { data: null, error: { message: 'That content-run event is cancelled.' } }
    const runs = this.tables.content_runs ?? (this.tables.content_runs = [])
    const existing = runs.find(run => run.calendar_event_id === event.id)
    if (existing) return { data: [{ content_run_id: existing.id, created: false, client_id: event.client_id }], error: null }
    const run = {
      id: this.id('run'),
      calendar_event_id: event.id,
      client_id: event.client_id,
      client_name: event.client_name ?? null,
      name: event.title,
      run_date: event.start_at.slice(0, 10),
      status: event.status === 'confirmed' ? 'ready' : 'planning',
    }
    runs.push(run)
    this.recordWrite('content_runs', 'insert')
    return { data: [{ content_run_id: run.id, created: true, client_id: event.client_id }], error: null }
  }

  rpc_get_or_create_content_guideline({ p_run_id, p_content_run_id }) {
    return this.createGuideline(p_run_id ?? p_content_run_id)
  }

  rpc_get_or_create_content_guideline_as_actor({ p_run_id }) {
    return this.createGuideline(p_run_id)
  }

  createGuideline(p_content_run_id) {
    const guidelines = this.tables.content_guidelines ?? (this.tables.content_guidelines = [])
    const existing = guidelines.find(row => row.content_run_id === p_content_run_id)
    if (existing) return { data: [existing], error: null }
    const run = (this.tables.content_runs ?? []).find(row => row.id === p_content_run_id)
    if (!run) return { data: null, error: { message: 'Content run not found.' } }
    const guideline = {
      id: this.id('guideline'),
      content_run_id: p_content_run_id,
      client_id: run.client_id,
      title: `${run.client_name ?? 'Client'} content guideline`,
      status: 'draft',
      coverage_start: null,
      coverage_end: null,
    }
    guidelines.push(guideline)
    this.recordWrite('content_guidelines', 'insert')
    return { data: [guideline], error: null }
  }

  // Mirrors link_content_guide_video_deliverable, refusals included.
  rpc_link_content_guide_video_deliverable({ p_content_guide_idea_id, p_deliverable_id }) {
    const video = (this.tables.content_guide_ideas ?? []).find(row => row.id === p_content_guide_idea_id)
    if (!video || video.status === 'archived') return { data: null, error: { message: 'Guideline video not found.' } }
    if (video.deliverable_id) return { data: false, error: null }
    const deliverable = (this.tables.monthly_deliverables ?? []).find(row => row.id === p_deliverable_id)
    if (!deliverable) return { data: null, error: { message: 'Client Schedule slot not found.' } }
    if (deliverable.client_id !== video.client_id) {
      return { data: null, error: { message: 'A guideline video can only link to a slot of its own client.' } }
    }
    if (!['video', 'reel'].includes(deliverable.deliverable_type)) {
      return { data: null, error: { message: 'Only a video or reel slot can hold a guideline video.' } }
    }
    const taken = (this.tables.content_guide_ideas ?? []).some(row =>
      row.deliverable_id === p_deliverable_id && row.status !== 'archived' && row.id !== p_content_guide_idea_id)
    if (taken) return { data: false, error: null }
    video.deliverable_id = p_deliverable_id
    this.recordWrite('content_guide_ideas', 'update')
    return { data: true, error: null }
  }
}
