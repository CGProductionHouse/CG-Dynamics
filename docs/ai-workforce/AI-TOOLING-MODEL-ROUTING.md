# AI Tooling and Model Routing — inspection appendix

Last updated: 17 August 2026 SAST

Cross-project authority:

- `docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md`

Read the master first. This appendix records troubleshooting/inspection details only. It must not become a competing provider/model configuration authority.

No API keys, tokens, passwords or billing secrets belong in GitHub.

## OpenCode rollback checkpoint

Observed on 17 August 2026:

- OpenCode CLI `1.18.18` was installed during troubleshooting;
- model catalogue refresh succeeded;
- an experimental global config was created under `%USERPROFILE%\.config\opencode\opencode.json` to filter providers/models;
- that filtering caused confusion and hid/changed useful already-working provider/model access;
- the experimental global file was backed up and removed later the same day.

**Current rule: do not assume a custom global OpenCode config exists.**

Do not restore the old whitelists/defaults from Git history simply because they appear in an older commit.

## Provider/model state is dynamic

OpenCode may expose models through OpenCode Zen, OpenRouter, direct OpenAI, Google and other connected providers. Exact model IDs/quotas can change quickly.

Historical observations are useful for diagnosis, but they are not durable routing truth.

Before assigning or troubleshooting a model:

```powershell
opencode --version
opencode models
```

Then inspect:

1. current session-selected model;
2. actual current model/provider list;
3. project-level `opencode.json`;
4. provider/auth state;
5. global config only if a file actually exists.

Do not guess a model ID from memory or from an old screenshot/document.

## Project-level OpenCode configuration

Project configs may legitimately exist for MCP/tooling even when there is no global model config.

During the 17 August safe inspection, `C:\Projects\CG-Accounting\opencode.json` contained MCP configuration and no observed model/provider override. Treat that as a dated observation only; inspect the file again before changing it.

Project configuration should not be deleted merely to solve a model-picker problem.

## Catalogue/version maintenance

If the picker is stale or a model endpoint has actually been retired:

```powershell
opencode upgrade
opencode models --refresh
```

Then re-inspect the live catalogue.

A similarly named model on another provider may have different lifecycle/availability. Do not conclude all variants are dead from one provider's `410 Gone` response.

## Google quota lesson

Google/Gemini remains available as a secondary coding/research route, but CA reports current quota/cap behaviour is too restrictive for dependable critical coding continuity.

Antigravity CLI (`agy`) is separately documented in the master as a tested fallback coding route. Its quota should also be treated as limited.

A future paid Google research/deep-research subscription for Media/Marketing Library work remains a candidate decision and requires current pricing/quota research before purchase.

## Local-model lesson

Gemma 4 12B was tested for agentic website coding/tool calling and performed poorly. Do not route production website implementation to it by default.

Local models are optional simple/experimental routes unless a specific model is proven on the actual project workflow.

## Security

Never commit:

- OpenRouter keys;
- OpenAI/Anthropic/Google keys;
- OpenCode auth/session tokens;
- provider billing secrets.

Track provider roles, troubleshooting observations and non-secret process only.
