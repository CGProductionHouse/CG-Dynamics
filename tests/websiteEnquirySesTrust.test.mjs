// SNS signing-certificate trust. Runs under Node (`npm test`: node:crypto backend) AND Deno
// (CI `deno test`: the WebCrypto/@peculiar backend the Supabase Edge function uses), so the
// same rules are proven on both X.509 implementations.
import assert from 'node:assert/strict'
import { createHash, X509Certificate } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { AMAZON_SNS_INTERMEDIATES } from '../supabase/functions/_shared/amazonSnsIntermediates.ts'
import { AMAZON_TRUST_ROOTS } from '../supabase/functions/_shared/amazonTrustRoots.ts'
import { acceptedSnsNames, verifySnsSigningCertificate } from '../supabase/functions/_shared/snsCertificateTrust.ts'
import { nodeX509 } from '../supabase/functions/_shared/snsX509Node.ts'
import { verifySnsSignature } from '../supabase/functions/_shared/websiteEnquirySes.ts'
import { buildPki, signSnsMessage } from './helpers/snsTestPki.mjs'

const x509 = globalThis.Deno
  ? (await import('../supabase/functions/_shared/snsX509WebCrypto.ts')).webCryptoX509
  : nodeX509
const backend = globalThis.Deno ? 'webcrypto' : 'node'
const fixture = (name) => readFileSync(new URL(`./fixtures/sns-trust/${name}`, import.meta.url), 'utf8')
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const AF_HOST = 'sns.af-south-1.amazonaws.com'
const AF_NOW = new Date('2026-10-02T18:00:00Z')
const injected = (pki) => ({ x509, intermediates: [pki.intermediatePem], roots: [pki.rootPem] })

// Published Amazon Trust Services root fingerprints (https://www.amazontrust.com/repository/).
const PUBLISHED_ROOTS = {
  AmazonRootCA1: '8ecde6884f3d87b1125ba31ac3fcb13d7016de7f57cc904fe1cb97c6ae98196e',
  AmazonRootCA2: '1ba5b2aa8c65401a82960118f80bec4f62304d83cec4713a19c39c011ea46db4',
  AmazonRootCA3: '18ce6cfe7bf14e60b2e347b8dfe868cb31d02ebb3ada271569f50343b46db3a4',
  AmazonRootCA4: 'e35d28419ed02025cfa69038cd623962458da5c695fbdea3c22b0bfb25897092',
}
const sha256 = (pem) => createHash('sha256').update(new X509Certificate(pem).raw).digest('hex')

test('pinned anchors are exactly the four Amazon Trust Services roots, by DER fingerprint', () => {
  assert.deepEqual(AMAZON_TRUST_ROOTS.map((root) => root.name), Object.keys(PUBLISHED_ROOTS))
  for (const root of AMAZON_TRUST_ROOTS) {
    assert.equal(sha256(root.pem), PUBLISHED_ROOTS[root.name], root.name)
    assert.equal(root.sha256, PUBLISHED_ROOTS[root.name])
    assert.match(new X509Certificate(root.pem).subject, /O=Amazon\nCN=Amazon Root CA [1-4]/)
  }
})

test(`[${backend}] pinned intermediates are exactly Amazon RSA 2048 M01–M04, by fingerprint, each anchored to Amazon Root CA 1`, async () => {
  assert.deepEqual(AMAZON_SNS_INTERMEDIATES.map((cert) => cert.name), ['AmazonRSA2048M01', 'AmazonRSA2048M02', 'AmazonRSA2048M03', 'AmazonRSA2048M04'])
  const root1 = await x509.parse(AMAZON_TRUST_ROOTS[0].pem)
  const root2 = await x509.parse(AMAZON_TRUST_ROOTS[1].pem)
  for (const [index, cert] of AMAZON_SNS_INTERMEDIATES.entries()) {
    assert.equal(sha256(cert.pem), sha256(fixture(`amazon-rsa-2048-m0${index + 1}.pem`)), cert.name)
    assert.equal(sha256(cert.pem), cert.sha256, cert.name)
    const parsed = await x509.parse(cert.pem)
    assert.equal(parsed.isCa, true, cert.name)
    assert.equal(await parsed.isIssuedBy(root1), true, cert.name)
    assert.equal(await parsed.isIssuedBy(root2), false, cert.name)
  }
})

