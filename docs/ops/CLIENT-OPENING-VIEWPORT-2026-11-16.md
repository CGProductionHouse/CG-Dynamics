# Client portal opening viewport correction

Owner: #389 / #381. Follows merged #993; CA's post-release screenshot still
shows a cropped header/Overview despite the new single-column signal cards.
The prior live-file checks were accurate but did not prove the phone opening
experience. Do not repeat the claim that a fresh tab alone resolves it.

## Reproduction and correction

The existing layout/scrollWidth tests miss magnification: native Chromium page
scale 16/14 gives a 320px layout but a 280px visual viewport. The old shell leaves
Sign out at x304, cropped outside the visible viewport. The new executable local
browser regression fails against the old behavior with those exact measurements.
This reproduces a matching failure mode, not a physical-iPhone root-cause trace.

Login now blurs its active field before async authentication. On real client
shell entry only, a narrow iOS/small-screen helper checks visualViewport.scale.
If already magnified and no editor is focused, it temporarily requests scale1,
then restores the exact original unrestricted viewport after two animation frames.
Cleanup, a new touch or a250ms background-tab timeout restore it too. Normal scale,
desktop/non-iOS, missing capabilities and staff preview are untouched. The persistent
shell does not re-run it on section navigation; later user zoom is preserved.
No permanent maximum-scale, user-scalable=no, gesture prevention, interval or
resize loop. Existing16px fields and responsive layout remain intact.

## Verification

-93 affected tests pass,0fail/skip: opening lifecycle/cleanup/guards, real auth/CSS,
  portal scope/isolation/preview/access and mobile regressions.
-Local actual Login/router/Shell/Overview/CSS in isolated Chromium and WebKit:
  320/375/393/430/1440px, normal direct entry and long names, password reveal,
  complete Sign out bounds and no document overflow. Four Chromium phone cases
  additionally inject native16/14 magnification before login, verify scale1 after
  entry, then preserve intentional1.5scale through actual keyboard route activation.
  WebKit normal-flow results do NOT claim UIKit's physical input-zoom emulation.
-TypeScript/Vite production build, scoped ESLint and diff check pass. Existing
  non-fatal Vite dependency-scan shutdown warnings in SSR tests are retained in
  the local log, not suppressed or represented as rendered-device verification.
-Local screenshots/logs: `%TEMP%/cg-client-opening-viewport`,
  `cg-opening-browser.log`, `cg-opening-tests.log`. Synthetic client/auth only;
  no production browser profile, credentials, provider request or data write.

## Release boundary

Prepared from current main4ee7d503 in the isolated client-login worktree. Other
agent lanes untouched; git deployment stays OFF. Corrective live release must
use one locally compiled prebuilt stage, verify it, promote the SAME stage and
read back exact production files. Rollback currentdpl_B8eMyLViZqYRNxae4cR9HXqLhwhB.
Fresh30-day billing reads at2026-11-16T13:46:28Z all succeed: conservatively
16.209721369951USD billed, same delayed cutoff16Nov08UTC;20USD included allocation,
at least3.79USD headroom,3USD reserve, at most0.10USD incremental corrective-release
allowance. No cap/budget/config change. Charges are delayed, not a real-time guarantee.
Physical iPhone acceptance remains unverified; no every-device completion claim.
