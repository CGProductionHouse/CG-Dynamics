import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('all automatic Git deployments remain disabled without changing SPA routing', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.git.deploymentEnabled, false);
  assert.deepEqual(config.rewrites, [{ source: '/(.*)', destination: '/index.html' }]);
});

test('source upload excludes generated output and local evidence, not app inputs', () => {
  const rules = readFileSync(new URL('../.vercelignore', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  assert.deepEqual(rules, ['dist', 'artifacts']);
});

test('agent and shared workflow entry points retain the mandatory budget policy', () => {
  for (const path of ['AGENTS.md', 'docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md',
    'docs/ai-workforce/AUTONOMOUS-CODING-ORCHESTRATION.md', 'docs/ops/CG-DYNAMICS-OPS-HANDOVER.md']) {
    assert.match(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), /HOSTING-BUDGET-AND-UPTIME-POLICY\.md/);
  }
});
