# AI Tooling and Model Routing — detailed appendix

Last updated: 17 August 2026 SAST

Cross-project authority now lives in:

- `docs/ai-workforce/MASTER-AI-TOOLS-AND-WORKFLOW.md`

Read the master first. This file is the detailed provider/model appendix only. If this file conflicts with the master, update both and treat the master as the current workflow authority.

No API keys, tokens, passwords or billing secrets belong in GitHub.

## OpenCode current checkpoint

Confirmed on 17 August 2026:

- OpenCode CLI `1.18.18`;
- global model cache refresh completed successfully;
- global config exists at `%USERPROFILE%\.config\opencode\opencode.json`;
- project-level configs may still override global settings;
- CG Accounting has a project `opencode.json` for MCP configuration but no model/provider override was observed in the safe inspection;
- **no global `enabled_providers` allowlist is currently desired**, because it previously hid direct OpenAI and useful models;
- use verified per-provider whitelists for large catalogues instead.

## OpenCode Zen

Current whitelist:

- `deepseek-v4-flash-free`;
- `big-pickle`;
- `mimo-v2.5-free`;
- `nemotron-3-ultra-free`;
- `nemotron-3.5-lightning-free`.

`opencode/deepseek-v4-flash-free` is CA's proven favourite OpenCode model and should stay visible while it works.

Do not infer that this model is dead because another provider identifier with a similar DeepSeek name reports end-of-life.

## OpenRouter

Separate paid API-backed OpenCode route.

Current whitelist:

- `~deepseek/deepseek-v4-flash-latest`;
- `deepseek/deepseek-v4-pro-0813`;
- `~anthropic/claude-sonnet-latest`;
- `~anthropic/claude-haiku-latest`;
- `~moonshotai/kimi-latest`;
- `~openai/gpt-latest`;
- `~openai/gpt-mini-latest`.

Current local defaults recorded on 17 August 2026:

- model: `openrouter/deepseek/deepseek-v4-pro-0813`;
- small model: `openrouter/~openai/gpt-mini-latest`.

These are defaults only. They do not override CA's judgement about which model actually performs best for a task.

## Google

Keep as secondary/research provider for now.

Current whitelist:

- `gemini-flash-latest`;
- `gemini-3.1-pro-preview`;
- `deep-research-max-preview-04-2026`.

CA reports Google quota/cap behaviour is currently too restrictive to rely on for day-to-day critical coding continuity.

Possible future paid Google research/deep-research subscription for Media/Marketing Library research remains unapproved and must be researched before purchase.

## Direct OpenAI in OpenCode

Direct OpenAI is connected and must not be hidden by global provider filtering.

Visible model IDs confirmed 17 August 2026:

- `openai/gpt-5.3-codex-spark`;
- `openai/gpt-5.4`;
- `openai/gpt-5.4-fast`;
- `openai/gpt-5.4-mini`;
- `openai/gpt-5.4-mini-fast`;
- `openai/gpt-5.5`;
- `openai/gpt-5.5-fast`;
- `openai/gpt-5.6-luna`;
- `openai/gpt-5.6-luna-fast`;
- `openai/gpt-5.6-sol`;
- `openai/gpt-5.6-sol-fast`;
- `openai/gpt-5.6-terra`;
- `openai/gpt-5.6-terra-fast`.

Direct OpenAI is intentionally not whitelisted yet so Sol and other useful current variants are not accidentally hidden while the preferred shortlist is still being evaluated.

Do not infer billing/subscription details from model visibility alone.

## Maintenance

When a model is retired/unavailable or the model picker is stale:

```powershell
opencode --version
opencode upgrade
opencode models --refresh
```

Then:

1. inspect real current model IDs;
2. inspect global config without printing secrets;
3. inspect project `opencode.json` overrides;
4. preserve working models CA actually relies on;
5. replace only proven-dead identifiers;
6. update `MASTER-AI-TOOLS-AND-WORKFLOW.md` if the shared strategy changed.

## Security

Never commit:

- OpenRouter keys;
- OpenAI/Anthropic/Google keys;
- OpenCode auth/session tokens;
- provider billing secrets.

Track roles, model IDs, non-secret configuration policy and operational observations only.
