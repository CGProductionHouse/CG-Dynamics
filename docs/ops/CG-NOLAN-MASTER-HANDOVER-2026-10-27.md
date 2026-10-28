# CG Production House — Nolan master continuity handover

> **28 October owner correction for both Studio PCs:** read the mandatory
> [shared editing rules](NOLAN-STUDIO-SHARED-EDIT-RULES-2026-10-28.md) before an
> edit/revision. Approved logo animation, beat-based cuts, full-height three-shot
> horizontal stacks, contextual music, source-specific colour matching and
> directly playable HD review media are required. Office signature: Nolan Studio
> PC, not BC. Current office ownership/delivery receipts are #903/#904; MSI's
> existing jobs and PR #875 stay MSI-owned. Older connection/setup states below
> remain historical, not current proof or a reason to duplicate either lane.

**As at Tuesday 27 October 2026 (Africa/Johannesburg).** Owner-approved direction and actually verified progress. This is a handover for the NEXT ChatGPT conversation and for authorised Codex staff/Studio lanes, not proof that all steps below are implemented.

## 1. First read and authorities
- **Core storage implementation:** https://github.com/CGProductionHouse/CG-Dynamics/issues/894 — read latest content from TOP. Contains evolving superseding owner updates, including LAPTOP-LED remote preparation.
- **Nolan Studio development:** https://github.com/CGProductionHouse/CG-Dynamics/issues/874 — next skill/tool audit and reference-to-edit development mission.
- **First real client Studio trial:** https://github.com/CGProductionHouse/CG-Dynamics/issues/872 — fresh PSG Bloemfontein video, only AFTER Studio skill development; not a separate concurrent PSG prompt.
- **Completed synthetic technical engine:** https://github.com/CGProductionHouse/CG-Dynamics/pull/873 (DRAFT), issue https://github.com/CGProductionHouse/CG-Dynamics/issues/871 .
- **Permanent two-mode creative directive:** https://github.com/CGProductionHouse/CG-Dynamics/pull/859 ; the core directive is `.agents/skills/cg-video-story-editor/references/nolan-core-creative-directive.md` on `codex/cg-video-editing-craft`.
- **CapCut staff handoff research:** https://github.com/CGProductionHouse/CG-Dynamics/pull/870 — draft, Windows host/staff acceptances not complete.
- **Repo authority:** https://github.com/CGProductionHouse/CG-Dynamics/blob/main/AGENTS.md ; always read current `docs/ops/CG-DYNAMICS-OPS-HANDOVER.md` and `docs/ai-workforce/CA-CODING-PROMPT-CONTRACT.md`. Manual Codex prompts ideally only 4–7 short lines; GitHub holds substantive brief.
- **This document is a cross-thread snapshot**. Where new live GitHub/CG Dynamics evidence disagrees, reconcile and document it rather than silently treating this snapshot as newest.

## 2. Big-picture owner decision
There are TWO complementary Nolan roles, not a third separate "sorter":
- **Nolan Assistant:** staff-facing assistant operating in relation to Nolan’s office PC; SD-card ingest and verification; file custody, organisation, searchable catalogue across removable drives; responds to Sydney/Franco’s media fixes and notes; prepares editable Premiere/CapCut timelines/projects where that genuinely helps the staff; ties client media/jobs to CG Dynamics, CG Hours, Content Runs, the Content Guidelines, schedules and tasks.
- **Nolan Studio:** autonomous, tool-agnostic premium video editor. It studies an owner-accessible real reference with moving pictures and sound, identifies exact creative techniques/timing, creates original brand-true edits using CG's authorised/licensed media, renders/revises real 4K-capable output with precise scene isolation and sound, and grows a tested reusable effects library. Python/FFmpeg, HyperFrames/GSAP and compatible tools are allowed; forcing Premiere/CapCut is NOT required.
The long-term aim is CG staff + owner operating via CG Dynamics and a private local content library, without huge OneDrive round trips or everyone duplicating camera footage onto laptops.

