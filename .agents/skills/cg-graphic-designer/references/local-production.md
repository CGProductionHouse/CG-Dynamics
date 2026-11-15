# Selected assets and offline masks

Use only when a selected original or independent foreground mask is needed.

## Retrieve selectively

OneDrive provider thumbnails can be inspected before original downloads. The
14 November proof bundled63 office previews,30 newer previews,7 edited-event
previews and6 website-source previews without hydrating their source libraries.
Use the documented browser `pageAssets` capability on actual visible grid image
URLs, retain the filename-to-asset mapping privately, and fetch only selected
originals through the authenticated UI/connector. Do not turn this into a hidden
API crawler or guess authenticated asset URLs. A thumbnail is not export media.

The browser-facing OneDrive URL returned `403 serviceReadOnly / Database Is Read
Only`. A later headless proof succeeded through the same authorised connector:
resolve the exact selected item's verified drive/item IDs and parent containment,
then call `microsoft_sharepoint.fetch` with `download_raw_file=true` and the
documented canonical item URL:
`https://graph.microsoft.com/v1.0/drives/<verified-drive-id>/items/<verified-item-id>`.
Materialise its private returned file reference only into the authorised local job.
Never guess IDs, create a public share or print/store transient signed download URLs.
Inspect safe metadata rather than the full successful fetch response. Verify bytes
against an existing trusted original hash; a metadata-only readback is insufficient.
On15November, a selected7,476,556-byte original matched its exact prior SHA256,
and the1,611,173-byte R3 recovery ZIP matched its uploaded SHA256 and passed ZIP CRC.
No browser, credential change or public sharing was used. This proves selected
private retrieval, not ordinary company-ChatGPT local execution or WhatsApp access.
The earlier UI download remains historical evidence, not the default fallback.
Do not infer a laptop outage or grant broader permissions from that connector error.
Folder-scoped search also returned unrelated-client results: enforce exact parent
containment before using a result. Never fetch another client's returned item.

## Offline alpha only

`scripts/poster-studio/local-cutout.py` runs the explicitly pinned U2-Net checkpoint
through existing ONNX Runtime CPU, with2 intra-op /1 inter-op threads. It has no
network, downloader, server or paid-model fallback. Supply the reviewed local model
explicitly; a wrong hash fails before inference. It accepts a new PNG destination,
preserves prior files, converts reviewed colour evidence through `photo_colour.py`,
and verifies that alpha composition leaves prepared RGB pixels unchanged.

```powershell
python scripts/poster-studio/local-cutout.py <private-finished-photo.jpg> <new-private-cutout.png> --model <reviewed-local-u2net.onnx>
```

Model SHA256:
`8d10d2f3bb75ae3b6d527c77944fc5e7dcd94b29809d47a739a7a728a912b491`

