Combines the secure-link readiness gate (from PR #662) with onboarding discoverability and Hub latency fixes (from PR #618).

## Changes

### Secure-link readiness (PR #662)
- **link-readiness.ts**: New pure module exporting `OnboardingLinkReadiness` type, `hasCompleteClientUploadMappings()`, and `onboardingLinkReadiness()` — read-only capability check, never refreshes tokens
- **portal-client-root.ts**: New `resolveBoundClientRoot()` that scopes portal discovery to the exact-client production binding (drive_id + folder_item_id), never a name guess
- **Edge Function (index.ts)**: Adds `staff_link_readiness` action (admin/manager) and guards `staff_generate` with the same readiness check; `staff_resolve_portal_root` uses `resolveBoundClientRoot`
- **api.ts**: Adds `loadOnboardingLinkReadiness(clientId)` client helper
- **InternalOnboardingPage.tsx**: Loads readiness when client selected; disables Generate button until `canGenerate===true`; shows contextual status message

### Discoverability + Hub latency (PR #618)
- **InternalOnboardingPage.tsx**: Adds 'Not started' status pill with count; `hasSession()` helper distinguishes synthetic entries; Preview link works for all clients; Revoke/Verify buttons only for real sessions
- **emptyState.ts**: Updates filtered-out message to 'No clients match your filters'
- **AdminLayout.tsx**: Increases `requestIdleCallback` timeout (1.5s to 8s) and fallback `setTimeout` (250ms to 5s); initial notification load skips `refreshAssistantDayNotifications()` RPC to avoid competing with Hub load; subsequent polls include it

### Tests
- **clientOnboardingReadiness.test.mjs**: 9 tests covering readiness gate, role gating, activation flag, adapter config, consent handling, exact-client upload mappings, and Edge Function gate placement
- **clientPortalBoundRoot.test.mjs**: 5 tests covering bound-client-root resolution, missing/foreign/blank bindings, durable ID requirements, portal/category ambiguity, and handler scoping
- **clientOnboardingEmptyState.test.mjs**: Updated to match new empty-state message and button disabled condition

### Preserved from main
- `downloadOnboardingFile(uploadId, audience, previewClientId?)` and `loadPortalSetup(previewClientId?)` signatures unchanged for client portal preview compatibility

## Verification
- `npm run build`: PASS (TypeScript + Vite)
- `npm test` (3 new test files): 19/19 PASS
- No migration, secrets/provider, token refresh, OneDrive, accounts, snapshots, strategy/publication or production data writes
- Backend deployment remains separately protected