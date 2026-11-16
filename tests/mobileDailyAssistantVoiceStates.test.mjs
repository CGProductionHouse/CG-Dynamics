import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

test('retired voice capture cannot mount from the shared shell or My Assistant', () => {
  assert.equal(existsSync('src/components/assistant/DailyAssistantCapture.tsx'), false)
  for (const path of ['src/pages/admin/AdminLayout.tsx', 'src/pages/admin/MyAssistantPage.tsx']) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /DailyAssistantCapture|applyDailyAssistantCapture/)
  }
})
