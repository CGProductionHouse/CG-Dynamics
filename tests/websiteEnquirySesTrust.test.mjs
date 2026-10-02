import assert from 'node:assert/strict'
import { createHash, X509Certificate } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { AMAZON_TRUST_ROOTS } from '../supabase/functions/_shared/amazonTrustRoots.ts'
import { trustedIssuerUrls, verifySnsSigningCertificate } from '../supabase/functions/_shared/snsCertificateTrust.ts'
import { verifySnsSignature } from '../supabase/functions/_shared/websiteEnquirySes.ts'
import { buildPki, signSnsMessage, SNS_ISSUER_URL } from './helpers/snsTestPki.mjs'

const fixture = (name) => readFileSync(new URL(`./fixtures/sns-trust/${name}`, import.meta.url), 'utf8')
const trust = readFileSync(new URL('../supabase/functions/_shared/snsCertificateTrust.ts', import.meta.url), 'utf8')
const issuerFrom = (bytes) => async (url) => { assert.equal(url, SNS_ISSUER_URL); return bytes }

// Published Amazon Trust Services root fingerprints (https://www.amazontrust.com/repository/).
const PUBLISHED = {
  AmazonRootCA1: '8ecde6884f3d87b1125ba31ac3fcb13d7016de7f57cc904fe1cb97c6ae98196e',
  AmazonRootCA2: '1ba5b2aa8c65401a82960118f80bec4f62304d83cec4713a19c39c011ea46db4',
  AmazonRootCA3: '18ce6cfe7bf14e60b2e347b8dfe868cb31d02ebb3ada271569f50343b46db3a4',
  AmazonRootCA4: 'e35d28419ed02025cfa69038cd623962458da5c695fbdea3c22b0bfb25897092',
}

test('pinned anchors are exactly the four Amazon Trust Services roots, by DER fingerprint', () => {
  assert.deepEqual(AMAZON_TRUST_ROOTS.map((root) => root.name), Object.keys(PUBLISHED))
  for (const root of AMAZON_TRUST_ROOTS) {
    const cert = new X509Certificate(root.pem)
    assert.equal(createHash('sha256').update(cert.raw).digest('hex'), PUBLISHED[root.name], root.name)
    assert.equal(root.sha256, PUBLISHED[root.name])
    assert.equal(cert.ca, true)
    assert.match(cert.subject, /O=Amazon\nCN=Amazon Root CA [1-4]/)
  }
})

test('real current Amazon RSA 2048 M01–M04 intermediates anchor to pinned Amazon Root CA 1', () => {
  const root1 = new X509Certificate(AMAZON_TRUST_ROOTS[0].pem)
  for (const n of ['01', '02', '03', '04']) {
    const intermediate = new X509Certificate(fixture(`amazon-rsa-2048-m${n}.pem`))
    assert.equal(intermediate.ca, true)
    assert.equal(intermediate.checkIssued(root1), true, n)
    assert.equal(intermediate.verify(root1.publicKey), true, n)
  }
})

test('a valid chain is trusted and its leaf key verifies the SNS SHA256 signature', async () => {
  const pki = buildPki({ name: 'good' })
  const result = await verifySnsSigningCertificate(pki.leafPem, { fetchIssuer: issuerFrom(pki.intermediateDer), roots: [pki.rootPem] })
  assert.equal(result.ok, true, result.reason)
  const message = signSnsMessage({ Type: 'Notification', MessageId: 'm', TopicArn: 'arn:aws:sns:eu-west-1:123456789012:t', Message: '{}', Timestamp: 't', SignatureVersion: '2', SigningCertURL: 'u' }, pki.leafKey, pki.dir)
  assert.equal(await verifySnsSignature(message, result.spki), true)
  assert.equal(await verifySnsSignature({ ...message, Message: '{"x":1}' }, result.spki), false)
})

