# Nolan — Premiere integration audit, 22 October 2026

**Lane:** [#856](https://github.com/CGProductionHouse/CG-Dynamics/issues/856), continuing [PR #862](https://github.com/CGProductionHouse/CG-Dynamics/pull/862). [PR #859](https://github.com/CGProductionHouse/CG-Dynamics/pull/859) owns craft skills and remains untouched. Authority: [latest owner instruction](https://github.com/CGProductionHouse/CG-Dynamics/issues/856#issuecomment-6334616955), AGENTS.md and the [4K game plan](CGPH-NOLAN-AUTONOMOUS-4K-EDITING-GAME-PLAN-2026-10-21.md).

**Status:** approved duplicate-only native UXP/CEP technical execution; **time-readback repair and editable AE font/size/exact RGB now demonstrated**, with actual 4K render. Automatic lifecycle, new-graphic frame-capture readiness, full advanced-tool coverage, creative quality and second-device acceptance remain open. No purchase, client upload, production data change, merge or deployment. This is not the final Emoya creative.

## Latest continuation — repaired candidate and stable-host typography

This supersedes earlier claims below that no vendor patches exist or that every installed AE template locks typography. The original approved vendor pin remains untouched. A **separate local repair candidate** (`nolan-repairs-v3`) reuses its existing dependencies without another package download. Reproducible preparation and generated-script regression fixtures are in `scripts/video-editing/`. Package/lock/patch-target hashes and unique anchors gate preparation; existing output is refused. Subsequently, the owner separately approved and we installed the free OpenCurve marketplace plugin; its actual test is recorded below.

### Verified in actual Premiere 26.3.2

- Human restarted the disconnected panel once. Fresh MCP identity confirms the saved duplicate/sequence; the original working Emoya project SHA-256 remains `a9c6a4be99d07ea40cbc4d07e26aba88a79f331645e268e629492a32c06b661b`.
- **Time-aware read repaired:** `get_value_at_time` now resolves the explicit property and calls `getValueAtTime(Time)`, refusing invalid time. First native Scale returns **100 / 102 / 104 at source 0 / 2 / 4s**. Final repaired-candidate read returns 102 at 2s. This is tested source-time behaviour, not an inferred timeline-time conversion for trimmed/retimed media.
- **Wrong-scene frame cause addressed:** numeric-seconds probing was replaced with a single `Time.getFormatted()` timecode using sequence timebase/display format. The 11s PNG now visibly contains the correct second shot and prior title, matching the full-render composition (SSIM against its compressed reference 0.964694, **not pixel equality or frame-accurate certification**). Stale files cannot count as fresh output; nonzero sequence start and unsupported displays fail closed. **Remaining defect:** quick PNGs of a newly changed AE graphic omitted it while full AME renders contained it. Frame capture remains excluded from the normal selected tools until readiness is reliable; actual renders remain QA authority.
- **Close fails safely before mutation:** the patched `close_project` returns an explicit quarantine error with `mutated:false`. Live follow-up identity succeeds; project/panel stay open, no orphan command remains. This prevents the reproduced failure; it **does not implement reliable automatic close/reopen**.
- Scanned metadata of **77 installed MOGRTs**, including 17 AE templates. Unlike Sports Lower Third Center, installed **Sports Graphic Overlay** exposes both font and size. Imported that existing Adobe asset into the duplicate, changed the actual AE Title JSON to **Arial-BoldMT / 32 / NEXT ROUND**, preserved style-run shape, and read back all three values. Existing `arialbd.ttf` verified; no font download, Beta or After Effects install. Initial 15-character/48pt copy overflowed the template's fixed text box; shorter 10-character/32pt copy fits. Template selection must check layout limits as well as editable flags.
- **Exact RGB repaired through native colour API:** use `getColorValue`/`setColorValue`, not a packed 64-bit number passed through JavaScript. Main colour requested/read **15,46,28**; title **255,255,255**; highlight **223,187,76**. Host's existing opaque alpha is **1**, not 255. Initial alpha-255 trial was corrected; final overlay accepts native alpha 0/1 and refuses unsupported fractional alpha. Readback mismatch fails with `mutated:true`, preventing false success/blind retries. This proves the explicit CEP colour route, not a fix to the earlier UXP conversion.
- Added/read five **native editable opacity keys** on the new MOGRT: 0/50/100/100/0 at 0/.16/.32/3.68/4s; native Motion Scale 50 adapts its landscape layout. Import initially occupied 0–8s and overwrote part of the old test Basic Title on V2 before trimming to 4s: **inspect lane occupancy before import**. Only the disposable duplicate changed; pre-test project copy retained.
- Saved and exported via actual MCP/AME. Final technical acceptance MP4: **2160×3840, 50fps, 750 video frames, 15s, H.264/AAC, 279,575,664 bytes**; full audio/video decode exit 0. Actual 2s frame viewed: complete NEXT ROUND text, changed sans font and green/gold/white styling are visible. This small test overlay is not an approved Emoya brand design, full-motion/listening assessment or polished client final.
- Named Codex entry now points to the repaired candidate with **19 selected tools** (added time-aware read, explicit colour, installed-MOGRT import, trim and sequence-structure read). All other TOML settings semantically unchanged; private backup retained. New configuration is not hot attachment to this conversation. Actual execution remains a bounded local MCP stdio client. Project-scope enforcement at the bridge boundary is still a production gate.

### Effective route / free-plugin decision

| Route | Current evidence | Decision |
| --- | --- | --- |
| Adobe native UXP | Actual stable-host effects, keys, transitions, audio and 4K render; typed advanced text requires newer host APIs | Long-term supported foundation; gate each method against the installed host, not newest type definitions. [ComponentParam reference](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/componentparam) |
| Approved PremiereMCP CEP + bounded repairs | Real MCP execution, stable-host editable AE typography and exact RGB now proven; lifecycle/readiness gaps remain | Current implementation route. Catalog size is not capability acceptance. Source explicitly groups 13 expanded reads under an unimplemented-error handler, including capture_frame and get_timeline_gaps. Do not enable all 283 and call that full control. |
| PrimCut direct Codex MCP | Vendor documents Codex HTTP MCP and token environment variable; external edits always require Apply. Download page still says downloads paused, despite displaying installer links. [Codex setup](https://docs.primcut.app/guides/connect-claude-code), [download status](https://www.primcut.app/download) | Revisit as a candidate when obtainable under an approved test. Its free tier/trial marketing does not prove ongoing free MCP access or unattended execution. Not installed. |
| OpenCurve | GitHub source/release checked at 2.0.1; **Adobe Exchange supplies 2.0.0**, minimum Premiere **25.6**, verified in installed manifest. This differs from source manifest 25.1 and README 2020+ claims. [Marketplace](https://exchange.adobe.com/apps/cc/3ecc7304/opencurve), [vendor](https://github.com/fayewave/OpenCurve) | Owner approved isolated test; installed **2.0.0 through Creative Cloud Marketplace**, not a manually copied GitHub package. Native easing/undo test passed below. No MCP endpoint established. No root LICENSE found at checked public commit: do not vendor source or infer redistribution rights. |
| Dagger | Vendor offers free effect search/application and shortcuts, Premiere 2020+, Windows/Mac. [Vendor](https://knightsoftheeditingtable.com/dagger) | Useful manual-editor convenience; no demonstrated MCP benefit or missing native effect solved. Lower priority; not installed. |

The app plugin-directory search for "Premiere Pro" returned no plugins in this session; that is not a universal absence claim. Codex officially supports per-server tool allowlists; preserve existing configuration when adding tools. [Official MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

### Approved OpenCurve experiment — installed and tested

Creative Cloud Marketplace visibly reports Installed; Adobe's installed UPIA `/list all` independently lists enabled OpenCurve **2.0.0** for Premiere 26.3.2 and 25.6.6. The installed manifest identifies `3ecc7304`, minimum 25.6, with clipboard read/write and requested local-file access; unlike the researched 2.0.1 source manifest it has no network permission entry. Only 26.3.2 was actually exercised. No purchase, source repackaging, security-setting change or client-original mutation. Website acquisition required a browser sign-in, so used the already-signed-in Creative Cloud marketplace instead; browser authentication was not automated.

On the same duplicate, original first-clip Scale had two keys, 100 at 0s / 104 at 4s, with samples **100/101/102/103/104** at 0/1/2/3/4s. MCP positioned playhead at 2s; native GUI selected that camera clip (otherwise the plugin detected the higher title's opacity), checked Scale and clicked Go on default Cubic In-Out. Independent MCP readback found **201 native keys**, and samples **100 / 100.283187866211 / 102 / 103.716812133789 / 104**. This proves sampled native easing, not two Bezier handles or a video overlay. One native **Edit → Undo restored exactly two keys and all five original samples**; duplicate saved afterward with the unbaked baseline. Pre-plugin project copy retained.

Go-click to observed UI state took **3,355.999ms**, including Computer Use/snapshot overhead; setup, target selection and recovery excluded. A selection click changed the checkbox but its tool refresh returned "no monitor found"; refreshed window/state confirmed the action before continuing, with no repeated toggle. **No comparable MCP curve operation was timed, so no plugin speedup is claimed.** The earlier blur benchmark concerns a different task. OpenCurve still requires GUI inputs; installation alone does not grant Codex a plugin API. Dense keys add timeline complexity: scope baking to short intentional moves, then inspect actual motion. Rendered-motion quality, other parameters, redo/persistence and staff-machine acceptance remain untested for this plugin. Private receipts retain before/after/undo keys, samples and install evidence.

### Coverage and next acceptance, in order

1. Keep native original-linked effects/keys, independent sound tracks and tested exposed typography as the baseline. Use exact client assets/fonts plus fitting text boxes; no baked movie substituted for editable titles.
2. Implement bridge-bound project/sequence scope checks and failure recovery. Native lifecycle remains a GUI dependency; closing the callback-owning CEP panel cannot be treated as an acknowledged transaction.
3. OpenCurve's first native easing/undo check has passed, but its GUI dependence remains. Validate a bounded native batch-easing route before calling it autonomous. Next validate retiming/speed ramps and Optical Flow on moving source, mask/reveal authoring and Lumetri controls individually; none is accepted merely because a tool name exists.
4. Solve fresh-graphic frame readiness, then repeat visual and listening QA from actual renders. Full-file decode alone does not judge smooth motion, sound design or story.
5. Repeat the same timed task with setup costs reported separately, and reopen on a staff machine with fonts/media/asset dependencies resolved. No staff-ready or full-Premiere-control claim until these gates pass.

Validation: repaired vendor TypeScript build passes; **7 generated-script regression tests pass without skips**, plus existing **9 file tests / 7 native-probe mocks**. Local Dynamics TypeScript/Vite build passes with existing chunk warning; no cloud build/deployment. Earlier GUI/MCP blur benchmark below remains the only comparable same-task timing; new typography tests are capability evidence, not an invented speedup.

## CEP host checkpoint — actual MCP execution

This supersedes earlier setup-only statements below. Vendor source/panel remain at the approved pin, without patches.

Human enabled CSXS.12 String `PlayerDebugMode=1`; readback verified, normal Premiere restart performed. Computer Use did not change security settings. Duplicate load was unresponsive for several minutes and recovered unaided; no forced kill/reinstall. Helper could not target the embedded CEP browser; human clicked **Start Bridge** once. A bounded local MCP client then verified **Premiere 26.3.2**, exact duplicate path and pilot sequence GUID, and read tracks. Initial host calls took 0.17–0.34s; later busy-host reads reached 8.93s. This running chat did not acquire the new tool namespace: actual tests used MCP stdio, not a claim of hot attachment or staff rollout.

### Fixed duplicate-only edit

Identity checked before each mutation; pre-test project copy preserved privately.

- Four exposed AE JSON text fields changed to **YOUR NEXT ROUND / STARTS HERE / EMOYA / GOLF**, preserving style-run structure; independently read back. Changed words visibly appear in the actual rendered 11s frame. Native PPro Basic Title exposes opaque Source Text through CEP: do not assign plain text or assume the AE strategy edits every title type.
- Real Gaussian Blur Blurriness 3 → 4; readback 4. Later GUI benchmark 4 → 5, MCP restored 5 → 4 and saved.
- Native second-clip Scale keys at source 0s / 6s read back 177.777770996094 / 181. Existing first-clip 100/104 keys retained. No arbitrary easing-quality claim.
- Independent whoosh Level key at source 0.3s, requested −9dB, normalized readback 0.06309573352337. Existing fades retained; cue spans 7.8–8.4s across the 8s picture cut. Parameter verification, not listening approval.
- Save passed. Fixed edit/readback/frame-request run: **10.612s**, including server startup/guards. Its frame endpoint was subsequently rejected for wrong content/time, below.
- MCP export returned an AME job ID; no completed output was claimed from that alone. Explicitly opened already-installed AME 2026 after auto-launch did not initially produce a file; queue then completed. Actual output independently verified: **H.264/AAC, 2160×3840, 50fps, 750 video frames, 15s, 48kHz stereo, 279,673,942 bytes**. Full audio/video decode exit 0. Correct 11s frame extracted from the rendered file and viewed. Main title contrast is poor; template font/size locked: **technical output only, not client-ready**.

### Reproduced defects and remaining limits

1. **Time-value defect confirmed live:** stored Scale keys 100 at 0s / 104 at 4s; `get_value_at_time` returns 100 for both requested times. Dispatcher ignores time. Use exact stored-key readback until repaired and verified.
2. **Frame-export defect confirmed:** `export_frame(time:11)` reports success and writes a valid 4K PNG, but shows first-shot content without the title. Actual rendered video at 11s shows second-shot/title content. Repeated after CTI set to 11s; still wrong. Not a missing-file issue; exact QE argument cause unconfirmed. Do not use this endpoint for QA/moment selection until cross-checked and repaired.
3. **Typography remains a template gate:** exposed objects report `capPropFontEdit:false` and `capPropFontSizeEdit:false`. Did not override locks or install Beta. Need approved template with exposed font/size/colour/layout controls, or supported native route. Earlier exact-colour mismatch unresolved. Text-content success does not clear these gates.
4. **Close/reopen lifecycle failed:** `close_project(confirm:true,saveFirst:true)` closed the saved duplicate to Home and removed its panel, but caller timed out at 40s without response. `open_project` was **not dispatched**. Preserved and removed the exact orphaned test close-command JSON so a later panel cannot replay it against another project. Reopened the saved duplicate through the native Open dialog. Automatic MCP reopen/readback remains unaccepted; no blind retry of timed-out mutations.
5. Final Codex test entry exposes only **14 selected tools**, excluding faulty time/frame tools, raw scripting and destructive catalog operations. All pre-existing settings preserved. The bridge is not a filesystem sandbox and still needs project-scope enforcement for production. No whole-edit, creative, exact-colour, phone/listening or second-device handover acceptance. Original working Emoya project SHA-256 unchanged.

### Comparable small-task measurement

| Same native control/save task | Result | Timing scope |
| --- | --- | --- |
| GUI: select clip, Effect Controls, Blurriness 4 → 5, save | **163.435s / 7 inputs** | Model/tool delays, snapshots and focus checks; final value 5/save verified |
| MCP: duplicate guard/discovery, Blurriness 5 → 4, readback/save | **19.589s / 11 requests / 0 GUI inputs** | Server startup, guards, reads/write/save/readback; includes busy-host delay |

One inverse-value pair on the same running host demonstrates fewer GUI operations for this task. It is **not** human-editor speed, an entire-video benchmark or a promised speedup. One-time setup, human setting/panel start and slow project loading excluded from both rows remain material costs.

Private pinned source/dependencies, bounded diagnostic, config backup, catalog, frames/render and receipts remain outside Git in the existing integration-audit workspace. **Next:** repair/quarantine time/frame/lifecycle behavior, use an approved template with editable typography/colour, then repeat actual-render and staff handover acceptance. Continue #856/#862; #859 craft remains separate.

## Earlier approved setup checkpoint — superseded by host results above

Owner explicitly approved **PremiereMCP 1.2.0**, pinned commit `50f534b17639aafc615a10b38325957bf73e6515`, for the duplicate-only experiment. This supersedes historical statements below that no candidate is installed. It does not approve production rollout or all catalog operations.

- Exact commit archive SHA-256: `c8bc01f052c319e765ddc76544ca8d76a6aa282bcef1b5af43a80ae120f876f0`; lockfile: `78ef9a239b60a8e1079184d00c808fe5fca47aec974bb4c3820c236689f3a817`. Local `npm ci --ignore-scripts --no-audit --no-fund`, Node 24.16.0, and `npm run build` pass. No global install. All resolved lock URLs use npm; lifecycle scripts disabled.
- Three focused vendor suites pass **31 mocked tests**: queue protocol, panel acceptance of generated scripts and QE targeting. These are not live Premiere acceptance or a full security audit.
- Default installer inspected and **not executed**: it enables CEP debug for CSXS 9–15, overwrites a panel directory and edits Claude/Copilot config. Manually copied four hash-matched panel files into the previously absent vendor-expected per-user folder; created a separate explicit queue and new panel config. No existing extension/config replaced.
- Added only Codex stdio entry **`nolan-premiere-isolated`**, with absolute Node/server paths and explicit `PREMIERE_TEMP_DIR`. Existing config backed up privately. CLI normalized away an existing empty `node_repl.args`; restored it and verified all pre-existing TOML entries/settings semantically identical. Other AI clients untouched. Persisted config does not prove attachment to this running chat.
- A bounded local read-only MCP client actually exchanged initialize, initialized notification, tools/list and `get_capabilities(checkConnection:false)`. Negotiated protocol **2025-11-25**, server **1.2.0**, **283 tools / 13 resources / 10 prompts**. Latest capability request **35.17ms**, excluding host/UI: **not an editing-speed benchmark**. Live connection explicitly unchecked; no host command dispatched.
- Queue Windows ACL observed: owner, SYSTEM and Administrators full control; CodexSandboxUsers inherited read/execute. No broad Users/Everyone write grant observed. This is not a filesystem sandbox; Node-enabled CEP/raw-script tools remain powerful. POSIX `0700` does not establish Windows isolation.
- Read-only registry inspection: CSXS.12 exists, but no `PlayerDebugMode=1`. Computer Use prohibits changing OS/in-app security settings. Human asked to set String `PlayerDebugMode` to `1` under `HKEY_CURRENT_USER\Software\Adobe\CSXS.12`, with step-by-step help. UXP Developer Mode is separate. [Adobe's unsigned-panel guidance](https://github.com/Adobe-CEP/Getting-Started-guides/blob/master/Client-side%20Debugging/readme.md) explains the mechanism.

Private source, dependencies, config backup, bounded probe, catalog and receipts remain outside Git. **Next:** human CEP setting → normal Premiere restart → start panel on explicit queue → MCP read-only duplicate path/sequence check → bounded typography/effect/keyframe/audio test with readback/reopen/render and comparable timing. Server startup, catalog size and mocked tests do not prove Premiere is connected.

## Native host checkpoint — after human Developer Mode enablement

This section supersedes the earlier “await Developer Mode / not run” statements below, retained as historical checkpoints. No native test touched the working client project; its original SHA-256 remained unchanged.

| Test in Premiere 26.3.2 | Verified result | Limit |
| --- | --- | --- |
| UDT Playground connection | Connected to actual Premiere 26.3.2 after normal restart | One-off diagnostic entry point; **not external Codex MCP** or an unattended service |
| Read-only discovery | 106 installed video effect match names; 2 video tracks, 13/5 clips; bounded native Motion/Opacity parameter readback | **55ms host time**, excludes setup, UI dispatch and model/tool latency |
| Original-linked 4K sequence | Two existing DJI masters, native source ranges 8s + 7s; 15s at 50fps; **2160 × 3840** | First master has **90° rotation metadata**; second is landscape. Respect orientation; raw width/height alone are insufficient |
| Native effect | Appended discovered `AE.ADBE Gaussian Blur 2`; Blurriness set/read back as 3 | Technical parameter test, not approved creative grading |
| Native transform | Scale keys at 0s/4s; readback 100/102/104 at 0s/2s/4s; interpolation action accepted and mode read back | Named host constants used. Midpoint alone does not prove a desirable easing curve or Bezier-handle control |
| Native title insertion / animation | Installed Premiere Basic Title and installed AE Sports Lower Third Center inserted; native title opacity readback 0/50/100 at 0/.15/.3s, ending fade keys | **Text/font editing NOT accepted.** Controls appeared after loading/reopen, but typed text values unavailable on 26.3.2. Colour writes work, with a channel mismatch noted below |
| Native transition | Discovered Cross Dissolve; 0.24s single-sided transition, 1 transition track item read back | Visual result/handle quality still requires inspection; not a premium-transition claim |
| Independent sound clips | Existing project-licensed music 0–15s plus generic whoosh 7.8–8.4s on separate tracks; native gain/fade keys read back | No baked mix substituted. Level is a normalised amplitude parameter (observed unity ≈0.17782794), **not a dB number**. Listening/mix quality not accepted |
| Save | Native `project.save()` returned true; duplicate file changed on disk | Working original hash unchanged; no second-device acceptance |
| Reopen/persistence | Saved duplicate reopened natively; original paths, scale/effect values, title opacity keys, transition and separate audio fade keys read back | **224,047ms** API open/identity/save wall time on this host; no speedup claim |
| Native export / decode | H.264/AAC export returned true in **15,647ms**; independent FFprobe: **2160 × 3840, 50fps, 750 frames, 15s, 48kHz stereo**, 267,039,182 bytes. Full-file video/audio decode exits 0 | Export completion event was not observed; evidence is the returned call plus actual decoded output. Technical fixture, **not client-ready** |
| Output inspection | Native frame exports at 2s/6s/10s visually inspected; audio analysis input **−14.29 LUFS / −5.25dBTP** | Placeholder typography/initial letterboxing failed creative QA. A later native fill-crop frame removes bars; that refinement is saved in the project but not in the earlier MP4. No full motion/listening/phone approval |

Private host receipts: discovery, native 4K pilot, finishing/readback and subsequent reopen/export attempt, stored outside Git. The successful continuation that applied animation/effect and inserted Basic Title recorded **651ms host execution** (effect/transform section 5ms); the separate native finishing test recorded **752ms**. These exclude the substantial diagnostic/setup/iteration overhead. They are **not** a same-task speedup against the 191.001s GUI open/inspect/save baseline. Advanced GUI comparison remains unmeasured.

### Host failures corrected or still under investigation

- **Exact identity guard:** Premiere reports its project path using Windows' local extended-length prefix. The read-only probe initially refused it. Normalisation now strips only the `\\?\C:\...` local-drive form; UNC/device paths and parent traversal still fail closed. Seven Node tests pass, including both cases.
- **Action scope:** first trim mutation failed with “The script object is no longer valid.” Action construction had occurred before entering a transaction. Corrected to synchronous `project.lockedAccess(() => project.executeTransaction(...))`, constructing and consuming every action inside the callbacks, with asynchronous discovery completed beforehand. The corrected native calls succeeded. [Adobe's action-scope guidance](https://developer.adobe.com/premiere-pro/uxp/resources/fundamentals/eslint-support/) documents this contract; do not introduce async callbacks or return cached Action objects across it. No new linter package installed.
- **Source identity:** originals already existed as project items. An unconditional import added duplicate references in the test copy; no source files were duplicated. The experiment now checks full media paths, records stable item IDs and avoids missing-only reimports. Preserve separate references to one master; never infer a unique asset from a display name alone.
- **Playground hot reload:** replacing code while it is loaded executes the edited script. An additional manual unload/load repeated the guarded experiment. Later scripts use explicit identity/precondition checks and append history receipts; do not use a generic auto-running raw-script loop as a production editor.
- **Reopen:** `Project.open` with forward-slash path produced an explicit “project could not be found” dialog. Dismissed it; native Windows backslashes succeeded, after a long load. Readback and actual render completed. Do not confuse a slow host open with a disconnected bridge or repeatedly dispatch the same operation.
- **Title loading versus API version:** initial component chains had only intrinsic controls. After reopen, native `AE.ADBE Text` / `AE.ADBE Capsule` controls appeared. Re-query after asset readiness, not just insertion return. Nevertheless, `getStartValue()` exposed no usable typed text interface on this 26.3.2 host. **Earlier API research used newer types without resolving this per-method version gate:** Adobe's [type changelog](https://github.com/adobe/premierepro-types/blob/main/CHANGELOG.md) introduces `MogrtText`/`MogrtComment` in **27.0.0-beta.22**, and its [official sample](https://github.com/AdobeDocs/uxp-premiere-pro-samples/blob/main/sample-panels/premiere-api/public/index.html) groups these controls under 27.0 Beta. Do not claim 25.6+ means every latest typed title API is supported. Do not install Beta or use it for client finishing without a separate decision.
- **Colour accuracy:** exposed AE Main/Title Color parameters accepted native `Color` writes. Requested `#0f2e1c` read back approximately `(15,46,32)/255`, not the requested blue 28/255. Cause unverified; channel conversion/quantisation must be resolved before exact-brand-colour acceptance. A successful transaction is insufficient.
- **Framing:** the first master has 90° rotation; the second is landscape. “Create sequence from media” alone does not solve mixed orientation. Visual QA caught the landscape bars; a native Scale value ≈177.7778 removes them in a later frame. That is an intentional crop/resample of a 4K master, not recovered portrait detail or a polished client composition.
- **Saved-project file audit:** 77 stored reference values: 76 filesystem references present, plus one numeric generated-Graphic candidate. The initial file-only scanner falsely treated that candidate as a missing camera file. It now retains the explicit candidate separately rather than declaring it offline or silently hiding it; a new regression test covers the observed `Graphic`/`Infinite` combination. This is not second-device portability proof.
- **Final read-only recheck:** strict pilot sequence GUID, 2160×3840, three video tracks, zero mutations; advanced typed `MogrtText` and `MogrtComment` constructors both absent. Temporary Playground plugin unloaded after receipts were copied privately. Approximately 206GB remains free.

**Next acceptance:** resolve stable-host editable text/font and exact colour, then test branded layout, native easing quality, motion/listening and second-device handover. PrimCut is unavailable for public download at the checked source; pinned PremiereMCP CEP is a possible alternate subject to explicit installation approval. Its default installer also enables unsigned CEP debug and edits other MCP-client configurations: inspect/customise those steps, require human-only security-setting action, and preserve existing client configuration. No generic auto-executing bridge should grow out of Playground.

## Later 22 October recovery checkpoint — storage resolved

Owner explicitly authorised laptop cleanup, the named game/gaming-app removals and connecting the existing rclone client to the specified personal Google Drive for archive/comparison. Private receipts and inventories stay on the laptop, not Git.

- Removed 13 old downloaded installers (**3,335,982,072 bytes**) and 13 duplicate ZIP downloads (**12,820,446,142 bytes**). Every file inside each removed ZIP was SHA-256 matched to its retained extracted copy; changed/missing sources abort removal. An incomplete extraction failed verification, so its archive was retained.
- MECCHA CHAMELEON (**3,507,083,983 installed bytes**) removed through Steam. Vortex, Epic Games Launcher and Epic Online Services absent from fresh uninstall-registry readback. Initial silent Epic removal failed with admin Error 1730; approved elevated launcher uninstall subsequently completed with status 0. Its own `UninstallAllApps` action ran. No game ownership/account deletion or separate save-folder purge was performed.
- C: observed free space rose from **208,023,552 bytes** before installer cleanup to approximately **206–207GB** after gaming cleanup and Adobe installation. This is observed disk headroom, not an independently attributed byte total for each uninstaller. No client original/project deletion was targeted. Original Emoya `.prproj` SHA-256 rechecked unchanged.
- Approved Google Drive remote configured with **`drive.readonly,drive.file`**: read existing files, create/modify its own uploads. Browser visibly verified the requested account; 31,477 remote file metadata records indexed. Seventeen Downloads files matched remote size/MD5 (**690,267,479 bytes**) and no inspected saved Premiere project references them. **These files were not removed:** subsequent account/metadata readback hit Google's shared rclone client `rateLimitExceeded` quota. No cloud uploads/deletes or cloud-based local deletions claimed. Rclone warns this shared OAuth client is being retired in 2026; a CG-owned client is a separate future setup, not an unattended-production promise.
- Retried the already-approved Adobe installation after cleanup. **UDT 2.3.0.5 installed successfully**, Adobe install log **10:07:03 SAST / exit 0**, executable version verified, application opened. No new third-party purchase/install.
- UDT Playground service connects locally at port 14001, but displays **Premiere Disconnected**. Actual Premiere Plugins preferences show **Enable developer mode unchecked**, with restart required. Preferences were opened read-only; human asked to enable it and click OK because Computer Use prohibits changing in-app security settings. **No diagnostic script or native effect mutation has run in Premiere yet.** This supersedes the storage-blocked rows below; retain the original failed-install/baseline evidence as history.

## 1. Why advanced editing still depends on Computer Use

Four representative builders and the current Emoya interchange/project were inspected in the existing private `CG-AI-Editing` workspace. Exact paths, SHA-256 values and source line references remain in private audit manifests, outside Git.

| Local builder | Verified pipeline | Native editability limit |
| --- | --- | --- |
| Bloem `build_premiere.py` | OpenTimelineIO schema → `fcp_xml` adapter → FCP 7 `xmeml`; FFmpeg-prepared picture and raster graphics | This is interchange, not a host API. Rendered effect pixels have no native controls. |
| PSG `build_psg_final_rev5.py` | PIL/NumPy/FFmpeg and OTIO; 1080 × 1920 preparation | Font, layout and animation are rendered before Premiere. |
| JFJ `build_jfj_final_candidate_10.py` | XML clip/track construction and prepared media; Emoya imports its helper using an absolute JFJ project path | Shared helper extraction is needed. This is a cross-project **code dependency**, not evidence of cross-client footage reuse. |
| Emoya `build_emoya_v5.py` and imports | 1080 × 1920/25fps; external crop, grade, flash and retiming; QTRLE title MOVs; NumPy audio stems; bare clip XML | Titles/ramp curves/much sound automation are rendered into media; cuts remain editable but these parameters do not. |

Current Emoya interchange: **750 frames / 30 seconds**, **2 video + 3 audio tracks**, **21 clip items**, **5 rendered title MOV references**, **zero `filter`, `transitionitem` or `keyframe` XML nodes**. This is evidence about this interchange, not all historical CG projects. Internal `.prproj` component counts include defaults and older sequences and are not proof of Nolan-created native effects.

Manual builder/import inspection found no connected UXP adapter, CEP `evalScript` transport or installed Premiere MCP server in the inspected configuration. Text-marker scanning locates evidence; absence alone is not a complete dependency audit.

**Root cause:** Nolan currently stops at prepared-media/interchange import. There is no programmatic route to Premiere's native title/effect/audio controls, save or export. Computer Use fills that gap. Further external rendering cannot establish native parameter editability.

Preserve screened source ranges, moment/rejection ledgers, rights/source identity and rhythm planning. Bind camera masters to host-created sequences; use native effects, exposed MOGRT parameters and keyframes. Proxies must retain verified master linkage. Upscaling prepared 1080 media cannot restore original 4K detail. This is an architectural bottleneck, not evidence that a bridge alone will supply creative judgement.

## 2. MSI and actual installation blocker

- MSI Cyborg 15 A13VF, approximately 32GB RAM; Intel UHD and NVIDIA RTX 4060 Laptop GPU detected. VRAM, sustained performance, LAN throughput and another editor device were not verified.
- Running Premiere **26.3.2**, executable **26.3.2.2**. Creative Cloud also lists Premiere 25.6.6 and AME 2025/2026. The 26.5.2 update offer is not the running version.
- Only C: appeared as a mounted physical filesystem drive. Free space was about 655MiB initially, about 546MiB around installation. This is not a complete storage/backup audit.
- FFprobe verified a local original DJI clip: **3840 × 2160, 50fps, 12.02s, 204,442,422 bytes**. No extra copy of that 195MiB media was made. Exact source path remains private.
- User explicitly approved Adobe UXP Developer Tools installation and Developer Mode setup. Creative Cloud offered **UDT 2.3.0**, installer package **2.3.0.5**.
- **Installation failed with Error 133: insufficient space.** Local Adobe install log at **09:25:23 SAST** requires **1,948,273,828 bytes**, with only **570,576,896 bytes available**. The error dialog was dismissed without retry. No successful UDT installation or Developer Mode enablement is claimed.

Recover installer capacity **plus separately budgeted 4K cache/export headroom** before retrying. No originals, active project assets, backups or other agent worktrees were deleted/moved. Storage recovery needs an identified, authorised target. The existing Adobe installation approval remains valid; no repeat purchase/install approval is required for this exact Adobe setup.

If setup presents a security/developer permission prompt, the Computer Use skill requires the human to perform that step: the agent must not change in-app security settings or bypass them through registry/settings-file edits. User approval of installation does not remove that tool restriction.

## 3. PrimCut vs PremiereMCP vs Adobe native APIs

Checked primary sources on 22 October. **Documented capability is not an MSI test receipt.**

| Requirement | PrimCut external Codex MCP | DutchErwin/PremiereMCP | Adobe UXP/native APIs |
| --- | --- | --- | --- |
| External connection | Explicit Codex HTTP MCP instructions, localhost and bearer-token env variable | MCP server → local temp file queue → CEP/ExtendScript | In-host API, **not a built-in external MCP server**; approved entry point/transport still needed |
| Effects/keyframes | Advertises effects, transforms, audio and Curve Zoom; actual tools/tier untested | Broad catalog; some effect/transition operations use QE | Documented component chains, parameters, keyframes and undoable project transactions |
| Editable titles | MOGRT assets relevant; exposed controls must be tested | Full MOGRT workflow explicitly not fully exercised upstream | Insert real MOGRT and edit exposed parameters; template determines editability |
| Rendered motion | HyperFrames produces alpha ProRes video, not native text | External render is not native-control proof | Reject rendered title MOV as a substitute for the native-title acceptance step |
| Automation limits | Every external write awaits Apply, on sequence copy; panel must stay open | Broad scripting/Node permissions; no equivalent approval guarantee established | Bridge design determines access; not inherently headless or unattended |
| Current result | Docs evaluated; public download paused; no install | Pinned source read; no install or vendor-code execution | Probe written/mock-tested; approved developer install failed before execution |

### PrimCut: credible direct-Codex candidate, availability/coverage unproven

The [official external-app guide](https://docs.primcut.app/guides/connect-claude-code) explicitly provides `codex mcp add` with a localhost endpoint and bearer-token environment variable. Its external edits always require Apply, even with internal Auto enabled; changes go to a sequence copy. This can remove coordinate editing but does not remove all user interactions. Its own chat login is not proof that this Nolan session is connected.

The [download page](https://www.primcut.app/download) says downloads are paused, with early-access login offered. It describes an unsigned EXE, signed ZXP alternative and automatic engine/transcription downloads. No installer/account was obtained; do not bypass the access state or Windows protection. Trial/tier, download size, staff licences and actual released AI tools remain unverified. The homepage's “coming in 1.2” and [AI beta documentation](https://docs.primcut.app/features/primcut-ai) need reconciliation against an available build.

Distinguish [MOGRT assets](https://docs.primcut.app/features/assets-library), [Curve Zoom parameter keyframes](https://docs.primcut.app/features/curve-zoom) and [HyperFrames motion graphics](https://docs.primcut.app/guides/motion-graphics-claude-code). Curve Zoom samples easing into native keyframes; HyperFrames renders transparent ProRes 4444 MOVs which need rerendering for design changes. These are different editability/performance contracts.

### PremiereMCP: specific findings from pinned source

Inspected commit **`50f534b17639aafc615a10b38325957bf73e6515`**, package 1.2.0. Source-only static review is not a full security/runtime audit.

- [Known issues](https://github.com/DutchErwin/PremiereMCP/blob/50f534b17639aafc615a10b38325957bf73e6515/KNOWN_ISSUES.md): UXP nonfunctional on its tested 26.0.2 host, full MOGRT execution not exercised, live-tested subset smaller than the catalog. Upstream tests do not certify this MSI.
- Actual [UXP bridge](https://github.com/DutchErwin/PremiereMCP/blob/50f534b17639aafc615a10b38325957bf73e6515/uxp-plugin/bridge.js) uses `require('premiere')` instead of Adobe's `premierepro` and lacks documented entrypoint registration. Do not deploy that path expecting it to work unchanged.
- In [expanded tools](https://github.com/DutchErwin/PremiereMCP/blob/50f534b17639aafc615a10b38325957bf73e6515/src/tools/expanded.ts), `get_value_at_time` dispatches to `getComponentProperty` without evaluating the supplied time. Time-specific readback therefore cannot be assumed correct. This is a source-level dispatch finding, not a local runtime reproduction.
- [CEP code](https://github.com/DutchErwin/PremiereMCP/blob/50f534b17639aafc615a10b38325957bf73e6515/cep-plugin/bridge-cep.js) runs ExtendScript via `CSInterface.evalScript`; some operations use undocumented QE. Sequence identity checks mitigate earlier targeting bugs but do not prove all effect support.
- [Server bridge](https://github.com/DutchErwin/PremiereMCP/blob/50f534b17639aafc615a10b38325957bf73e6515/src/bridge/index.ts) uses a session-specific local temp file queue. Windows ACLs, raw-script exposure and Node-enabled CEP permissions need review. POSIX `0700` is not proof of Windows ACL restriction.

If evaluated, approve/pin the exact install and inspect installer/debug-setting changes. Start with a bounded read-only catalog on the duplicate, then verify IDs and read back every mutation. No broad unreviewed raw-script deployment to client work.

### Adobe native: the right primitives, still needs a connection

[Adobe's reference](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/) documents Premiere UXP from 25.6. Check method-level versions and installed capabilities. Legacy [CEP/ExtendScript](https://ppro-scripting.docsforadobe.dev/) is a separate route.

| Need | Documented API surface | Not yet verified locally |
| --- | --- | --- |
| Effect discovery/application | `VideoFilterFactory.getMatchNames/createComponent`; `VideoComponentChain` actions; project transactions | Installed match names, effect creation, undo and reopen |
| Keyframes/easing | `ComponentParam` time-varying/add-keyframe/interpolation actions; `getValueAtTime` | Timebase correctness and visual result; arbitrary Bezier-handle editing not established |
| Branded animated title | `SequenceEditor.insertMogrtFromPath/Library`; exposed `MogrtText`/component parameters | Approved template, text/font/colour/position controls and missing-font handling |
| Transition | `VideoClipTrackItem.createAddVideoTransitionAction` | Supported transition, handles and duration |
| Sound design | Independent audio clips, audio component chains and parameter automation | Per-cue fades/ducking, readback and listening |
| Save/export | `Project.save`; `EncoderManager.exportSequence` | Completion/error events, original-linked 4K output and reopen |

Sources: [filter factory](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/videofilterfactory), [component chain](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/videocomponentchain), [parameters](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/componentparam), [sequence editor](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sequenceeditor), [video clip](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/videocliptrackitem), [encoder manager](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/encodermanager), [developer tools](https://developer.adobe.com/premiere-pro/uxp/introduction/essentials/dev-tools/).

## 4. Implementation and tests

New bounded diagnostics in [`scripts/video-editing`](../../scripts/video-editing/README.md), no new dependencies:

- `audit_local_pipeline.py`: read-only saved-project/interchange/builder audit with hashes; optional exclusive project copy; refuses overwrite and private reports inside Git. No internal XML rewriting, render, network, install or Premiere launch.
- `test_audit_local_pipeline.py`: **9 passing file tests**, including original integrity, overwrite refusal, nonlocal URL rejection, private-output protection and explicit generated-Graphic reference handling.
- `probe_premiere_readonly.cjs`: bounded discovery function, now executed in the approved UXP host. Exact project path and optional sequence GUID guards before reads; identity recheck after asynchronous reads; effect match names/component/keyframe metadata. The function has no transactions, save, filesystem or network writes. A local diagnostic wrapper wrote receipts to its own UXP sandbox only. **Not a plugin/MCP server or deployed custom editor.**
- `probe_premiere_readonly.test.cjs`: **7 passing mock tests**, including wrong project/sequence, extended local Windows paths, blocked UNC/device namespaces and mid-read sequence change. Mocks remain distinct from the host receipts above.

API shapes checked against [Adobe types at `c8f108941197c1d987f08b9916c0d18a2e252699`](https://github.com/adobe/premierepro-types/blob/c8f108941197c1d987f08b9916c0d18a2e252699/src/premierepro.d.ts). Missing host support produces an explicit failure, not a fabricated result.

`npm run build` passed: TypeScript and Vite 7.3.6, 386 modules; existing >500kB chunk warning. Used the already-installed dependency directory via a local ignored junction after confirming identical package-lock SHA-256; no package installation. Diff checks and final focused-test receipt are recorded in PR #862. This is not authenticated app, production or native-Premiere acceptance.

## 5. Measured duplicate baseline (before storage recovery)

Private test **`Nolan_Duplicate_API_Test.prproj`** was copied exclusively, hash checked, opened and saved in Premiere. Original SHA-256 rechecked after this operation: unchanged. The file audit found **69 stored media references, zero missing**; prepared sequence visibly online. A project copy shares media references and is not an independent backup.

| Experiment | Actual result | Measurement / limit |
| --- | --- | --- |
| File audit plus verified project copy | Passed | **0.023s**, zero host API calls. File-only operation, not an editing speed benchmark. |
| GUI open duplicate → inspect identity → save | Passed | **191.001s wall time, 6 input actions**, one identity-guard refusal/recovery. Includes model/tool latency and focus failure; not a human-editor timing. |
| Native discovery | Later passed | 55ms in-host; see current checkpoint above |
| Native effect/keyframe/transition/audio task | Later bounded pass; typography incomplete | Native action/readback receipts above; identical advanced GUI speedup unmeasured |
| Original-linked 4K export/reopen | Later technical pass | 224.047s API reopen/identity/save; 15.647s export call; creative QA fails described above |
| Second device | Not run | Available licensed second workstation/linked-original access unverified |

The owner-reported 30-minute text placement is feedback, **not a controlled measured baseline**. No speedup percentage or fully editable 4K success is claimed.

Actual GUI failure: cached window metadata still named the original when the screenshot showed the duplicate. The guard refused Save until fresh window enumeration resolved the duplicate identity. API work must bind project path/GUID and sequence GUID, not stale titles or guessed clip indexes.

## 6. Same-task pilot after storage/setup recovery

Use the duplicate container; create a **new 15-second 4K sequence** from authorised clean camera originals. Existing 1080 prepared media is baseline evidence only. Do not relink the working client project in place.

1. Read host identity, sequence size, installed effects and exact source ranges; compare private ledger.
2. Build the sequence using masters. Choose 3840 × 2160 or 2160 × 3840 intentionally; verify source timebase/crop rather than forcing portrait.
3. Insert an approved MOGRT, edit text/font/colour/position inside agreed safe area. Verify real exposed parameters; rendered MOV titles fail this step.
4. Apply one native effect, transform animation with specified interpolation and one native transition with adequate handles. Read back match names, keyframe times and values **at multiple times**. Inspect moving middle frames.
5. Independent soundtrack/SFX clips with native fade/duck automation crossing the picture cut. Read back gains/keyframes, measure output and listen. A mixed full-film stem does not pass.
6. Save/reopen duplicate; change a title parameter and effect value; export true 4K from linked originals. Verify render completion, dimensions/fps/frame count, framing and audio/playback. File existence alone is insufficient.
7. Perform the **same operation list** by GUI and candidate API. Separate setup, creative planning, command latency, host execution and export. Record input actions/tool calls/retries, elapsed time, usage where available, native readback, quality and reviewer effort. Do not compare file-copy speed to title design.
8. Franco/Sydney handover only with available device, matching Premiere, licensed templates/fonts/effects and verified original paths/backup. Until then second-device acceptance is UNVERIFIED.

**Decision:** storage, native discovery and a technical 4K save/reopen/render are complete; native editing primitives have bounded host receipts. Finish typography/colour/creative QA gates above. PrimCut is the documented external-Codex candidate when an available build can be approved/tested. Bounded pinned PremiereMCP **CEP** is an alternative after its install/code gate, not its broken UXP path. Compare candidates before creating a custom CG production bridge. The discovery function and local pilot are diagnostics, not a competing editing engine.

## 7. Continuity and remaining gates

No third-party install/purchase authorisation has been granted. Existing approval covers Adobe developer setup only. No MCP tokens generated/committed, no LAN/internet listener, no raw client upload, no production dependencies, Supabase/Microsoft/schedule/Planner/Content Guideline changes. Preserve #679 `git.deploymentEnabled=false`; push does not authorise deployment.

Update #856/#862 and ops handover; checkpoint #381. Exact Google Control Centre reference remains unavailable in current continuity; no guessed spreadsheet/replacement tracker write. No new broad agent mission or overlap with #859/#841/#450.

**Current blockers:** production external MCP transport untested/uninstalled; stable-host title text/font editing not accepted; exact colour mismatch unresolved; creative motion/listening/phone QA and identical advanced GUI comparison pending; available second workstation and verified original backup. Human Developer Mode, storage, UDT setup and technical 4K reopen/export are resolved. Shared Google OAuth quota blocks final cloud duplicate readback and durable archive acceptance. System remains **LOCAL PROTOTYPE / NOT PRODUCTION VERIFIED**.
