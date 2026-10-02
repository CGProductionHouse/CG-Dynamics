Public Amazon certificates used as trust fixtures (no secrets).

- `sns-amazonaws-com-2021-leaf.pem` — a genuine, expired (2021-09-07 → 2022-08-17) SNS signing
  certificate (`CN=sns.amazonaws.com`, issuer `Amazon Server CA 1B`), as embedded in the AWS
  SDK for Ruby message-verifier spec (`aws/aws-sdk-ruby`, gems/aws-sdk-sns/spec).
- `amazon-rsa-2048-m0{1..4}.pem` — current Amazon RSA 2048 M01–M04 intermediates, fetched from
  their AIA URLs `http://crt.r2m0N.amazontrust.com/r2m0N.cer`; each verifies against the pinned
  Amazon Root CA 1 (checked in tests). The same certificates are pinned in
  `supabase/functions/_shared/amazonSnsIntermediates.ts` (fingerprints asserted equal).
- `sns-af-south-1-2026-leaf.pem` — a genuine current af-south-1 SNS signing certificate
  (`CN=sns-signing.af-south-1.amazonaws.com`, SAN `sns-signing.af-south-1` + `sns.af-south-1`
  only, issuer Amazon RSA 2048 M01, valid 2026-07-25 → 2027-02-07), fetched from
  `https://sns.af-south-1.amazonaws.com/SimpleNotificationService-5416b31fae4efe3bce5b30212490f0b5.pem`.
  Proves regional leaves carry no `sns.amazonaws.com` SAN, so trust binds the regional name to the
  cert-URL host. Trusted end-to-end in tests on both X.509 backends (node:crypto and WebCrypto).
