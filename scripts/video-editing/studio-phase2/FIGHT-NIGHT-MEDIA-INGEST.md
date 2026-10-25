# Fight Night large-original ingest — 25 October 2026

The camera originals live in the exact private OneDrive folder recorded in
`FIGHT-NIGHT-EVENT-INTAKE.md`. Keep them there unchanged. This note separates
the connected SharePoint tool's fetch ceiling from the files' actual health.

## Verified routes

| Route | Observed result | Use |
| --- | --- | --- |
| Connected SharePoint list/get metadata | Lists item IDs, lengths and SHA-256 even for the 646 MB bout source | Inventory and integrity authority |
| Connected SharePoint raw fetch | Successfully retrieved 25 additional originals smaller than 104,857,600 bytes; all matched remote lengths and hashes | Small source intake only |
| Connected SharePoint fetch, `3Q7A9330.MP4` | `413 File too large to fetch: 646389792 bytes exceeds the 104857600-byte limit`, including when raw fetch is false | Hard tool limit; do not infer source corruption or keep retrying it |
| This PC's local OneDrive roots | None contains the current Staffy shoot. The configured personal sync account differs from the source drive; OneDrive was not running at the check | Cannot use these roots as a media mirror |
| Direct unauthenticated OneDrive/WebDAV HEAD | Login redirect or `403` | Not a download route |
| Signed-in browser | Two ~97 MB originals previously downloaded and hash-verified; later larger bout download attempts had no completed local file at the check | Retry only when desktop control is unconflicted, then verify the whole file |

The connector ceiling is **a service limit, not a project setting**. Do not
evade it by creating a share link, changing item permissions, splitting or
rewriting the cloud original, or extracting browser credentials. No account or
workstation sync configuration was changed for this investigation.

## Repeatable large-media route

1. On an authorised editor workstation signed into the **source drive's**
   account, use the normal OneDrive application or browser to make a private
   local copy of selected large originals. Check the actual profile/account
   before enabling any sync; this PC's existing roots are linked elsewhere.
   Do not operate another editor's active desktop.
2. Store originals in the private, Git-excluded
   `C:\Users\chris\Videos\CG-AI-Editing\Fight-Night-2026\source\` work area,
   or an equivalently private local media volume. Never replace a cloud item.
3. Match every local filename against
   `FIGHT-NIGHT-SOURCE-INVENTORY-20261025.csv`, then confirm byte length and
   SHA-256 with `Get-FileHash -Algorithm SHA256`. Reject incomplete files and
   duplicate names from other clients/shoots.
4. Screen the full moving original and camera sound. Log contact frame,
   immediate consequence and ambiguity before any impact edit. Keep source
   in/out points and hashes in the handover; edit protected copies only.

For future large shoots, the sustainable handover is the camera-card or an
authorised OneDrive sync/local transfer into the editing workspace **before**
the trailer deadline. The connected SharePoint tool remains valuable for
metadata and small selects, but cannot be the sole 4K camera-original ingest.

Current status: 27 hash-verified short originals are local; no clearly landed
event blow has been verified. The 646 MB and 822 MB candidate bout files are
still missing locally. The large-media route is documented but **not yet
operationally verified** on this workstation. Do not call the access gap fixed
until a complete large original arrives and passes its remote hash.

**23:20 SAST recheck:** metadata for the six initially zero-byte entries
(`3Q7A9106`, `9107`, `9108`, `9115`, `9145`, `9488`) still reports zero bytes;
do not ingest or count them as completed camera takes. The signed-in source
account's normal OneDrive preview of `3Q7A9330.MP4` opened and displayed the
23-second ring take. Its ordinary Download control was activated once during
an unconflicted browser interval, but the page showed no completion signal and
no hash-verified large local original resulted in this pass. Do not repeat
blind clicks or claim that preview playback is a working 646 MB transfer.
The intended handover remains a normal authorised source-account local copy
or camera-card transfer followed by the inventory size/SHA check above.
