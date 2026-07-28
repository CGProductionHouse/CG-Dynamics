import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(
  new URL('../src/components/PlannerPeoplePicker.tsx', import.meta.url),
  'utf8',
)

test('exports the reusable person contract, controlled picker, and card avatars', () => {
  assert.match(source, /export type PlannerPerson/)
  assert.match(source, /id: string[\s\S]*full_name: string[\s\S]*role: string[\s\S]*avatar_url\?: string \| null[\s\S]*is_active: boolean/)
  assert.match(source, /value: string\[\][\s\S]*onChange: \(personIds: string\[\]\) => void/)
  assert.match(source, /export function PlannerPeoplePicker/)
  assert.match(source, /export function PlannerAssigneeAvatars/)
})

test('searches only active people by full name and never commits arbitrary text', () => {
  assert.match(source, /person\.is_active[\s\S]*person\.full_name\.toLowerCase\(\)\.includes\(normalizedQuery\)/)
  assert.match(source, /onChange\(value\.includes\(person\.id\)/)
  assert.doesNotMatch(source, /onChange\(event\.target\.value\)/)
  assert.match(source, /No matching active people/)
})

test('renders identity context with image and initials fallback', () => {
  assert.match(source, /function initials/)
  assert.match(source, /person\.avatar_url[\s\S]*<img[\s\S]*onError/)
  assert.match(source, /person\.full_name[\s\S]*person\.role/)
  assert.match(source, /title=\{`\$\{person\.full_name\}, \$\{person\.role\}/)
})

test('supports multiple quick selection and selected-person removal', () => {
  assert.match(source, /\[\.\.\.value, person\.id\]/)
  assert.match(source, /value\.filter\(personId => personId !== person\.id\)/)
  assert.match(source, /aria-selected=\{selected\}/)
  assert.match(source, /\{selected \? 'Remove' : 'Add'\}/)
  assert.match(source, /aria-label=\{`Remove \$\{person\.full_name\}`\}/)
})

test('shows unassigned and preserves inactive current assignees without selectable inactive options', () => {
  assert.match(source, /selectedPeople\.length === 0[\s\S]*Unassigned/)
  assert.match(source, /!person\.is_active[\s\S]*Inactive/)
  assert.match(source, /const options = people\.filter\(person => \([\s\S]*person\.is_active/)
  assert.match(source, /if \(locked \|\| !person\.is_active\) return/)
})

test('implements combobox and multiselect listbox accessibility', () => {
  assert.match(source, /role="combobox"/)
  assert.match(source, /aria-autocomplete="list"/)
  assert.match(source, /aria-expanded=\{open\}/)
  assert.match(source, /aria-controls=\{listboxId\}/)
  assert.match(source, /aria-activedescendant=/)
  assert.match(source, /role="listbox"/)
  assert.match(source, /aria-multiselectable="true"/)
  assert.match(source, /role="option"/)
})

test('supports full keyboard navigation without free-form entry', () => {
  assert.match(source, /event\.key === 'ArrowDown' \|\| event\.key === 'ArrowUp'/)
  assert.match(source, /event\.key === 'Enter'/)
  assert.match(source, /event\.key === 'Escape'/)
  assert.match(source, /event\.preventDefault\(\)/)
  assert.match(source, /toggle\(highlightedPerson\)/)
  assert.match(source, /useState\(-1\)/)
  assert.match(source, /current === -1[\s\S]*event\.key === 'ArrowDown' \? 0 : options\.length - 1/)
  assert.match(source, /event\.stopPropagation\(\)[\s\S]*setOpen\(false\)/)
  assert.match(source, /event\.key === 'Enter' && open && highlightedPerson/)
})

test('provides disabled and read-only modes with mobile touch targets', () => {
  assert.match(source, /const locked = disabled \|\| readOnly/)
  assert.match(source, /disabled=\{disabled\}/)
  assert.match(source, /!readOnly/)
  assert.match(source, /min-h-11/)
  assert.match(source, /min-h-12/)
  assert.match(source, /h-8 w-8/)
})

test('compact avatars expose names, unassigned state, and labelled +N overflow', () => {
  assert.match(source, /maxVisible = 3/)
  assert.match(source, /people\.slice\(0, Math\.max\(0, maxVisible\)\)/)
  assert.match(source, /people\.length - visible\.length/)
  assert.match(source, /aria-label=\{`Assigned to \$\{names\}`\}/)
  assert.match(source, /aria-label=\{`\$\{overflow\} more assignee/)
  assert.match(source, /\+\{overflow\}/)
  assert.match(source, /people\.length === 0[\s\S]*Unassigned/)
})
