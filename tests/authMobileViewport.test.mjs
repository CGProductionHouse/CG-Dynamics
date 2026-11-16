import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import test from 'node:test'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../tailwind.config.js'

const require = createRequire(import.meta.url)
const read = path => readFileSync(path, 'utf8')
function load(path, dependencies = {}) {
  const code = ts.transpileModule(read(path), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => dependencies[name] ?? require(name) })
  return exports
}
const brand = load('src/components/BrandMark.tsx')
const authShell = load('src/components/AuthShell.tsx', { './BrandMark': brand })
const password = load('src/components/PasswordField.tsx')

test('actual login renders username and password inside the mobile-safe auth scope', () => {
  const { default: Login } = load('src/pages/Login.tsx', {
    '../contexts/AuthContext': { useAuth: () => ({ signIn: () => { throw new Error('No login in this render-only test') } }) },
    '../components/PasswordField': password,
    '../components/BrandMark': brand,
    '../components/AuthShell': authShell,
    '../lib/authErrors': { friendlyAuthError: () => '' },
    '../lib/oauthConsent': { isSafeOAuthReturnPath: () => false },
  })
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(Login)))
  assert.match(html, /<div data-auth-shell="true"/)
  assert.match(html, /<input[^>]*id="identifier"[^>]*autoComplete="username"/)
  assert.match(html, /<input[^>]*id="password"[^>]*type="password"[^>]*autoComplete="current-password"/)
  assert.match(html, /aria-label="Show password"/)
  const recovery = renderToStaticMarkup(React.createElement(authShell.default, { title: 'Reset password' }, React.createElement(password.default, { id: 'new-password', label: 'New password', value: '', onChange() {}, autoComplete: 'new-password' })))
  assert.match(recovery, /<div data-auth-shell="true"/)
  assert.match(recovery, /id="new-password"/)
})

test('compiled stylesheet overrides 14px auth fields at phone widths including password visibility mode', async () => {
  const css = await postcss([tailwindcss({ ...tailwindConfig, content: ['src/pages/Login.tsx', 'src/components/PasswordField.tsx'] })]).process(read('src/index.css'), { from: 'src/index.css' })
  let override
  css.root.walkRules(rule => { if (rule.selector.includes('[data-auth-shell] input')) override = rule })
  assert.ok(override)
  assert.equal(override.parent.name, 'media')
  assert.equal(override.parent.params, '(max-width: 767px)')
  assert.equal(override.nodes.find(node => node.prop === 'font-size')?.value, '16px')
  assert.match(override.selector, /input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\)/)
  assert.doesNotMatch(override.selector, /type='password'/, 'applies to both password and revealed text mode')
  assert.ok(css.css.indexOf('.text-sm') < css.css.indexOf('[data-auth-shell] input'), 'auth override follows utility sizing')
})

test('initial phone viewport fits device width without suppressing user zoom or scripting scale resets', () => {
  const html = read('index.html')
  assert.match(html, /name="viewport" content="width=device-width, initial-scale=1\.0"/)
  assert.doesNotMatch(html + read('src/pages/Login.tsx'), /user-scalable=no|maximum-scale=1|minimum-scale=1|visualViewport.*scale|document\.querySelector\(['"]meta\[name=/)
})
