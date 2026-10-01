import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'

// Generator tests must never rewrite the frozen reviewed production evidence.
export function strategyArtifactSandbox(scripts) {
  const directory = mkdtempSync(join(tmpdir(), 'cg-strategy-tests-'))
  cpSync(resolve('artifacts/client-strategy-dossiers/issue-513'), directory, { recursive: true })
  process.once('exit', () => rmSync(directory, { recursive: true, force: true }))
  for (const script of scripts) {
    execFileSync(process.execPath, [`scripts/${script}.mjs`], {
      stdio: 'pipe', env: { ...process.env, CG_STRATEGY_ARTIFACT_DIR: directory },
    })
  }
  return filename => readFileSync(join(directory, filename), 'utf8')
}
