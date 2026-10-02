// Issue #405: X509Backend over `node:crypto` (OpenSSL in Node; Deno CLI). Not usable on the
// Supabase Edge runtime — see snsX509.ts.
import { X509Certificate } from 'node:crypto'
import type { SnsCertificate, X509Backend } from './snsX509.ts'

const certs = new WeakMap<SnsCertificate, X509Certificate>()

function dnsNames(cert: X509Certificate): string[] {
  const san = cert.subjectAltName
  if (typeof san === 'string' && san.length > 0) {
    return san.split(/,\s*/).filter((entry) => entry.startsWith('DNS:')).map((entry) => entry.slice(4))
  }
  const cn = cert.subject.split('\n').filter((part) => part.startsWith('CN=')).map((part) => part.slice(3))
  return cn.length === 1 ? cn : []
}

export const nodeX509: X509Backend = {
  parse: async (pem) => {
    let cert: X509Certificate
    try { cert = new X509Certificate(pem) } catch { return null }
    const parsed: SnsCertificate = {
      dnsNames: dnsNames(cert),
      subject: cert.subject,
      issuer: cert.issuer,
      isCa: cert.ca,
      isRsa: cert.publicKey.asymmetricKeyType === 'rsa',
      notBefore: new Date(cert.validFrom),
      notAfter: new Date(cert.validTo),
      spki: new Uint8Array(cert.publicKey.export({ type: 'spki', format: 'der' })),
      isIssuedBy: async (issuer) => {
        const parent = certs.get(issuer)
        return !!parent && cert.checkIssued(parent) && cert.verify(parent.publicKey)
      },
    }
    certs.set(parsed, cert)
    return parsed
  },
}
