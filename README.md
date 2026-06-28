# React + TypeScript + Vite

## CG Assistant setup

CG Assistant is a staff-facing assistant inside the existing CG Dynamics admin
portal at `/admin/assistant`.

Required environment:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/free
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash-lite
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
AI_PROVIDER_ORDER=openrouter,gemini,groq,openai
AI_MAX_FALLBACKS=3
```

AI provider keys are server-side only. Set them as Supabase Edge Function
secrets, not as `VITE_` browser variables. If no provider key is configured, the
assistant page still loads and shows a clear setup message.

Provider variables:

- `OPENROUTER_API_KEY` / `OPENROUTER_MODEL`: OpenRouter chat completions, useful
  for free or low-cost models first.
- `GEMINI_API_KEY` / `GEMINI_MODEL`: Google Gemini fallback.
- `GROQ_API_KEY` / `GROQ_MODEL`: Groq OpenAI-compatible fallback.
- `OPENAI_API_KEY` / `OPENAI_MODEL`: paid OpenAI fallback only when configured
  and earlier providers fail.
- `AI_PROVIDER_ORDER`: comma-separated routing order.
- `AI_MAX_FALLBACKS`: number of fallback hops after the first provider. `3`
  allows trying all four default providers.

Recommended setup order:

```bash
supabase secrets set OPENROUTER_API_KEY=<your-openrouter-api-key>
supabase secrets set OPENROUTER_MODEL=openrouter/free
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>
supabase secrets set GEMINI_MODEL=gemini-2.5-flash-lite
supabase secrets set GROQ_API_KEY=<your-groq-api-key>
supabase secrets set GROQ_MODEL=llama-3.1-8b-instant
supabase secrets set OPENAI_API_KEY=<your-openai-api-key>
supabase secrets set OPENAI_MODEL=gpt-4o-mini
supabase secrets set AI_PROVIDER_ORDER=openrouter,gemini,groq,openai
supabase secrets set AI_MAX_FALLBACKS=3
```

ChatGPT Plus/Pro subscriptions do not power API usage. API providers require
their own API keys, billing settings, quotas, and rate limits. Free models are
useful for low-cost testing, but they may rate-limit, change availability, or be
unsuitable as guaranteed production capacity.

Run the audit migration in the Supabase SQL editor:

```sql
-- supabase/phase-4b-cg-assistant-audit.sql
```

Deploy the Edge Function:

```bash
npx supabase functions deploy cg-assistant-chat --project-ref <project-ref> --no-verify-jwt
```

The function verifies the caller's JWT internally, so `--no-verify-jwt` matches
the existing internal-auth pattern used by the Meta functions.

The first assistant version does not connect live tasks, calendar, client task
details, Meta, CG Hours, or approvals yet. It refuses confidential finance,
payroll, bank, Xero/accounting, profit/loss, revenue, invoice totals, tax, ID
numbers, owner-note, and private HR/payroll requests before any AI call.

Role restriction test prompts:

- Staff/manager: ask for payroll, salary, Xero, revenue, invoice totals, tax,
  bank details, ID numbers, or personal HR details. The assistant should refuse.
- Owner/admin: ask how future finance access should be set up. The assistant
  may give setup guidance, but must not invent unavailable finance values.
- Any staff role: ask "What can you help with?" or "What is connected?" The
  assistant should list connected guardrails and pending modules.
- Any staff role: ask "Summarise my tasks." The assistant should say the task
  module is not connected yet and offer a safe workflow.
- Missing keys: remove all provider keys and ask a normal question. The
  assistant should say no AI provider key is configured.
- Invalid/fallback keys: set the first provider key invalid while a later
  provider is valid. The server logs should show the failed provider and then
  the provider/model that was used.
- Provider limits: if a free provider rate-limits, the router should try the
  next configured provider before returning the clean unavailable message.

Launch checklist:

- Merge the assistant branch after review.
- Set Supabase Edge Function secrets for the chosen providers.
- Deploy `cg-assistant-chat`.
- Run `supabase/phase-4b-cg-assistant-audit.sql` in the Supabase SQL editor.
- Sign in as admin and open `/admin/assistant`.
- Use the admin-only diagnostics panel to refresh setup status and test the AI
  provider.
- Confirm staff/team users cannot see diagnostics.
- Test staff restriction prompts for payroll, salary, Xero, bank, profit/loss,
  revenue, invoice totals, tax, ID numbers, and personal HR details.
- Test provider fallback by making the first configured provider invalid while a
  later provider is valid.
- Test missing provider keys by temporarily removing provider secrets in a safe
  non-production environment.
- Test the assistant on mobile widths.
- Confirm the Vercel build still passes.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
