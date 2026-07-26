# AI Workforce — Music Copyright and Platform Rights System

Last updated: 2026-07-26
Status: Actual researched cross-platform rights pack; all production knowledge remains review-gated.
Territory: South Africa with platform-specific international licence terms.

## Purpose

Give CG staff and skilled agents a reliable way to answer practical questions such as:

- Can this song be used on Facebook, Instagram, TikTok, YouTube or LinkedIn?
- Does the answer change for a business account, creator account, organic post, ad, boosted post, Reel, Short or long-form video?
- Does an Envato licence cover this exact client project and platform?
- Why was a video muted or claimed even though CG licensed the music?
- What proof must be stored before publishing?

This system does not decide copyright ownership from a song title alone and does not provide legal advice.

## Core truth

A song being available inside a platform does not automatically mean it may be used for every commercial purpose.

The answer depends on:

1. platform;
2. account type;
3. organic versus paid use;
4. post format;
5. territory;
6. song source;
7. exact licence;
8. client/project registration;
9. duration and edit;
10. whether music is incidental or the primary value;
11. whether the platform later changes or loses rights.

“Copyright-free” is often inaccurate. Better states are:

- public domain;
- original and fully owned;
- platform-cleared for the specified use;
- licensed from a third party;
- Creative Commons under specified terms;
- permission obtained from rights holder;
- unknown or unresolved.

“Royalty-free” does not mean no copyright. It normally means the licence avoids recurring royalties within its permitted scope.

## Canonical music-rights record

Every externally sourced track used by CG should have:

- `track_title`;
- `artist_or_author`;
- `source_provider`;
- `source_item_url`;
- `source_item_id`;
- `licence_type`;
- `licence_version`;
- `licence_certificate_url_or_file`;
- `downloaded_at`;
- `subscription_active_at_download`;
- `registered_project_name`;
- `client_id`;
- `end_product_description`;
- `allowed_platforms`;
- `allowed_formats`;
- `organic_allowed`;
- `paid_ad_allowed`;
- `boosting_allowed`;
- `territories`;
- `duration_limit`;
- `attribution_required`;
- `content_id_expected`;
- `claim_clear_available`;
- `expiry_or_reverification_date`;
- `proof_status`;
- `reviewed_by`;
- `reviewed_at`;
- `notes_and_limitations`.

A licence should be linked to the exact client project or end product where the provider requires project registration.

## Decision workflow for the Assistant

When a user asks whether a song can be used, the agent must first resolve:

1. Exact song and source
2. Exact platform
3. Account type
4. Organic, boosted or paid ad
5. Format and duration
6. Client/project
7. Territory
8. Whether CG owns, licensed or merely found the audio
9. Available certificate or proof

Then return one of:

- `approved_for_exact_use`;
- `approved_with_conditions`;
- `platform_library_only`;
- `third_party_licence_review_required`;
- `not_approved`;
- `insufficient_information`.

The answer must cite the current platform and provider source, show the reviewed date and list the exact missing proof.

## Meta: Facebook and Instagram

### Official findings

Meta states that music in Instagram’s licensed music library is intended for personal, non-commercial use. Certain business accounts and post types therefore have restricted access. Availability can also vary by country or region.

Meta’s Sound Collection is positioned as royalty-free music and sound that can be used commercially, including in ads, subject to the applicable Meta terms.

Meta also warns that licensed audio can later be muted when its agreements with rights holders change.

Buying or downloading a song, recording it in the background at an event, or crediting the artist does not by itself grant the right to publish it.

### Safe operating rules

For client business content:

- Prefer Meta Sound Collection or a separately documented commercial licence.
- Do not assume a song shown in a personal or creator library is cleared for a client business.
- Treat boosting as commercial/paid use and verify the licence again.
- Preserve the original licence certificate for third-party music.
- Expect that platform-licensed music may later be muted because rights can change.
- Avoid exporting a Reel with Meta-licensed music and reposting it elsewhere; platform library rights are not automatically portable.

### Risk states

- `meta_sound_collection_commercial`: usually lowest platform risk for eligible Meta uses.
- `meta_licensed_library_personal`: not approved by default for client commercial use.
- `externally_licensed`: review exact platform, paid-media and territory permissions.
- `ambient_event_music`: still copyright risk even when captured incidentally.

## TikTok

### Official findings

TikTok recommends that content promoting a brand, product or service use music from its Commercial Music Library because it is pre-cleared for commercial use.

TikTok states that licences for music outside the Commercial Music Library do not cover commercial use in branded content. When using original audio or music outside the CML, the publisher must confirm that the post contains no protected music or that all necessary licences have been obtained and paid for.

