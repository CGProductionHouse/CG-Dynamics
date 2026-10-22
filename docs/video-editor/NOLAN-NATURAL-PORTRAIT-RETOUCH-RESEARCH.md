# Nolan — natural portrait / beauty retouch in Premiere
**Owner request:** 22 October 2026. **Research state:** NOT installed, NOT tested on the MSI, no purchase/credit usage/media upload. **Purpose:** replicate CG's frequent CapCut *subtle skin-enhancement* look inside the actual editable 4K Premiere timeline. This is a **creative skill and optional native/plugin effect**, not a reason to abandon Premiere or interrupt Nolan's Emoya session.

## Creative acceptance rule

**Natural touch-up only.** Reduce distracting temporary blemishes, harsh texture and unwanted shine if appropriate to the client's brief; preserve pores, eyelashes, real skin structure, complexion, expression, skin tone, and the person's identity. Don't silently use face/thin-body reshaping, eye enlargement, complexion lightening/whitening or “de-aging.” Whitening tools may exist in products but **leave them disabled by default**. Use only where portrait retouch suits the client/content and is appropriately approved. A documentary/interview/regulated-claim shot may not warrant cosmetic modification.

A treatment is successful when: in a **moving 4K full-resolution before/after**, people look well lit and naturally polished, not filtered; no “waxy” skin, face-edge halos, texture pumping, tracking slips, blotchy backgrounds or varying face colour across cuts. Check at phone size and actual 100% frame detail, skin tones/lighting including different complexions and **two faces in frame**. No universal default preset is to be applied to every subject.

## Ranked routes — read-only market research, 22 Oct 2026

