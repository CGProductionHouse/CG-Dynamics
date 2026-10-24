# CapCut initial compatibility proof — 24 October 2026

**Scope:** isolated research worktree `research/nolan-capcut-poc-20261024`, based on `origin/main` `5d7696a7`. No existing CapCut or Premiere project, process, integration, workstation setting, client media, cloud account, or permission was changed. Scratch outputs are ignored. This is a technical compatibility probe, not an approved staff workflow or creative-quality acceptance.

## Decision

**CapCut-first CG editing is not yet proven reliable.** A local CLI made a structurally editable 12-second draft, but the installed CapCut 9.1 Windows application was not used to open, save, reopen, or export it. The bundled project template is CapCut 6.5/macOS, known to be refused by some newer Windows builds. A moved copy retained absolute paths to the original media. The CLI also placed text *over* the silhouette, defeating the requested behind-person effect. Keep Nolan's proven Premiere master and Python/FFmpeg diagnostics/render checks. The next bounded test is a **new, empty, disposable app-created CapCut 9.1 project**, edited only as a copy, followed by witnessed app open/save/reopen/export and second-editor media relink verification. Do not promote any generated draft before those gates.

## Machine and access receipts

| Item | Observed here | Limit |
| --- | --- | --- |
| CapCut Desktop | Windows installation includes `9.1.0.3879`; no CapCut process was running at inspection. | App UI was not controlled in this task. Presence is not project compatibility. |
| Premiere | Premiere Pro process was running. | No interaction with it. |
| Codex official plugin | Native `codex plugin list --marketplace CapCut --available --json` returned `installed: []`; `codex mcp get capcut_creation --json` said no server. | No protected CapCut tools or account access were available. |
| Docker | CLI installed, daemon pipe absent. | `spectrika/capcut-mcp` was not built, installed, or tested. |
| FFmpeg / Node / Python | FFmpeg 8.1.1, Node 24.16.0, Pillow 12.2.0 available. | Used only on synthetic assets and isolated scratch files. |

## Official CapCut × Codex first

