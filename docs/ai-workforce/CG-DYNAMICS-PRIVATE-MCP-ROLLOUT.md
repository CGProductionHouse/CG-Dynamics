# CG Dynamics private MCP rollout checkpoint

Issue: #308. Status: contract prepared; transport/auth/deployment intentionally not claimed complete.

## Verified product requirements

Current official OpenAI documentation requires a streamable HTTP MCP endpoint (normally `/mcp`), focused typed tools with accurate safety annotations and handler authorization, and OAuth 2.1 for customer-specific data or writes. Authentication discovery requires protected-resource and authorization-server metadata, PKCE, and supported client identification/registration. Developer testing requires a reachable HTTPS endpoint or Secure MCP Tunnel.

Sources reviewed 2026-09-09:

- https://developers.openai.com/plugins/build/mcp-server
- https://developers.openai.com/plugins/build/auth
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/plugins/guides/security-privacy

The official plugin developer documentation reviewed here does not prove that a custom private app will be callable from CG's scheduled-task surface. Treat scheduled invocation as **UNVERIFIED** until tested in the actual managed ChatGPT workspace; normal Project chat access must be accepted independently.

## Prepared boundary

`supabase/functions/cg-dynamics-mcp/toolCatalog.ts` is the versioned contract. It contains focused read and reversible-write tools only, explicit JSON schemas, safety annotations, upstream dependencies and the canonical Dynamics contract each tool must invoke. It contains no SQL/query-table tool, arbitrary mutation, service credential, contact value, staff identity, or Project-derived identity.

The first usable release should enable the eight read tools only. Writes remain disabled until the same-user read path passes isolation tests and the mutation endpoint has caller-scoped durable idempotency in addition to existing #208 audit/permission checks.

## Required implementation order

1. Merge/deploy and accept #241/#294 exact-client/contact retrieval and #305 staff/lead truth. Do not copy those implementations into this branch.
2. Extend the canonical #208 action RPC once for any shared missing semantics (currently task reopen and durable external-call idempotency); keep internal Assistant and MCP on the same action.
3. Add an OAuth 2.1 authorization-code/PKCE bridge for CG Dynamics. Tokens must resolve the exact active `profiles.id` on every call; deactivation/revocation must fail immediately. Never place tokens in Project Instructions.
4. Implement streamable HTTP with the official MCP SDK after CA approves the new production dependency. Register the existing catalog and call only the named canonical contracts through a user-scoped client/RPC.
5. Test with MCP Inspector, then Secure MCP Tunnel/developer mode. Prove cross-staff/client/branch denial, stale-contact exclusion, audit, replay/idempotency, and concise confirmation behavior.
6. After CA approval, configure the private CG workspace app and perform one controlled staff pilot. Separately test scheduled-task access; record supported/unsupported from observed behavior.

## Explicit gates

- CA approval: new production dependency (`@modelcontextprotocol/sdk` and its schema peer), OAuth client/metadata endpoints, secret configuration, tunnel/public endpoint, workspace app connection/publication.
- Production approval: deploy function/auth endpoints and any idempotency migration.
- No merge, deployment, OAuth registration, secret change, tunnel, or app publication is part of this checkpoint.

