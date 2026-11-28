import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Packet consistency only. Obtain the current exact-client packet and verify mutable facts separately. */
export function auditCaptionFooter(bytes, packet, expectedClientId) {
  if (typeof expectedClientId !== 'string' || !expectedClientId.trim() || packet?.client?.id !== expectedClientId) throw new Error('Footer packet client does not match the exact expected client')
  const effectiveId = packet?._context?.effective_client_id
  if (effectiveId && effectiveId !== expectedClientId) throw new Error('Footer packet effective client scope differs')
  const footer = packet.contact_footer
  if (packet.runtime_readiness !== 'ready' || footer?.status !== 'ready'
    || footer.can_generate_footer !== true || footer.exact_scope_only !== true) throw new Error('Exact-client footer packet is not ready for use')
  if (footer.requirement !== 'mandatory') throw new Error('This check requires an explicit mandatory footer contract')
  if (!Array.isArray(footer.contacts)) throw new Error('Approved footer contacts are missing')
  const template = footer.format_template
  if (typeof template !== 'string' || !template.trim()) throw new Error('Approved footer template is missing')
  let tokenCount = 0
  const expected = template.replace(/\{([a-z_]+)\}/g, (_, token) => {
    tokenCount++
    const values = [...new Set((footer.contacts ?? [])
      .filter(contact => contact.contact_type === token && typeof contact.value === 'string')
      .map(contact => contact.value.trim()).filter(Boolean))]
    if (values.length !== 1) throw new Error('Approved footer field is missing or ambiguous: ' + token)
    return values[0]
  }).replace(/\r\n?/g, '\n').trim()
  if (!tokenCount || /[{}]/.test(expected)) throw new Error('Unsupported footer template')
  const canonical = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/\r\n?/g, '\n')
  const blocks = canonical.trim().split(/\n[ \t]*\n/)
  const hashtagsOnly = block => block.trim().split(/\s+/).every(token => /^#[\p{L}\p{N}_]+$/u.test(token))
  while (blocks.length && hashtagsOnly(blocks.at(-1))) blocks.pop()
  if (blocks.at(-1) !== expected) throw new Error('Caption must end with the exact approved footer before optional hashtags')
  if (canonical.split(expected).length - 1 !== 1) throw new Error('Approved footer must appear exactly once')
  return {
    schemaVersion: 1, footerChecksPassed: true, clientId: expectedClientId,
    captionCanonicalSha256: createHash('sha256').update(canonical).digest('hex'),
    footerSha256: createHash('sha256').update(expected).digest('hex'),
    limitations: ['Checks the explicitly supplied packet and caption, not packet authenticity or current real-world facts.',
      'Does not certify creative approval, photo correspondence, recipient or posting order; does not rewrite or send.'],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [input, packetPath, clientId, flag, output] = process.argv.slice(2)
    if (!input || !packetPath || !clientId || flag !== '--out' || !output) throw new Error('Usage: caption-footer-guard.mjs caption.txt context-packet.json exact-client-id --out new-receipt.json')
    if ([input, packetPath].some(path => resolve(path).toLowerCase() === resolve(output).toLowerCase())) throw new Error('Receipt must not overwrite an input')
    const receipt = auditCaptionFooter(readFileSync(input), JSON.parse(readFileSync(packetPath, 'utf8')), clientId)
    writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', encoding: 'utf8' })
    console.log(JSON.stringify(receipt))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
