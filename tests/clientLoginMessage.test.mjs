import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync('src/lib/clientLoginMessage.ts', 'utf8')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { readClientLoginMessage, copyClientLoginMessage } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
const row = { client_id: 'client-a', client_name: 'Example Timber', username: 'exampletimber', provisioned: true, enabled: true }
const read = (data = [row], error = null) => async () => ({ data, error })

test('message contains the saved exact-client identity, login link and issued credential', async () => {
  const message = await readClientLoginMessage('client-a', read())
  assert.match(message, /Hi Example Timber,/)
  assert.match(message, /Login: https:\/\/www.cgdynamics.co.za\/login\nUsername: exampletimber\nPassword: exampletimber_cg\$/)
  assert.doesNotMatch(message, /client-a|client-b|proposed_username/)
})

test('missing, duplicate, disabled, unprovisioned and malformed mappings refuse to copy', async () => {
  for (const data of [[], [{ ...row, client_id: 'client-b' }], [row, row], [{ ...row, enabled: false }], [{ ...row, provisioned: false }], [{ ...row, username: null }], [{ ...row, username: 'unsafe\nname' }]]) {
    await assert.rejects(readClientLoginMessage('client-a', read(data)), /needs access setup/)
  }
  await assert.rejects(readClientLoginMessage('client-a', read([], new Error('private backend detail'))), /could not be checked/)
})

test('fresh exact-client selection never copies another client or an edited proposed username', async () => {
  const message = await readClientLoginMessage('client-a', read([{ ...row, client_id: 'client-b', username: 'differentclient' }, { ...row, proposed_username: 'unsavededit' }]))
  assert.match(message, /Username: exampletimber/)
  assert.doesNotMatch(message, /differentclient|unsavededit/)
})

test('iPhone clipboard starts before async access read finishes and returns real copied text', async () => {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const oldItem = globalThis.ClipboardItem
  let resolveRead
  let started = false
  let copied
  try {
    globalThis.ClipboardItem = class { constructor(items) { this.items = items } }
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { write: async items => {
      started = true
      const blob = await items[0].items['text/plain']
      copied = await blob.text()
    } } } })
    const pending = copyClientLoginMessage('client-a', () => new Promise(resolve => { resolveRead = resolve }))
    assert.equal(started, true)
    resolveRead({ data: [row], error: null })
    await pending
    assert.equal(copied, await readClientLoginMessage('client-a', read()))
    await assert.rejects(copyClientLoginMessage('client-a', read([], new Error('unavailable'))), /could not be checked/)
  } finally {
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator)
    else delete globalThis.navigator
    if (oldItem === undefined) delete globalThis.ClipboardItem
    else globalThis.ClipboardItem = oldItem
  }
})

test('copy is exposed on desktop/mobile cards and access rows, gated to admin and never resets', () => {
  const clients = readFileSync('src/pages/admin/ClientsList.tsx', 'utf8')
  const admin = readFileSync('src/pages/admin/ClientAccessAdmin.tsx', 'utf8')
  const button = readFileSync('src/components/clients/CopyClientLoginButton.tsx', 'utf8')
  assert.equal((clients.match(/isAdmin && <CopyClientLoginButton/g) ?? []).length, 2)
  assert.match(admin, /row.enabled && <CopyClientLoginButton/)
  assert.match(button, /profile\?\.role !== 'admin'/)
  assert.match(button, /role=\{failed \? 'alert' : 'status'\}/)
  assert.doesNotMatch(source + button, /resetClientPortalAccess|provisionClientPortalAccess|localStorage|sessionStorage|console\./)
})

test('text-only clipboard fallback copies the same message and propagates permission denial', async () => {
  const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const oldItem = globalThis.ClipboardItem
  try {
    delete globalThis.ClipboardItem
    let copied
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { copied = text } } } })
    await copyClientLoginMessage('client-a', read())
    assert.equal(copied, await readClientLoginMessage('client-a', read()))
    navigator.clipboard.writeText = async () => { throw new Error('Clipboard permission denied') }
    await assert.rejects(copyClientLoginMessage('client-a', read()), /Clipboard permission denied/)
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} })
    await assert.rejects(copyClientLoginMessage('client-a', read()), /Clipboard is unavailable/)
  } finally {
    if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator)
    else delete globalThis.navigator
    if (oldItem === undefined) delete globalThis.ClipboardItem
    else globalThis.ClipboardItem = oldItem
  }
})