Read the [official product page](https://www.capcut.com/tools/capcut-x-codex) and its [linked installer runbook](https://sf16-sg.tiktokcdn.com/obj/eden-sg/962370eh7nupenuhbo/capcut_codex_plugin/SKILL.md) before any installation. The runbook advertises bundle version **0.2.6**, requires installation into Codex's managed plugin directory, `capcut_creation` registration at `https://www.capcut.com/api/external_mcp`, and separate CapCut OAuth authorization. It instructs a protected material search as a read-only connection check. This is an **account-connected remote MCP**, so the product page's “upload video clips / an existing draft” flow must be treated as a source-media upload. Exact media handling, OAuth scopes, supported editing operations, retention, free quotas/credits, and export/share behavior could not be independently inspected without installing and authorizing. The product page claims an editable CapCut first cut and free entry; it does **not** establish a numeric free allowance or a verified desktop round trip. No bundle, OAuth, cloud upload, generation, or credit-consuming call was made. The user's no-permission-changes rule is why installation/authorization stopped after the read-only inventory.

## Independent candidates

| Candidate | Licence / engine / security | Version and observed result |
| --- | --- | --- |
| [`renezander030/capcut-cli`](https://github.com/renezander030/capcut-cli) 0.31.1 | MIT, zero runtime dependencies; local JSON draft writer, no server. Installed **locally in ignored scratch** with npm lifecycle scripts disabled; no global/agent/plugin configuration. It copies media into the draft and uses atomic writes/backups. Its optional `caption --cloud` uploads audio to ByteDance and was not called. Versions through 0.17 had reported injection/credential-output issues; 0.31.1 was chosen. | [Version matrix](https://github.com/renezander030/capcut-cli/blob/master/docs/version-support.md) calls 9.x other builds expected-compatible/unverified; 8.7 Windows has a storage fixture but desktop round-trip after mutation remains pending. Our 9.1 host was **not** app tested. Local synthetic JSON, cuts, sound, separate text/image tracks and two position keys passed; see below. |
| [`spectrika/capcut-mcp`](https://github.com/spectrika/capcut-mcp) 0.3.0 | Apache-2.0 Docker/stdin wrapper around pinned Apache-2.0 `sun-guannan/VectCutAPI` and `pyJianYingDraft`; no exposed port, media read-only mount, project write mount, URL/path guards. The [security policy](https://github.com/spectrika/capcut-mcp/blob/main/SECURITY.md) still warns that upstream is not hardened for hostile input and CapCut autosave can overwrite concurrent writes. Do not mount existing projects for an initial test. | Maintainer-tested on **CapCut Windows 9.3.0.3970**, not this installed 9.1. It exposes 22 draft/edit tools, including text, cuts, audio, video position keys, copy-on-open and masks; manual CapCut export remains necessary. Docker daemon is absent here; no runtime test. Version claims and limitations are from its README, not a local pass. |
| Raw [`VectCutAPI`](https://github.com/sun-guannan/VectCutAPI) | Repository licence file is Apache-2.0 (its Python metadata includes an inconsistent MIT classifier). Uses `pyJianYingDraft` for project JSON. Raw HTTP/server mode lacks the wrapper's path/URL and deletion protections; avoid direct exposure or broad draft mounts. | Not installed. Spectrika's fork-specific 9.3 repair must not be attributed to raw upstream. |

## Reproducible synthetic probe

`generate_synthetic_assets.py` creates three 4-second color clips, a transparent graphic person silhouette, and a 12-second generated tone. All assets are artificial; no client rights or privacy question arises. The exact local test used `capcut-cli@0.31.1` under `scratch/tools`, `init --template bundled --ratio 9:16`, then `add-video` for each clip at 0/4/8 seconds, `add-text`, a separate foreground PNG track, `add-audio`, and two `position_x` keyframes. `info`, `timeline`, `lint`, `diagnose`, `version`, `render`, `diff`, and `set-text` were run on this disposable draft or a copied version.

| Acceptance item | Result | Evidence / limit |
| --- | --- | --- |
| 10–15 s, cuts, audio | **Local JSON pass** | 12.000 s; three 4 s video segments, one 12 s PCM audio segment. FFmpeg proxy verified 12.000 s, but this is not CapCut export. |
| Editable branded typography | **Local JSON pass only** | Separate text material and track, white `MAKE IT MATTER`, size 16. Copy's text was changed to `KEEP THE MOMENT` and diff found only that material changed. Font family/brand fidelity and app editability unverified. |
| Safe area | **Unverified visually** | Text transform is x=0, y=0.2 in project units. No phone or CapCut canvas inspection; positioning cannot be accepted. |
| Motion keys | **Local JSON pass only** | Foreground `position_x` keys at 0 and 12 s, −0.06 to +0.06, easing requested. CLI proxy explicitly drops keyframe animation. App playback unverified. |
| Text behind person | **Failed** | Image track is separate and transparent, but text segment `render_index=15000` is above person image `render_index=14000`; the CLI provides no verified layer-reorder command. Overlay-only proxy showed the silhouette, not text. |
| Proxy of text | **Failed on this Windows host** | `render --all-video-tracks --burn-captions` failed with FFmpeg `Fontconfig error: Cannot load default config file`. Overlay-only proxy rendered, but omitted text and keys. Do not present it as a final composite. |
| Existing-project edit/save/reopen | **CLI copy pass; app unverified** | A copy of the generated draft was read, text-edited, and read again. No existing human-created draft was read or modified. No CapCut app open/save/reopen/export occurred. |
| Share with another editor | **Failed local move test** | A copied project still pointed to absolute paths under the original draft; `lint` flagged five `media-outside-draft` references. Media relink/registration and second-device rights remain unverified. |

The copied draft also has one `cue-too-long` lint warning (10-second title > 7-second caption heuristic). `diagnose` reported undiverged root files and CapCut **6.5.0 / macOS** project metadata because the bundled template was used. This mismatch is the main reason **not** to import this draft into staff work.

## Compared with Nolan's current lane

[Nolan's active Premiere audit](https://github.com/CGProductionHouse/CG-Dynamics/pull/862) contains actual Adobe save/reopen/render receipts, source-linked 4K checks, and uses Python/FFmpeg for bounded media inspection, proxy/decode checks, and XML/project diagnostics. Its verified controls include editable native titles/keys/audio within stated limits; behind-person masking and creative/listening approval remain separate gates. The CapCut CLI's useful addition is **local draft-structure manipulation**; its FFmpeg proxy is less faithful than an application export and does not replace Nolan's existing diagnostics, render verification, or editorial review. No Premiere implementation was copied or changed.

## Next test and stop line

Use only a fresh, empty, synthetic CapCut 9.1 project created in the app, in a designated disposable location. Close the app before modifying a copy. First verify exact schema/version and storage authority, then add one clip and title with the selected tool, reopen in CapCut, manually change the title, save, close, reopen, and export. Move a *copy with media* to another editor or clean profile and prove the track remains editable. Test text/background/foreground ordering, app-rendered keyframes, audio audition, safe-area phone view, and free export gates. If the app refuses or alters the draft, stop; do not force-write, replace the existing store, downgrade CapCut, or build a new renderer. Official plugin exploration remains a separate permission/authorization decision with synthetic uploads only.

No production data/migration, role or security configuration, desktop sign-in, Vercel deployment, purchase, AI credits, client footage, or external message was involved.

## Native-app milestone attempt — 24 October 2026

The owner authorized a new disposable project and native CapCut 9.1 round-trip test. Before any desktop action, a read-only process check found CapCut already running (main PID 38368, started 11:40 SAST) and Premiere Pro running (PID 40052). The concurrent **Nolan - CG Video Editor** Codex chat was active and issuing Premiere commands, including a Premiere restart and project save. The foreground was Chrome, but that does not establish an exclusive desktop lease. Per the owner's desktop-conflict stop rule, **no CapCut UI interaction or project creation was attempted**. This is a scheduling/interference block, not a compatibility failure. The original CapCut draft store was not read or changed during this attempt, and there is no new native app result to report.

When the desktop is free, use this exact sequence on a fresh synthetic-only app project: create it in CapCut; record the new project folder and read-only structure; duplicate it natively; close CapCut; snapshot both folders; run `capcut diagnose` on the duplicate and add one synthetic clip and text only if the CLI accepts its verified active timeline without `--force-write`; reopen the duplicate in CapCut and witness picture, editable text, timeline playback, save/reopen and native export. Stop immediately on refusal, missing media, damaged timeline, or silent reset. Compare before/after hashes of the untouched original. Only after that pass, test layer order, keys, safe areas and copied media relink.