test('an otherwise-valid attacker chain (own root, amazontrust AIA, CN sns.amazonaws.com) is rejected by the pinned Amazon roots', async () => {
  const attacker = buildPki({ name: 'attacker' })
  // Production path: no injected roots -> pinned Amazon roots only.
  const result = await verifySnsSigningCertificate(attacker.leafPem, { fetchIssuer: issuerFrom(attacker.intermediateDer) })
  assert.deepEqual(result, { ok: false, reason: 'issuer_not_anchored_to_amazon_root' })
})

test('attacker leaf presenting a REAL Amazon intermediate is rejected (not signed by it)', async () => {
  const attacker = buildPki({ name: 'attacker-real-int' })
  const realIntermediate = new X509Certificate(fixture('amazon-rsa-2048-m02.pem')).raw
  const result = await verifySnsSigningCertificate(attacker.leafPem, { fetchIssuer: issuerFrom(new Uint8Array(realIntermediate)) })
  assert.deepEqual(result, { ok: false, reason: 'leaf_not_signed_by_issuer' })
})

test('self-signed sns.amazonaws.com certificate (no issuer) is rejected', async () => {
  const pki = buildPki({ name: 'self' })
  const result = await verifySnsSigningCertificate(pki.rootPem.replace('Amazon Root CA 1', 'x'), { fetchIssuer: async () => { throw new Error('must not fetch') } })
  assert.equal(result.ok, false)
  // A real self-signed leaf: the PKI root is a CA, so it is rejected as a leaf.
  const selfSigned = await verifySnsSigningCertificate(pki.rootPem, { fetchIssuer: async () => { throw new Error('must not fetch') } })
  assert.equal(selfSigned.ok, false)
})

test('genuine SNS leaf fails closed when expired or presented with the wrong Amazon intermediate', async () => {
  const leaf = fixture('sns-amazonaws-com-2021-leaf.pem')
  assert.deepEqual(trustedIssuerUrls(new X509Certificate(leaf)), ['http://crt.sca1b.amazontrust.com/sca1b.crt'])
  const realM02 = new Uint8Array(new X509Certificate(fixture('amazon-rsa-2048-m02.pem')).raw)
  assert.deepEqual(await verifySnsSigningCertificate(leaf, { fetchIssuer: async () => realM02 }), { ok: false, reason: 'leaf_not_valid_now' })
  // Inside the leaf's validity the real M02 intermediate did not yet exist (valid from Aug 2022).
  assert.deepEqual(await verifySnsSigningCertificate(leaf, { fetchIssuer: async () => realM02, now: new Date('2022-01-01T00:00:00Z') }),
    { ok: false, reason: 'issuer_not_valid_now' })
})

test('genuine af-south-1 SNS leaf (regional SAN only) is trusted via real M01 + pinned root, bound to its cert-URL host', async () => {
  const leaf = fixture('sns-af-south-1-2026-leaf.pem')
  const cert = new X509Certificate(leaf)
  assert.equal(cert.subjectAltName, 'DNS:sns-signing.af-south-1.amazonaws.com, DNS:sns.af-south-1.amazonaws.com')
  assert.deepEqual(trustedIssuerUrls(cert), ['http://crt.r2m01.amazontrust.com/r2m01.cer'])
  const realM01 = new Uint8Array(new X509Certificate(fixture('amazon-rsa-2048-m01.pem')).raw)
  const now = new Date('2026-10-02T18:00:00Z')
  const verify = (certUrlHost) => verifySnsSigningCertificate(leaf, { fetchIssuer: async () => realM01, now, ...(certUrlHost === undefined ? {} : { certUrlHost }) })
  const trusted = await verify('sns.af-south-1.amazonaws.com')
  assert.equal(trusted.ok, true, trusted.reason)
  assert.deepEqual(Buffer.from(trusted.spki), cert.publicKey.export({ type: 'spki', format: 'der' }))
  // Without the host binding, or bound to another region / a non-SNS host, the regional leaf is not SNS's.
  for (const host of [undefined, 'sns.eu-west-1.amazonaws.com', 'sns-signing.af-south-1.amazonaws.com', 'evil.example', 'sns.af-south-1.amazonaws.com.evil.example']) {
    assert.deepEqual(await verify(host), { ok: false, reason: 'not_issued_to_sns' }, String(host))
  }
  // Expired: still fails closed after notAfter.
  assert.deepEqual(await verifySnsSigningCertificate(leaf, { fetchIssuer: async () => realM01, certUrlHost: 'sns.af-south-1.amazonaws.com', now: new Date('2027-03-01T00:00:00Z') }),
    { ok: false, reason: 'leaf_not_valid_now' })
})

