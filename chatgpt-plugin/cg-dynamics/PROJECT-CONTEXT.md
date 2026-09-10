# Project context contract (required)

CG Production House uses **one communal ChatGPT account**. Every staff member and every
client has their own **Project** in that account, and the CG Dynamics connector is
OAuth-connected **once** using the company admin login.

**The OAuth connection is therefore NOT the staff identity.** Without an explicit Project
context every Project would collapse to the admin account. So:

> Every operational tool call must state which Project it is acting for.

## The two principals

| | What it is | Who sets it |
|---|---|---|
| **Connection principal** | The shared company/admin account behind the single OAuth connection. Proves the connector is authorised. | The one-time OAuth connection |
| **Operating context** | The exact staff member, exact client, or explicit company-admin scope this Project works as. | Passed by these skills on every call |

The server records **both** on every call, so an action is always attributable to the
communal connection *and* to the Project that actually performed it.

## How to establish context

At the start of a fresh Project chat, call **`resolve_project_context`** once:

- Staff Project → `{ context_kind: "staff", staff_full_name: "<exact full name>" }`
  (or the exact canonical `staff_profile_id`)
- Client Project → `{ context_kind: "client", client_name: "<exact client name>" }`
  (or the exact canonical `client_id`)
- CA / management Project → `{ context_kind: "company_admin" }`

It returns a `resolved_context` object. **Carry that exact object as `context` on every
later tool call in this Project.**

```
get_my_day({ context: { context_kind: "staff", staff_profile_id: "<uuid>" } })
```

## Rules

- **Never guess or invent a context.** Names are matched by exact equality against active
  canonical records; 0 or >1 match fails closed. If it fails, ask which exact staff member
  or client this Project is for — do not fall back to admin.
- **Never reuse another Project's context.** Context is per call and never remembered by the
  server. If you are unsure which Project you are in, re-run `resolve_project_context`.
- **Never infer identity** from the chat history, the Project title, or the connected
  OpenAI account.
- **`company_admin` is not a fallback.** Use it only when the Project genuinely is CA's or
  management's, and the user is explicitly asking for company-wide work.
- In a **client Project**, staff-subject tools (`get_my_day`, `list_my_tasks`,
  `list_my_leads`, the assistant profile, mail drafts) are unavailable, and every
  client-scoped call is pinned to that exact client. A cross-client request is refused by
  the server — do not try to work around it.