## 3. Hardware and networking — evidence versus assumptions
- **Confirmed by owner:** Nolan’s office PC and all staff laptops currently receive INTERNET over the now-connected wired Ethernet installation. Two 20-metre Cat6-type Ethernet leads purchased. This is NOT yet confirmation of Windows file sharing, common LAN/VLAN access, or actual Gigabit negotiated transfer.
- **Confirmed from user photos:** Tenda **TEG1008M V2.0**, eight-port Gigabit switch, label **9V DC 600mA**; Tenda **SG105**, five-port Gigabit switch, label **5V DC 600mA**. Different power adapters MUST NOT be interchanged. Existing MikroTik fibre/network hardware and UniFi Wi-Fi remain intact. Avoid duplicate Ethernet uplinks creating loops.
- **Reported prior Nolan PC inventory, to verify locally:** Ryzen 9 3900, RTX 5070 Ti 16GB, 32GB RAM, ASUS TUF B550-PLUS, internal KLEVV NVMe **4TB**. Internal drive is for programs, editing cache, renders/proxies — NOT the permanent central CG media archive.
- **Previously reported externals:** two populated Seagate Expansion **10TB** drives and another populated **6TB** external (26TB nominal total). Every disk may contain important, potentially unique client footage and duplicated clips. Real health, used/free, interfaces, serials and original copy coverage remain UNVERIFIED.
- **First 10TB:** owner intended to attach one 10TB external to Nolan PC for initial inspection; no verified confirmation in this conversation that the device is actually attached, healthy, or accessible remotely.
- **Purchased a cheap basic SD reader** for convenience; pro fast multi-card reader still on purchase watchlist. Aim: two independent full-size SD UHS-II USB3 readers or proven dual full-size simultaneously readable unit (NOT merely SD+microSD combo).
- **Existing Ethernet switch covers staff wiring**; no NAS, new router, new workstation or expensive new switch needed now. Also do not buy a backup drive until actual unique media volume and backup deficit measured.

## 4. Central storage model — owner-approved intended allocation, NOT yet migrated
All drives physically connect by suitable original power adapters and USB3 to existing Nolan Windows PC; Nolan owns shared-media access, organisation and backups. Staff access a Windows password-protected local SMB share, preferably using one stable UNC path / mapped letter, with individual user credentials. PC ON and drives attached are required for availability.

- **10TB #1 — CG ACTIVE PRODUCTION (always available at office):** ongoing genuinely monthly clients plus current in-progress event/wedding work. Staff access live original media from this drive; local editing proxies/caches are fine when needed. The exact active client set must reconcile actual *package and schedule* truth from CG Dynamics and canonical CG Hours entity mapping, not stale CRM flags.
- **10TB #2 — CG CLIENT & EVENT ARCHIVE (normally unplugged/on demand):** former clients, one-off completed events, old campaigns, annual-event promo reuse. Search while detached using small persistent manifest pointing to physical drive ID and relative files.
- **6TB — CG WEDDINGS (normally unplugged/on demand):** completed weddings kept apart; a new unfinished wedding can temporarily stay on Active until verified completion and independent backup, then archive.
- **Backups are SEPARATE from all three logical libraries.** One unique copy on an archive disk is NOT backup. Need an independent verified restore point, ideally protected/versioned and at least one copy kept separately; if >20TB unique, an additional 10TB drive alone won't cover all. Never auto-mirror deletion into the only backup. No deletion until protection is confirmed.
- **Swapping physical drives:** dismount properly; don't unplug while copying/editing. Preserve volume identifiers, reliable letter/mount mapping, no drive-letter collision. Shared source paths will be unavailable when external disconnected; reattach/relink correctly. Existing media/project paths must not be renamed blindly.

## 5. Exact CG Dynamics + Microsoft client/data integration
Existing current product and data authority must be reused; don't build a competing standalone client database.
- CG Hours intended canonical client naming and IDs, subject to exact identity reconciliation; historic reconciliations are NOT automatically correct. See `docs/client-directory-reconciliation-2026-09-08.md`, `docs/cg-hours-dynamics-sync-vision.md`.
- CG Dynamics holds client profiles, active packages/monthly deliverables in **Client Schedule**, Content Runs (one canonical Content Guideline per run), planned shoot/media needs, Brand Hub, approved client identity, and client portal. Media catalogue should store stable foreign IDs as metadata only, media bytes stay locally.
- Teams / Planner / CG Work contain real operational assignments, but a historic task or calendar shoot does not prove a current client retainer. Read sync freshness and source provenance. **Never auto-create fake tasks or mix operational CG Calendar with Client Schedule.** Read `docs/ops/CGPH-PLANNER-CALENDAR-CLEANUP-OWNER-HANDOVER-2026-10-18.md`.
- Suggested future per-job metadata: exact client ID + confirmed display/brand, job/event/wedding ID, content-run ID, guideline/video ID, actual monthly deliverable ID when linked, Planner task ID when linked, year/date, archive status, exact physical volume ID, relative path, immutable source hashes, exports, rights/licence, backup count/last restore.
- Proposed future folder naming (NOT yet migrated): `Clients/<canonical-client-slug>__<stable-id>/<year>/<year-month>_<content-run-or-job-id>/01_Originals, 02_Selects, 03_Projects, 04_Photos-Design, 05_Exports, 06_Approved`; `Events/<year>/<event>__<job-id>`; `Weddings/<year>/<job-id>`. Keep camera card trees intact inside originals and existing NLE project paths safe.

