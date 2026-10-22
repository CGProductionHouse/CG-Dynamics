# Local Premiere diagnostics

See the [audit and pilot contract](../../docs/ops/CGPH-NOLAN-PREMIERE-INTEGRATION-AUDIT-2026-10-22.md). These tools do not install a bridge or create professional edits.

## File audit

Standard-library Python; inspect saved `.prproj`/FCP 7 `xmeml`, optionally copy a project without overwriting. Never rewrites Premiere internal XML. Trusted local inputs only. Reports contain private paths and must remain outside Git.

```powershell
python -B scripts/video-editing/audit_local_pipeline.py --project 'C:\private\original.prproj' --interchange 'C:\private\edit.xml' --builder 'C:\private\builder.py' --duplicate-project 'C:\private\pilot\new-copy.prproj' --private-output 'C:\private\audit-new.json'
```

Report and duplicate destinations must be new. Project copies share media: not independent backups. MOV/PNG suffix counts only locate possible title assets; inspect actual builder output before classifying them.

Numeric generated-Graphic reference candidates are reported separately from missing disk files. They remain visible and require host/portability validation; internal XML is not an Adobe schema contract.

## Native discovery — bounded host test passed

`probe_premiere_readonly.cjs` exports an async function for an **approved Premiere UXP context**. Ordinary Node cannot supply `require('premierepro')`. This is not a manifest/plugin, MCP service or arbitrary-script endpoint.

Pass the exact duplicate path and optional known sequence GUID; identity changes abort. Local Windows extended-length paths are normalised, while UNC/device namespaces and parent traversal are refused. It reads effect match names and bounded component/keyframe metadata without media/transcript upload or mutations. Keep client-specific output private.

22 October host receipt: Premiere 26.3.2 / UDT 2.3.0.5, 106 installed effect names, bounded Motion/Opacity readback in 55ms host time. This is not an external MCP connection or a creative-quality benchmark. The diagnostic wrapper saved a private JSON receipt in its own UXP data sandbox.

Subsequent local duplicate-only native pilot demonstrated source-linked portrait 4K, effect/transform keys, title opacity, a transition, separate audio fades, save/reopen and actual 4K render/full decode. Text/font controls, exact colour and creative quality remain separate gates; see the audit. The optional availability flags explicitly distinguish missing advanced typed text constructors: Adobe's latest types contain **27.0 Beta** APIs, not all supported on 26.3.2. **Native action factories must run synchronously inside `lockedAccess`/`executeTransaction` callbacks.** Async discovery happens first; Action objects must not escape the lock/transaction. Do not apply this read-only function as though it were a production editing bridge.

```javascript
const result = await probePremiereReadOnly(require('premierepro'), {
  expectedProjectPath: 'C:/private/pilot/new-copy.prproj',
  expectedSequenceGuid: 'previously-verified-sequence-guid'
});
```

## Approved MCP repair candidate

`prepare_premiere_mcp_repairs.cjs` prepares a **new private copy** of the already-approved PremiereMCP 1.2.0 test source at commit `50f534b17639aafc615a10b38325957bf73e6515`. It validates the package, dependency lock and both patch-target hashes; changed/ambiguous anchors abort. Existing output is refused. It preserves the vendor pin, reuses its installed dependencies with a directory junction, and runs no installer, package download, security setting or Codex configuration change. Use trusted local source only. Build the new copy with its existing `npm run build` before testing.

The overlay uses time-aware parameter reads, a single formatted-timecode frame request, explicit native colour channels, and quarantines `close_project` **before** a host mutation. Native colour uses alpha **0/1**, RGB integer **0..255**; fractional alpha remains unaccepted. Readback mismatch is a failure with `mutated:true`, not permission to retry. Generic packed numeric colour writes are unsuitable for brand matching.

```powershell
node scripts/video-editing/prepare_premiere_mcp_repairs.cjs 'C:\private\approved-pinned-source' 'C:\private\new-repair-candidate'
# Build in that candidate, then execute regression fixtures against its generated scripts:
$env:NOLAN_MCP_REPAIR_ROOT='C:\private\new-repair-candidate'
node --test scripts/video-editing/premiere_mcp_repairs.test.cjs
```

Seven regression tests execute actual generated scripts against mocks, including stale sequence, invalid input, no static-getter fallback, no close side effect, exact colour and stale frame output. Without the private candidate, six host-script tests explicitly skip; that is **not a passing vendor acceptance run**. Live receipts remain separate. Formatted timecode corrected the old wrong-scene defect, but freshly modified AE graphics were absent from quick PNGs and present in full AME output: do not use frame export alone to approve graphics. See latest audit.

## Existing diagnostic tests

```powershell
python -B -m unittest discover -s scripts/video-editing -p test_audit_local_pipeline.py -v
node --test scripts/video-editing/probe_premiere_readonly.test.cjs
```

Node tests use mocks: passing guards/readback shapes are not Adobe runtime or edit-quality acceptance. No install/network dependency/client-media fixture is used.