TikTok Business Accounts do not generally receive the same general music library access because that library is intended for personal entertainment use.

### Safe operating rules

For any client-promotional TikTok:

- Prefer the Commercial Music Library.
- Record the exact sound ID and duration used.
- Enable the required content disclosure where applicable.
- Use non-CML music only where the exact external licence covers TikTok commercial use.
- Do not assume an Envato licence prevents automatic muting; preserve proof and test.
- Do not assume a sound that works organically is approved for Promote or Ads Manager.
- Do not use a personal-account music workaround to evade business restrictions.

### Duration truth

There is no verified universal rule that every organic TikTok over one minute must be muted.

Possible causes include:

- the chosen sound only being licensed for a shorter clip;
- embedded music not cleared for commercial use;
- the account or post being classified as commercial;
- a region-specific rights limitation;
- later rights changes;
- ad-format duration rules rather than organic-post rules.

The AI must inspect the exact mute notice, sound source, post type and duration before diagnosing.

## YouTube

### Official findings

YouTube’s Content ID can apply a policy chosen by the rights holder, including monetisation, regional blocking, worldwide blocking or muting. Rights-holder policies can change later, so a video’s status can change after publication.

A Content ID claim is not automatically a copyright strike. A takedown is different and can produce a strike.

YouTube recommends the Audio Library as a source of music intended for YouTube use. Creator Music availability and terms vary by territory, channel eligibility, track and format.

Creator Music licences are track-specific and may be restricted to one YouTube video, one channel, long-form content only and specified territories. They are not automatically transferable to Shorts, livestreams or other platforms.

Music that is safe in a Short under a particular rule may not be safe in a longer video.

### Safe operating rules

- Prefer YouTube Audio Library for straightforward YouTube use.
- Check attribution requirements for each Audio Library track.
- Do not assume Creator Music is available in South Africa or available for the account.
- Read exact Creator Music usage details before every use.
- Do not transfer a YouTube-specific licence to Meta, TikTok or LinkedIn.
- Upload an unlisted test where practical before client publication.
- Distinguish claim, block, mute and takedown.
- Keep the third-party licence certificate and project registration.

## LinkedIn

### Official findings

LinkedIn requires posted content to be lawful and not violate the rights of others. It provides copyright notice and counter-notice processes and may disable or terminate repeat infringers.

LinkedIn does not provide a broad, documented commercial music library equivalent to TikTok CML or Meta Sound Collection in the official sources reviewed for this pack.

### Safe operating rules

- Use original audio, commissioned music or a third-party licence that expressly covers LinkedIn/social-media commercial use.
- Do not assume music cleared on another platform is cleared for LinkedIn.
- Avoid mainstream music unless rights are independently documented.
- Preserve licence evidence before upload.
- Treat a counter-notice as a serious legal statement, not a routine button.

## Envato Elements

### Official findings

Envato permits licensed items to be used in social-media end products where the item forms part of a larger end product rather than being redistributed as the item itself.

For music in a video, the video’s value should come from the combined end product, not mainly from letting people listen to the music.

Envato issues item licence certificates that can support resolution of copyright or Content ID claims.

Some Envato music is registered with YouTube Content ID. A claim does not necessarily mean the licence is invalid; Envato provides claim-clear and dispute processes for eligible tracks.

Envato’s Claim Clear system can safelist a limited number of YouTube channels, but the claim-clear process does not necessarily apply to Shorts, Reels or every other platform.

A licence should be registered for the specific project/end product according to the current Envato licence workflow.

### Required CG workflow for Envato music

Before editing:

1. Create or select the exact client project in Envato.
2. Register the track to that project.
3. Download and store the licence certificate.
4. Store item URL, author, item ID and download date.
5. Confirm the intended platforms and paid-media use.

Before publishing:

1. Confirm the video is a larger end product, not a music-distribution substitute.
2. Check whether the track is Content ID registered or Claim Clear Ready.
3. Upload an unlisted YouTube test where relevant.
4. Keep the certificate accessible to the staff member publishing.
5. Do not assume one project registration covers unrelated client videos.

After a claim:

1. Capture the exact notice and claimant.
2. Confirm the track and licence match the published video.
3. Use Envato Claim Clear where eligible.
4. Otherwise dispute as licensed use with the certificate.
5. Do not escalate to a legal appeal casually; an unsuccessful appeal may carry strike risk.

## Platform portability matrix