test(`[${backend}] genuine af-south-1 SNS leaf (regional names only) is trusted, bound to its cert-URL host`, async () => {
  const leaf = fixture('sns-af-south-1-2026-leaf.pem')
  const parsed = await x509.parse(leaf)
  assert.deepEqual(parsed.dnsNames, ['sns-signing.af-south-1.amazonaws.com', 'sns.af-south-1.amazonaws.com'])
  const verify = (extra) => verifySnsSigningCertificate(leaf, { x509, now: AF_NOW, ...extra })
  const trusted = await verify({ certUrlHost: AF_HOST })
  assert.equal(trusted.ok, true, trusted.reason)
  assert.deepEqual(Buffer.from(trusted.spki), new X509Certificate(leaf).publicKey.export({ type: 'spki', format: 'der' }))
  for (const certUrlHost of [undefined, 'sns.eu-west-1.amazonaws.com', 'sns-signing.af-south-1.amazonaws.com', 'evil.example', `${AF_HOST}.evil.example`]) {
    assert.deepEqual(await verify({ certUrlHost }), { ok: false, reason: 'not_issued_to_sns' }, String(certUrlHost))
  }
  assert.deepEqual(await verify({ certUrlHost: AF_HOST, now: new Date('2027-03-01T00:00:00Z') }), { ok: false, reason: 'leaf_not_valid_now' })
  // Only the real issuer (M01) is accepted; the other pinned intermediates do not sign it.
  const others = AMAZON_SNS_INTERMEDIATES.slice(1).map((cert) => cert.pem)
  assert.deepEqual(await verify({ certUrlHost: AF_HOST, intermediates: others }), { ok: false, reason: 'leaf_not_signed_by_pinned_intermediate' })
  // M01 anchored to a root it was not issued by: not anchored.
  assert.deepEqual(await verify({ certUrlHost: AF_HOST, roots: [AMAZON_TRUST_ROOTS[1].pem] }), { ok: false, reason: 'issuer_not_anchored_to_amazon_root' })
})

test('accepted names: global SNS name always; regional names only for a regional SNS cert-URL host', () => {
  assert.deepEqual(acceptedSnsNames(), ['sns.amazonaws.com'])
  assert.deepEqual(acceptedSnsNames(AF_HOST), ['sns.amazonaws.com', AF_HOST, 'sns-signing.af-south-1.amazonaws.com'])
  for (const host of ['sns-signing.af-south-1.amazonaws.com', 'sns.amazonaws.com', 'sns.af-south-1.amazonaws.com.evil.example', 'xsns.af-south-1.amazonaws.com']) {
    assert.deepEqual(acceptedSnsNames(host), ['sns.amazonaws.com'], host)
  }
})

test(`[${backend}] a valid chain is trusted and its leaf key verifies the SNS SHA256 signature`, async () => {
  const pki = buildPki({ name: 'good' })
  const result = await verifySnsSigningCertificate(pki.leafPem, injected(pki))
  assert.equal(result.ok, true, result.reason)
  const message = signSnsMessage({ Type: 'Notification', MessageId: 'm', TopicArn: 'arn:aws:sns:eu-west-1:123456789012:t', Message: '{}', Timestamp: 't', SignatureVersion: '2', SigningCertURL: 'u' }, pki.leafKey, pki.dir)
  assert.equal(await verifySnsSignature(message, result.spki), true)
  assert.equal(await verifySnsSignature({ ...message, Message: '{"x":1}' }, result.spki), false)
  const regional = buildPki({ name: 'regional', leafDns: AF_HOST })
  assert.equal((await verifySnsSigningCertificate(regional.leafPem, { ...injected(regional), certUrlHost: AF_HOST })).ok, true)
})