## 6. OneDrive / costs / client portal distinction
- Current OneDrive is reported full again and slow/unreliable for huge raw footage. Owner wants to keep OneDrive/SharePoint where necessary for **client portal finished approved videos/photos/designs and verified Brand Identity/logo assets**, not permanent heavy raw source-media editing.
- Existing CG Dynamics Brand Hub/client library OneDrive mappings and sharing must NOT be broken. Historic OneDrive material may be cloud-only, placeholder-only locally, or shared shortcuts; simply seeing it in Explorer does not prove archived bytes.
- Audit real tenant account, quotas, storage by folder, OneDrive version/recycle-bin overhead, actual bills, packages and dependencies. Preliminary Gmail evidence: Business Basic renewal 26 September 2026 and two licences as of 6 October 2026; this is NOT proof of the expensive storage plan price or which drive is full. Keep Teams, Planner, authentication, existing portal and any mail dependencies functional. **No Microsoft subscription cancellation or downgrade until costs/dependencies proven and owner approves**.
- OneDrive cleanup follows full source copy, hash verification, independent backup restore, portal link checks and exact file-specific owner approval. No automated mass cloud deletion/renaming in initial audit.

## 7. Today’s actual state and next Nolan Assistant action
- Network **internet works**, but LAN reachability, SMB share, staff file transfer speed and access permissions have NOT been independently tested in this chat. No physical drive inventory, drive capacity report or deduplication has been completed here.
- The graphic designer was still using the Nolan PC; owner asked whether **Codex on her own Ethernet-connected laptop** could begin setup. **YES for planning, local network checks and drafting scripts**. No remote host control is implied by sharing the wired network. Remote administration requires existing authorised session/credentials/host-side service, must not displace designer or install disruptive remote agent. Issue #894 already contains owner-approved **laptop-led** plan. If Nolan PC unavailable, mark host inspection BLOCKED, prep host-local steps to run when free.
- Start non-destructively: on owner laptop check actual network link, address/gateway, (if authorised) reachability of Nolan; use GitHub/CG Dynamics/Teams read-only authority to build client mapping and prepare inventory scripts. On Nolan PC when designer finishes and Sydney present: detect first connected 10TB by volume ID, record label, used/free, health, top folders, create read-only file manifest. Do NOT initialise/repair/format, rename/move/delete. Read each remaining disk similarly, then compare manifest by size and exact cryptographic hashes in bounded runs; same filename is insufficient proof of duplicates.
- In parallel when permissible, create a **disposable password-protected Windows SMB test share** with least-privilege individual access; have one staff laptop authenticate, write/read/rename disposable file, verify hash and real transfer speed. Require explicit permission before admin/global firewall or network reconfiguration.
- Sydney provides historic drive and shoot context; no one should classify supposedly duplicate/archive-only files without her contextual review.
- Produce table of drives (label/serial, used/free, clients, media class, unique files, verified duplicate bytes, missing backup) + OneDrive unique cloud sources + actual needed future backup TB. Owner approves allocation/migration only afterward.

