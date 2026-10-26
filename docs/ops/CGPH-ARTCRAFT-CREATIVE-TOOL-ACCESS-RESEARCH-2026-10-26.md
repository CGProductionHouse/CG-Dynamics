# CG Production House — Creative Tool Access Research: ArtCraft, Nolan and PICASSO

Date: 26 October 2026
Status: RESEARCH / ISOLATED TECHNICAL EVALUATION ONLY. NOT PRODUCTION APPROVAL.
Owner intent: improve agent access to real video editing, photo editing and vector/graphic design software; reduce custom one-off editing skills; subscription savings are secondary.

## Key finding

The ArtCraft / Crafting Apps screenshots shared by the owner point to a real, public open-source project, primarily under https://github.com/storytold . Do not accept TikTok's claim that seven Adobe apps have been production-equivalently replicated. Official repositories identify several tools as **early alpha, actively developing, or young**. GitHub stars are not security or fidelity proof.

The **most interesting differentiator** is programmatic control:
- PhotoCraft says its engine can be driven through **UI, CLI, JSON control channel or MCP**.
- LightCraft says it is controllable over **MCP**.
- VectorCraft advertises an **MCP server**.
- FilmCraft states editing actions are commands controllable by an AI agent; **inspect the actual documented CLI/MCP command surface before asserting that an external tool can perform any given operation**.
- Main ArtCraft studio is about compositing and prompting to image/video generators, NOT synonymous with open-source editing apps. Model calls can incur third-party costs and have separate rights/terms.

These are developer-maintainer claims grounded in current repo READMEs, **not hands-on CG verification or an independent creator performance review**. They justify a limited technical integration investigation, not replacing Adobe, Photoshop, Premiere or the existing approved PICASSO/Nolan pipeline.

## Relevant official upstream repositories

| Product | Potential CG use | Source | Research status |
|---|---|---|---|
| PhotoCraft | Agent-controlled layer/mask/color/type/PSD operations for PICASSO; structured poster/image operations | https://github.com/storytold/photocraft | Officially early alpha; MCP, CLI and JSON interfaces advertised. Verify actual commands, PSD preservation and outputs. |
| LightCraft | Local RAW ingestion/non-destructive batch grading and image catalog operations for PICASSO | https://github.com/storytold/lightcraft | MCP advertised; requires quality, RAW format and colour fidelity verification. |
| FilmCraft | AI agent timeline manipulation, trims, titles, sound, exports and potential NLE automation for Nolan | https://github.com/storytold/filmcraft | Young, rapidly changing. Verify API/CLI/MCP interface, deterministic operations and compatibility with actual target footage. |
| VectorCraft | Agent-driven paths, vectors, text layout and poster/logo assets | https://github.com/storytold/vectorcraft | Actively developing; MCP advertised; check SVG/PDF import/export and layer/editability before use. |
| EffectCraft | Motion and compositing candidate | https://github.com/storytold/effectcraft | Investigate command surface; not production-approved. |
| ArtCraft | Scene composition, image/video generator orchestration | https://github.com/storytold/artcraft | Model costs, API/vendor data transfer and generated identity/brand fidelity require governance. |
| Vendor directory | Official installers and app positioning | https://getartcraft.com/apps | Download only from verified official project sources; repository code still requires dependency and supply-chain review. |

Independent press discusses the collection as alpha: https://pasqualepillitteri.it/en/news/21619/free-adobe-clones-artcraft-claude-opus-5-5 . Third-party directories and social posts can be outdated or promotional. Recheck each official project's tagged release and maintainer identity before touching a local machine.

## Core research question for Codex

**Can Nolan and PICASSO use already-existing stable, scriptable image/video engines, via MCP, command line, JSON/RPC or documented APIs, instead of continually building custom skills that simulate GUI interactions?**

Investigate in this order, preserving proven incumbent engines:
1. **Native proven tools already connected:** Adobe/Photoshop/Acrobat or local Premiere/Photoshop scripting and batch APIs where actual access and licensing allow; any current Nolan/PICASSO skills and Windows editors.
2. **Existing open-source headless foundations:** FFmpeg/ffprobe for video processing, OpenTimelineIO for timeline interchange if compatible, ImageMagick/libvips and RAW processors where appropriate, OpenRaster/PSD-compatible workflows with explicit fidelity tests. Do not replace incumbent tooling just because a library is open source.
3. **Crafting Apps MCP/CLI:** inspect official READMEs, source, command schema, release state, transport, permissions and executable availability; distinguish *MCP advertised* from *agent connected*. Determine whether control is headless/local, whether assets remain local, whether commands are reversible, how saves/exports work and whether one editor host can serve both authorised agents.
4. **Cost and agent usability:** list what already works without extra subscription, what needs a third-party model/key, and what requires a local service or installer. Do not imply Photoshop/Premiere replacement based solely on screenshots.

