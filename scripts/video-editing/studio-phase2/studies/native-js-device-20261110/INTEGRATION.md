# Reconciliation with Nolan BC

This branch is intentionally additive. Do not install it over an active Nolan BC runtime.

1. Read the latest canonical PR #910 and BC ownership state, then review this study on its separate draft branch.
2. Reuse BC's existing reference queue and director/scene plan. REFERENCE.json is an intake record to reconcile, not a second global catalogue.
3. The source exposes window.seek(seconds), window.NOLAN_READY and window.NOLAN_SCENE. It uses Canvas 2D rather than a new rendering service. Every state is reconstructed from the requested timestamp.
4. For capture, load the scene with the capture query flag, or add the capture CSS class to document.body before screenshots. The isolated proof harness does the latter. Do not capture the interactive Play/scrub controls into a client export. Preserve hashes of any generated capture-only wrapper.
5. Run the existing browser adapter's configuration and technical-study contract. The normal client story, quality, sound and release checks remain in force. This specific composition has not been rendered through the remote BC adapter yet; matching its seek interface is not target-device acceptance.
6. Use a bounded control render before adopting in a real client film. System font differences across operating systems may alter exact pixels. Use verified brand typography and actual client screenshots when changing this from a study to an advert.
7. Keep scene direction separate from the reusable mechanics. Do not turn this laptop, metallic text or orange/teal palette into a mandatory template for other clients.

## Scope of the clean worktree

The proof was authored and tested in a genuine isolated Git worktree inside this chat's execution environment, not in BC's live Windows checkout. That local proof repository is not a clone of the full CG-Dynamics history. Its provenance records the canonical GitHub base commit. The separate GitHub branch is based on the actual PR #910 head observed at task start. BC's runtime, installed skills, lockfiles, browser profile and running jobs were not modified.
