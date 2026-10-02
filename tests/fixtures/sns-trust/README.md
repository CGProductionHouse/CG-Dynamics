Public Amazon certificates used as **negative/anchoring fixtures only** (no secrets).

- `sns-amazonaws-com-2021-leaf.pem` — a genuine, expired (2021-09-07 → 2022-08-17) SNS signing
  certificate (`CN=sns.amazonaws.com`, issuer `Amazon Server CA 1B`), as embedded in the AWS
  SDK for Ruby message-verifier spec (`aws/aws-sdk-ruby`, gems/aws-sdk-sns/spec).
- `amazon-rsa-2048-m0{1..4}.pem` — current Amazon RSA 2048 M01–M04 intermediates, fetched from
  their AIA URLs `http://crt.r2m0N.amazontrust.com/r2m0N.cer`; each verifies against the pinned
  Amazon Root CA 1 (checked in tests).
