export const INSTAGRAM_TOKEN_ENCRYPTION_VERSION = 'instagram-token-aes-256-gcm-v1' as const

const AES_GCM_IV_BYTES = 12
const AES_256_KEY_BYTES = 32
const AES_GCM_TAG_BITS = 128
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PROVIDER_ID_PATTERN = /^\d+$/
const KEY_VERSION_PATTERN = /^v[1-9]\d{0,8}$/

export interface EncryptedInstagramToken {
  encryptionVersion: typeof INSTAGRAM_TOKEN_ENCRYPTION_VERSION
  keyVersion: string
  ivBase64: string
  ciphertextBase64: string
}

export interface InstagramTokenEncryptionContext {
  clientId: string
  instagramAccountId: string
  keyVersion: string
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value || value.trim() !== value) {
    throw new Error(`Instagram token ${label} is invalid.`)
  }
  return value
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function strictBase64ToBytes(value: unknown, label: string): Uint8Array {
  const encoded = requiredString(value, label)
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error(`Instagram token ${label} must be canonical RFC 4648 base64.`)
  }

  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
  } catch {
    throw new Error(`Instagram token ${label} must be canonical RFC 4648 base64.`)
  }
  if (bytesToBase64(bytes) !== encoded) {
    throw new Error(`Instagram token ${label} must be canonical RFC 4648 base64.`)
  }
  return bytes
}

export function decodeInstagramTokenEncryptionKey(keyBase64: unknown): Uint8Array {
  const key = strictBase64ToBytes(keyBase64, 'encryption key')
  if (key.byteLength !== AES_256_KEY_BYTES) {
    throw new Error('Instagram token encryption key must decode to exactly 32 bytes.')
  }
  return key
}

function validateContext(context: InstagramTokenEncryptionContext): InstagramTokenEncryptionContext {
  const clientId = requiredString(context?.clientId, 'client ID').toLowerCase()
  const instagramAccountId = requiredString(context?.instagramAccountId, 'account ID')
  const keyVersion = requiredString(context?.keyVersion, 'key version')
  if (!UUID_PATTERN.test(clientId)) throw new Error('Instagram token client ID is invalid.')
  if (!PROVIDER_ID_PATTERN.test(instagramAccountId)) throw new Error('Instagram token account ID is invalid.')
  if (!KEY_VERSION_PATTERN.test(keyVersion)) throw new Error('Instagram token key version is invalid.')
  return { clientId, instagramAccountId, keyVersion }
}

export function buildInstagramTokenAdditionalData(context: InstagramTokenEncryptionContext): Uint8Array {
  const checked = validateContext(context)
  return new TextEncoder().encode([
    'cg-dynamics',
    INSTAGRAM_TOKEN_ENCRYPTION_VERSION,
    checked.keyVersion,
    checked.clientId,
    checked.instagramAccountId,
  ].join('|'))
}

async function importAesKey(keyBase64: unknown): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    decodeInstagramTokenEncryptionKey(keyBase64),
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptInstagramAccessToken(input: {
  accessToken: unknown
  keyBase64: unknown
  context: InstagramTokenEncryptionContext
}): Promise<EncryptedInstagramToken> {
  const accessToken = requiredString(input.accessToken, 'access token')
  const context = validateContext(input.context)
  const key = await importAesKey(input.keyBase64)
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv,
    additionalData: buildInstagramTokenAdditionalData(context),
    tagLength: AES_GCM_TAG_BITS,
  }, key, new TextEncoder().encode(accessToken)))

  return {
    encryptionVersion: INSTAGRAM_TOKEN_ENCRYPTION_VERSION,
    keyVersion: context.keyVersion,
    ivBase64: bytesToBase64(iv),
    ciphertextBase64: bytesToBase64(ciphertext),
  }
}

export async function decryptInstagramAccessToken(input: {
  encrypted: EncryptedInstagramToken
  keyBase64: unknown
  context: InstagramTokenEncryptionContext
}): Promise<string> {
  const encrypted = input.encrypted
  if (!encrypted || encrypted.encryptionVersion !== INSTAGRAM_TOKEN_ENCRYPTION_VERSION) {
    throw new Error('Instagram token encryption version is unsupported.')
  }
  const context = validateContext(input.context)
  if (encrypted.keyVersion !== context.keyVersion) {
    throw new Error('Instagram token key version does not match the decryption context.')
  }
  const iv = strictBase64ToBytes(encrypted.ivBase64, 'IV')
  if (iv.byteLength !== AES_GCM_IV_BYTES) throw new Error('Instagram token IV must decode to exactly 12 bytes.')
  const ciphertext = strictBase64ToBytes(encrypted.ciphertextBase64, 'ciphertext')
  if (ciphertext.byteLength <= AES_GCM_TAG_BITS / 8) {
    throw new Error('Instagram token ciphertext is invalid.')
  }

  try {
    const plaintext = await crypto.subtle.decrypt({
      name: 'AES-GCM',
      iv,
      additionalData: buildInstagramTokenAdditionalData(context),
      tagLength: AES_GCM_TAG_BITS,
    }, await importAesKey(input.keyBase64), ciphertext)
    const token = new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
    return requiredString(token, 'decrypted access token')
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Instagram token ')) throw error
    throw new Error('Instagram token ciphertext could not be authenticated.', { cause: error })
  }
}