## Required investigation and technical outputs (separate Nolan/PICASSO scopes)

- **Capabilities table**: app + version + OS + official launch/download + MCP/CLI/JSON/API entrypoint + supported actions + file formats + license + offline/cloud requirement + security limitations + human QC gate.
- **Integration diagram**: authorised ChatGPT/Work/Codex → explicit tool bridge (MCP or local runner) → authorised Windows host → isolated sandbox/copy → deterministic tool operation → reviewed preview/manifest → approved write/export. ChatGPT connectors and Codex do not automatically gain identical tool access; confirm actual available interfaces for EACH agent.
- **Nolan proof-of-interface:** on disposable/public-domain sample clips, verify the command schema, non-destructive import, edit, timeline save, export, determinism, media relinking and failure recovery. Never run an experiment on client masters.
- **PICASSO proof-of-interface:** on disposable/public-domain images, inspect RAW/PSD handling, layers, masks, colour space, metadata, image fidelity, editable saving and batch processing; preserve the existing approved style/selection/identity instructions. Never change private client jobs in discovery.
- **Graphics proof-of-interface:** vector paths, typography, SVG/PDF output and repeatable poster layout without redesigning real client logos.
- **Security and reliability gate:** checksum verified official release, inspect pinned source/release/signatures if offered, dependency/supply-chain scan, sandbox/no-network mode if possible, resource limits, test malware concerns, and rollback/removal. Open source != malware-free.
- **Independent reviews gate:** record named creators/reviewers and date/version plus real workflows actually tested; when independent evidence is absent, label **research-only** regardless of features or Github stars.
- **Privacy:** do not upload private CG/client footage, photo selections, project files, faces or brand assets to a vendor/model without owner-reviewed terms and explicit approval.
- **Quality:** no unattended client delivery, no "better" judgement without review, no claim that a prototype equals Premiere/Photoshop, and no auto-mutation of Nolan/PICASSO working directories or source media.
- **Handoff:** create a narrow technical recommendation: (A) usable agent connection today, (B) feasible with bounded local bridge, (C) premature. Include exact commands/interfaces proven, local test receipts, and clear next step. Do not install/purchase/activate in the course of this research without authorisation.

## Coordination and scope

This research is for **CG Production House** creative operations, not a merger of identities with CG Dynamics, CG Arcc or CG Design Solutions. Preserve current Nolan and PICASSO owners/jobs; no other-client retrieval or alteration. Before coding, recover each agent's actual source repo, current skills, active PRs/issues, host/device state and their existing accepted workflows. No guessed paths or "connected" claims.

Existing related workflow: [CGPH Premiere editing Codex handoff](./CGPH-AI-VIDEO-EDITING-CODEX-HANDOFF-2026-10-20.md) and [issue #856](https://github.com/CGProductionHouse/CG-Dynamics/issues/856). This broader investigation **does not supersede** the proven Premiere SOP or authorise changing production editing infrastructure.

Stay within GitHub research/documentation until explicit machine and execution authorisation. Respect repository hosting/billing/data gates and current worker ownership. No live client data, no builds/deployments, no new platform/DB architecture from this research request.

## Test decision

Owner explicitly wants to **explore and eventually try real, promising tool connectivity**, unlike the earlier production editing request which rejected unproven plugin trials. Therefore the correct path is a **bounded, isolated technical proof-of-interface on disposable sample media**, not a forced production rollout or a ban on exploration. The owner does NOT authorise an immediate live install or private client job edit in this message.

## Provenance

Official source README inspected through the connected GitHub source browser 26 October 2026:
https://github.com/storytold/photocraft
https://github.com/storytold/lightcraft
https://github.com/storytold/filmcraft
https://github.com/storytold/vectorcraft
https://github.com/storytold/artcraft

Screenshots supplied by owner depict social claims and website graphics, **not installation, source safety or video/photo output verification**.
