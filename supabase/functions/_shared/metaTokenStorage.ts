// Server-only envelope in the existing text column. Deploy ALL readers before
// enabling the writer; old readers would send this envelope to Meta as a token.
const PREFIX = 'cg-meta-token:'
const VERSION = 'v1'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const KEY_VERSION = /^v[1-9]\d{0,8}$/
const STORAGE_ERROR = 'Meta credential storage is unavailable. Contact an administrator.'

function fail(): never { throw new Error(STORAGE_ERROR) }
function encode(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
}
function decode(value: unknown): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !value || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail()
  try {
    const bytes = Uint8Array.from(atob(value), character => character.charCodeAt(0))
    if (encode(bytes) !== value) fail()
    return bytes
  } catch { fail() }
}
function token(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 16_384 || /\s/.test(value)) fail()
  return value
}
function context(connectionId: unknown, keyVersion: unknown): Uint8Array<ArrayBuffer> {
  if (typeof connectionId !== 'string' || !UUID.test(connectionId) ||
      typeof keyVersion !== 'string' || !KEY_VERSION.test(keyVersion)) fail()
  return new TextEncoder().encode(`cg-dynamics|meta-token|${VERSION}|${keyVersion}|${connectionId.toLowerCase()}`)
}
async function key(keyBase64: unknown): Promise<CryptoKey> {
  const raw = decode(keyBase64)
  if (raw.length !== 32) fail()
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function validateMetaTokenEncryptionConfig(keyBase64: unknown, keyVersion: unknown): Promise<void> {
  try {
    if (typeof keyVersion !== 'string' || !KEY_VERSION.test(keyVersion)) fail()
    await key(keyBase64)
  } catch { fail() }
}

export async function encryptMetaStoredToken(accessToken: unknown, connectionId: unknown, keyBase64: unknown, keyVersion: unknown): Promise<string> {
  try {
    const plaintext = token(accessToken)
    // No nested envelope, plaintext fallback or inference that a configured key
    // means existing rows have already been encrypted.
    if (plaintext.startsWith(PREFIX)) fail()
    const additionalData = context(connectionId, keyVersion)
    const secretKey = await key(keyBase64)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData, tagLength: 128 }, secretKey, new TextEncoder().encode(plaintext),
    ))
    return `${PREFIX}${VERSION}:${JSON.stringify({ keyVersion, iv: encode(iv), ciphertext: encode(ciphertext) })}`
  } catch { fail() }
}

export async function readMetaStoredToken(stored: unknown, connectionId: unknown, keyBase64: unknown, keyVersion: unknown): Promise<{ accessToken: string; encryptedAtRest: boolean }> {
  try {
    if (typeof stored !== 'string' || !stored || stored.length > 32_768) fail()
    if (!stored.startsWith(PREFIX)) return { accessToken: token(stored), encryptedAtRest: false }
    if (!stored.startsWith(`${PREFIX}${VERSION}:`)) fail()
    const envelope: unknown = JSON.parse(stored.slice(`${PREFIX}${VERSION}:`.length))
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) fail()
    const data = envelope as Record<string, unknown>
    if (data.keyVersion !== keyVersion) fail()
    const additionalData = context(connectionId, keyVersion)
    const iv = decode(data.iv)
    const ciphertext = decode(data.ciphertext)
    if (iv.length !== 12 || ciphertext.length <= 16) fail()
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData, tagLength: 128 }, await key(keyBase64), ciphertext,
    )
    const accessToken = token(new TextDecoder('utf-8', { fatal: true }).decode(plaintext))
    if (accessToken.startsWith(PREFIX)) fail()
    return { accessToken, encryptedAtRest: true }
  } catch { fail() }
}
