// Issue #405: X.509 trust for Amazon SNS signing certificates.
//
// AWS requires checking that the signing certificate is issued by Amazon SNS and that its
// chain of trust is valid (docs: sns-verify-signature-of-message). A URL on an SNS host is
// necessary but not sufficient. This module establishes trust with the platform's maintained
// X.509 implementation (`node:crypto` X509Certificate: OpenSSL in Node, Deno's built-in
// implementation on Supabase Edge) — no hand-written ASN.1 parsing.
//
// Accepted chain, exactly: leaf -> Amazon intermediate -> pinned Amazon Trust Services root.
// - leaf: single certificate, not a CA, SAN contains DNS:sns.amazonaws.com, RSA key,
//   currently valid, issued and signed by the intermediate;
// - intermediate: obtained only from the leaf's AIA "CA Issuers" URL on crt.*.amazontrust.com
//   (transport is irrelevant: it must chain to a pinned root), a CA, currently valid;
// - root: one of AMAZON_TRUST_ROOTS (fingerprint-pinned), currently valid.
// Any deviation fails closed with a named reason.

import { X509Certificate } from 'node:crypto'
import { AMAZON_TRUST_ROOTS } from './amazonTrustRoots.ts'

export const SNS_SIGNING_CERT_DNS = 'sns.amazonaws.com'
const TRUSTED_ISSUER_URL = /^https?:\/\/crt\.[a-z0-9]{1,32}\.amazontrust\.com\/[a-z0-9]{1,32}\.(cer|crt)$/

export type TrustResult = { ok: true; spki: Uint8Array } | { ok: false; reason: string }

export interface TrustDeps {
  /** Fetches the intermediate (DER or PEM) from an already-validated amazontrust.com URL. */
  fetchIssuer: (url: string) => Promise<Uint8Array>
  now?: Date
  /** Test seam only; production always uses the pinned Amazon roots. */
  roots?: ReadonlyArray<string>
}

const validAt = (cert: X509Certificate, now: Date) => {
  const from = Date.parse(cert.validFrom)
  const to = Date.parse(cert.validTo)
  return Number.isFinite(from) && Number.isFinite(to) && now.getTime() >= from && now.getTime() <= to
}

const sanDnsNames = (cert: X509Certificate) =>
  (cert.subjectAltName ?? '').split(/,\s*/).filter((entry) => entry.startsWith('DNS:')).map((entry) => entry.slice(4))

export function trustedIssuerUrls(cert: X509Certificate): string[] {
  return [...(cert.infoAccess ?? '').matchAll(/CA Issuers - URI:(\S+)/g)].map((match) => match[1]).filter((url) => TRUSTED_ISSUER_URL.test(url))
}

export async function verifySnsSigningCertificate(leafPem: string, deps: TrustDeps): Promise<TrustResult> {
  const now = deps.now ?? new Date()
  if ((leafPem.match(/-----BEGIN CERTIFICATE-----/g) ?? []).length !== 1) return { ok: false, reason: 'not_a_single_certificate' }

  let leaf: X509Certificate
  try { leaf = new X509Certificate(leafPem) } catch { return { ok: false, reason: 'unparseable_certificate' } }
  if (leaf.ca) return { ok: false, reason: 'leaf_is_ca' }
  if (!sanDnsNames(leaf).includes(SNS_SIGNING_CERT_DNS)) return { ok: false, reason: 'not_issued_to_sns' }
  if (leaf.publicKey.asymmetricKeyType !== 'rsa') return { ok: false, reason: 'unexpected_key_type' }
  if (!validAt(leaf, now)) return { ok: false, reason: 'leaf_not_valid_now' }

  const issuerUrl = trustedIssuerUrls(leaf)[0]
  if (!issuerUrl) return { ok: false, reason: 'untrusted_issuer_location' }
  let intermediate: X509Certificate
  try { intermediate = new X509Certificate(await deps.fetchIssuer(issuerUrl)) } catch { return { ok: false, reason: 'issuer_unavailable' } }
  if (!intermediate.ca) return { ok: false, reason: 'issuer_not_ca' }
  if (!validAt(intermediate, now)) return { ok: false, reason: 'issuer_not_valid_now' }
  if (!leaf.checkIssued(intermediate) || !leaf.verify(intermediate.publicKey)) return { ok: false, reason: 'leaf_not_signed_by_issuer' }

  const anchored = (deps.roots ?? AMAZON_TRUST_ROOTS.map((root) => root.pem)).some((pem) => {
    try {
      const root = new X509Certificate(pem)
      return root.ca && validAt(root, now) && intermediate.checkIssued(root) && intermediate.verify(root.publicKey)
    } catch {
      return false
    }
  })
  if (!anchored) return { ok: false, reason: 'issuer_not_anchored_to_amazon_root' }

  const spki = leaf.publicKey.export({ type: 'spki', format: 'der' })
  return { ok: true, spki: new Uint8Array(spki) }
}
