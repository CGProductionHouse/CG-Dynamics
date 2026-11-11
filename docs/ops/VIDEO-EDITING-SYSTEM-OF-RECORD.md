# Video editing system of record

Agreed by CA on 11 November 2026. Applies to every editor and agent: Claude,
ChatGPT/Nolan, Codex, OpenCode and CG staff.

| What | Lives in | Notes |
|---|---|---|
| Brief, assignment, status, review, approval | CG Dynamics: Content → Video Pipeline, Work → My Video Queue | The tracker. Use the existing status actions (`src/lib/videoPipelineRules.ts`). |
| Client brand facts and must/should rules | CG Dynamics brand rules panel (`client_brand_profiles`, `client_brand_rules`, migration `20261111064719`) | Editors add client rules from feedback; managers maintain profiles and house rules. |
| Working files, drafts, renders in progress, feedback rounds, agent handovers | Company Google Drive (`m.productions.cg@gmail.com`), folder **CG Video Editing System** → `Projects/<Client>/<YYYY-MM Video name>` | Read its `00_START_HERE` first. One file per feedback round; never edit an old round. |
| Approved final exports for the client | The client's portal OneDrive library, linked in CG Dynamics | Finals only. Existing client-portal and Client Schedule flows; no new upload path. |
| Code, skills, technique cards | GitHub (this repo) | Through pull requests. Nolan's library stays in PR #910. |

Rules:

1. Do not create another tracker, task list, brand register or status system.
2. Never use a personal Google Drive or personal browser for CG work.
3. Drafts never go to the client portal OneDrive.
4. Live database changes outside normal app actions still need CA approval.
5. Nolan's existing handovers (Drive `ChatGPT/`, PR #910) move their working
   files into the Drive `Projects` layout as they migrate; status moves to
   CG Dynamics. This does not take over or reset any Nolan lane.
