/**
 * Mock Meta Graph API server for non-production load testing of PR #202.
 *
 * Serves all endpoints the meta-sync-worker calls, with deterministic
 * responses keyed by page/IG account IDs. Supports failure injection
 * via a JSON control file on disk.
 *
 * Run: node mock-meta-server.js [port]
 */
const http = require('node:http')
const fs = require('node:fs')

const PORT = process.env.MOCK_PORT || 54325
const MOCK_DIR = process.env.MOCK_DIR || __dirname
const CONTROL_FILE = require('node:path').join(MOCK_DIR, 'mock-control.json')

// ── State tracking ───────────────────────────────────────────────────────────

const state = {
  graphCalls: 0,
  http429s: 0,
  errorCodes: { '4': 0, '17': 0, '32': 0, '341': 0, '613': 0 },
  pageTokenCalls: 0,
  postListingCalls: 0,
  igMediaListingCalls: 0,
  insightProbes: 0,
  pageFieldProbes: 0,
  startTime: Date.now(),
}

function getDefaultControl() {
  return {
    rateLimited: false,
    rateLimitEveryN: 0,
    errorCodes: {},
    slowResponse: false,
    slowMs: 0,
    dropTokenMap: false,
    returnEmpty: false,
    injectErrorAtCall: {},
    disabledPages: [],
  }
}

function getControl() {
  try {
    return { ...getDefaultControl(), ...JSON.parse(fs.readFileSync(CONTROL_FILE, 'utf8')) }
  } catch {
    return getDefaultControl()
  }
}

function saveControl(ctrl) {
  fs.writeFileSync(CONTROL_FILE, JSON.stringify(ctrl, null, 2))
}

function initControlFile() {
  if (!fs.existsSync(CONTROL_FILE)) {
    saveControl(getDefaultControl())
  }
}

// ── Mock data generation ─────────────────────────────────────────────────────

function generatePosts(pageId, month, cursor, origin) {
  const posts = []
  for (let i = 8; i >= 1; i--) {
    const postId = `${pageId}_${month}_${i}`
    posts.push({
      id: postId,
      message: `Post ${i} for page ${pageId} in ${month}`,
      created_time: `${month}-${String(i).padStart(2, '0')}T12:00:00.000Z`,
      permalink_url: `https://www.facebook.com/${pageId}/posts/${postId}`,
      full_picture: `https://via.placeholder.com/400x300?text=Post${i}`,
      shares: { count: 5 + i },
      reactions: { summary: { total_count: 10 + i * 3 } },
      comments: { summary: { total_count: 3 + i } },
    })
  }
  const startIdx = cursor ? Number(cursor) : 0
  const pageSize = 5
  const page = posts.slice(startIdx, startIdx + pageSize)
  const nextCursor = startIdx + pageSize < posts.length ? String(startIdx + pageSize) : null
  return {
    data: page,
    paging: {
      cursors: { after: nextCursor },
      next: nextCursor
        ? `${origin}/v25.0/${pageId}/posts?access_token=TOKEN&after=${nextCursor}`
        : null,
    },
  }
}

function generateIgMedia(igId, month, cursor, origin) {
  const items = []
  for (let i = 8; i >= 1; i--) {
    const itemId = `${igId}_${month}_${i}`
    items.push({
      id: itemId,
      caption: `IG post ${i} for ${igId} in ${month}`,
      media_type: 'IMAGE',
      media_product_type: 'FEED',
      timestamp: `${month}-${String(i).padStart(2, '0')}T12:00:00.000Z`,
      permalink: `https://www.instagram.com/p/${itemId}/`,
      thumbnail_url: `https://via.placeholder.com/400x400?text=IG${i}`,
      media_url: `https://via.placeholder.com/400x400?text=IG${i}`,
      like_count: 20 + i * 2,
      comments_count: 5 + i,
    })
  }
  const startIdx = cursor ? Number(cursor) : 0
  const pageSize = 5
  const page = items.slice(startIdx, startIdx + pageSize)
  const nextCursor = startIdx + pageSize < items.length ? String(startIdx + pageSize) : null
  return {
    data: page,
    paging: {
      cursors: { after: nextCursor },
      next: nextCursor
        ? `${origin}/v25.0/${igId}/media?access_token=TOKEN&after=${nextCursor}`
        : null,
    },
  }
}

