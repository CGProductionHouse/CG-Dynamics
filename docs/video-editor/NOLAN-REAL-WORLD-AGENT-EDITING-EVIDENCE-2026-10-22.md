# Nolan — real-user Codex/Claude video-editing evidence review
**Date:** 22 October 2026 · **Scope:** third-party working examples, constraints and transferable techniques · **Status:** evidence-led research, **not** installed, no client footage touched and no active #862/#859 files changed. **Owner mandate:** only promote ideas grounded in actual tested outputs, with a hard preference for **zero new licence cost, zero AI-generation credits**, better editing and faster accepted client work.

## Executive decision

**Do not replace the existing Premiere CEP/UXP system.** We found multiple real experiments that support **AI-assisted editing as a first-pass/review loop**, but none independently certifies a Windows **hands-off, world-class commercial editor** that can do masks, variable ramps, reliable rich typography, story judgement and final export in one run.

**Most useful transferable method:** use a small, named editorial skill with source analysis → candidate paper edit → non-destructive Premiere operations → independently verified rendered playback → **timecode-specific human feedback** → record transferable decisions. Apply only appropriate techniques by source/genre. In the successful creator examples, the agent does not replace editorial taste; it takes repeated mechanical work and proposes usable drafts.

**Highest-leverage optional future research:** source-clip semantic search for large CG shoots, before another fancy-effects bridge. Footage understanding and *finding the actual frame of action* is often more valuable than a novel transition. Existing Adobe native media-search and prior-source ledgers are first, optional Jumper separately gated; see the existing research triage.

## Evidence levels — don't confuse demos with verified production value

- **A · CG-host verified:** only #862's independently read-back/save/render on the MSI, with explicit remaining defect gates. Nothing in this file can be promoted to installed on the MSI.
- **B · Third-party creator real-use case:** author demonstrates an actual edited video, Premiere project/timeline, repo/artifact and limitations. This validates *that creator's bounded task*, **not** Windows CG quality, cost, licence or general reliability. A creator's 95% claim is *self-report*, not independent accuracy measurement.
- **C · Independent/same-brief test:** a person other than the repo author ran code on sample media, inspected the actual output under explicitly stated checks. Such tests may prove technical render, not editorial taste/real client footage.
- **D · Demo/README/marketing only:** no reproducible outside acceptance. Useful for discovery, not adoption.

Do not treat stars, tool count, an “AI editor” label, a synthetic 15-second promo or a smooth Youtube presentation as editor-quality certification.

## Investigated working examples

