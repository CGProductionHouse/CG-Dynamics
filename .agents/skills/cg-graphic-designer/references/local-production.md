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

The file connector returned `403 serviceReadOnly / Database Is Read Only` for four
selected files; the existing company OneDrive UI downloaded those same originals
successfully. Verify original hashes against returned OneDrive metadata. Do not
infer a laptop outage or grant broader permissions from that connector error.
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
