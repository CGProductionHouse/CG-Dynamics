# Isolated premiere-pro-mcp 1.24.3 acceptance — 22 October 2026

Owner explicitly approved this isolated install/test after the readiness run. Continue #856/#862; no replacement of the working DutchErwin CEP bridge and no #859 craft edits. This is the separately maintained **leancoderkavy** project, not an upgrade of the already-approved DutchErwin pin.

## Provenance and installation

- [Tag v1.24.3](https://github.com/leancoderkavy/premiere-pro-mcp/releases/tag/v1.24.3), resolved commit **`d07ca155ba6c99c006d0e55738b6db4a0aa59508`**, MIT source licence. Downloaded source ZIP SHA-256 **`9cb714f6981dc454012369b25232c0855682352fb5b8d48ce2fbc81ef64cb079`**. Original vendor source remains unpatched.
- Reviewed package/build/manifest/transport/telemetry and CCX packing sources. `npm ci --ignore-scripts --no-audit --no-fund` installed 198 packages privately; upstream `npm run build` passed. These are local test dependencies, not CG Dynamics production dependencies.
- Built the vendor's deterministic direct CCX: SHA-256 **`f84724df8cf77bf880dd8566dc4995491f1520d36e17bccaa5d7a4a62ce56402`**. Used existing Adobe UPIA `/install <path>`, not the vendor's CEP installer. Adobe `/list all` reports **MCP for Adobe Premiere Pro 1.24.3 Enabled**, plus existing OpenCurve 2.0.0, for Premiere 25.6.6 and 26.3.2. **Only 26.3.2 was actually tested.**
- UDT manifest registration did not complete and its window went blank. Normal close/relaunch left stale background helpers; only verified UDT processes were stopped. No Premiere termination or reinstall. A direct CCX attempt then failed **−644**, with Creative Cloud's missing/damaged message. **A normal Creative Cloud launch restored its dashboard and the next UPIA attempt succeeded. No Repair/reinstall action ran.** Adobe documents −644 as internal communication failure; do not interpret the first launcher dialog as proof reinstall is required. [Adobe installation](https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/install/), [Adobe error guidance](https://helpx.adobe.com/ca/creative-cloud/apps/troubleshoot/plugin-installation-issues/plugin-installation-errors-using-exman-or-upia.html).

## Security and isolation actually used

The [manifest](https://github.com/leancoderkavy/premiere-pro-mcp/blob/v1.24.3/uxp-plugin/manifest.json) retains requested folder access and network domains `all`. That permission was disclosed before approval; configuring loopback does not narrow the manifest itself. The inspected panel validates loopback URLs; actual listener readback was **127.0.0.1:7789**, authenticated with a random 32-byte secret. No LAN/WAN binding or client-media upload operation was executed; packet-level network auditing was not performed.

PostHog activates only when its API key is supplied. The isolated launcher explicitly excludes every `POSTHOG_` variable. Token values are never printed/committed; the credential was moved into the verified private queue. The panel also persists its local session credential in its own Adobe storage. Do not copy that user credential as a staff deployment method.

Initial upstream tests: **149 passed /13 failed**, all 13 in transport setup because the inherited Windows temp ancestry permitted other identities to replace contents. Do not disable this guard. A fresh root queue also exposed an unnecessary owner-setting privilege failure in vendor initialisation. Prepared **two new, empty, owner-checked task folders only**, retaining their owner and restricting inherited ACLs to the current user, SYSTEM and Administrators. No existing user folder, global Windows setting, developer/security preference or production bridge ACL was changed. Vendor's unchanged private-directory checker then accepted both folders. With that private scratch root as TEMP/TMP, the same five suites passed **162/162**. This is an environment fix, not a patched vendor security check or evidence all 530 tools work.

Existing working CEP panel SHA-256 remains **`ef788ed1b1f67bc55e44c9870a36d5cca9743676b762ce314f15d017a4a52b4a`**. Existing Codex entry still targets v4 with all 19 selected tools. No new default Codex server entry was added. Actual tests used a bounded standard MCP stdio client; this is **not hot attachment of 530 tools to the current chat**. A thin private launcher is prepared for reuse; no custom editor or new host-script endpoint was built.

## Live host results

Actual UXP protocol 2 handshake succeeded; 169 commands advertised supported at that moment, separate from 530 MCP tools listed. Advertised support is not acceptance. All writes were serialised and preceded by exact duplicate project/sequence checks. The new UXP server's own parameter/effect tools do not inherit the old CEP opt-in lease, and its separate queue does not provide a shared write lock with that old bridge. **Never run the two writers concurrently.** This was a protected duplicate experiment, not a universal sandbox.

| Test | Verified result | Remaining boundary |
| --- | --- | --- |
| Stable project identity | `inspect_project_uxp` returns correct string project/sequence GUIDs and exact duplicate path | Compact `get_uxp_state` serialises its GUID objects as `{}` on this host; do not use those fields as mutation authority |
| Clone | Native clone of practice sequence, new GUID **`bc1233c8-54da-49e5-9636-0fda28d432f0`**, collection identity readback | First request supplied an action-incompatible optional field; refused before dispatch, then corrected. Source sequence and working client project preserved |
| Activate/open | Subsequent project snapshot confirms clone active; explicit `open` synchronises visible timeline/Program Monitor | Tool itself returns `committed_unverified`/host-return evidence; activation alone did not open the visible tab |
| Effect insertion | Real `AE.ADBE Gaussian Blur 2` appended 3→4 components; separate catalog identifies Gaussian Blur (Legacy)/Blurriness | Insertion receipt's main proof is chain count; exact match name/catalog and render were checked separately |
| Native keyframes | Two native Blurriness keys at source 4.52/4.88s; independent UXP samples **24/12/0 at 4.52/4.70/4.88s**; preserved CEP returns the same three scalar samples | Upstream timed read returns `{value:number}` without unwrapping it, then compares that object to the requested scalar. Writes report **`committed_unverified`**. They were not replayed; independent postconditions were checked. Keep the vendor receipt unchanged |
| AE title text | New UXP timed Title read fails with unsupported-value-type error; static read returns null | Not accepted through this route. Preserved CEP changed the clone's exposed Title to **PLAY ON.**, read it back and saved; original practice title remains TEE OFF. |
| Transition | Catalog lists 118 match names | `inspect_video_transition_uxp` refuses because `VideoClipTrackItem.hasVideoTransition` is unavailable on its resolved clip. No new transition mutation attempted. Earlier finite native UXP add-action proof remains valid; this is a connector-route limitation, not absence of Premiere transitions |
| Native save | Explicit project GUID + exact native path; save receipt succeeded, saved duplicate remains nonempty | Tool boundary is path/host readback; separate saved-file and render checks followed. No project reopen/cold-host claim |
| New UXP encode/import/frame paths | Not exercised | Requires operator-granted workspace. No folder-consent prompt was bypassed; verified old CEP was deliberately used for render instead |
| Server reconnect | Server stopped/restarted; panel reconnected without another Connect click; direct project/keyframe reads succeeded | One separate harness guard request timed out 60s; cause not isolated. No post-restart write/replay. This does not certify cold Premiere recovery or every reconnect scenario |

Native call timings, orchestration included: clone 859ms; add effect 815ms; key writes 779/793ms; typical parameter samples 385–404ms; save 3.301s. Existing CEP independent title/samples/save/export-queue run took about 18.3s before shutdown; export queue acceptance is not completion. Setup, permissions, dependency download, failed Adobe startup, review and all recovery time are separate and substantial. No matched GUI speedup or 20-minute whole-edit claim.

## Actual output evidence

Private proof **`Emoya_1243_Native_Animation_4K_20261022.mp4`**:

- **2160×3840 /25fps /300 frames /12.000s**, H.264/AAC, **99,629,908 bytes**.
- SHA-256 **`453747efefae1e1067dfc0786e304139da247a77d31136d1564a37205ae3b48b`**.
- Complete video/audio decode exit0; no black segments at `d=.03,pix_th=.08`.
- Inspected actual 4.2s output frame: fresh **PLAY ON.** title visible. Side-by-side 0.04s frames show the added native blur against the prior sharp render. This proves visible effect/title output, not aesthetic approval.
- Audio measured **−19.0LUFS integrated /−4.6dBTP**. Full-motion playback, listening, phone and second-device acceptance remain **unverified**. This is still a 12s technical practice section, not a final client deliverable.

Original working Emoya project SHA-256 rechecked unchanged: **`a9c6a4be99d07ea40cbc4d07e26aba88a79f331645e268e629492a32c06b661b`**. Protected project backup, original practice sequence, source files and earlier exports retained. Private reports, credentials and media are excluded from Git.

## Reuse decision

**Limited GO:** installed 1.24.3 is useful alongside the preserved bridge for native effect insertion, catalog discovery, keyframe creation with explicit independent value/time checks, clone and save. Prefer `inspect_project_uxp` for identities. Exposed AE text and actual render stay on the proven CEP route. New connector is **not promoted as default/all-tools acceptance**.

Keep direct native ramps, Optical Flow, tracked masks, typed AE text through this UXP surface, guarded transition use, operator workspace access, cold recovery and staff portability as separate open gates. Next focused engineering improvement is a regression-backed scalar Keyframe-wrapper readback fix; do not relabel the unmodified vendor's false-unverified result as verified. Only then consider a narrowly selected persistent Codex entry, preserving the existing 19 tools.

At handoff the isolated listener is stopped and test panel closed; plugin remains installed. Existing CEP remains connected to the saved protected clone under its expiring lease. Existing 31 focused tests pass with zero skips; local Dynamics TypeScript/Vite build passes with its existing chunk warning. No pending old-bridge commands, new production dependencies, migration/data, RLS/role, Microsoft, merge or deployment action. Continue #862; #859 untouched. Exact Google Control Centre target remains unavailable, so no guessed tracker write.