| Tier | Product / verified source | Capability and costs | Honest limitation / choice |
| --- | --- | --- | --- |
| **P0 native, no extra purchase** | [Adobe Color & Contrast — Texture/Sharpness](https://helpx.adobe.com/premiere/desktop/correct-color/color-mode-fundamentals/default-adjust-operation.html), [Texture detail](https://helpx.adobe.com/premiere/desktop/correct-color/color-mode-fundamentals/grading-clips-using-adjust.html); [Lumetri HSL Secondary](https://helpx.adobe.com/ca/premiere/desktop/correct-color/add-color-effects/correct-color-using-hsl-secondary-controls.html) | Adobe documents negative Texture to soften blemishes and selective Sharpness to retain facial detail; HSL Secondary isolates skin colour with hue/saturation/luminance key and feather/denoise. Included with compatible installed Premiere, **no AI generation credits**. | **Not a truly automatic face-tracking beauty filter**. HSL skin keys may affect similarly coloured surroundings. The newer Color & Contrast panel's exact availability in Nolan's **Premiere 26.3.2** has **not** been verified—don't claim that host exposes it. Native masks/skin range need careful shot-level selection and final render QA. |
| **P1 premium specialist, optional trial only** | [Digital Anarchy Beauty Box Video 6.5](https://digitalanarchy.com/beauty-box-video/), [official installer/demo](https://digitalanarchy.com/downloads/premiere-pro-and-ae-beauty-box-video/), [Sept 2026 release](https://www.postmagazine.com/press-center/editing/2026/digital-anarchy-updates-beauty-box-skin-retouching-application/) | Premiere + AE Windows-compatible automatic skin-tone mask/analysis, shine reduction, adjustable smoothing, Nvidia CUDA/GPU; v6.5 adds AI eye/teeth controls. Release reports **US$199 new licence**, no per-clip generation credit, processing **locally**. Official full-function trial is **watermarked**. | Best-established match for CapCut's “subtle, automatic” intent, but **not free for clean client exports**. Additional AI whitening functions unnecessary. Brand/4K performance, exact Adobe 26.3.2 compatibility, plugin effect enumeration and hands-free analysis require a later **owner-approved safe offline duplicate test**. Installer requires Premiere/other Adobe apps to be CLOSED; do not install while Nolan edits. |
| **P1 lower-cost candidate, vet vendor** | [Higfx Easy Face](https://higfx.com/easyface/?lang=en) | Vendor lists Windows + NVIDIA, Premiere 2023+, 18 cosmetic controls including **blemish removal / skin smoothing**; **free watermarked trial**, **US$29.90 lifetime, one computer** for no watermark. | **Aug 2026 v26.8.1 is marked BETA**; advertises optional body/face reshaping. Vendor maturity, licence transfer, security/telemetry, true 4K quality, local vs cloud behaviour and MCP access **unverified**. Do not select because it is cheapest without assessing those factors. Limit future test to retouch (turn off reshaping/brightening). |
| **P2 alternative face tracking** | [Imagenomic Portraiture Video](https://www.imagenomic.com/Products/PortraitureVideo), [vendor pricing](https://www.imagenomic.com/Pricing?section=photo-video-plugins&videohost=premiere-pro) | Vendor describes AI face tracking, skin smoothing, shine removal/fill light and NVIDIA GPU acceleration in Premiere/AE, with free trial and one-time purchase. Vendor pricing has changed/promotions: single Premiere/AE video licence listed **US$199.95 discounted**, with higher standard or bundle pricing. | No CG test of result or MCP parameters. Another paid solution; compare only if Beauty Box or native approach fails. Confirm exact cart/bundle price at decision time. |
| **P3 existing licensed bundle only** | [Boris FX BCC+ Beauty Studio](https://borisfx.com/products/continuum-filters/beauty-studio-filter-in-continuum/), [Maxon Cosmo II](https://help.maxon.net/rg/en-us/Content/html/03-Cosmo-overview.html) | Professional selective skin smoothing and detail restoration. Boris includes Mocha tracking/PixelChooser; Cosmo controls protect face detail but requires a sampled skin tone. | Typically paid bundles, **no known CG licence**. Do not assume Photoshop/Creative Cloud subscription includes Maxon or Boris, or install a second massive suite for one effect. |

### Why the no-credit rule is different here

- Beauty Box, Imagenomic and Easy Face are **conventional local plugin effects/licences**, not hosted generative-video models; their pricing is an installation/licence decision rather than “use N Adobe/Higgsfield credits per shot.” Being locally processed must still be checked if client privacy requirements demand proof.
- **Free trials ≠ free production:** Beauty Box and Easy Face trial exports are watermarked, unsuitable for client delivery. Do not buy/activate licence without CA's separate consent.
- The owner’s separate [AI generation zero-credit rule](NOLAN-AI-VIDEO-ZERO-CREDIT-POLICY-2026-10-22.md) stays absolute: no AI generation/Firefly/Higgsfield credits, including included/free credits, without explicit owner authorisation. Natural local skin correction does not by itself require Firefly video generation.
- CapCut's built-in beauty tool already works for CG, but an extra CapCut→Premiere render **bakes the retouch** into picture media and adds roundtrip/export friction. Retain it as a fallback when needed; the desired master is adjustable in Premiere.

## Nolan integration: creative skill vs MCP capability

**Treat retouch as a contextual video-finishing skill, not a routine global effect.** Before applying anything Nolan should inspect subject scale, shot length, face visibility, compression/ISO, light and skin range. Default to **none** when no issue. When helpful, choose the lowest-intensity treatment that survives full-motion comparison.

**Implementation order (at a natural checkpoint, not during current Emoya session):**
1. **Existing host first:** enumerate Color & Contrast/Texture on actual Premiere 26.3.2, or Lumetri HSL Secondary and native selective correction already tested in #862. Try **one approved, duplicated portrait clip**, gentle isolated adjustment and zero new plugins. Can the existing MCP inspect/apply/read parameters? Does the rendered output keep natural detail? If native isn't sufficiently automatic, log why.
2. **Decide whether specialized plugin is worthwhile** based on *real savings over CapCut* and aesthetics. Beauty Box 6.5 is best-documented. Ask owner before any install/trial test; Premiere must be closed beforehand. A watermarked trial can be judged visually but is **not client deliverable**.
3. **For any installed effect, inspect accessible Premiere effect property names**, sample before/after and re-open project; ask whether “Analyze Frame” is a UI-only command. A third-party filter does **not** automatically expose its own face tracking/analyze button through MCP. It may need one bounded GUI operation; make that explicit rather than spending days writing a new bridge.
4. Keep original camera footage untouched, preserve effect settings in editable Premiere master, validate host-specific installation and future desktop/staff portability, and verify **performance on original-linked 4K**, not just a 1080 crop.

### Compact skill record to keep once proven

```text
Skill: natural-portrait-finish
Maturity: researched only (as of 22 Oct 2026)
Intent: reduce transient blemish and shine without looking retouched
Use when: consenting client portrait/beauty/hospitality/talking-head footage shows distracting texture
Avoid when: authentic documentary, no visible need, artificial smoothing/identity changes or poor mask tracking
Priority: native subtle texture control → native selective Lumetri → owner-approved plugin test
Recipe: record exact plugin/version/host, parameters, local face mask analysis steps and before/after
QA: two faces; multiple skin tones; moving expression; light changes; eye/teeth/eyebrow preservation; 4K and phone
Credits: no generative AI credits; plugin licences/purchases only after approval
Fallback: unmodified original or source-approved CapCut external bake with provenance
```

## Recommendation / not an instruction to Nolan right now

**Best immediate free hypothesis:** Verify Adobe's existing texture/colour controls on the installed release when not interrupting work. **Best specialist candidate if native is inadequate:** Beauty Box Video 6.5, **locally processed** and automatically isolating skin, but US$199 upfront; cost/quality need owner judgment. **Best low-price experiment later:** Higfx Easy Face watermarked trial after source/security inspection, but its beta status and identity-changing features warrant caution.

Research prepared on separate PR #865. **No installation, config changes, licence purchase, credits, footage processing, client-media read, merge, or messages to Nolan from this lane.**
