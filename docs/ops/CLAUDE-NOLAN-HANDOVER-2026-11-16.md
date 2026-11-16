# Claude → Codex handover: Nolan motion library and brand rules, 16 November 2026

**Who wrote this:** Claude (Nolan Claude lane), at CA's request: "send me a proper handover … then I can have Codex go merge and do whatever it needs to do. Make sure everything, all the skills, all the everything is properly in GitHub or Google Drive."
**Status at handover:** everything Claude built is in GitHub (two open PRs) or the company Google Drive. Nothing lives only in a Claude chat. One thing needs CA in person: saving the Claude account skill card (step 5).

## 1. What exists and where

| Item | Where | State |
|---|---|---|
| Brand rules panel (app code, staff-only, Video Pipeline) | PR **#984** `claude/client-brand-rules-panel` → `main` | Mergeable (clean) at `be6d717f`; `npm run build` passes; 31/31 brandRules + videoPipeline tests pass. **Not deployed.** |
| Brand tables `client_brand_profiles` / `client_brand_rules` | Production Supabase | **Already applied** (ledger `20261111064719`). Do not re-apply. |
| CG brand profile + rules | Production rows | CG profile (Canva kit `kAFrnwbT8rQ`); 16 Nov CA-approved: retired `1fefef98`; added `1ecd64fb`, `df9cd97f`, `9afc61c9`, `23a20e25`, `02a7db19`, `797dbbaa` (CG) and `998772b8`, `1d8edf48` (house). |
| Claude motion library (references, house brief, case studies, 4 technique cards, owner rules MAP-01/SCENARIO-01/ENDCARD-01, study code) | PR **#999** `claude/nolan-motion-library-20261116` → `codex/nolan-office-research-874` (stacked on #910) | Draft, mergeable (clean) at time of writing; skill tests 122/123 (the one error is `faster_whisper` missing, identical on base). |
| Claude-lane router skill (`nolan-video-editor`) | CA's Claude account (live); GitHub mirror `docs/ai-workforce/claude-skills/nolan-video-editor/SKILL.md` in #999 | Proposed edits shown to CA as a save card on 16 Nov; mirror has them applied. |
| Shared standards / onboarding | Drive doc `00_START_HERE — CG Video Editing System` (`1V57HP_aPxkWrVgndsOPwJR5xx8IRHsCibLl5JKebUQQ`) | Tab 1: new "CG house brand and Claude motion library" section and corrected Current projects. Tab 2 §8: pointer to PR 999. |
| CG websites video R06 | Drive `Projects/CG Production House/2026-11 We build websites and apps (30s)` (`1HP49T4bgYuACN7p-_3pTpL1DHEA4CWCC`) | MP4 in 5 parts + join note, source HTML, Feedback R04–R06 files, **build assets** `cg-websites-R06-build-assets.zip` (`15bQTPo8UaMD1XONGbIXlaWNbgpahbbsA`, SHA-256 `608e14d4…ca59`). Dynamics record `11833c8d` = internal_review. |
| Property Gain Wilgehof video R02 | Drive `Projects/Property Gain/2026-11 Wilgehof vacant stand (30s portrait)` (`1vFMYfZP95X-2NrlQOOmuUksD9zIGnzn2`) | R01 + R02 MP4 parts, source HTML (2 parts), Brief R01, Feedback R02, **build assets** `wilgehof-R02-build-assets.zip` (`145yFQhbA5wLbSL_aXaCbXg53PUJNBber`, SHA-256 `35558388…e73e`). Not a Dynamics client. |
| Retired | Claude artifact "CG Motion Library" | Superseded by all of the above. Do not use. |

## 2. Merge and release order for Codex

1. **#984 → main.** Re-check `git status`, mergeability and CI; run `npm run build` and `node --test tests/brandRules.test.mjs tests/videoPipeline*.test.mjs`. Merge when green. Do **not** run the migration again; it is in production.
2. **Deploy #984 only through the #679 gate.** `git.deploymentEnabled=false` stays. A release needs CA's explicit release packet and fresh budget evidence per `docs/ops/HOSTING-BUDGET-AND-UPTIME-POLICY.md`. After release, sign in as staff, open Content → Video Pipeline, select a CG Production House video and confirm the Brand rules panel lists the 6 new CG rules + house rules and not the retired one. Staff can read; managers write; rules are retire-only.
3. **#999 → `codex/nolan-office-research-874`.** This is the PR910 owner's lane: review, then merge into that branch (not main). If the branch moved, merge it into #999 (no rebase/force-push); the only past conflict was the top of `docs/ops/CG-DYNAMICS-OPS-HANDOVER.md` — keep both entries, newest first. #910 itself stays the owner's decision (it is draft and currently conflicts with its own base `codex/nolan-studio-874`; do not resolve that as part of this handover unless the owner asks).
4. **Install on editing devices** after #999 lands: per `NOLAN-START-HERE.md`, run `scripts/video-editing/studio-phase2/sync-shared-skill.ps1` (expect `CURRENT`) and record a device receipt. Publication does not prove installation.
5. **CA only:** save the `nolan-video-editor` skill card in Claude (no agent can save an account skill). If CA declines, refresh the GitHub mirror to match the live skill.

## 3. Rebuilding either video

Get the build-asset zip from the project's Drive folder and unzip it next to the generator in `scripts/video-editing/studio-phase2/studies/claude-browser-motion-20261111/` (`shots/` for CG, `img/` for Wilgehof). Fonts: Inter Display (free Inter family, e.g. `fonts-inter`) for CG; Poppins (Google Fonts) and `npm i @fontsource/cormorant-garamond@5` for Wilgehof. Set `AGENT_PHONE` for the Wilgehof CTA (the number is in the Drive feedback file, not in Git). Then follow the study README. Both generators reproduce the delivered pages byte for byte.

## 4. Open items (not done, not claimed)

- CG websites R06: CA said "nice"; the Dynamics record stays at internal_review until CA approves or requests changes there. Confirm the client/staff names visible in the CG Dynamics screenshot before public use. No music.
- Wilgehof R02: CA liked R01 ("great video, i like it"); no client approval, posting or portal filing recorded. No music.
- Property Gain is not a Dynamics client; create it only through the app if CA wants it tracked.
- Neither film had normal-speed human viewing or any listening by Claude.
- Canva brand-kit collection for other clients was paused on 11 Nov at 26 of 44 kits; resume only on CA's go, using the company Chrome.

## 5. Do not

Deploy outside #679; re-apply the brand migration; write production rows without CA approval; create another tracker, registry or renderer; commit client photos, portraits, logos or phone numbers; mark either film approved from this handover.
