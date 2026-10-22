# Nolan — CG Production House autonomous 4K editing and media operations game plan

**Owner direction:** 21 October 2026. **Status:** Approved strategic direction and staged implementation brief; **not** proof of an installed network, a running ingest service, completed Premiere automation, or client-ready autonomous edits.

**Owning lane:** [CGPH AI video editing issue #856](https://github.com/CGProductionHouse/CG-Dynamics/issues/856). Read its [20 October implementation handoff](./CGPH-AI-VIDEO-EDITING-CODEX-HANDOFF-2026-10-20.md), [video/photo/sound craft pack](../ai-workforce/VIDEO-PHOTOGRAPHY-SOUND-EDITING-CRAFT-SOURCE-PACK.md), and in-flight [video editing craft PR #859](https://github.com/CGProductionHouse/CG-Dynamics/pull/859). This document extends the **same** lane; do not create a competing video editor, content registry, or autonomous coding mission.

## 1. Outcome and non-negotiable owner direction

**Latest 22 October repair checkpoint:** [Verified repair overlay, native typography/colour, free-plugin comparison and ordered coverage gates](CGPH-NOLAN-PREMIERE-INTEGRATION-AUDIT-2026-10-22.md#latest-continuation--repaired-candidate-and-stable-host-typography). Actual MCP now reads time-varying values correctly and changes exposed AE font/size/exact RGB; complete new title visibly verified in a decoded 4K render. Separate repaired candidate preserves vendor pin; seven new generated-script tests pass. Named entry expanded to 19 selected tools. Owner approved free OpenCurve; installed marketplace **2.0.0** and verified actual 2→201 native Scale keys/eased samples, then one native Undo→2 keys. It remains GUI-operated; no direct MCP integration or comparative speedup demonstrated. **Automatic lifecycle and fresh-graphic frame readiness remain unresolved**, along with production scoping, automatic easing/advanced tools, creative/listening and staff-device acceptance. This supersedes earlier font/size/colour blockers in the historical checkpoint below; no all-tools or production-ready claim.

**22 October implementation checkpoint:** [Local audit, candidate comparison, duplicate benchmark and actual UXP/CEP receipts](CGPH-NOLAN-PREMIERE-INTEGRATION-AUDIT-2026-10-22.md). Builders prepare 1080/FCP 7 XML; storage recovered and native UXP pilot produced original-linked 4K effects/keyframes/title-opacity/transition/audio/render. Owner-approved pinned PremiereMCP CEP subsequently changed real native controls and four exposed AE text fields through MCP; saved 4K/50fps/750-frame render fully decodes, changed words visible. Small blur/save task: GUI 163.435s/7 inputs vs MCP 19.589s/11 requests, orchestration included, not whole-edit/human speed. **No production/creative acceptance:** template font/size locked, exact colour unresolved, live time/frame readback defects and close/panel lifecycle timeout; new test entry restricted to 14 selected tools. 31 vendor mocks pass, native originals unchanged. Next: repaired lifecycle/time/frame validation and approved editable typography template; staff portability remains open. Continue #856/#862; #859 craft untouched.

**Nolan should become CG's strongest video editor, not merely a first-cut assistant.** Nolan should eventually produce compelling, polished **real, editable Premiere Pro projects** so Franco and Sydney mostly review, correct and approve; KG may continue preparing simple timelines until that work is automated. Nolan must improve from human revisions, maintain a distinct CG-level creative standard, and handle routine social reels with minimal repeated Codex interaction.

**Progressive autonomy is the goal; autonomous final client approval is not.** The earlier handoff's human-only creative finishing describes the presently proven workflow, not the long-term ceiling. Nolan should take responsibility for draft creative decisions, finishing passes and self-QA as each capability becomes demonstrably reliable. Actual release, client approval, music rights, brand claims and acceptance remain subject to existing human/CG Dynamics authority.

The immediate problem: approximately **45 October social-video edits** were awaiting production planning during the 21 October discussion, in addition to event/wedding work. Manual SD-card transfer, OneDrive upload then re-download, and time spent making basic timelines are the bottlenecks. The system must remove that round trip **without losing the ability to reuse original footage years later**.

All CG deliverables use **4K originals and 4K final output**. Lower-resolution proxies are permitted **only for editing and remote preview**, always linked back to intact 4K originals for finishing/export. Do not render a 1080p proxy as a claimed 4K master.

## 2. Known hardware and environment — audit before buying

Confirmed by owner in the 21 October conversation:

- The whole team works **from the CG office**; double-booked events sometimes put shooters at different locations.
- **Nolan currently runs on CA's MSI laptop in Codex/Premiere** while the powerful desktop is occupied; it will become Nolan's dedicated computer when free. His current process combines scripting/commands and some GUI/Computer Use; do **not** assume all local Nolan code is pushed to GitHub.
- Separate powerful desktop and smaller desktop; **KG uses the smaller build** to make basic video timelines. Franco and Sydney use laptops, **both with Ethernet ports**. Their laptops currently use Wi-Fi. The powerful desktop already has an Ethernet connection to the office network.
- **Three Canon EOS R6 Mark II cameras**; SD/UHS-II media (not CFexpress). Actual in-camera duplicate-recording settings, card capacity and recording codecs must be checked.
- Fibre is available in the office. Internet throughput is not the same as wired LAN throughput.
- Two separate Adobe Creative Cloud subscriptions/logins and CapCut Pro are confirmed in the earlier handoff. This does **not** prove three or four simultaneous legally licensed Premiere seats.

Purchase records independently established during the discussion (purchase ≠ present installation):

- Palit RTX **5070 Ti 16GB** and 34-inch ultrawide purchased from Wootware in July 2025.
- **KLEVV CRAS C910 4TB Gen4 NVMe SSD** purchased from Evetech in June 2025.
- **Two separate Seagate Expansion 10TB external desktop HDDs** purchased from Takealot in August and November 2025.
- A **6TB additional external HDD** was reported by the owner but its purchase/model is unverified.
- Ryzen 9 3900 / ASUS TUF B550-PLUS / 32GB DDR4 was previously discussed as the powerful desktop configuration, but exact **current** CPU, motherboard, installed RAM, installed GPU, SSD location/capacity and network link rates require a live machine readback.
- A second Ryzen 7 5700 / ASRock B550 / 16GB memory upgrade kit and 1000W PSU were also purchased in January 2026. Do not conflate that build with the powerful desktop or KG's actual installed parts without inventory.

**Do not put receipts, personal addresses, serial numbers, passwords, OneDrive tokens or client raw-media URLs in public GitHub.** Verify drive serials and health privately on machines; write only necessary technical summaries to the protected local inventory.

Read-only inventory acceptance: each computer's actual CPU/GPU, VRAM, RAM, OS and Premiere versions, drive letters, drive models and free space, Ethernet negotiated link speed and port capability, connected USB external drives, SMART/health, existing archive copies, current project locations, Adobe seats/plugins, Windows sharing/network permissions, and actual Microsoft OneDrive account type/remaining quota. **No drive formatting, data movement, merge or deletion** during inventory.

## 3. Target architecture: LAN-first editorial, cloud-backed archive

Office wired network:

- Existing fibre router -> **8-port 2.5GbE unmanaged switch** -> Nolan powerful desktop, Franco laptop, Sydney laptop, KG desktop, and optionally temporary MSI Nolan laptop; reserve ports for growth. Choose physical placement/lengths after tracing the desktop's current router cable; don't order arbitrary cable lengths.
- Use Cat6 patch runs, preferably safely routed rather than loose across footpaths. The powerful desktop's existing Ethernet cable may be reusable as uplink only if cable endpoints/layout are suitable. Verify actual **negotiated** link speed at both ends; 1Gb/s built-in laptop ports remain useful.
- Proposed shopping **only after audit**: one 8-port 2.5GbE switch, enough Cat6 patch cables, optional 2.5Gb USB Ethernet adapters only if speed tests justify them, cable management and potentially a UPS for PC/network and external drives. No new PC, GPU, NAS, SSD or 10TB drive by default.
- A 2.5GbE LAN is a budget-conscious starting point for **4K source + proxy-based multi-editor work**, **not** a guarantee of simultaneous full-quality 4K multi-stream editing. Benchmark real Canon files. Consider 10GbE later only with throughput evidence, SSD/server capability, and a specific bottleneck.

Working storage:

- When available, the **powerful desktop is Nolan's editing/processing workstation and Windows SMB media host**. Use the confirmed internal SSD for **active jobs and proxy/project scratch** where capacity and SSD health permit. Keep Premiere media cache local to each workstation.
- Expose one restricted staff-only share (illustrative only: \\NOLAN\CGMedia), map the **same stable drive letter** (illustrative: P:) for Nolan, Franco, Sydney and KG, and ensure shared project media resolve consistently. Final paths must be chosen after live inventory and must be documented once; do not assume example paths already exist.
- On the MSI **temporary pilot**, use a non-destructive shared test folder and measure the handover; laptop sleep/disconnection means it cannot be the reliable unattended server. When moving to the desktop, perform an explicit path/relink test before switching production.
- External USB HDDs are **long-term original/archive and independent backup media**, not the preferred primary source for multiple editors streaming 4K. Their 10TB/10TB/6TB inventories, failures/free space and duplication levels must be established before assigning roles. Never overwrite historical footage.

Cloud:

- Retain the established **client-specific OneDrive tree and canonical Dynamics content/run/video mapping**. OneDrive is the **background off-site copy/remote exchange** of verified raw media and final approved exports, not the required staging point before anyone can edit in the office.
- Sync/upload completed, stable, verified local originals **in the background**, with resumable transfers, rate limits and independent confirmation of remote item counts/bytes and hashes where available. Do not treat a "sync submitted" flag as a verified backup.
- Check which **OneDrive personal vs business** account actually owns the raw folders, current quota and API permissions before choosing Microsoft Graph, OneDrive desktop client or rclone. Maintain private credentials and least-privilege permissions; do not introduce a second unapproved cloud provider.
- Sync mirrors alone are not backup: retain **a second physically/logically independent recoverable copy with versioning**, and test actual restoration. Apply retention/archive policies only after owner approval and documented recovery verification; never delete original media just because an edit was exported.

**Existing OneDrive authority is unchanged:** CG Dynamics Client Schedule -> exact Content Run -> one Content Guideline -> existing canonical internal video folder -> review -> approved final to the existing client-safe destination. No new speculative OneDrive subfolder design, no new client portal and no raw footage publicly visible. Existing source identities/folder IDs survive this workflow.

## 4. SD-card intake (zero manual reorganisation)

Every SD-card insert at the intake PC should start an **observable, bounded, idempotent** workflow, **not** silently wipe, move or rename the card.

1. Detect source media, camera identity where reliable, date, existing import history, card volume and available destination space. User selects/confirms **exact CG Dynamics client + Content Run / real event** when metadata alone is ambiguous; never guess identity from a filename or event title.
2. Import untouched Canon originals, associated audio and metadata to the **existing authorised production media identity**, avoiding filename collisions across cameras/cards (e.g. files named C0001.MP4 can repeat). Use a transfer manifest retaining original relative paths, hash/byte count, source volume/camera, timestamps and destination.
3. Verify copied files with hashes/checksums and a readback/ffprobe/media-integrity test. Interrupted transfers resume; repeated imports skip matching hashes and flag conflicting filenames. Corrupt/incomplete clips quarantine in an internal diagnostics state, without deleting sources.
4. After usable clips settle, generate source indexes, thumbnails/contact frames **and motion previews**, automatic scene boundaries and 1080p editing proxies linked to originals. Keep frame rate, timecode, audio sync, orientation and colour metadata compatible with the real Canon recording profiles.
5. Begin Nolan's preparation on fully verified clips **as soon as available**. The larger backup to OneDrive and independent archive can continue in parallel; show explicit **LOCAL VERIFIED / CLOUD PENDING / CLOUD VERIFIED / SECOND BACKUP VERIFIED** receipts.
6. SD cards **must not be erased/reused** until **at least two independently checked copies** exist and card reuse is cleared by authorised staff. A duplicate simultaneous camera-card recording, if enabled and checked, adds protection but is not automatically proof of a completed off-device backup.

For split-location shoots, use **existing staff laptops plus portable SSD/reader** where necessary: make verified local copies, upload only proxies/manifests if connectivity allows, and transfer full originals into the office when practical. The plan must still work **offline** and with 4K media too large for event Wi-Fi. No specialty cloud-card uploader required for phase 1.

## 5. Real editable Premiere handover — not rendered MP4s

Use **Adobe Premiere Pro Productions** or the best supported equivalent for the *installed Premiere version* and Windows shared storage. Prototype with exact installed seats before choosing a production-level structure:

- Nolan opens the exact existing brief/guideline and footage for one assigned video, creates/or updates an **editable Premiere project and sequence** with the actual source-linked cuts, separate dialogue/music/SFX tracks, graded originals or adjustment layers, titles and brand assets.
- Keep predictable non-authoritative **sequence suffixes** such as _SELECTS, _ROUGH, _MASTER; preserve the already-authorised client project folders. Do not create a second Dynamics deliverable table.
- Nolan saves the project and **releases any Premiere Production project lock**. Franco or Sydney opens that exact timeline over the shared LAN from the laptop, reviews, edits and saves without a 4K OneDrive download. KG may contribute in an assigned project without concurrent conflicting locks.
- Validate multi-PC relinking, same Premiere version, licensed plugins, fonts, LUTs, compatible audio/video effects and GPU requirements; do not claim an edit is portable if the other editor sees offline media or missing effects.
- Proxies should permit responsive multi-user preview; 4K originals must be accessible for effects, colour review and final **genuine 4K export**, including source-audio alignment. Store personal local media cache separately; do not sync Premiere cache via cloud.
- Support an explicit "Nolan → Editor review → corrections → Nolan review/reusable learning" handback with snapshot/version history and a protected previous working project. Never have Nolan silently overwrite a human-reviewed project.
- Maintain authorisation to export/publish with human review; do not replace the established client WhatsApp approval and CG Dynamics status evidence.

**Acceptance demonstration:** Nolan creates a real editable Premiere 4K project on MSI; Franco opens it over Ethernet, changes a clip and music mix, saves; Nolan reopens the changes; no offline assets, broken lock or full OneDrive re-download. Repeat later with the desktop as host.

## 6. Nolan's editor engine: automate repeated processing, reason where creative decisions matter

Build a modular, testable, local-first pipeline rather than an agent clicking everything in Premiere on every iteration.

| Stage | Preferred default | Where reasoning helps |
| --- | --- | --- |
| Card copy, checksum, dedupe, retries, remote sync | Deterministic scripts/services, durable job receipts | Only ambiguous client identity or safe conflict resolution |
| Footage probing/proxies/waveforms/scenes/contact sheets | FFmpeg/ffprobe and locally tested open tools | Prioritise which candidates need deeper visual review |
| Spoken content | Local transcription when accurate; use supported Premiere transcript tools | Match a **verified** script to takes, genuine quotes and moment intent |
| Visual candidate detection | Timecoded local analysis, motion snippets, embeddings/search where useful | Judge emotion, subject, focus, crop, authenticity and visual proof |
| Story assembly | Structured editable shot plan and template/UXP/script API when released and verified | Choose hook, narrative progression, shot alternatives, ending |
| Timeline authoring | Premiere's **actually supported** automation/plugin APIs with reversible operations | Creative selection; GUI/Computer Use **only for unsupported exceptions** |
| Music/sound and grading | Licensed asset library, reusable track/layer/templates, technical normalisation | Deliberate timing, tension-release, mood, genuine source sound |
| Quality checks/render | Local media checks, project relink/health, audio/black-frame/safe-zone checks | Creative self-review and uncertainty decisions |
| Feedback/revisions | Timecoded diffs, manifests and reproducible applied edits | Identify *why* an editor changed an edit; improve next attempt |

**Skills and plugin policy:**

- Reuse the in-flight [PR #859 CG video story editor skill](https://github.com/CGProductionHouse/CG-Dynamics/pull/859) after its review; do not silently copy/overwrite that skill on another branch. Its source-screening helper and rhythm/sound/moment playbooks are a foundation, **not** proof of a complete autonomous engine.
- Existing released Premiere Media Intelligence, Text-Based Editing, Paper Edit and audio tools are baseline. Jumper visual retrieval, licensed BeatEdit/music markers and optional dialogue-first tools (e.g. approved AutoEdit) require separate verification/seat approval. Existing CapCut Pro remains secondary, not an assumed fully-editable Premiere handover.
- An AI model must not hallucinate filenames/timecodes, invent shots, swap client footage, fake words/faces/products or export previews as final deliverables.
- Do **not** make unreviewed Eddie AI V4, Premiere AI Assistant beta, FireCut, or third-party client-media uploads core dependencies. New vendor purchases/subscriptions and raw-media uploads need owner approval.
- Cache deterministic results by file checksum and analysis/model version; cache script analysis by **guideline version**. Re-run only affected clips/stages after revisions, not the whole video.
- Allow bounded per-video budgets for AI calls, task timeouts, retries and memory/VRAM; support pause/resume, fail-fast, honest BLOCKED states and a queue that does not consume tokens while merely polling.
- Codex is for **engineering, difficult editorial decisions and quality improvement**. Camera import, backups, proxies, rendering, basic timeline authoring, audit receipts and scheduled batch jobs must run without a constant interactive Codex session once implemented. Local model use is an option after **real GPU and quality benchmarking**, not a promise it replaces stronger creative reasoning.

## 7. The most important deliverable: Nolan's *creative* quality standard

Do **not** optimise only for edit speed or fancy AI. Nolan should reliably produce the type of thoughtful, specific, premium content that CG wants to sell.

### Grounding before touching the timeline

For **each actual client video**, fetch the exact approved Content Guideline/script, campaign objective, client-specific brand guidance, target viewer, platform, permitted claims, CTA, approved graphics/music, and relevant **CG-created, rights-cleared final exports**. Never treat an arbitrary old reel as mandatory style, and never use client A's confidential footage in client B's edit.

Write a one-sentence **viewer story**: who cares, what changes, what proves it, what the audience should feel/do. Verify that the footage really supplies the proof. If a requested script scene was not shot, flag **MISSING SHOT** rather than fabricating one. Maintain project-specific shot/take and rejected-candidate reasons.

### Choose *moments*, not just clips

- Analyse actual **moving** footage and usable source in/out timecodes. Contact sheets are triage, not substitutes for viewing motion.
- Prefer genuine expressions, relevant actions, well-framed meaningful proof, clean focus/exposure/audio, good movement and natural continuity. Reject staged/awkward expressions when better real alternatives exist.
- Consider correct 9:16 crop and motion across the shot even if original is landscape; check heads/products are never cropped incorrectly; preserve 4K composition and safe zones.
- Use wide/medium/detail alternation for a **reason**: establish, demonstrate, reveal, connect, resolve; avoid repeated almost-identical B-roll and meaningless stock-feeling montages.
- For scripted speech: match the **meaning and wording of the authorised script** to real recorded takes; flag omissions, repeats, misstatements and cut-incoherent quotes. Afrikaans/bilingual speech, names and captions need reliable human accuracy review if models/transcript support is imperfect.

### Shape the edit like a skilled editor

- Open with an **earned hook** in the first seconds: action, curiosity, meaningful human expression, clear product benefit, proof, or deliberate sound. Do not force one generic "3 fast shots" template on every brand.
- Build a **narrative arc** and purposeful rhythm. Use fast cuts where information/motion calls for them, then space for the viewer to register the hero moment ("rush and release" is an option, not a mandatory recipe).
- Audition several **licensed** music cues at beginning, middle and ending, rejecting wrong moods, conflicting vocals, bad final phrases and unclear rights. Cut **to meaningful musical phrasing**, not blindly every beat.
- Sound is layered: source sound, useful natural transitions, controlled pre-laps/tails, restrained whooshes/risers/impacts, intelligible dialogue and appropriate music ducking. Individual elements remain editable on separate tracks.
- Transitions and motion graphics must serve meaning, brand and continuity; no gimmicky overuse or cheesy one-size-fits-all effects.
- Balance exposure, white balance, skin tones and product truth across actual cameras. Grade to the client's aesthetic without materially falsifying products, people or spaces.
- Make branded text, CTAs and captions readable on a phone, safe from UI overlays and correctly timed. Preserve names/prices/offers exactly as approved; never make up statistics or consent.
- Review the final **with sound, without sound, and on a phone-sized vertical preview**, not just a still frame or desktop timeline. Technical polish does not excuse a weak viewer story.

### Editable evidence and reviewer feedback

Every draft outputs: a playable preview, **editable Premiere project**, source/select ledger with timecodes, music/SFX/brand asset licence refs, a brief creative rationale (hook/arc/outro), missing-shot/uncertainty flags, 4K export settings, and the review link inside the **existing** approved staff workflow.

Franco/Sydney mark corrections with timecodes and **reason codes**, e.g. WRONG_SHOT, WEAK_HOOK, SCRIPT_MISMATCH, CROP, PACING, MUSIC_MOOD, MIX, COLOUR, BRAND, CAPTION, RIGHTS, MISSING_MEDIA. Nolan compares the revised project with his previous version and records the editorial **principle** learned. Do not blindly imitate one correction across unrelated brands. Only verified human-reviewed examples become reusable style references; no unapproved bulk self-training on private client content.

### Quality rubric for pilot review

Use an **internal provisional 100-point rubric** to compare Nolan against finished CG edits; weights are targets, not established effectiveness research:

| Criterion | Points |
| --- | ---: |
| Story, truthful script and hook | 25 |
| Shot and moment selection, relevant proof | 20 |
| Meaningful pacing and visual continuity | 15 |
| Music, dialogue mix, sound design | 15 |
| Client brand, graphic clarity, CTA | 10 |
| 4K technical craft, colour, crop, captions | 10 |
| Rights, consent and claim safety | 5 |
| **Total** | **100** |

**Fail the deliverable regardless of score** for wrong client/unauthorised footage, unlicensed music, untrue claims, unsupported/replaced dialogue, critical missed shot or release brief, broken project/offline media, wrong actual 4K source/export, confidential raw exposure, major audio/caption error or unapproved publication.

Reviewers provide a short scored assessment plus timecoded changes. Track *actual human amendment minutes*, whether corrections were creative or technical, whether Nolan's chosen moments survived, per-video elapsed compute/cost, model usage and eventual accepted result. Quality must **not** be traded for a fabricated "80% automated" headline.

## 8. Skills, style memory and professional learning loop

Maintain a reusable, versioned CG **editor craft skill** (source PR #859) plus **client-scoped style profiles** derived from authoritative guidelines, real approved past edits and reviewed corrections. Do not create a new client truth database when CG Dynamics already stores brand/content authority.

Recommended split:

1. **CG craft foundation:** story, authentic moment selection, transitions, sound mixing, colour, motion, framing, quality gates.
2. **Per-format recipe:** scripted talking-head/testimonial, 15–60s service/product reel, high-energy event/social highlight, premium commercial, separately supervised wedding/once-off.
3. **Per-client style memory:** approved typography/colour/logo, edit temperament, footage priorities, constraints, prior approved hook examples and no-go language.
4. **Per-edit working manifest:** exact source hashes/ranges, chosen/rejected moments, music provenance, edit choices, confidence flags, versioned review notes and accepted revisions.
5. **Promotion gate:** specific learnings become reusable only after a reviewer validates them; isolate client data; never overwrite the source edit, original footage or stronger prior reference.

Develop stable local Premiere templates and a tested automation adapter rather than spending Codex usage reconstructing every new edit from zero.

## 9. Project integration, authority and security

- CG Dynamics **Client Schedule monthly_deliverables** owns regular obligations; one **Content Run** owns one **Content Guideline**. Event/once-off/wedding scope requires accepted quote/contract and #841's owner override, **not** mere calendar title or speculative backlog counts.
- Reuse canonical video production IDs, client-specific media mappings, staff-only Video Pipeline and actual **READY_TO_EDIT / IN_EDIT / IN_REVIEW / FINAL_READY** states where supported. Technical Nolan job records should be local manifests/receipts attached to canonical video IDs, **not a second business Planner/task table**.
- Use exact protected authorisation to map media; missing client folder/contract/script/license must block or request review, never fall back across clients.
- Keep all raw video strictly staff-only. No public client-portal raw sources, no hard-coded Microsoft tokens/paths, no secret-bearing console logs or Git commits.
- Preserve release gate [#679 hosting budget and uptime](https://github.com/CGProductionHouse/CG-Dynamics/issues/679): development and local tests only unless a separately approved deployment. Do not introduce uncontrolled Vercel compute, unbounded media storage or new paid subscriptions.
- The existing commercial/marketing team continues in parallel. **Nolan's worker/engine implementation is a separate tightly owned workstation lane**. Coordinate any shared CG Dynamics code changes and PR #859 with #856/#381; no duplicate repo-wide Codex mission that conflicts with accounting, CG Pay or CG Dynamics development.

## 10. Implementation milestones, in exact priority order

### M0 — Recon and safety (read-only, no purchases)

- Inspect actual Nolan MSI scripts/repo (including uncommitted code and Computer Use usage) and the current PR #859 before touching it; classify **already automated / partially automated / manual / missing**. Preserve functional code.
- Hardware and drive inventory, reliable backups, software licences/versions, Canon format/profile sampling, OneDrive actual type/quota/mapping, real network link rates and disk speed baseline.
- Identify ONE real authorised pilot social video and its exact guideline, footage and approved CG final examples; note uncertain media/rights blockers.
- Output concise verified inventory and blocklist, no speculative hardware order.

### M1 — Reliable LAN and 4K ingest with existing MSI

- Wire MSI and Franco first (then Sydney/KG), install/test 8-port 2.5Gb switch if needed and measure sustained **real-file** SMB transfer speeds and 4K Premiere playback; do not depend on a speed-test website.
- Non-destructive SD import with collision-safe filenames/manifest, checksum+readback, duplicate/retry handling, simple status receipts; automated proxies; independent verified copies and background OneDrive upload.
- **Acceptance:** one real Canon card import safely completes and starts preview preparation **before OneDrive upload finishes**; network disconnect and repeated card insert recover without missing or duplicated media; raw originals remain reusable.

### M2 — Real Nolan → Franco Premiere edit handover

- Create editable Premiere sequence on MSI, use shared local media and save/release Productions lock. Franco opens and edits on laptop without a second full-resolution OneDrive download; Nolan reopens his changes.
- Test same Premiere version, effect/fonts/brands availability, project versions, 4K original relink, portrait framing and true 4K export.
- **Acceptance:** both systems render the revised cut without offline media or project corruption; no false approval status changes.

### M3 — Nolan selects the *right moments* and follows a real script

- Implement indexed clips + motion screening + timecoded selects; robust dialogue alignment where supported; structured story plan; multiple candidate hooks/endings; controlled Premiere timeline creation through tested APIs/templates.
- Compare **five varied actual CG videos**: scripted English, Afrikaans/bilingual where available, B-roll-only reel, event highlight and a mixed product/service case. Weddings/premium work remain separately supervised until tested.
- **Acceptance:** reviewer can explain and inspect why each main shot/quote was selected; no made-up source ranges; reviewers prefer most of the selected footage over the fallback manual rough cut.

### M4 — Polished audio, colour, branding and self-QA

- Sound-map/music audition, licensed SFX layers, audio quality, grade consistency, branded graphics, captions, safe zones, black-frame/missing-media checks and self-review pass.
- Benchmark an editor-complete draft against a real human-accepted CG version with the quality rubric. Retain side-by-side proof and **timecoded revision ledger**; do not declare Nolan better than the team without repeated blind review evidence.
- **Acceptance:** Premiere timeline remains fully editable, original 4K files/colour metadata remain linked, human amendments reduce over several comparable trials **without creative regression**.

### M5 — Move Nolan to the powerful desktop; unattended processing

- Only after real workstation availability: install/migrate proven tools, media share and necessary licences to high-spec desktop, with a safe snapshot/rollback and explicit media relink tests. MSI becomes a client/editor/supervision option, not a fragile always-on host.
- Background worker with bounded job queue, clear per-video status/receipt/health, rate limiting, resumable uploads, CPU/GPU concurrency, disk-space warnings and actionable fail/blocked reasons.
- **Acceptance:** Nolan can take a verified content-run/video batch, prepare several **separate** editable projects and notify correct editor of review readiness **without needing an always-open interactive Codex window**.

### M6 — Scale to events, doubles and historical archive reuse

- Field laptop/portable SSD proxy-first handoff for simultaneous events; offline ingest, secure transfer and later full-quality relinking.
- Make older **verified, client-authorised** original footage searchable by shot/moment and usable for new same-client content, preserving age/context/rights and without mixing clients.
- Only evaluate more 10TB backup storage, UPS, 10GbE or NAS **against measured capacity and restore/throughput failures**. Owner preference is well under R20,000 additional investment where feasible, with **initial switch/cabling in low thousands** if audit confirms.
- **Acceptance:** no missing event media/delivery due to upload handoff, no single-copy originals, working restore demonstration and a repeatable monthly quality/time/usage report.

## 11. Required evidence on every milestone

Record in owning issue/PR (and a private local audit manifest where footage paths are sensitive):

- Exact current code ref/branch and files changed; machine environment and Premiere version; software/provider licensing gates; tests/fixture receipts and any known unsupported Premiere automation operation.
- A real authorised test footage set with **no public private media URLs**, import receipt, source/backup/restore verification, source->timeline clip mapping, changed-sequence reopen and 4K export verification.
- Before/after editor-hours and elapsed ingest/export time, project recovery, errors/retries, Codex/UI interaction count, model/API usage, accepted edit quality/rubric and specific creative reviewer comments.
- Honest state: **PLANNED / LOCAL PROTOTYPE / REVIEWED / PILOT READY / PRODUCTION VERIFIED / BLOCKED**. Documentation or screenshots alone are not proof of autonomously completed edits.

No surprise purchase, no production database modification, no change to existing OneDrive structure, no token/credential logging, no client delivery, and no merge/deployment without the existing appropriate approval gates.

## 12. Nolan's first implementation instruction

**Read AGENTS.md, #856, this game plan, the existing 20 Oct video handoff, craft pack and PR #859. Recover the actual MSI-local Nolan source before coding. Continue the existing owning lane. First deliver a read-only verified inventory of the local automation, exact PC/storage/network/software state and the smallest M1/M2 pilot for one real authorised 4K video. Do not buy, deploy, move/delete raw footage, create duplicate Dynamics tasks or edit active #859 files in parallel.** Then implement in bounded verified increments and maintain the owning GitHub issue/PR as the single handoff.

---

**This is a forward-looking owner brief.** It deliberately distinguishes confirmed equipment purchases, owner-reported use and still-unverified machine/deployment details; it does not claim that Nolan currently achieves autonomous professional editing, or that a specific plugin does so.
