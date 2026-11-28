import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Transport checks only: never creative approval, fact verification or send authority. */
export function auditCaption(bytes, expectedSha256) {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256 ?? '')) throw new Error('Explicit lowercase canonical SHA-256 required')
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error('Caption must be UTF-8 without BOM')
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const canonical = decoded.replace(/\r\n?/g, '\n')
  if (!canonical.trim()) throw new Error('Empty caption')
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\ufffd]/u.test(canonical)) throw new Error('Invalid caption control or replacement character')
  if (/(?:â[€€™“”„]|Ã[©¨¼±]|Â[ \u00a0]|ðŸ)/u.test(canonical)) throw new Error('Possible caption encoding corruption: inspect source Unicode')
  if (canonical.split('\n').some(line => /^\s*(?:[-–—]\s*)?(?:picasso|nolan)(?:\s*[.!])?\s*$/iu.test(line))) throw new Error('Agent signature is forbidden in forwardable captions')
  const sha256 = createHash('sha256').update(canonical, 'utf8').digest('hex')
  if (sha256 !== expectedSha256) throw new Error('Caption differs from the allocated canonical version')
  return {
    schemaVersion: 1, transportChecksPassed: true, canonicalSha256: sha256,
    canonicalUtf8Bytes: Buffer.byteLength(canonical, 'utf8'),
    lineEndingsNormalised: decoded !== canonical,
    limitations: ['Does not verify claims, brand voice, image correspondence, approvals, recipient or posting order.', 'Does not send or modify the caption; only CR/CRLF are normalised for comparison.'],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [input, expected, flag, output] = process.argv.slice(2)
    if (!input || flag !== '--out' || !output) throw new Error('Usage: caption-guard.mjs caption.txt canonical-sha256 --out new-receipt.json')
    if (resolve(input).toLowerCase() === resolve(output).toLowerCase()) throw new Error('Receipt must not overwrite caption')
    const receipt = auditCaption(readFileSync(input), expected)
    writeFileSync(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', encoding: 'utf8' })
    console.log(JSON.stringify(receipt))
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
