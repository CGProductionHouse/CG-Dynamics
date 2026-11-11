# Nolan M05: Professional motion-asset intake and source-bound preflight

**11 November 2026 | DESKTOP-M1VHEJF only | existing CG Nolan queue/PR910**

## Actual change

Implemented \`nolan_motion_asset_gate.py\` as a **read-only verification and eligibility layer** over the already-existing Adobe MOGRT catalog; added \`nolan_assets.py assess <exact-asset-id> [--usage-file evidence.json]\` to the existing discovery router and appended scoped usage/limitations to the installed \`nolan-browser-motion\` skill. No new provider account, download, global catalog, client library or production job. No employee application/UI was opened or controlled.

The existing catalog at \`Video Editing System/licensed-assets/adobe-installed-mogrt/CATALOG.json\` remained SHA256 **13691f12a864e031ac3288507be7b265874e5bbb420f4c1f8aa1e91796fcf9e2** before/after. Its **77 unique** installed Adobe motion-graphics templates, plus 77 duplicate installed copies in the other Adobe directory, were already counted by the original discovery routine. This M05 run independently reopened and verified the original 77 file hashes and actual archive structure (77/77, zero failures). **60** are Premiere-authored \`ppro\`; **17** are After Effects-authored \`aefx\`; **74** declare at least one English-locale font; **60** contain embedded vendor MP4 previews; **17** declare effects. All native-host dependency tests remain *NOT RUN*. Installed After Effects executable was not found in the checked conventional 2026 location; this does **not** prove the templates cannot run in Premiere.

The new read-only scanner checks exact source SHA/capsule/authorApp, archive entries, ZIP traversal and decompression bounds, source formats, declared fonts/used effects/renderers, embedded preview presence, and required Premiere import/reopen/export and licensing proofs. The screener never extracts or executes an untrusted template. \`nolan_assets.py find\` still returns original source IDs; \`assess\` binds that exact ID to the preflight, not a second asset catalog.

## Genuine media proof and creative limitation

Extracted only the built-in \`Basic Lower Third.mogrt\` vendor \`thumb.mp4\` into a protected local research folder for inspection. Original source template SHA256 **d3b9949f2147e82ad409c9e20a6c95b471e23bdf6d6ef682bbcf7790a03d6b14**; embedded preview SHA256 **8be4772b87f7f21c4d3d0cdfd10c0db9ab76443bbac8b6c5520c86ce0016ca3b**. Actual **640×360 H.264/AAC, 118 frames, 4.921583 s**, fully decoded with FFmpeg; frames at .25, 1.8 and 3.7 s inspected. It is a static text/lower-third vendor example on black, **not** a dynamic CG client film, original transparent export, 1080p production proof or witnessed native editor import. The vendor preview was NOT included in any source ZIP or transferred externally.

An actual \`nolan_assets.py assess\` call on this same source returned \`HASH_AND_ARCHIVE_VERIFIED\` but \`HOLD_FOR_PRODUCTION_REVIEW\`: unknown project/licensing context; missing exact Myriad font rights evidence; no witnessed Premiere import/save/reopen/decoded export; no brand/whole-motion review. The intended default for production is to **hold**, not pick a generic installed template because it exists.

## Tests and negative controls

A first isolated run of 22 tests had **21 pass, 1 test-fixture error**: the missing-file test attempted to hash the fixture after deleting it. The test, not the operator, was repaired and the failure retained in \`M05-ASSET-GATE-TEST-RESULT.json\`. A 22/22 rerun passed. A later security review found a weakness in the first candidate: fabricated strings such as \`"evidence_sha256":"x"\` could make an internal evidence-complete status. This was corrected so entitlement, font, native-host, art and whole-motion evidence must bind to **real existing files and verified SHA256 bytes**. The 24-test R03 suite passed (**24/24**, no failures/errors). Synthetic fixture successes are never evidence of real licence or editor operation, and even a fully bound review is **internal-only**, never client publication approval.

Negative tests cover changed source hash, missing/malformed archive, missing actual graphic project, unsafe traversal members, extreme compression ratio, fake capsule/author identity, stale/altered evidence bytes, mismatched project-specific Envato licence, missing font evidence, missing native-proof receipt, and forged mere assertions. The original \`nolan_assets.py inventory\` and \`find\` routes still worked; first command-pipeline test failed because PowerShell closed Python stdout early through \`Select-Object -First\`. Rerunning without prematurely closing the pipe succeeded and preserved separate discovery outputs. No original asset was renamed or changed.

## Envato and licensing boundary

**No legitimate connected or authenticated Envato account/session was verified on this desktop.** A bounded inspection of the ordinary Downloads root and existing CG Video Editing System licensed-assets directory did not find a known Envato asset/license certificate; this is *not* an exhaustive search of every historical staff drive or proof the company has no subscription. No login, cookie copying, scraping, provider automation, asset bulk download, new purchase, trial, or AI-credit use took place.

Current primary-source guidance consulted:
- Envato Elements License, **revised 6 October 2026**: https://help.elements.envato.com/hc/en-us/articles/360000628966-Envato-Elements-License (one project-specific use per licence; active subscription for new project use; redistributing raw stock prohibited).
- Envato item licence certificate: https://help.elements.envato.com/hc/en-us/articles/360000621443-Envato-item-license-certificate
- Envato correct-use, source redistribution restrictions: https://help.elements.envato.com/hc/en-us/articles/360000621783-Correct-Usage-of-Envato-Elements-Items and https://help.elements.envato.com/hc/en-us/articles/360000621803-Prohibited-Usage-of-Envato-Items
- Adobe Premiere installed MOGRT workflow (7 January 2026): https://helpx.adobe.com/premiere/desktop/add-text-images/use-motion-graphics-templates/install-motion-graphics-templates.html
- Adobe MOGRT sourcing (18 August 2026): https://helpx.adobe.com/premiere/desktop/add-text-images/use-motion-graphics-templates/where-do-i-get-motion-graphics-templates.html

The scanner distinguishes locally installed **Adobe Content Files** from Envato Elements: no source may be relabelled as licensed by the other provider. Envato assets require the active account plus item/project-specific documented licence. Third-party templates can contain uncleared demonstration photos, music, fonts or plug-ins; their presence inside an archive cannot prove rights. No source/template should become a default client graphic without actual creative review and licensed brand-font source.

## Files, receipts and safe continuation

Runtime: \`C:\Users\info\Documents\Codex\2026-10-27\n\work\tools\nolan-browser-motion\`
- \`nolan_motion_asset_gate.py\` SHA256 **37f45f84e0a7ecb75fb94ba51f6713a91e556f5b9ddf775fd24d38f81610575d**
- \`test_nolan_motion_asset_gate.py\` SHA256 **ba8c27948db5299f7f21fe0a8ff9d20dccc898d0777dbb13e58aa03a7ceaac8d**
- \`nolan_assets.py\` SHA256 **bd145d1ea6beed76010a013f3067355ef09c2f3e43c96fe1be3c1941e137e769**
- Installed \`nolan-browser-motion/SKILL.md\` SHA256 **7165dad373f7969988c66a9dfd41e94f2b5ea537bf9b337214fdded0d7907fc0**
- \`overall-development-20261110/M05-MOTION-ASSET-INTAKE-20261111/\` contains the complete read-only screen, actual vendor-preview probe, saved .25/1.8/3.7-frame samples and exact production **HOLD** receipt.
- \`M05-ASSET-GATE-TEST-RESULT-R03.json\` is the final 24/24 test receipt. Earlier failed/fixed test reports remain retained.

**Milestone recommendation:** M05 has a verified **local Adobe intake substage**, but full Envato/account and native Premiere source-dependency qualification are **BLOCKED/UNVERIFIED**. Mark M05 blocked with this evidence; do not claim the account or native host passed. Continue the earliest safe next lane, M06 sound/perceptual audition, without changing the current client work. Resume M05 only when genuine authenticated account evidence/source licences and an unconflicted native-editor session are available. The nine TikTok source videos and Facebook glass reference remain unviewed and are not silently promoted here.

All work was source-only/local, with no client, Katana/MSI, permission or release mutation.
