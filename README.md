# React + TypeScript + Vite

## CG Assistant setup

CG Assistant is a staff-facing assistant inside the existing CG Dynamics admin
portal at `/admin/assistant`.

Required environment:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
OPENAI_API_KEY=
```

`OPENAI_API_KEY` is server-side only. Set it as a Supabase Edge Function secret,
not as a `VITE_` variable. If it is missing, the assistant page still loads and
shows a clear setup message.

Set the OpenAI key:

```bash
supabase secrets set OPENAI_API_KEY=<your-openai-api-key>
```

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
