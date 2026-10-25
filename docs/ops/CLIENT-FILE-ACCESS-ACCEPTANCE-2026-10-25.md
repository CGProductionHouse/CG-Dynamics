# Client file access — slow authorisation repair and acceptance

25 October 2026; client lane #396/#668, supervisor #381. ZERO Vercel.
Runtime source: `ea5eaad6e66167f45918c8fb495e98287346e8e1`.

## Concrete defect reproduced and fixed locally

The previous file action awaited its server grant before creating a new window.
With Chromium's normal popup blocking enabled and a six-second grant response,
the actual View action never opened its file window. The canonical fixture
failed waiting for that destination. The previous default Playwright launch
disabled popup blocking and therefore did not exercise this failure.

The action now reserves one blank destination during the user's tap, immediately
detaches its opener and installs a no-referrer policy. Only the existing validated,
purpose-bound file grant can navigate it. The portal stays open. A blocked window
does not request an unused grant; denied/malformed grants close the blank window.
Leaving the client closes a pending destination and fences its late result. A
window the user closed is not silently replaced. Video streaming is unchanged.

There is no new route, credential transport, auth bypass, permission, dependency,
file publication or provider/backend change. The accepted portal layout is intact.
The source repair is **not deployed**; the live browser observations below are
acceptance of the existing published files, not proof the new frontend is live.

Changed runtime/test files:

- `src/features/client-portal-library/ClientPortalLibrary.tsx`
- `scripts/client-library-readonly-browser.mjs`

The popup limitation and separate-window behaviour were checked against the
[browser API reference](https://developer.mozilla.org/en-US/docs/Web/API/Window/open).
No browser security protection was disabled in a real user session. The local
test now removes Playwright's popup-blocking-disabling launch argument.

## Local verification

Focused library/transport/acceptance tests: **27 passed, zero failed/skipped**.
Actual-component browser checks pass at **1440 /375 /390 /430** with normal popup
blocking, including slow View and Download, real attachment bytes and filename,
null opener before and after authorisation, no referrer, blocked/closed/abandoned
windows, expired-grant recovery, manual video retry and stale-response fences.
Every browser request remains loopback-only with synthetic exact-client data.

Canonical frozen-source acceptance:

- 4208 total /4184 pass /24 explicit skips /0 failed/cancelled/todo.
- TypeScript, Vite actual-app build and **all 20 canonical browser fixtures** pass.
- Both mandatory disposable PostgreSQL fixtures remain included and pass.
- Stable source tree; source `ea5eaad6e66167f45918c8fb495e98287346e8e1`.
- Run started 20:07 UTC and completed 20:26 UTC on 25 October.
- Private receipt `%TEMP%/cg-local-launch-ea5eaad6e661.json`.
- SHA256 `F900C1378CF355C58EDCB22852597B21CDBEC48047C42BB24B9C3CB7B3E0881F`.

Scoped ESLint and diff checks pass. Whole-repo lint has zero errors and the same
17 existing warnings outside this change. No new production packages were added.
The earlier separately opted-in Instagram/registry SQL checks retain their own
receipts; they are not counted into this run's skips/passes. Seven optional staff
PGlite groups and the explicitly excluded unsupported Windows Bash fixture are
not silently relabelled passed. Fixture-configured `dist` must NEVER be uploaded.

## Live file-view matrix — all 41 published libraries accounted for

The earlier eight-client result is extended to **37 unique published image
libraries**. Every accepted image has completed loading with nonzero natural
dimensions, a separate window, empty referrer and the original Dynamics client
preserved. These are real staff-preview Views, not 37 attachment downloads or
genuine client-password/physical-phone acceptance.

The four remaining render checks are explicit:

| Client | Exact remaining check |
| --- | --- |
| Case Bloemfontein | Correct published PDF title opened; Chrome native-PDF extension inspection blocked. No extension workaround. |
| Emoya Estate Driving Range | Published PDF entry verified; native-PDF rendering not automated. |
| Germoparts | Published PDF entry verified; native-PDF rendering not automated. |
| LHP Student Village & Block | Browser URL-policy gate denied content observation. No retry, alternate surface or bypass; not passed. |

Some new windows initially had unsettled metadata. Those were not observed until
their existing windows had a validated file endpoint; Novus, PSG and Tobich were
correlated against three SELECT-only published-asset identities before reading.
No grant replay/new navigation or raw signed URL was printed/committed. NCNA and
We Ar Fuels' preliminary loading frames were replaced by actual completed-load
observations. The LHP policy-denied window was specifically excluded from recovery.

Sanitized private matrix `%TEMP%/cg-brand-file-window-final-20261025.json`, SHA256
`A38278CE116570FAA548889D8054DCD017855C09E1A8E4F8C1B5090BEDC7BA38`.
The 17 original private libraries and new Jodrico launch scope are unchanged.
Nothing was published, enabled, shared, copied, moved or remapped by this pass.

## One bounded read-only backend-health window

Verified the CG Dynamics Supabase project identity before reads. Fixed window:
19:24:40–20:24:40 UTC, 25 October. Function-edge aggregates show six Meta worker
responses, all HTTP200, and client-onboarding 298 HTTP200 /1 HTTP206. The matching
worker runtime aggregate contains only eight Boot and seven Shutdown log rows;
no error-level row was returned. Only counts/severity/path fields were read,
not raw request URLs, headers, messages, tokens or credentials.

This is endpoint-health evidence, **not** per-client metric completeness, proof
all worker items succeeded, or a conclusion that other providers failed because
they had no invocation in this one-hour window. No sync, retry, OAuth, mapping,
config/key or production data write was performed. Private aggregate receipt
`%TEMP%/cg-provider-log-acceptance-20261025.json`, SHA256
`704D80F8CEB3199F4D3970ED569A2A08D1C82B6A128EF23D6B7F2E99F4C4BC62`.

## Next action and retained owners

Review/merge only this coherent source fix and receipts; keep Git deployment OFF.
The next frontend release still needs its exact #679 packet; no Vercel action is
authorised or performed here. Do not rerun completed all-client listing sweeps or
the 37 accepted image Views. The four render exceptions above are precise owner
review items, not justification to bypass browser policy.

Meta consent/encrypted-row acceptance, #731 source/editorial/publication, original
private asset/new-client scope, staff posting/calendar and CA's real passwords/
physical-phone checks retain their existing owners. Do not repeat the already
released Google/Meta backend packets, duplicate strategy authoring or disturb the
staff/Teams lane. The finite overnight heartbeat remains bounded to 08:00 SAST
26 October; stop unchanged audits when no safe executable item remains.

No production SQL/data/schema/Edge/config/secrets/provider/OAuth/permission,
contract, strategy or asset mutation occurred. The exact Google Control Centre
reference remains unavailable; GitHub/ops are updated, no replacement invented.
