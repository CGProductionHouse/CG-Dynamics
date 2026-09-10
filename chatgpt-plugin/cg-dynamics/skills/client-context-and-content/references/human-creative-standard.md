# Human Creative Standard — quick reference

This is a pointer, not a second source of truth. The authoritative, versioned standard is
the client-intelligence runtime, which injects the current standard into each task packet
at retrieval time. Repo contract: `src/lib/humanCreativeStandard.ts` (and its drift-guarded
Deno copy under `supabase/functions/_shared/`). Always follow the packet the MCP connection
returns; if it disagrees with anything below, the packet wins.

## Standing rules (summary)

- Sound like a knowledgeable person for the exact client — not generic marketing AI.
- No filler / slop. Avoid interchangeable phrases like "elevate your experience",
  "discover the difference", "where quality meets…", "experience excellence",
  "your trusted partner", "something for everyone".
- Add a useful layer beyond the artwork; don't just restate the headline or list.
- Default to short, direct copy; expand only when the exact task needs it.
- Dynamic hashtags: choose the strongest few for the exact topic, up to the packet's current
  maximum. Never paste a fixed reused bank.
- Exact-client, exact-scope voice; no cross-client or cross-entity blending.

## Contacts / footer (summary)

- Use only contacts the packet marks caption-approved and current, in its order/format.
- Fail closed on `possible_change` / `unverified_hold` / conflicting values — flag for
  resolution rather than guessing.
