import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'vite'

let server
let parseWebmDurationSeconds
let parseMp4DurationSeconds

before(async () => {
  server = await createServer({
    root: process.cwd(),
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
  })
  ;({ parseWebmDurationSeconds, parseMp4DurationSeconds } = await server.ssrLoadModule('/supabase/functions/_shared/audioDuration.ts'))
})

after(async () => { await server.close() })

const concat = (...parts) => Uint8Array.from(parts.flatMap(part => [...part]))
const id = value => {
  const result = []
  while (value > 0) { result.unshift(value & 0xff); value = Math.floor(value / 256) }
  return result
}
const ebmlSize = size => {
  if (size < 127) return [0x80 | size]
  if (size < 16_383) return [0x40 | size >> 8, size & 0xff]
  throw new Error('fixture too large')
}
const element = (elementId, payload) => concat(id(elementId), ebmlSize(payload.length), payload)
const uint = value => {
  const result = []
  do { result.unshift(value & 0xff); value = Math.floor(value / 256) } while (value > 0)
  return result
}

function mediaRecorderWebm(seconds, { metadataSeconds = seconds, includeDuration = true } = {}) {
  const ebmlHeader = element(0x1a45dfa3, concat(element(0x4286, [1]), element(0x4282, [...Buffer.from('webm')]), element(0x4287, [4])))
  const infoParts = [element(0x2ad7b1, uint(1_000_000))]
  if (includeDuration) {
    const duration = new Uint8Array(8)
    new DataView(duration.buffer).setFloat64(0, metadataSeconds * 1000, false)
    infoParts.push(element(0x4489, duration))
  }
  const info = element(0x1549a966, concat(...infoParts))
  const track = element(0xae, concat(
    element(0xd7, [1]),
    element(0x83, [2]),
    element(0x86, [...Buffer.from('A_OPUS')]),
    element(0x23e383, uint(20_000_000)),
  ))
  const tracks = element(0x1654ae6b, track)
  const lastStartMs = Math.round(seconds * 1000 - 20)
  const clusterTimecode = Math.max(0, lastStartMs)
  const block = element(0xa3, [0x81, 0, 0, 0x80, 0x98, 0, 0])
  const cluster = element(0x1f43b675, concat(element(0xe7, uint(clusterTimecode)), block))
  return concat(ebmlHeader, element(0x18538067, concat(info, tracks, cluster)))
}

function box(type, payload) {
  const bytes = new Uint8Array(8 + payload.length)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, bytes.length, false)
  for (let index = 0; index < 4; index += 1) bytes[4 + index] = type.charCodeAt(index)
  bytes.set(payload, 8)
  return bytes
}

function fullDurationBox(type, duration, timescale) {
  const payload = new Uint8Array(20)
  const view = new DataView(payload.buffer)
  view.setUint32(12, timescale, false)
  view.setUint32(16, duration, false)
  return box(type, payload)
}

function audioTrackM4a(duration, timescale = 48_000, { movieDuration = duration, sampleDuration = duration } = {}) {
  const ftyp = box('ftyp', Uint8Array.from([0x4d, 0x34, 0x41, 0x20, 0, 0, 0, 0, 0x69, 0x73, 0x6f, 0x6d]))
  const handler = new Uint8Array(12)
  handler.set([...Buffer.from('soun')], 8)
  const sttsPayload = new Uint8Array(16)
  const sttsView = new DataView(sttsPayload.buffer)
  sttsView.setUint32(4, 1, false)
  sttsView.setUint32(8, 1, false)
  sttsView.setUint32(12, sampleDuration, false)
  const stbl = box('stbl', box('stts', sttsPayload))
  const mdia = box('mdia', concat(fullDurationBox('mdhd', duration, timescale), box('hdlr', handler), box('minf', stbl)))
  const moov = box('moov', concat(fullDurationBox('mvhd', movieDuration, timescale), box('trak', mdia)))
  return concat(ftyp, moov)
}

test('parses an actual-like browser MediaRecorder WebM encoded Opus timeline without optional Duration', () => {
  assert.equal(parseWebmDurationSeconds(mediaRecorderWebm(12.5, { includeDuration: false })), 12.5)
  assert.equal(parseWebmDurationSeconds(mediaRecorderWebm(301, { includeDuration: false })), 301)
})

test('uses a consistent WebM metadata/timeline maximum and rejects tampered Duration mismatch', () => {
  assert.equal(parseWebmDurationSeconds(mediaRecorderWebm(12.5, { metadataSeconds: 12.501 })), 12.501)
  assert.equal(parseWebmDurationSeconds(mediaRecorderWebm(301, { metadataSeconds: 1 })), null)
  assert.equal(parseWebmDurationSeconds(mediaRecorderWebm(1, { metadataSeconds: 301 })), null)
})

test('derives M4A duration from the audio mdhd and stts timeline, not mutable mvhd', () => {
  assert.equal(parseMp4DurationSeconds(audioTrackM4a(600_000, 48_000, { movieDuration: 1 })), 12.5)
  assert.equal(parseMp4DurationSeconds(audioTrackM4a(14_448_000, 48_000)), 301)
})

test('rejects missing or inconsistent MP4 audio timelines and malformed containers', () => {
  assert.equal(parseMp4DurationSeconds(audioTrackM4a(600_000, 48_000, { sampleDuration: 599_000 })), null)
  assert.equal(parseWebmDurationSeconds(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3])), null)
  assert.equal(parseMp4DurationSeconds(Uint8Array.from([0, 0, 0, 8, 0x66, 0x74, 0x79, 0x70])), null)
})
