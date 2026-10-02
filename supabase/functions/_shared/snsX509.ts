// Issue #405: the X.509 operations SNS certificate trust needs, behind one small interface.
//
// Two maintained implementations (no hand-written ASN.1):
// - snsX509Node.ts: `node:crypto` X509Certificate (OpenSSL) — Node and the Deno CLI.
// - snsX509WebCrypto.ts: `@peculiar/x509` over WebCrypto — the Supabase Edge runtime, whose
//   node:crypto X509Certificate leaves subjectAltName undefined and throws ERR_NOT_IMPLEMENTED for
//   infoAccess, raw, checkHost, checkIssued and verify.

export interface SnsCertificate {
  /** DNS names the certificate was issued to: SAN dNSName entries, else the single subject CN. */
  dnsNames: string[]
  subject: string
  issuer: string
  isCa: boolean
  isRsa: boolean
  notBefore: Date
  notAfter: Date
  /** SubjectPublicKeyInfo, DER. */
  spki: Uint8Array
  /** True when `issuer` names this certificate's issuer and its key verifies this certificate's signature. */
  isIssuedBy: (issuer: SnsCertificate) => Promise<boolean>
}

export interface X509Backend {
  /** Parses exactly one PEM certificate; null when it cannot be parsed. */
  parse: (pem: string) => Promise<SnsCertificate | null>
}