test('a regional host binding never lets an attacker chain through the pinned roots', async () => {
  const attacker = buildPki({ name: 'regional-attacker', leafDns: 'sns.af-south-1.amazonaws.com' })
  assert.deepEqual(await verifySnsSigningCertificate(attacker.leafPem, { fetchIssuer: issuerFrom(attacker.intermediateDer), certUrlHost: 'sns.af-south-1.amazonaws.com' }),
    { ok: false, reason: 'issuer_not_anchored_to_amazon_root' })
  const regional = buildPki({ name: 'regional', leafDns: 'sns.af-south-1.amazonaws.com' })
  const ok = await verifySnsSigningCertificate(regional.leafPem, { fetchIssuer: issuerFrom(regional.intermediateDer), roots: [regional.rootPem], certUrlHost: 'sns.af-south-1.amazonaws.com' })
  assert.equal(ok.ok, true, ok.reason)
})

test('every structural rule fails closed with a named reason', async () => {
  const cases = [
    ['not_issued_to_sns', buildPki({ name: 'san', leafDns: 'sns.evil.example' })],
    ['leaf_is_ca', buildPki({ name: 'leafca', leafIsCa: true })],
    ['untrusted_issuer_location', buildPki({ name: 'aia', aiaUrl: 'http://crt.evil.example/r2m02.cer' })],
    ['untrusted_issuer_location', buildPki({ name: 'noaia', aiaUrl: null })],
    ['issuer_not_ca', buildPki({ name: 'intca', intermediateIsCa: false })],
  ]
  for (const [reason, pki] of cases) {
    const result = await verifySnsSigningCertificate(pki.leafPem, { fetchIssuer: async () => pki.intermediateDer, roots: [pki.rootPem] })
    assert.deepEqual(result, { ok: false, reason }, reason)
  }
  const good = buildPki({ name: 'misc' })
  assert.deepEqual(await verifySnsSigningCertificate(good.leafPem + good.intermediatePem, { fetchIssuer: async () => good.intermediateDer, roots: [good.rootPem] }),
    { ok: false, reason: 'not_a_single_certificate' })
  assert.deepEqual(await verifySnsSigningCertificate(good.leafPem, { fetchIssuer: async () => { throw new Error('dns') }, roots: [good.rootPem] }),
    { ok: false, reason: 'issuer_unavailable' })
  assert.deepEqual(await verifySnsSigningCertificate(good.leafPem, { fetchIssuer: async () => good.intermediateDer, roots: [good.rootPem], now: new Date('2100-01-01T00:00:00Z') }),
    { ok: false, reason: 'leaf_not_valid_now' })
  // Not yet valid (before notBefore) — portable across OpenSSL versions via an injected clock.
  assert.deepEqual(await verifySnsSigningCertificate(good.leafPem, { fetchIssuer: async () => good.intermediateDer, roots: [good.rootPem], now: new Date('2000-01-01T00:00:00Z') }),
    { ok: false, reason: 'leaf_not_valid_now' })
  assert.deepEqual(await verifySnsSigningCertificate('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----', { fetchIssuer: async () => good.intermediateDer }),
    { ok: false, reason: 'unparseable_certificate' })
})

test('trust uses the platform X.509 verifier, not a hand-written parser', () => {
  assert.match(trust, /import \{ X509Certificate \} from 'node:crypto'/)
  assert.doesNotMatch(trust, /readTlv|0x30|0xa0/)
})
