// Issue #405: X509Backend over `@peculiar/x509` (WebCrypto). Used on the Supabase Edge runtime,
// whose node:crypto X509Certificate cannot verify signatures or expose SANs — see snsX509.ts.
// @peculiar/x509 resolves its parsers via tsyringe, which needs the Reflect metadata polyfill first.
import 'npm:reflect-metadata@0.2.2'
import * as x509 from 'npm:@peculiar/x509@2.1.0'
import type { SnsCertificate, X509Backend } from './snsX509.ts'

x509.cryptoProvider.set(crypto)

const certs = new WeakMap<SnsCertificate, x509.X509Certificate>()

function dnsNames(cert: x509.X509Certificate): string[] {
  const san = cert.getExtension(x509.SubjectAlternativeNameExtension)
  if (san) return san.names.items.filter((name) => name.type === 'dns').map((name) => name.value)
  const cn = cert.subjectName.getField('CN')
  return cn.length === 1 ? cn : []
}

export const webCryptoX509: X509Backend = {
  parse: async (pem) => {
    let cert: x509.X509Certificate
    try { cert = new x509.X509Certificate(pem) } catch { return null }
    const parsed: SnsCertificate = {
      dnsNames: dnsNames(cert),
      subject: cert.subject,
      issuer: cert.issuer,
      isCa: cert.getExtension(x509.BasicConstraintsExtension)?.ca === true,
      isRsa: cert.publicKey.algorithm.name.startsWith('RSA'),
      notBefore: cert.notBefore,
      notAfter: cert.notAfter,
      spki: new Uint8Array(cert.publicKey.rawData),
      isIssuedBy: async (issuer) => {
        const parent = certs.get(issuer)
        if (!parent || cert.issuer !== parent.subject) return false
        try {
          return await cert.verify({ publicKey: parent.publicKey, signatureOnly: true })
        } catch {
          return false
        }
      },
    }
    certs.set(parsed, cert)
    return parsed
  },
}
