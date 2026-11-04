# Ehrlich Park November source intake — 4 November 2026

The owner corrected the queue workflow: **pre-stage the originals needed for all assigned client films, then edit Ehrlich alone**. This means selecting by story and source review, not bulk copying every raw camera file. The first Ehrlich R05 is a rejected private study; it must not be sent.

## Byte integrity

The signed-in OneDrive folder inventory for March, April, May and July `VIDEO 1` contains **59 MP4 originals / 13,340,349,728 bytes**. A private machine-readable size/SHA-256 manifest and current status CSV live outside Git at `C:\Users\chris\Videos\CG-AI-Editing\Nolan-Studio-Private\Ehrlich-Nov-2026\source-intake-{manifest.json,status.csv}`. At the latest complete audit, **9 of 59** source copies matched both listed size and remote SHA-256, **2** March local copies were incomplete/mismatched and excluded, and **48** were absent. A subsequent normal OneDrive download of May `199A1367.MP4` matched its exact 330,977,172 bytes and SHA-256 `3095465B581648DBD49C80531B1AC843EEE7AD52E4AA1245F7B59DF9F7BDD997`, making **10 verified**; refresh the CSV before citing the count again. Do not use `.crdownload` fragments, overwrite the two mismatches, or claim that the full folder is local.

The combined four-client raw camera queues exceed available C: working space. The PSG, TBS and WiseRide cache currently holds only **one byte-verified access proof per client**, not a complete selected-media handover. Select their story-specific action first, then stage all chosen originals before *their* edit. Keep adequate room for Ehrlich proxies, stems and final exports. There is no usable D: headroom. No client media belongs in Git.

## Actual source screen, not an edit clearance

These are OneDrive preview and local contact-screen findings. They do **not** prove full-motion/audio quality or that a picture beat was never publicly posted.

| Source | Visible content | Decision now |
| --- | --- | --- |
| April `199A1429`, `1430`, `1431`, `1433`–`1436` | Same male staff member addresses the camera; most takes are visibly speaking. | Exclude from this no-speaking-person film. Do not download 7 large files for this cut. |
| April `199A1432` | Sausage/display counter shot | Optional geography only; weaker than distinct human preparation. |
| May `199A1365` | Blue-gloved butchery worker completes a hanging beef separation around 9–11 s; complete original is verified. | New candidate action, exact in/out and published-use review pending. |
| May `199A1367` | Overhead knife cleanly portions two beef strips in roughly 0–11.9 s; complete original is verified. | Strong new candidate for a slice-led hook or preparation beat. |
| May `199A1368`–`1373` | Closely related beef trimming/slicing details | `1372` has the cleanest blade-on-strip preview; acquire only if it adds a truly distinct beat. |
| May `199A1374`–`1377` | Worker poses with beef pieces and appears to address the camera | Exclude under the owner's no-speaking-person rule. |
| July `199A1388`–`1389` | Worker concentrates on bagging sausages at the counter | Candidate for a human service/packing beat, pending full original and prior use. |
| July `199A1390` | Worker faces camera with a bag | Exclude unless complete motion proves a silent natural action, not an address to camera. |
| July `199A1391`–`1392` | Mostly empty machine/scale setup | No story job; exclude. |
| July `199A1393`–`1394` | Distinct bone-in cutting action; `1394` is a tighter knife/detail angle | `1394` candidate, transfer/verification pending. |
| June `199A1408` | Gloved hand near sausage equipment | Possible transitional action; screen further before selecting. |
| June `199A1409`–`1410` | Top-down coiled sausage on production equipment | `1410` candidate as a real Ehrlich making beat; transfer/verification pending. June was outside the first four assigned folders but is an authorised older-client archive source. |
| August `199A1378` | Staff member addresses camera holding meat | Exclude; no need to bulk download the seven-file August folder. |

The source folder's month labels do not equal the camera capture date: several May/July/June items display 14–15 April in OneDrive. Do not call them current November stock. The owner allows a different moment from a previously posted shoot only when it serves a new story job; a crop or changed soundtrack does not make a repeated published beat new.

## Transfer behaviour and next gate

A normal signed-in OneDrive download of `1365` and then `1367` completed after apparent `.crdownload` pauses; both were verified against remote hashes before copying into the protected source tree. Selected-folder, multi-select and some preview Download actions did not immediately yield local bytes. Inspect the filesystem after waiting; do not blindly click the same control repeatedly or infer success from an activated button. The SharePoint raw connector previously returned `403 serviceReadOnly` and the 100 MiB ceiling remains; do not work around it.

Next: obtain complete `1394` and `1410` (or a stronger distinct source), hash against fresh OneDrive metadata, inspect full motion and camera sound, compare exact selected moments with source-month/later public films, then replace R05's repeated sausage/knife and stock holds. The R05 music/creative listening and full phone review remain unapproved. Only a thoroughly reviewed new export may go to CG Nolan Approvals.

## R06 protected source-select trial

The refreshed private CSV now reports **10 verified, 2 mismatched/incomplete, 47 absent** across the 59 assigned originals; this supersedes the earlier 9/2/48 count above.

`ehrlich-november/render_r06.py` produced a private 28.350-second 540×960 preview from verified May/July originals, February shop geography and previously licensed illustrative cooking shots. `contact-r06.jpg` is stored privately outside Git. **Reject this as a review delivery:** the action family still repeats beef separation, knife cuts, sausages and flame; the middle remains too similar to R05. The sampled picture screen cannot establish normal-speed sound fit. Do not send it. More distinct verified source moments are needed, rather than a longer montage of the same shots.
