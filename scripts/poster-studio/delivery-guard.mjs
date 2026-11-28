import { createHash } from 'node:crypto'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { auditCaption } from './caption-guard.mjs'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const hasText = value => typeof value === 'string' && value.trim().length > 0
const hash = value => /^[a-f0-9]{64}$/.test(value ?? '')

function localBytes(root, file) {
  if (!hasText(file) || isAbsolute(file)) throw new Error('Use a job-relative file path')
  const base = realpathSync(root)
  const target = realpathSync(resolve(base, file))
  const child = relative(base, target)
  if (!child || child === '..' || child.startsWith('..\\') || child.startsWith('../') || isAbsolute(child)) {
    throw new Error('File escapes the private job directory')
  }
  return readFileSync(target)
}

/** Read-only transport audit. Caller-supplied history is NOT authoritative approval. */
export function auditDelivery(manifest, root, histories = []) {
  if (!manifest || !hasText(manifest.clientId) || !hasText(manifest.designId) || !hasText(manifest.recipient)) {
    throw new Error('Exact client, design and recipient are required')
  }
  if (!Array.isArray(manifest.entries) || !manifest.entries.length || !Array.isArray(histories)) {
    throw new Error('Nonempty entries and a history array are required')
  }
  for (const history of histories) {
    if (!history || !hasText(history.clientId) || !hasText(history.recipient) || !Array.isArray(history.entries)) {
      throw new Error('Malformed delivery history; do not silently skip it')
    }
  }
  const relevant = [manifest, ...histories].filter(item =>
    item.clientId === manifest.clientId && item.recipient === manifest.recipient)
  const seenPosters = new Set()
  const seenPages = new Set()
  const seenPayloads = new Set()
  const results = manifest.entries.map(entry => {
    const findings = []
    if (!hasText(entry.poster) || !hasText(entry.pageId)) findings.push('Missing poster or stable page identity')
    if (seenPosters.has(entry.poster) || seenPages.has(entry.pageId)) findings.push('Duplicate poster/page in selection')
    seenPosters.add(entry.poster)
    seenPages.add(entry.pageId)
    const payload = `${entry.sha256}:${entry.captionSha256}`
    if (seenPayloads.has(payload)) findings.push('Duplicate artwork/caption payload in selection')
    seenPayloads.add(payload)
    try {
      if (!hash(entry.sha256)) throw new Error('Invalid allocated artwork hash')
      const bytes = localBytes(root, entry.png)
      if (digest(bytes) !== entry.sha256) throw new Error('Artwork bytes differ from the selected version')
      if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
          bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR') {
        throw new Error('Expected a PNG with a valid IHDR header')
      }
      const dimensions = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
      if (!Array.isArray(entry.dimensions) || entry.dimensions.length !== 2 ||
          !dimensions.every((value, index) => value > 0 && value === entry.dimensions[index])) {
        throw new Error('PNG header dimensions differ from the selected version')
      }
      auditCaption(localBytes(root, entry.caption), entry.captionSha256)
    } catch (error) {
      findings.push(error.message)
    }

    // Any message witness is a stop, including Sent or an ambiguous delivery state.
    // Match exact bytes across page/design renames; don't retry merely because a UI
    // acknowledgement is absent. A changed caption on the same page also needs review.
    const witnesses = relevant.flatMap(item => item.entries.filter(old =>
      (old.sha256 === entry.sha256 && old.captionSha256 === entry.captionSha256) ||
      (item.designId === manifest.designId && old.pageId === entry.pageId && old.sha256 === entry.sha256)))
    const messageIds = [...new Set(witnesses.filter(old => hasText(old.messageId)).map(old => old.messageId))]
    const uncertain = witnesses.some(old => !hasText(old.messageId) &&
      hasText(old.deliveryStatus) && !['not sent', 'not-sent'].includes(old.deliveryStatus.toLowerCase()))
    if (uncertain) findings.push('Delivery status lacks a message witness; inspect the live chat before retrying')
    return {
      poster: entry.poster, pageId: entry.pageId, sha256: entry.sha256,
      transportChecksPassed: findings.length === 0,
      state: findings.length ? 'hold' : messageIds.length ? 'already-recorded' : 'unrecorded',
      messageIds, findings,
    }
  })
  return {
    schemaVersion: 1, clientId: manifest.clientId, designId: manifest.designId, recipient: manifest.recipient,
    transportChecksPassed: results.every(item => item.transportChecksPassed),
    alreadyRecordedCount: results.filter(item => item.state === 'already-recorded').length,
    unrecordedCount: results.filter(item => item.state === 'unrecorded').length,
    holdCount: results.filter(item => item.state === 'hold').length,
    automaticSendAllowed: false, entries: results,
    limitations: [
      'Unrecorded means no matching witness in the supplied history, not proof of an unsent message.',
      'History and recipient identity are caller supplied; recheck the exact live chat after an uncertain send.',
      'PNG header/hash checks do not decode pixels, establish HD source quality, colour management or creative approval.',
      'Does not verify brand, facts, reuse coverage, human approval, schedule, live mention entities or send authority.',
      'Does not send, mutate artwork/captions, reset delivery status or replace immutable historical receipts.',
    ],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = process.argv.slice(2)
    const input = args.shift()
    const histories = []
    let output
    while (args.length) {
      const flag = args.shift()
      const value = args.shift()
      if (!value) throw new Error('Missing argument value')
      if (flag === '--history') histories.push(value)
      else if (flag === '--out' && !output) output = value
      else throw new Error('Unknown or duplicate argument')
    }
    if (!input || !output) throw new Error('Usage: delivery-guard.mjs manifest.json [--history prior.json] --out new-receipt.json')
    const inputPath = realpathSync(input)
    const result = auditDelivery(JSON.parse(readFileSync(inputPath, 'utf8')), resolve(inputPath, '..'),
      histories.map(file => JSON.parse(readFileSync(file, 'utf8'))))
    writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', encoding: 'utf8' })
    console.log(JSON.stringify({ transportChecksPassed: result.transportChecksPassed,
      alreadyRecordedCount: result.alreadyRecordedCount, unrecordedCount: result.unrecordedCount,
      holdCount: result.holdCount, automaticSendAllowed: false }))
    if (!result.transportChecksPassed || result.alreadyRecordedCount) process.exitCode = 1
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
