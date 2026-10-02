// Test-only X.509 PKIs built with OpenSSL: root -> intermediate (CA) -> SNS-style leaf.
// Used to exercise the real snsCertificateTrust verifier with injected test roots, and to
// build an otherwise-valid attacker chain that must fail against the pinned Amazon roots.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { snsStringToSign } from '../../supabase/functions/_shared/websiteEnquirySes.ts'

const env = { ...process.env, MSYS_NO_PATHCONV: '1', MSYS2_ARG_CONV_EXCL: '*' }
const openssl = (args) => execFileSync('openssl', args, { stdio: ['ignore', 'pipe', 'ignore'], env })

export const SNS_ISSUER_URL = 'http://crt.r2m02.amazontrust.com/r2m02.cer'

export function buildPki({
  name = 'pki',
  leafDns = 'sns.amazonaws.com',
  leafIsCa = false,
  intermediateIsCa = true,
  aiaUrl = SNS_ISSUER_URL,
  leafDays = 2,
  leafStart,
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), `cg-sns-pki-${name}-`))
  const path = (file) => join(dir, file)
  const ext = (file, lines) => { writeFileSync(path(file), lines.join('\n') + '\n'); return path(file) }

  openssl(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path('root.key'), '-out', path('root.pem'), '-days', '30',
    '-subj', `/C=US/O=Amazon/CN=Amazon Root CA 1`, '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign'])

  openssl(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', path('int.key'), '-out', path('int.csr'), '-subj', `/C=US/O=Amazon/CN=Amazon RSA 2048 M02`])
  openssl(['x509', '-req', '-in', path('int.csr'), '-CA', path('root.pem'), '-CAkey', path('root.key'), '-CAcreateserial', '-out', path('int.pem'), '-days', '20',
    '-extfile', ext('int.ext', [`basicConstraints=critical,CA:${intermediateIsCa ? 'TRUE,pathlen:0' : 'FALSE'}`, 'keyUsage=critical,keyCertSign,cRLSign,digitalSignature'])])

  openssl(['req', '-newkey', 'rsa:2048', '-nodes', '-keyout', path('leaf.key'), '-out', path('leaf.csr'), '-subj', `/CN=${leafDns}`])
  const leafArgs = ['x509', '-req', '-in', path('leaf.csr'), '-CA', path('int.pem'), '-CAkey', path('int.key'), '-CAcreateserial', '-out', path('leaf.pem'),
    '-extfile', ext('leaf.ext', [
      `basicConstraints=critical,CA:${leafIsCa ? 'TRUE' : 'FALSE'}`,
      `subjectAltName=DNS:${leafDns}`,
      ...(aiaUrl ? [`authorityInfoAccess=caIssuers;URI:${aiaUrl}`] : []),
    ])]
  if (leafStart) leafArgs.push('-not_before', leafStart, '-not_after', '20991231000000Z')
  else leafArgs.push('-days', String(leafDays))
  openssl(leafArgs)

  const intermediateDer = openssl(['x509', '-in', path('int.pem'), '-outform', 'der'])
  return {
    dir,
    rootPem: readFileSync(path('root.pem'), 'utf8'),
    intermediatePem: readFileSync(path('int.pem'), 'utf8'),
    intermediateDer: new Uint8Array(intermediateDer),
    leafPem: readFileSync(path('leaf.pem'), 'utf8'),
    leafKey: path('leaf.key'),
  }
}

/** Signs an SNS message (SignatureVersion 2 / SHA256) with a private key. */
export function signSnsMessage(message, keyPath, dir) {
  const input = join(dir, `sts-${Math.random().toString(36).slice(2)}.txt`)
  writeFileSync(input, snsStringToSign(message))
  return { ...message, Signature: openssl(['dgst', '-sha256', '-sign', keyPath, input]).toString('base64') }
}
