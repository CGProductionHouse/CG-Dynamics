# Guideline preview contrast correction — 25 November 2026

CA supplied a real RC-Polypipe WhatsApp screenshot: its white transparent logo
became invisible on the large white link-preview image. The compact dark preview
was legible. This is an image-compositing defect, not missing scripts or a share
permission defect. Existing published content and bearer links are preserved.

## Prepared correction

- Original `public/client-logos` bytes remain unchanged. Generated social-only
  images are fully opaque PNG1200×630 with the original mark contained inside a
  central safe area. RC receives a solid dark green/black canvas. Black marks use
  a light canvas; mixed fine lettering is checked too. Ehrlich's red/white mark
  has an explicitly visually reviewed neutral matte. No logo is AI-redrawn.
-45 existing PNG assets, including existing aliases, have exact-source hashed
  previews. This is45 public logo assets, not45 distinct verified active clients.
  Missing source logos are not invented. New/unprepared/changed/corrupt images
  produce no image metadata rather than a raw transparent fallback.
- A manifest binds each exact local source path/hash to its output path/hash.
  The API verifies both and rejects foreign or arbitrary paths before reading.
  Runtime uses only Node built-ins. Local generation reuses the existing PNG
  decoder and already-installed sharp0.35.5; no production dependency added.
- Metadata emits PNG type and exact dimensions. New share/copy/canonical URLs use
  `v=cg3-<same publication timestamp>`; original capabilities and old paths still
  work. This does not republish content or approve anything. Previously sent
  WhatsApp cards may remain cached; new shares need the new version after release.

## Verification

38/38 focused tests pass,0fail/0skip: real image alpha/dimensions/source hashes,
RC contrast, fine white lettering, source drift/corruption/foreign/missing path
refusal, raw-logo fallback rejection, actual metadata/share/canonical/review and
receipt/isolation/packaging regressions. Production TypeScript/Vite build with app
code, scoped JS/TS/TSX lint and diff check pass. The45-image contact sheet and
RC/Ehrlich full-size images were inspected locally. No physical WhatsApp or phone
acceptance is claimed for unreleased code.

Private rendered proof/logs:
`C:/Users/chris/.codex/artifacts/client-preview-contrast-2026-11-25/`.
Regenerate locally using an existing sharp entrypoint in `CG_SHARP_MODULE`, then
`node scripts/build-client-preview-logos.mjs`. Never run the original sync script
as an import; it now runs maintenance only when explicitly invoked.

## Release is HELD, not live

Standing CA no-Vercel instruction and #679 hosting policy remain in force. Git
deployment is still OFF. No cloud build/upload/promote, MCP deploy, SQL/data write,
republish, provider/secret/permission, Teams or other-agent mutation occurred.
Read-only hosting inspection is not a release.

Known target:CG Dynamics `prj_jHVsExoStNjI7ikqlJyXZx26Ahuu`,team
`team_SK5vvWv1AIXFkPNV8JFYL205`,production `www.cgdynamics.co.za` (apex308).
Fresh domain registration read confirms that project. Live root serves
`/assets/index-BP2mPX54.js`; the current branch's different app bundle is NOT
authorised wholesale. Preview deployment must be isolated from the other
unreleased staff/Pipeline changes in PR1005. Fresh exact active-domain rollback
identity and source/artifact parity still need qualification before upload.

Billing inspection:the full18–25November request exceeded the provider tool size
limit. Disjoint daily requests succeeded through24November;25November returned
costs_not_found. Those delayed daily records do not establish current-cycle
headroom/serving reserve. No current budget guarantee is made from partial data.
Do not upload until the exact rollback, current usage/reserve and bounded release
authority are established; no blind retries or protection/cap changes.

Later order:qualify one preview-only production-target prebuilt artifact against
the exact live frontend → authorised bounded stage → crawler GET/HEAD,own image
bytes/opacity,wrong capability denial,root/login uptime → promote SAME artifact →
verify live RC metadata/image → update only the MCP share-version helper using a
fresh whole-live-source overlay/readback → refresh connector and verify one new
RC link in an unsent WhatsApp composer. No external WhatsApp message is authorised
or required. Do not deploy the new link version first and cache the old image.

This receipt is source/local acceptance, not a live fix. Approval for one bounded
preview-only release is the exact remaining owner gate under the no-Vercel rule.
