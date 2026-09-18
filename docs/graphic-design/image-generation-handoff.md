# Internal Image Generation Handoff

Last tested: 2026-09-09

## Why this matters

The strongest creative route for CG social posters is ChatGPT's internal image generator, but the current normal-chat image-generation path has an attachment boundary that matters for OneDrive automation.

## Verified current behaviour

During the Piek/Engen pilot, ChatGPT could:

- browse the Piek Group OneDrive folder;
- fetch the exact source JPEGs and Piek logo;
- inspect/use those files through connector/container-backed tools;
- build a local reference board containing the exact files.

However, the internal image generator did **not** recognise the connector-fetched OneDrive files or the locally generated reference board as an eligible image-edit target in that chat session. It required a usable image target explicitly available to the image-generation surface.

This is a plumbing/attachment limitation, not a conclusion that the generator cannot produce the desired design quality.

## Immediate browser-chat production workaround

For high-design generation today:

1. ChatGPT/Dynamics selects the exact source images and logo from OneDrive.
2. The selected source files are surfaced to the user/staff as the creative input pack.
3. User/staff attaches the selected photo(s) and exact logo directly to the normal ChatGPT conversation.
4. Internal image generation creates the high-design composition from those attached references.
5. For real people, use Adobe/Photoshop-style non-generative correction/cutout/compositing to preserve the exact person wherever possible.
6. Apply/verify exact logo and typography as locked production layers before approval.
7. Record all selected source IDs and final output names back to the usage ledger.

This keeps routine production in normal browser chat; Work mode is not required.

## Desired future connector behaviour

The long-term Dynamics/ChatGPT integration should expose selected client media to the image-generation surface as actual conversation attachments or another officially supported image-reference primitive, rather than merely returning file metadata/connector URLs.

The ideal flow is:

`Dynamics schedule + usage ledger -> OneDrive selector -> attach exact selected files to chat/image generation -> generate -> exact-asset finishing -> Canva -> approval -> schedule/post -> ledger update`

## Important safety/quality distinction

The internal image generator is generative. Even with a reference, it reconstructs pixels. It can preserve likeness closely, but CG should not treat that as a pixel-lock guarantee for real people or logos.

Therefore:

- real human photography should remain an exact photographic layer whenever identity preservation matters;
- exact logos should remain imported exact assets, never model-drawn substitutes;
- internal generation is best used for art direction, backgrounds, effects, graphic devices, compositional ideas and non-identity-critical elements;
- Adobe/Photoshop-style tools are the preferred precision path for real-photo colour correction, crop, cutout and compositing.

## Pilot consequence

Do not fall back to flat Python/document-style poster design merely because the image generator cannot yet ingest OneDrive connector files directly. The correct response is to solve the attachment handoff while preserving the high-design route.