function generateInsights(metric, since, until) {
  const sinceTs = Number(since) || 0
  const untilTs = Number(until) || 0
  const days = Math.max(1, Math.ceil((untilTs - sinceTs) / 86400))
  const values = []
  for (let d = 0; d < Math.min(days, 30); d++) {
    values.push({
      value: 50 + d * 3,
      end_time: new Date((sinceTs + d * 86400) * 1000).toISOString().split('T')[0],
    })
  }
  return {
    data: [
      {
        name: metric,
        values,
        total_value: { value: 500 },
        period: 'day',
      },
    ],
  }
}

function generateIgInsights(metric, since, until) {
  const values = []
  for (let d = 0; d < 30; d++) {
    values.push({
      value: 10 + d * 2,
      end_time: new Date(Date.now() - (30 - d) * 86400000).toISOString().split('T')[0],
    })
  }
  return {
    data: [
      {
        name: metric,
        values,
        total_value: { value: metric === 'followers_count' ? 1500 : 300 },
        period: 'day',
      },
    ],
  }
}

// ── Request handler ──────────────────────────────────────────────────────────

initControlFile()

const server = http.createServer(async (req, res) => {
  // Derive origin from Host header so paging URLs match the caller's origin
  const hostHeader = req.headers.host || `localhost:${PORT}`
  const requestOrigin = `http://${hostHeader}`
  const url = new URL(req.url || '', requestOrigin)

  if (url.pathname === '/__stats__') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ...state, uptimeMs: Date.now() - state.startTime }))
    return
  }

  if (url.pathname === '/__reset__') {
    state.graphCalls = 0
    state.http429s = 0
    state.errorCodes = { '4': 0, '17': 0, '32': 0, '341': 0, '613': 0 }
    state.pageTokenCalls = 0
    state.postListingCalls = 0
    state.igMediaListingCalls = 0
    state.insightProbes = 0
    state.pageFieldProbes = 0
    state.startTime = Date.now()
    saveControl(getDefaultControl())
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, message: 'stats and control reset' }))
    return
  }

  if (url.pathname === '/__control__') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(getControl()))
      return
    }
    if (req.method === 'POST') {
      let body = ''
      req.on('data', c => body += c)
      req.on('end', () => {
        try {
          const newCtrl = JSON.parse(body)
          saveControl(newCtrl)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true, control: newCtrl }))
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
        }
      })
      return
    }
  }

  state.graphCalls++
  const callNumber = state.graphCalls
  const control = getControl()
  const pathParts = url.pathname.split('/').filter(Boolean)

  // ── Failure injection ─────────────────────────────────────────────────

  // Rate limit injection
  if (control.rateLimited && control.rateLimitEveryN > 0 && callNumber % control.rateLimitEveryN === 0) {
    state.http429s++
    res.writeHead(429, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: { message: 'Application request limit reached', type: 'OAuthException', code: 4, fbtrace_id: 'mock-429' },
    }))
    return
  }

  // Error code injection
  for (const [code, threshold] of Object.entries(control.errorCodes)) {
    if (threshold > 0 && callNumber % threshold === 0) {
      state.errorCodes[code] = (state.errorCodes[code] || 0) + 1
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: {
          message: `Mock error code ${code}`,
          type: 'OAuthException',
          code: Number(code),
          error_subcode: code === '32' ? 2069032 : undefined,
          fbtrace_id: `mock-${code}`,
        },
      }))
      return
    }
  }

  // Specific call-number injection
  if (control.injectErrorAtCall && control.injectErrorAtCall[callNumber]) {
    const cfg = control.injectErrorAtCall[callNumber]
    if (cfg.type === '429') {
      state.http429s++
      res.writeHead(429, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: { message: 'Rate limit', type: 'OAuthException', code: 4, fbtrace_id: 'mock-inject' },
      }))
      return
    }
    if (cfg.type === 'error_code') {
      state.errorCodes[cfg.code] = (state.errorCodes[cfg.code] || 0) + 1
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: {
          message: `Mock error code ${cfg.code}`,
          type: 'OAuthException',
          code: Number(cfg.code),
          error_subcode: cfg.subcode,
          fbtrace_id: 'mock-inject',
        },
      }))
      return
    }
  }

  // Slow response injection
  if (control.slowResponse && control.slowMs > 0) {
    await new Promise(r => setTimeout(r, control.slowMs))
  }

  // Drop token map
  if (control.dropTokenMap) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'Internal error', type: 'Exception', code: 1 } }))
    return
  }

  // Return empty data
  if (control.returnEmpty) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data: [], paging: null }))
    return
  }

  // Disabled pages
  const objectId = pathParts[1]
  if (control.disabledPages && control.disabledPages.length && objectId && control.disabledPages.includes(objectId)) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: { message: 'Page access token invalid', type: 'OAuthException', code: 190, fbtrace_id: 'mock-disabled' },
    }))
    return
  }

  // ── Route the request ─────────────────────────────────────────────────

  // /{version}/me/accounts — page token map
  if (pathParts.length === 3 && pathParts[1] === 'me' && pathParts[2] === 'accounts') {
    state.pageTokenCalls++
    const accounts = []
    for (let i = 1; i <= 37; i++) {
      accounts.push({
        id: String(1000000000000000 + i),
        access_token: `page-token-${i}`,
        name: `Client Page ${i}`,
      })
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data: accounts }))
    return
  }

  // /{version}/{objectId} — field query
  if (pathParts.length === 2) {
    state.pageFieldProbes++
    const objectId = pathParts[1]
    const isIg = objectId.startsWith('2000000')
    if (isIg) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: objectId, followers_count: 1500 }))
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ id: objectId, followers_count: 2500, fan_count: 2450 }))
    }
    return
  }

  // /{version}/{objectId}/posts — Facebook posts
  if (pathParts.length === 3 && pathParts[2] === 'posts') {
    state.postListingCalls++
    const pageId = pathParts[1]
    const since = url.searchParams.get('since') || ''
    const after = url.searchParams.get('after') || null
    let month = '2026-06'
    if (since) {
      const d = new Date(Number(since) * 1000)
      month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    }
    const result = generatePosts(pageId, month, after, url.origin)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  // /{version}/{objectId}/media — Instagram media
  if (pathParts.length === 3 && pathParts[2] === 'media') {
    state.igMediaListingCalls++
    const igId = pathParts[1]
    const after = url.searchParams.get('after') || null
    const result = generateIgMedia(igId, '2026-06', after, url.origin)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  // /{version}/{objectId}/insights — account insights
  if (pathParts.length === 3 && pathParts[2] === 'insights') {
    state.insightProbes++
    const metric = url.searchParams.get('metric') || ''
    const since = url.searchParams.get('since') || ''
    const until = url.searchParams.get('until') || ''
    const isIg = pathParts[1].startsWith('2000000')
    const result = isIg ? generateIgInsights(metric, since, until) : generateInsights(metric, since, until)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(result))
    return
  }

  // Default response
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ id: pathParts[1] || 'unknown', name: 'Mock Object' }))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock Meta Graph API server running on port ${PORT}`)
  console.log(`Control file: ${CONTROL_FILE}`)
  console.log(`Stats: http://localhost:${PORT}/__stats__`)
})