| Music source | Meta organic | Meta ads/boost | TikTok client content | TikTok ads | YouTube long-form | YouTube Shorts | LinkedIn |
|---|---|---|---|---|---|---|---|
| Meta licensed library | personal/non-commercial context only by default | not assumed | no | no | no | no | no |
| Meta Sound Collection | verify exact Meta terms | generally intended for commercial Meta use | no | no | no | no | no |
| TikTok Commercial Music Library | no | no | intended for TikTok commercial use | verify ad terms | no | no | no |
| YouTube Audio Library | no automatic portability | no | no | no | intended for YouTube subject to track terms | verify track/use | no |
| YouTube Creator Music | no | no | no | no | exact track licence only | generally not transferable | no |
| Envato Elements | verify licence | verify paid-use terms | verify social/commercial scope | verify ad scope | licensed project plus claim workflow | verify format/claim limits | verify social scope |
| Original commissioned music | only if CG/client holds required rights | verify advertising rights | verify rights | verify advertising rights | verify rights | verify rights | verify rights |
| Mainstream song found in-app | never assume | never assume | never assume outside CML for brand use | never assume | may trigger Content ID | use only under YouTube’s applicable Shorts terms | never assume |

This matrix is a triage guide, not a substitute for the exact current licence.

## Publishing checklist

Before approving a video containing music:

- exact track identified;
- source identified;
- account type identified;
- organic/paid/boosted identified;
- platform and format identified;
- duration checked;
- client/project registration completed;
- certificate stored;
- commercial use confirmed;
- paid-ad use confirmed where needed;
- territory confirmed;
- attribution added where required;
- content disclosure enabled where required;
- platform portability not assumed;
- unlisted/test upload completed where practical;
- ambient copyrighted music assessed;
- incident owner assigned if muted or claimed.

## Music incident record

For every mute, claim, block or takedown, store:

- client_id;
- platform/account;
- post URL or ID;
- date/time;
- post format and duration;
- organic, boosted or paid;
- account type;
- track and artist;
- sound/item ID;
- source provider;
- licence certificate;
- exact notice text;
- claimant;
- enforcement type;
- territories affected;
- appeal/dispute path;
- evidence submitted;
- outcome;
- restoration date;
- repeat-infringer impact;
- prevention lesson.

## Candidate review-gated Skill Cards

### MCR-01 — In-platform availability is not universal commercial clearance

A song visible in a platform library may be limited by account type, post type, territory and commercial purpose.

### MCR-02 — Music rights do not automatically travel between platforms

A platform-specific licence is not portable unless its terms expressly allow it.

### MCR-03 — Royalty-free still has copyright and licence conditions

Store the exact licence and project registration.

### MCR-04 — Meta business content should prefer commercial-safe sources

Use Sound Collection or documented external rights rather than assuming the licensed music library covers business use.

### MCR-05 — TikTok brand content should prefer CML

Non-CML music requires independent rights confirmation and disclosure.

### MCR-06 — YouTube claim is not automatically a strike

Diagnose Content ID claim, block, mute and takedown separately.

### MCR-07 — Envato certificate is operational evidence

Register the exact project and retain the certificate before publishing.

### MCR-08 — A music licence can coexist with automated claims

A valid licence may still require claim clearance; do not assume the claim proves infringement.

### MCR-09 — Ambient event music can create copyright risk

Recording music at a venue does not itself grant publication rights.

### MCR-10 — Rights can change after publication

Platform or rights-holder agreements may later cause muting, blocking or changed monetisation.

## Agent routing

This knowledge should be available to:

- Social Media Strategist;
- Content Planner;
- Creative Director;
- Brand Guardian;
- Paid Ads Agent;
- Copywriting Agent when scripts specify music;
- CG Assistant quick voice-note workflow.

A quick voice-note answer should be concise but sourced:

```text
Use status: Approved with conditions
Platform: Instagram Reel on a business account
Source: Envato Elements
Conditions: Track registered to this client project, certificate stored, social commercial use confirmed, not boosted unless paid-media permission is confirmed.
Main risk: Meta may still generate an automated claim; keep the certificate ready.
Last verified: YYYY-MM-DD
```

## Non-negotiable boundaries

- No song approved from title alone.
- No “copyright-free” label without exact legal basis.
- No personal-library workaround for business use.
- No platform-specific music exported elsewhere without separate rights.
- No credit-to-artist treated as permission.
- No purchased/downloaded song treated as licensed commercial use automatically.
- No client project used to cover unrelated client work where the provider requires separate registration.
- No false dispute or counter-notice.
- No automated activation without human review.
- No legal advice; flag uncertainty and route high-risk disputes to qualified review.