## 8. Nolan Studio — proven baseline and next real creative acceptance
- Completed bounded isolated synthetic proof in [draft PR #873](https://github.com/CGProductionHouse/CG-Dynamics/pull/873): fictional ARC/FORM, 2160×3840, 24fps, 18.0s baseline and 17.5s revision; Python/Pillow/NumPy/FFmpeg, scene-level source manifest/cache, protected scene bytes and decoded frames unchanged. Initial render 43.91s, revision 18.58s. Builds/technical scans passed. Actual audio listening and full-speed phone creative approval **NOT yet done**. Synthetic silhouette/audio is NOT evidence of sophisticated CG-level client editing.
- [#874](https://github.com/CGProductionHouse/CG-Dynamics/issues/874) is complete development brief: audit real licences, examples and software source, not blindly download random skills. High-priority candidates: Nate Herk Edit Kit, HyperFrames, ffmpeg-skill, free247editor wrapper, selective motion/audio/real-mask techniques; assess SAM2 hardware/licence; practical Adobe/CapCut/Envato tools where justified. Avoid API-heavy/NEMO_TOKEN/commercial ambiguities, unapproved AI credits, client footage uploads or mass `npx skills add` installs. A downloaded `SKILL.md` does NOT equal working/mastered effect.
- User expects Nolan to study a FULL moving/sounding reference (e.g. PSG TikTok `https://vt.tiktok.com/ZSgHdr123/`), reconstruct original CG-branded techniques: kinetic/perspective text, real-person foreground occlusion/masking, clean tracked motion, purposeful sound, believable transitions. If URL cannot be played, say "not viewed" and obtain owner's accessible file. Verify actual side-by-side A/B output, exact isolated revision and staff creative acceptance; then mark reusable skill mastered.
- **PSG [#872](https://github.com/CGProductionHouse/CG-Dynamics/issues/872) is the FIRST real client creative test AFTER capability building in SAME Studio lane**, NOT another parallel independent PSG agent. Approved/published PSG **"Your Business Grew"** is intact, reused shots excluded. New PSG concept/approved brand must feel different from generic TBS or the published edit. Use real appropriate client media where permitted and high-quality continuous music/SFX. Draft review only, no external publishing.
- Nolan Assistant (storage/sorting/staff timeline handoffs) and Studio (autonomous high-end renders) coordinate through the same media catalogue but have separate scope to avoid file/desktop contention.

## 9. Permanent approval WhatsApp process (DESIGNED, NOT YET CONNECTED)
- For each genuine Nolan Studio client draft prepare **MP4 + client-branded cover photo + complete ready-to-use caption** (plus optional short rationale/questions).
- Send messages **ONLY to one explicitly verified allowlisted "CG Nolan Approvals" WhatsApp group ID**, once Nolan has his own phone number, authenticated session, verified membership and proven reliable send/read route. May read other explicitly authorised groups for context; **NEVER send/react/delete/mark-read/write anything elsewhere**. User planned dedicated Nolan WhatsApp number but not provisioned here.
- Create durable **awaiting review** task tied to client/job/version/asset hashes and actual message IDs. With a real permitted process/scheduler, watch Nolan group feedback from CA/team, identify version/timecoded scene revisions, reply/questions in THAT group only, rerender exact protected edits, resend video+cover+caption, keep active until explicit approval. Silence is not approval. A chat tab alone cannot serve as a 24/7 watcher.
- If no proven WhatsApp connector, package everything and log BLOCKED_WHATSAPP_DELIVERY; never claim the message was sent, never substitute another group or personal account.

## 10. Safety, purchases and unfinished gates
- No destructive media cleanup, disk format, automatic dedup/removal, changing current NLE source paths, SD-card erasure, cloud cleanup, or external customer posting without verified independent copy and explicit owner review. Owner's stance: "we cannot delete anything" until custody/backup assured.
- No new NAS or R30k network storage; use existing PC and external hardware. Buy backup drives only AFTER used/unique/duplicate/restore analysis. SD reader upgrade can be separately purchased after confirming real Canon card formats. Gigabit Tenda switches already in office; do NOT purchase another switch.
- Same-PC concurrent GUI control can disturb current design or editing work; no forced takeover. Any Windows remote-login/admin/firewall/share change should be narrow, approved and verified.
- Three main NOT YET DONE items: (a) tested staff SMB shared folder; (b) Sydney-guided physical media + OneDrive inventory and real backup plan; (c) actual Nolan Studio impressive reference-driven effect and first PSG edit/WhatsApp approval loop.
- OneDrive retention and savings comparison, real per-client active status, archive purchase and privileges all remain subject to current evidence, not assumptions.

## 11. First message for a NEW ChatGPT conversation
"Continue CG Nolan handover of 27 October 2026. Read this document and live GitHub issues #894 (storage, latest laptop-led directions), #874 (Studio) and #872 (PSG). Focus first on getting owner laptop-led Nolan Assistant safely started and a staff SMB pilot, with Sydney-guided read-only first 10TB drive inspection. Ethernet internet works, but shared access and disk inventories are not yet verified. Keep every source intact; don't propose NAS or cancel OneDrive. Make actual updates to owning GitHub issue; give me one tiny next Codex prompt."

## 12. Mini Codex opening prompt — Nolan Assistant (only when owner is ready)
CA MANUAL AGENT
Read AGENTS.md and GitHub issue #894 FROM TOP, including the laptop-led owner option.
On my Ethernet-connected laptop, safely test what LAN/host access is already authorised, and prepare the secure staff SMB pilot + first attached 10TB non-destructive inventory.
Do not interrupt the designer on Nolan PC or assume access to its drive; involve Sydney and wait for host access if blocked.
Keep existing media/OneDrive untouched. Post tested results, blockers and next step on #894.

## 13. Status abbreviations
**CONFIRMED:** owner-reported Ethernet internet on laptops and PC; switch model/labels; purchase of two 20m cables/basic SD reader; owner-approved intended role architecture.
**PLANNED/NOT VERIFIED:** first 10TB attached; actual drive occupancy/health; Windows SMB access; exact current active CG Dynamics/Hours client list; actual OneDrive billing/quota; backup protections; Studio next skill pilot; phone number + WhatsApp approval channel.
**IN PROGRESS IN GITHUB:** scope/prompt documents, draft PR #873, open Studio #874 and PSG #872; none of these imply on-device installation or media migration.

END OF HANDOVER
