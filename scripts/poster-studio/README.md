# Poster Studio proof engine

This local-only engine renders a versioned JSON scene graph to:

- an editable SVG with live text and independently addressed layers;
- a deterministic PNG review preview;
- a manifest containing source-asset, scene, layer and output SHA-256 hashes; and
- an amendment receipt proving exactly which stable layer IDs changed.

It deliberately does not upload assets, call a paid API or flatten an image and call it editable. The SVG is the portable interim production document. Photoshop/UXP is the preferred PSD finishing path once its local round trip is verified.

The companion headless tools are:

- `creative-ledger.mjs` — image fingerprints plus source/shoot/person/product/service/branch/concept/headline/mechanism repetition checks for both human and AI work;
- `month-plan.mjs` — validates a proposed monthly strategy board against package, Brand Pack and future-schedule safety gates;
- `month-board.mjs` — renders the complete proposal as a responsive, printable local review board.
- `source-history-audit.py` — compares selected exact photo sources against local Canva poster previews using SIFT features and geometric verification. Requires the existing OpenCV runtime; it creates no face identities. Matches require visual review, and negative results never certify that a source is unused.
- `canva-native-package.mjs` — packages a private structured scene as metadata-clean, self-contained HTML plus a layer/asset-hash manifest for Canva's native import connector. It performs no upload, auth, export, publication or desktop interaction. Exact kit font rendering and real native elements were checked in the Piek pilot; everyday company-ChatGPT authoring/export remains a separate acceptance gate.

They are designed for a future normal-company-ChatGPT tool wrapper and do not require routine desktop takeover.

## Commands

```powershell
node scripts/poster-studio/poster-studio.mjs render C:\private\job\scene-v1.json --out C:\private\job\output
node scripts/poster-studio/poster-studio.mjs compare C:\private\job\scene-v1.json C:\private\job\scene-v2.json --out C:\private\job\amendment.json
```

Chrome is used headlessly for the local preview. Set `CHROME_PATH` only if Chrome is not installed in its normal Windows location. `--no-preview` emits SVG and the manifest without PNG rendering.

```powershell
node scripts/poster-studio/creative-ledger.mjs fingerprint <image>
node scripts/poster-studio/creative-ledger.mjs check <ledger.json> <candidate.json> --out <receipt.json>
node scripts/poster-studio/month-plan.mjs <month-plan.json> <brand-pack-index.json>
node scripts/poster-studio/month-board.mjs <month-plan.json> <private-output.html>
python scripts/poster-studio/source-history-audit.py --source <original.jpg> --history <private-thumbnail-directory> --out <private-report.json>
node scripts/poster-studio/canva-native-package.mjs <private-native-scene.json> <private-output.html>
```

The history matcher records every preview hash and decode error. Its controlled test places a resized source inside a poster and checks that an unrelated texture is rejected. Small, heavily overlaid, edited, same-shoot or missing historical content still needs visual/history review; do not promote a candidate automatically from this report.

For verified parent-brand use of a subsidiary photograph, add `--brand-pack <trusted-brand-pack-index.json>` to the ledger check. Exact-client `sourceScopeRules` permit only the reviewed parent scope; candidates cannot self-authorise mixing sibling kits. Unknown people/branches remain unresolved, and headline matching uses the actual headline. The real pilot exercises source hashes, pHash and EXIF capture/sequence against 12 candidates and a known human-history source; it retains repetition warnings rather than auto-approving the month.

The matcher now caps OpenCV worker threads at two unless already lower. The uncapped real multi-source pass consumed roughly 9 GB; bounded follow-ups preserved matching settings and completed with much lower observed memory. This is not a 6,000-photo throughput benchmark. Run one feature audit at a time on the MSI and keep receipts for rejected matches and resource limits.

## Native Canva scene contract

Use `schemaVersion: 1`, `status: "internal-draft"`, `title`, `canvas`, verified `brandScopes` and individually composed `pages`. Each page has a stable `id`, exact `brandScope`, `label`, accurate internal `notes`, verified `background` and ordered `layers`. Supported layers are `text`, `image`, `rect` and declared `nativeAsset`; unknown types fail instead of flattening silently. Each layer needs stable `id`, `x`, `y`, `width` and `height`.

Text declares an exact scope `fontFamily`, `fontSize`, `colour`, explicit `lines` or `text`, and retained `lineHeight`. Image paths must resolve inside the private job directory; source hashes are recorded and an optional `expectedSha256` detects source changes. Prepare sRGB derivatives without private EXIF/XMP/IPTC/text metadata before packaging. The output embeds exact supplied image bytes and therefore stays private and outside Git.

Native asset layers declare the verified Canva `assetId` and either `replace-frame` or `delete-and-insert` binding mode. The imported placeholder is deliberately marked `UNBOUND NATIVE ASSET`; use `verifyNativeBindings(manifest, state)` after actual binding. It requires exact page/asset identity, unique placement and dimensions within observed half-pixel native quantisation, with no remaining placeholder. This proves binding only, not font family metadata, PSD editability, final export or creative approval.

The actual shared CLI generated the 1,462,279-byte Sasol night candidate, imported with three live text records and separate photo/logo assets, then transferred into the official file with all non-target records unchanged. See the Piek production evidence. Browser/connector export and sender permissions are not bypassed by this local packager.

## Privacy and provenance

Scene files and client assets stay outside Git. Image layers embed the exact source bytes as data URLs so the SVG remains portable across Affinity, browsers and another workstation; the manifest records each original path, size and digest. The engine never mutates a source asset.

## Supported layer types

`image`, `text`, `rect`, `ellipse`, `path` and nested `group` layers are supported, alongside gradients, clip paths and explicit SVG filters. Layer IDs must remain stable across versions so a change receipt can prove isolated amendments.