Reviewed sources: [maintainer checkpoint/normalisation](https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2net.py),
[upstream Apache2 licence](https://github.com/xuebinqin/U-2-Net/blob/master/LICENSE).
The model is175,997,641 bytes, downloaded separately from the maintainer release;
never commit weights or private photographs. Do not select rembg's default model
or a cloud backend: other checkpoints can have different commercial terms.

Actual Windows ONNX Runtime1.31.0 test:2400x1600 input,0.590s inference /1.934s
whole command, prepared RGB equality true. Seven synthetic invariants exercise
bad hashes, invalid predictions, alpha/colour preservation and overwrite guards.
These measurements are one image, not a whole-month or5,000-photo benchmark.

Inspect the actual alpha on light and dark grounds, then its HD placement. The
model included a chair and made an outstretched hand translucent in this sample;
the accepted technical use was a cropped original hair cap only. Keep a full
photographic base underneath. Do not reuse the imperfect full cutout elsewhere
or interpret segmentation as person recognition, skin retouch or creative approval.
An original hand-traced mask left a visible wall fringe in the actual HD export;
that revision was superseded rather than shipped.

## Native Canva evidence

Two headline-frame changes in the DP01 transaction returned success and retained
all native records, but its returned preview lost unrelated lower text/logo.
Cancel was verified; the saved R1 and its actual2160x2700 export retained those
elements. Cause is unproven. Compare rendered output as well as object records
before committing a native amendment. A deterministic revision to one structured
page is an available fallback; preserve the old page and non-target source hashes,
and identify the current candidate explicitly. Do not claim whole-poster AI
regeneration or a successful isolated native amendment from this failure.

A later support-line-only replacement on DP04 succeeded: all14 element IDs
retained, only the target text record changed, and0 preview pixels changed outside
its conservative frame (1552 inside,480x600 actual preview). The test was canceled
and original wording retained. Do not generalise the earlier resize-preview
failure to every editing operation or promote this preview test into an HD proof.

Inspect SIFT flags against actual artwork before declaring reuse. A high-inlier
portrait match was visibly confirmed in two old posters and excluded. Another
office photograph flagged an exterior-building poster: actual artwork disproved
that correspondence. Keep machine findings and visual decisions together; do not
lower thresholds, delete findings, or infer person identity from a feature match.

Canva's blob export completed locally even when the browser download event timed
out. The filename used the page label, not the design title. Inspect the actual
Completed UI and recently received exact labelled file before clicking again;
the false-negative wait produced a duplicate incoming file. Validate dimensions
and hash locally. Do not report a failed export solely from its event timeout.

None of these local tools proves normal company ChatGPT invocation, master-page
transfer, human approval, schedule assignment or delivery. Keep those gates separate.
# Proven November14 corrections

- Durable owner direction belongs in the exact client's canonical intelligence,
  when recording it is authorised. The append-only content-direction tool returned
  an unreviewed record subsequently retrieved by get_client_context, with guidev1
  unchanged. Preserve agency-owner versus client-approval provenance; do not turn
  machine findings into approved knowledge or create unrelated meeting/tasks.
- Local access and remote-account access are separate proofs. The MSI was reachable
  in Codex while its running saved remote pairing belonged to Gmail and this chat's
  connector belonged to the company account. Existing personal autostart was already
  enabled/running. Do not re-pair, kill, duplicate or weaken that setup to make an
  offline record look healthy; company invocation needs an authorised matching
  pairing. Metadata diagnosis must never expose or transmit saved credentials.

- Retrieve the exact-client `get_client_context` packet with `task_type=caption`
  before allocating copy. An idea packet can have no footer while the caption
  contract requires phone plus website. Run both caption transport and
  `caption-footer-guard.mjs` checks on the explicit current version. Reverify
  mutable contact facts; the guard checks supplied-packet consistency, not source
  authenticity or current business truth. Never rewrite an approved caption
  silently; preserve its prior bytes/hash and record the bounded amendment.
- Re-resolve stable IDs immediately before structural edits. An additional January
  page shifted the rejected owned copies from39–46 to40–47. The approved nine-call
  replacement preserved all94other IDs/order, including that new page. Old page
  numbers must never serve as write authority. Exact-operation approval does not
  grant creative approval, publication or deletion of anyone else's work.
- The actual master allowed native layer inspection at99and100pages during
  transfer, then rejected full editing at102. Verified six drafts' full native
  records and extracted all four posters' live text; inspect the actual final
  previews too. Do not imply every transferred media record or final master HD
  was independently rechecked when the connector cannot expose it. Keep current
  source workbenches until that operational limit is resolved.

- Native formatting may auto-fit both width and left position. After a font-size
  change, restore the intended frame width, then explicitly reapply its position.
  Actual DP03 export proved the final centred/tight hierarchy; record geometry
  alone did not reveal the first unintended left shift.
- A commit timeout is an unknown response, not proof of failed saving. Do not
  blindly retry. Fresh saved-editor output and genuine HD verified DP03/F03 while
  page-list thumbnails/AX labels could be stale. Record the timeout and actual
  final-file evidence separately; never relabel a cached thumbnail as current HD.
- Verify the full source before assigning product copy. Actual selected originals
  showed a multimeter/hacksaw and fire extinguishers, not guessed oils/cleaners.
  Blur obsolete temporary price numerals only when needed; retain source and mask
  rectangles. Zero change outside that mask is a pre-encoding graded-RGB test,
  not bitwise equality after JPEG encoding or the overall colour finish.
- A negative thumbnail match is selection evidence only. The full-original pass
  found additional equipment/background flags; inspect actual historical art and
  retain raw results/visual decisions. EXIF-date overlap is a source-family review
  flag, not a biometric identity or automatic exemption. The private feature-cache
  experiment is not a proven reusable production cache or like-for-like benchmark.
- If WhatsApp says active elsewhere, inspect the existing company window instead
  of clicking Use here and disrupting another sender. If actual latest-history
  coverage cannot be refreshed, stage exact files/captions with a hold receipt.
  Do not call that delivery or infer that the laptop is switched off.

- A transparent PNG can cover the full page for hit-testing even where its pixels
  are clear. Clicking visible text beneath it selected the graphic instead. Use
  Canva Position > Layers to select the actual text before a font readback; the
  DP04 BRAKE layer then showed actual Mokoto in the native font picker. Selection
  alone is read-only; do not infer font fidelity from a similar-looking preview.
- Keep bounded working recovery packs in the existing internal OneDrive helper
  folder. The real DP04 recovery ZIP was uploaded and exact name/size/item ID read
  back; do not confuse creating a folder with backing up any files. Preserve source
  locators and mark unapproved working packs clearly; no public sharing or portal
  final status follows from that backup.
- Inspect the original task before selecting service copy. An October workshop
  thumbnail initially suggested wheel alignment; the actual original showed brake/
  hub equipment. Rebrief from that source and current service evidence instead of
  making the image fit a prewritten claim. A person looking down while doing clear
  hands-on work differs from an awkward posed portrait; judge the actual image.
- Canva download panels can rerender during field entry. A real `Size` fill pasted
  a stray2 onto an owned working page. Stop when the displayed dimensions disagree,
  undo exactly that change, and compare saved native records. The verified recovery
  restored all14 records. Wait for settled controls, verify2160x2700/size2 before
  Download, and never accept `Preparing` as completion. Native download-event waits
  can time out even when the exact file arrived; check that file before retrying.
- Use `scripts/poster-studio/caption-guard.mjs` with the explicit canonical UTF-8/LF
  SHA-256 and a new receipt path. It rejects malformed Unicode, common mojibake,
  stale text and standalone agent signatures; it neither rewrites nor sends copy.
  Windows CRLF is normalised only for comparison. Caption notes are not authority.