### 1. Pat Simmons — Claude Opus 5.5 editing actual Premiere on separate Mac Mini
**Sources:** [Oct 12 first-person walk-through](https://www.aiformortals.co/blog/opus-5-5-edits-my-videos-premiere), [published editing skill + background CEP MCP](https://github.com/per-simmons/opus-premiere-editing), [independent repo browse](https://github.com/per-simmons/opus-premiere-editing/tree/main/skill). **Evidence:** B, **creator's own claim**.

- The author reports **95%** of routine editing handled in Premiere, with separate *Mac Mini editing agent* and *orchestrator* on another machine. Published repo has a *real editing skill* (Premiere transcript/pause pass, waveform-based correction, bad take removal, “Chat, cut that” markers, review sequence per section) and a **separate CEP script transport**. A timed-out command becomes `uncertain`, never silently replayed. This is particularly pertinent to #862's proven queue/lifecycle and stale-write issues.
- **Transfer to CG:** named, repeatable **review-sequence-per-section** and **record/retrieve approval feedback** rules; transcript and audio waveform as *different evidence*; mark known-bad takes at ingest rather than having the editor rediscover them. An editing agent with its own PC is consistent with CG's *later* desktop direction.
- **Do NOT import now:** another Premiere bridge, the Mac-only workstation assumptions, or the 95% automation claim. We already have two bridge routes and actual Windows host tests. Repo itself has only a small public history; no outside CG-port evidence.

### 2. Patryk Marketer / Krafie — Codex + Premiere MCP, real long-form timeline edits
**Source:** [Aug 15 annotated case study](https://krafie.com/blog/edit-videos-codex-premiere-pro-mcp). **Evidence:** B, first-person measured case; not independently rerun on CG.

- Reports an initial **16:22 → 10:37** talking-head sequence in roughly **31 minutes**; also a separate **23-minute** project. Tasks: remove silence/repeats, conservative zooms, later graphics. Reviews actual edits in Premiere, then sends precise timecode corrections (e.g. one 27-second range), repeats until acceptable. Uses a local MCP bridge, [HyperFrames](https://github.com/heygen-com/hyperframes) for rendered visual overlays, and `EDITING-RULES.md` to retain constraints.
- **Transfer to CG:** user/story brief and source ranges → **conservative first pass** → **micro-corrections with precise times** → reusable rule. Keep real Premiere assets editable; HyperFrames exports **rendered** overlay clips, so it is an optional *special effect*, not proof of native typography or motion-layer editability. Avoid blindly chopping pauses (emotion or meaning can depend on them).
- **Not proven:** 31 min is whole task on the author's environment, not comparable with #862's MCP per-operation benchmark; cannot promise this for a 4K CG commercial.

### 3. September travel-vlogger — 3 months of Claude → editable Final Cut XML
**Source:** [first-person Reddit breakdown and ten-minute demo](https://www.reddit.com/r/ClaudeAI/comments/1w8ofdg/3_months_of_editing_my_travel_videos_with_claude/). **Evidence:** B, self-reported repeated real projects.

- Says ~**12 produced videos**, using five commands: `/edit` proposes cut from Whisper transcript and frames, `/video-review` checks word-aligned cuts and voice/music levels, `/finalcut` emits **editable FCPXML** with audio on separate lanes; human finishes in editor.
- **Transfer:** preflight **source frames AND words**, verify no chopped words, retain layered timeline/audio, check loudness vs speech before review. CG already used FCP7 XML but is moving to native controls; **do not regress to baked graphics or replace native Premiere with FCP**.
- The author admits the remaining human polish is real; this is not a plug-and-play Premiere clone.

### 4. Aidan Stanik — live Claude/Premiere MCP demonstrated on a 17-min source
**Sources:** [May 21 presentation with times](https://www.youtube.com/watch?v=QSXyT2fJi2E), [accessible published description](https://zolotube.com/watch?v=QSXyT2fJi2E). **Evidence:** B demo, specific workflow, not independent full-quality review.
- Demonstrates connecting community CEP MCP to Premiere and removing dead air from a **17-minute source**, then saving a reusable `/auto-cut` skill. This corroborates *mechanical talking-head silence work* and skill re-use, not every advertised “269 tool” command.
- **For Nolan:** when editing dialogue-heavy work, propose a safe duplicate + transcript/word-safety pass; user review decides pacing, comedy and breaths. **Not applicable** to purely visual Emoya golf action.

### 5. Creator test that actually reported failed capabilities — important negative evidence
**Source:** [Vlad Sateev, Aug 4 Claude–Premiere hands-on](https://www.youtube.com/watch?v=F6jWlIVN6Ds), [accessible transcript summary](https://glasp.co/youtube/F6jWlIVN6Ds). **Evidence:** B, video creator's narrated task results, not CG rerun.
- Connected a free MCP and got basic **slow zooms, opacity transitions, markers and colour**; reported *poor speed/reliability* and failures in silence removal, audio effects, speed changes and dependable exports.
- **Implication:** Do not promote a “283/530 tools listed” catalog as blanket capability. Nolan must prove the exact operation on Premiere **26.3.2**, look at output and record unsupported functions. The failure modes match #862's already documented missing ramps/lifecycle.

### 6. Codex + SAM3 + MatAnyone + Remotion — finished text-behind-person video
**Source:** [author's detailed Reddit walk-through, released video, work files and failed example](https://www.reddit.com/r/ChatGPT/comments/1r0tqz3/i_edited_this_video_100_with_codex/). **Evidence:** B, visible real artifact and candid limitation.
- Uses **SAM3 object/foreground segmentation**, **MatAnyone** to propagate video alpha, **Remotion** for titles/composition; author links actual generated code and clip. Reported **8–9 hours** and says *slower than editing manually*, much of it spent correcting bad mattes. Earlier groundwork wasn't free; his processing was deployed on Modal (potential external cost/privacy).
- **Transfer only:** when the real cut calls for one worthwhile behind-person title, an actual propagated matte + compositing recipe can work; verify edges at every moving frame and keep native Premiere title if possible. **Do not build/install this alternate editor stack or upload client faces to cloud just because the demo looks cool.** Run only in authorised local environment later and assess GPU/duration and fees.

### 7. CapCut MCP codebases — some working projects, no portable free beauty automation yet
- [simopa/capcut-mcp-kit](https://github.com/simopa/capcut-mcp-kit) gives explicit locally tested, transactional CapCut Desktop **9.1 macOS** workflow, transcript trims, subtitles, audio ducking, version-safe draft writes, adversarial tests. It explicitly says **CapCut's native beauty/retouch, filters and other in-app AI tools are not exposed**. **Windows untested** and installation macOS shell. Evidence B for author's local Mac, plus test suite; not a Windows CG proof.
- [spectrika/capcut-mcp](https://github.com/spectrika/capcut-mcp) claims CapCut 9.3 draft edits via Docker, with copy-first safety. Source is open, but no CG Windows real-output acceptance. Unofficial `draft_content.json` contracts are version-fragile. **Do not switch Nolan or install this to get the CapCut beauty effect.**
- [CapCut native beauty](https://www.capcut.com/tools/face-retouching) as **actually used by CG** remains our free functional benchmark. An intentional clip-level CapCut export and source-linked import back into Premiere remains a possible **free fallback** if needed, but it bakes the correction, risks colour/4K round-trip and is *not* an autonomously accessible native effect.

### 8. 16-tool same-brief video-skill test — *real output* but narrow benchmark
**Source:** [zhuyansen / awesome-claude-video-skills, Oct 11 end-to-end methodology, rendered test links](https://github.com/zhuyansen/awesome-claude-video-skills). **Evidence:** C for output-format/sound/copy on *synthetic* briefs, not human-sourced editing.
- Benchmark author runs **16 distinct agent skills + Claude no skill** on the same **15s synthetic app-promo** (1920×1080 /30fps, 5 lines) with no video/image model API keys. All pass **4 technical checks** (decode, requested format/duration, five captions sampled at 2fps, motion). Relative full run: **explainroo 2.0min**, **Remotion skill 4.5min**, **HyperFrames 23.5min**; **no skill 4.4min**. 9/16 include sound.
- **Huge caveat:** technical tests did **not** score storytelling, editing of client-origin 4K clips, dialogue cut semantics, 9:16, rights, skin/face, editable Premiere sequence, rich keyframes or human quality. Its “SAFE” grade reflects automated README/install review, **not a security audit**; counts/ratings fluctuate. Still useful as an exploration filter for *graphics-only motion insert* when built-in MOGRTs don't suffice.
- **Transfer:** don't install a motion-graphics framework without a real need. Ask which effect is truly needed in the current video, use existing Premiere first, then compare *one narrowly controlled overlay tool* if helpful.

### 9. Creative production skill frameworks — examples, not proof of world-class editing
- [DotanVG/video-director-skill](https://github.com/DotanVG/video-director-skill): full trailer example with actual video render and custom skill; uses HyperFrames. Good *music-phrase/hold/cinematic brief* conventions; lacks native Premiere timeline handoff.
- [TimoteoAltobrando/ai-video-skill](https://github.com/TimoteoAltobrando/ai-video-skill): storyboard/paper edit approvals and per-format delivery recipes, but Seedance/OpenRouter/ElevenLabs may consume paid tokens and use cloud AI. No default adoption under CG's **zero-credit** rule.
- [FireRedTeam/FireRed-OpenStoryline](https://github.com/FireRedTeam/FireRed-OpenStoryline): reusable Style Skills, natural-language project plans. Upstream **explicitly warns** AI transition generation uses external charged models and may be unpredictable; not a free drop-in Premiere replacement.
- [SmoothyEdit](https://smoothyedit.com/): vendor advertises **free local** Premiere/Resolve multicam/audio cleanup/captions, no sign-up; potentially useful to CG's live-stream/multicam direction *later*, but we have **no independent Windows 4K/Canon staff validation**. Do not install while Nolan is cutting Emoya.

## What CG should take from this *now*, without another tool or plugin

1. **One review sequence per passage** (Pat Simmons): preserve original, make isolated corrections, use exact timeline/source range IDs. Avoid “edit whole video again” loops.
2. **Source actions and speech are separate analysis lanes:** for events/golf/cinematic actions use *moving visual source screening and sound on the impact*, not transcript-only auto-cut. For interviews, combine Whisper timestamps, waveform and a human-approved paper edit.
3. **Explicit stop/pause point:** agent proposes one meaningful craft improvement, renders that segment, receives staff/owner reaction, saves the result and one transferable lesson. Don't spend tokens re-reviewing the same clean segments.
4. **Journal/uncertain-state safety:** command writes have unique IDs; uncertain timeouts must get an independent readback, **never replay blindly**. #862 already knows this—reuse rather than cloning Pat's Mac CEP bridge.
5. **No false skills:** `discovered` tutorial != `CG host implemented` != `owner creatively approved`. Teaching editorial taste requires client feedback tied to source decision, not generic presets.
6. **Quality gates before optional polishing:** (a) connected 4K originals; (b) every cut narratively and visually coherent; (c) no black gaps; (d) real title/logo/brand, safe areas; (e) music/SFX audible fit and cuts, not just LUFS; (f) correct exported file; (g) staff/owner review.

## Free natural beauty effect: updated owner constraint

**Only recommend products with an actual clean, no-watermark, non-expiring, commercially usable free workflow that is genuinely comparable to the CapCut touch-up CG already uses.** None of the paid Beauty Box/Portraiture/Easy Face trials clears this. The dedicated [retouch research](NOLAN-NATURAL-PORTRAIT-RETOUCH-RESEARCH.md) remains a catalog but those items are **not purchase recommendations**.

**Current reliable free baseline:** the existing CapCut beauty tool already in CG's licensed workflow. **Free Premiere hypothesis:** official Adobe [Texture softness and selective Sharpness](https://helpx.adobe.com/premiere/desktop/correct-color/color-mode-fundamentals/grading-clips-using-adjust.html), possibly native HSL Secondary skin isolation, subject to **actual Premiere 26.3.2 availability and on-face visual quality**. These aren't auto face retouch by default, and source-background spill matters. We cannot say “as good or better” until an actual matching 4K A/B comparison against CapCut passes.
No purchase, trial watermark, generative credits, face reshaping, skin-lightening/identity alteration or live plugin install from this research.

## Hard limits / coordination

- **Do not interrupt or direct the active Emoya editing process.** This document exists only on separate **draft PR #865**; no #862 or #859 edits, no team notifications, no automatic adoption.
- Existing [#862 host-verified controls](https://github.com/CGProductionHouse/CG-Dynamics/pull/862) remain installation/control authority; its latest locally verified host data overrides this broader web research.
- **No external AI credit use or client footage upload**, including included Adobe/Higgsfield allowances, without explicit owner case-by-case approval.
- No new video engine, extra production app, second MVP, workstation migration setup or expensive study lab. Next worthwhile CG evidence will be a real updated **Emoya review cut** with native editable Premiere controls and owner feedback—not a pile of unused skill repos.
