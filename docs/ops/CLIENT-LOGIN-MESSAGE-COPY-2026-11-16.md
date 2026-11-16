# Client login message copy — 16 November 2026

CA's phone screenshot showed no login-sharing action on the Clients card.
Current main also required a provision/reset action before displaying individual
credential-copy controls. This is a bounded #399 usability correction.

The source candidate adds an admin-only **Copy login message** action directly
to desktop/mobile Clients cards and existing enabled Client Access rows. It reads
the existing admin access endpoint on each click, selects exactly one canonical
client ID and uses only the saved username. Missing, duplicate, disabled,
unprovisioned or malformed mappings fail closed. No suggested/edited username
is used. The message includes the canonical login URL and the explicitly approved
Phase 1 issued starter convention. Custom passwords cannot be retrieved; that
limitation is visible. Copying never provisions, resets, enables or signs in.

The iPhone clipboard path starts a promise-backed ClipboardItem inside the user
gesture, before the access read completes. Passwords are not rendered in the DOM,
logged, returned by the API, or persisted to browser storage. Success/error feedback
is accessible. The failure link opens the exact client in existing Client Access.

Cape's enabled exact-client mapping and issued starter validity were confirmed
read-only in production for CA's immediate sharing request. No credential value
or hash is retained in this receipt. No production account/data/schema change.

Verification: 17 focused login-copy/access tests pass, production TypeScript/Vite
build passes with emitted application chunks, scoped lint and diff check pass.
Actual desktop/mobile browser clipboard acceptance is unverified: the computer-use
tool previously safety-stopped because it could not reliably establish Chrome's
URL. Unit evidence exercises the async clipboard flow, not a physical iPhone.
No Vercel action; git deployment remains OFF under #679. This candidate is NOT LIVE.
