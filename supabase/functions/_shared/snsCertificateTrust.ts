// Issue #405: X.509 trust for Amazon SNS signing certificates.
//
// AWS requires checking that the signing certificate is issued by Amazon SNS and that its
// chain of trust is valid (docs: sns-verify-signature-of-message). A URL on an SNS host is
// necessary but not sufficient. X.509 parsing and signature checks come from a maintained
// implementation behind X509Backend (snsX509.ts) — no hand-written ASN.1 parsing.
//
// Accepted chain, exactly: leaf -> pinned Amazon RSA 2048 intermediate -> pinned Amazon root.
// - leaf: single certificate, not a CA, RSA key, currently valid, issued to SNS: its DNS names
//   (SAN, else the single subject CN) include sns.amazonaws.com, or — only for the regional SNS
//   host the certificate was fetched from (sns.<region>.amazonaws.com) — that host or
//   sns-signing.<region>.amazonaws.com (af-south-1 leaves carry only these two names);
// - intermediate: one of AMAZON_SNS_INTERMEDIATES (fingerprint-pinned), a CA, currently valid,
//   naming and signing the leaf. Pinned rather than fetched from the leaf's AIA URL: the Edge
//   runtime cannot read AIA, and a fixed set is narrower than any amazontrust.com issuer;
// - root: one of AMAZON_TRUST_ROOTS (fingerprint-pinned), a CA, currently valid, naming and
//   signing the intermediate.
// Any deviation fails closed with a named reason.

import { AMAZON_SNS_INTERMEDIATES } from './amazonSnsIntermediates.ts'
import { AMAZON_TRUST_ROOTS } from './amazonTrustRoots.ts'
import type { SnsCertificate, X509Backend } from './snsX509.ts'

export const SNS_SIGNING_CERT_DNS = 'sns.amazonaws.com'
const REGIONAL_SNS_HOST = /^sns\.([a-z]{2}(-[a-z]+)+-\d)\.amazonaws\.com$/

export type TrustResult = { ok: true; spki: Uint8Array } | { ok: false; reason: string }

export interface TrustDeps {
  x509: X509Backend
  /** Host of the (already validated) SigningCertURL; binds a regional leaf to its own region. */
  certUrlHost?: string
  now?: Date
  /** Test seams only; production always uses the pinned Amazon intermediates and roots. */
  intermediates?: ReadonlyArray<string>
  roots?: ReadonlyArray<string>
}

export function acceptedSnsNames(certUrlHost?: string): string[] {
  const region = certUrlHost?.match(REGIONAL_SNS_HOST)?.[1]
  return region ? [SNS_SIGNING_CERT_DNS, `sns.${region}.amazonaws.com`, `sns-signing.${region}.amazonaws.com`] : [SNS_SIGNING_CERT_DNS]
}

const validAt = (cert: SnsCertificate, now: Date) =>
  Number.isFinite(cert.notBefore.getTime()) && Number.isFinite(cert.notAfter.getTime()) &&
  now.getTime() >= cert.notBefore.getTime() && now.getTime() <= cert.notAfter.getTime()

async function firstIssuer(child: SnsCertificate, pems: ReadonlyArray<string>, deps: TrustDeps, now: Date) {
  for (const pem of pems) {
    const candidate = await deps.x509.parse(pem)
    if (candidate && candidate.isCa && validAt(candidate, now) && await child.isIssuedBy(candidate)) return candidate
  }
  return null
}

export async function verifySnsSigningCertificate(leafPem: string, deps: TrustDeps): Promise<TrustResult> {
  const now = deps.now ?? new Date()
  if ((leafPem.match(/-----BEGIN CERTIFICATE-----/g) ?? []).length !== 1) return { ok: false, reason: 'not_a_single_certificate' }

  const leaf = await deps.x509.parse(leafPem)
  if (!leaf) return { ok: false, reason: 'unparseable_certificate' }
  if (leaf.isCa) return { ok: false, reason: 'leaf_is_ca' }
  const accepted = acceptedSnsNames(deps.certUrlHost)
  if (!leaf.dnsNames.some((name) => accepted.includes(name))) return { ok: false, reason: 'not_issued_to_sns' }
  if (!leaf.isRsa) return { ok: false, reason: 'unexpected_key_type' }
  if (!validAt(leaf, now)) return { ok: false, reason: 'leaf_not_valid_now' }

  const intermediate = await firstIssuer(leaf, deps.intermediates ?? AMAZON_SNS_INTERMEDIATES.map((cert) => cert.pem), deps, now)
  if (!intermediate) return { ok: false, reason: 'leaf_not_signed_by_pinned_intermediate' }
  const root = await firstIssuer(intermediate, deps.roots ?? AMAZON_TRUST_ROOTS.map((cert) => cert.pem), deps, now)
  if (!root) return { ok: false, reason: 'issuer_not_anchored_to_amazon_root' }

  return { ok: true, spki: leaf.spki }
}