test(`[${backend}] attacker chains fail against the pinned Amazon intermediates and roots`, async () => {
  // Production path: no injected intermediates/roots.
  for (const leafDns of ['sns.amazonaws.com', AF_HOST]) {
    const attacker = buildPki({ name: `attacker-${leafDns}`, leafDns })
    assert.deepEqual(await verifySnsSigningCertificate(attacker.leafPem, { x509, certUrlHost: AF_HOST }), { ok: false, reason: 'leaf_not_signed_by_pinned_intermediate' }, leafDns)
    // Attacker intermediate injected, but anchored only to the pinned Amazon roots.
    assert.deepEqual(await verifySnsSigningCertificate(attacker.leafPem, { x509, certUrlHost: AF_HOST, intermediates: [attacker.intermediatePem] }), { ok: false, reason: 'issuer_not_anchored_to_amazon_root' }, leafDns)
  }
  // A self-signed CA presented as the leaf is rejected.
  const self = buildPki({ name: 'self' })
  assert.deepEqual(await verifySnsSigningCertificate(self.rootPem, { x509 }), { ok: false, reason: 'leaf_is_ca' })
})

test(`[${backend}] genuine expired 2021 SNS leaf fails closed`, async () => {
  const leaf = fixture('sns-amazonaws-com-2021-leaf.pem')
  assert.deepEqual(await verifySnsSigningCertificate(leaf, { x509 }), { ok: false, reason: 'leaf_not_valid_now' })
  // Inside its validity its issuer (Amazon Server CA 1B) is not a pinned intermediate.
  assert.deepEqual(await verifySnsSigningCertificate(leaf, { x509, now: new Date('2022-01-01T00:00:00Z') }), { ok: false, reason: 'leaf_not_signed_by_pinned_intermediate' })
})

test(`[${backend}] every structural rule fails closed with a named reason`, async () => {
  const cases = [
    ['not_issued_to_sns', buildPki({ name: 'san', leafDns: 'sns.evil.example' })],
    ['leaf_is_ca', buildPki({ name: 'leafca', leafIsCa: true })],
    ['leaf_not_signed_by_pinned_intermediate', buildPki({ name: 'intca', intermediateIsCa: false })],
  ]
  for (const [reason, pki] of cases) {
    assert.deepEqual(await verifySnsSigningCertificate(pki.leafPem, injected(pki)), { ok: false, reason }, reason)
  }
  const good = buildPki({ name: 'misc' })
  assert.deepEqual(await verifySnsSigningCertificate(good.leafPem + good.intermediatePem, injected(good)), { ok: false, reason: 'not_a_single_certificate' })
  assert.deepEqual(await verifySnsSigningCertificate(good.leafPem, { ...injected(good), now: new Date('2100-01-01T00:00:00Z') }), { ok: false, reason: 'leaf_not_valid_now' })
  assert.deepEqual(await verifySnsSigningCertificate(good.leafPem, { ...injected(good), now: new Date('2000-01-01T00:00:00Z') }), { ok: false, reason: 'leaf_not_valid_now' })
  assert.deepEqual(await verifySnsSigningCertificate('-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----', { x509 }), { ok: false, reason: 'unparseable_certificate' })
})

test('trust uses maintained X.509 implementations, not a hand-written parser; Edge uses the WebCrypto backend', () => {
  const trust = read('../supabase/functions/_shared/snsCertificateTrust.ts')
  assert.doesNotMatch(trust, /node:crypto|readTlv|0x30|0xa0/)
  assert.match(read('../supabase/functions/_shared/snsX509Node.ts'), /import \{ X509Certificate \} from 'node:crypto'/)
  assert.match(read('../supabase/functions/_shared/snsX509WebCrypto.ts'), /from 'npm:@peculiar\/x509@2\.1\.0'/)
  assert.match(read('../supabase/functions/website-enquiry-ses-events/index.ts'), /x509: webCryptoX509/)
})
