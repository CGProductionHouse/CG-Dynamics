# Local Premiere diagnostics

See the [audit and pilot contract](../../docs/ops/CGPH-NOLAN-PREMIERE-INTEGRATION-AUDIT-2026-10-22.md). These tools do not install a bridge or create professional edits.

## File audit

Standard-library Python; inspect saved `.prproj`/FCP 7 `xmeml`, optionally copy a project without overwriting. Never rewrites Premiere internal XML. Trusted local inputs only. Reports contain private paths and must remain outside Git.

```powershell
python -B scripts/video-editing/audit_local_pipeline.py --project 'C:\private\original.prproj' --interchange 'C:\private\edit.xml' --builder 'C:\private\builder.py' --duplicate-project 'C:\private\pilot\new-copy.prproj' --private-output 'C:\private\audit-new.json'
```

Report and duplicate destinations must be new. Project copies share media: not independent backups. MOV/PNG suffix counts only locate possible title assets; inspect actual builder output before classifying them.

## Native discovery — not yet host-tested

`probe_premiere_readonly.cjs` exports an async function for an **approved Premiere UXP context**. Ordinary Node cannot supply `require('premierepro')`. This is not a manifest/plugin, MCP service or arbitrary-script endpoint.

Pass the exact duplicate path and optional known sequence GUID; identity changes abort. It reads effect match names and bounded component/keyframe metadata without media/transcript upload or mutations. Keep client-specific output private. Host-test before implementing mutations.

```javascript
const result = await probePremiereReadOnly(require('premierepro'), {
  expectedProjectPath: 'C:/private/pilot/new-copy.prproj',
  expectedSequenceGuid: 'previously-verified-sequence-guid'
});
```

## Tests

```powershell
python -B -m unittest discover -s scripts/video-editing -p test_audit_local_pipeline.py -v
node --test scripts/video-editing/probe_premiere_readonly.test.cjs
```

Node tests use mocks: passing guards/readback shapes are not Adobe runtime or edit-quality acceptance. No install/network dependency/client-media fixture is used.
