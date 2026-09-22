# Instagram fleet audit — Issue #471

**Audit date:** 22 September 2026

**Scope:** the 17 active clients named in Issue #471 with no current `meta_client_assets.instagram_account_id` mapping.

**Phase:** evidence + isolated code foundation only. No provider consent, production token, mapping, migration, configuration or reporting write was performed.

## Decision rule

An Instagram handle is recorded as official only when it is linked from a current first-party client website or already exists in reviewed client intelligence with direct client/site evidence. Search-name similarity, directories and old embeds are not enough.

A public profile does **not** prove that an account is professional, that CG has access, or that it is linked to a Facebook Page. Meta's provider response is authoritative for those facts. Therefore no client below is classified as Page-linkable or standalone-ready until a staff-controlled provider check proves the exact account identity and account type.

## Client matrix

| Client | Exact official Instagram evidence | Truthful classification now | Correct connection route / CA action |
|---|---|---|---|
| Bohemia Quick Stop | No exact Instagram account verified. Existing reviewed intelligence confirms only the CA-supplied Facebook identity and says the page was not publicly retrievable. The repo calls the business **Bohemia Quick Shop**, while Issue #471 says **Quick Stop**; preserve the Dynamics identity until CA resolves the display-name difference. | Access/ownership unknown or blocked | In the existing Meta Integrations page, load assets and inspect the exact confirmed Facebook Page. If Meta returns its linked professional IG, use the existing Page route. Otherwise CA/client must provide the exact official handle and owner-controlled login before considering Instagram Login. |
| Bouwer & Coetzee Attorneys | `@bouwer_coetzee_attorneys`, recorded from the current Instagram profile and CG-built site screenshots in the reviewed 6 Aug client-intelligence update. | Access/ownership unknown or blocked | Try exact Page-linked discovery first. If the owner confirms it is Business/Creator but Meta returns no Page relationship, use the standalone fallback and verify `/me` returns this exact username. |
| Central Canvas | No Instagram account verified. The current official site links Facebook only; reviewed intelligence explicitly leaves current social handles unresolved. | Access/ownership unknown or blocked | Confirm the official handle with the client. Use the existing Page route if the exact Page exposes a linked IG; otherwise standalone is eligible only after Business/Creator proof. |
| Daisy & Co | No Instagram account verified. Reviewed intelligence warns about same-name businesses and explicitly leaves official Facebook/Instagram handles unresolved. | Access/ownership unknown or blocked | Client must confirm the exact handle and ownership. Do not map any search result. Then prefer Page-linked discovery; standalone only for a provider-verified professional account. |
| Ehrlich Park Butchery | No Instagram account is linked from the current official website and no exact handle is verified in reviewed intelligence. | Access/ownership unknown or blocked | Ask the client to confirm whether an account exists. If none exists, staff may explicitly mark Instagram not applicable; otherwise follow Page-first, standalone-second verification. |
| Emmanuel Funerals | `@emmanuelfunerals`, linked directly by the current official website. | Access/ownership unknown or blocked | Load the exact Facebook Page assets first. If the Page route does not return this account, CA may run standalone Instagram Login with the account owner; accept only an exact `/me` username match and Business/Creator type. |
| First Technology Central | No exact **Central branch** Instagram account verified. The official group site and reviewed local intelligence confirm the branch identity but expose no branch Instagram link. | Access/ownership unknown or blocked | Do not substitute a national/group social account for the Central client. Confirm the branch's exact account and authority, then use Page-first or verified standalone as applicable. |
| HMHI | No exact official Instagram account verified. Public evidence resolves the client name to Hill, McHardy & Herbst, but does not prove a current Instagram identity. | Access/ownership unknown or blocked | CA/client must confirm the exact handle and whether the Dynamics name `HMHI` intentionally represents Hill, McHardy & Herbst. Then use Page-first or provider-verified standalone. |
| Novus Steel | `@novus_steel`, linked directly by the current official website. | Access/ownership unknown or blocked | Try Page-linked discovery first. If absent and the owner proves Business/Creator access, use standalone Instagram Login and require the exact username. |
| Piek Group | `@piekgroup`, linked directly by the current official `.co.za` website on 22 Sep. This is newer first-party evidence than the earlier reviewed note that the profile was unverified; the unrelated `piekgroup.com` remains rejected. | Access/ownership unknown or blocked | Try the exact Piek Facebook/Page route first. If not linked, use standalone only after exact Business/Creator identity and owner consent are proven. Do not map `@gettogethercoffee` to the Piek Group client. |
| PSG Bloemfontein | The official branch page links the national `@psgfinancialservices` account, not a branch-specific account. That corporate account is not safe to map to this client without explicit PSG/CA confirmation. | Access/ownership unknown or blocked | Confirm whether reporting is intended for the national account or an exact Bloemfontein-owned account. No mapping until that client boundary is explicit. |
| Red Oak | `@official.redoak`, linked directly by the current official website. Exact Facebook Page `117937152934535` / `RedOak LHP` remains provider-access blocked per Issue #471. | Access/ownership unknown or blocked | CA may first restore exact Page access/re-consent. If that cannot or should not be done and the owner controls this Business/Creator account, standalone Instagram Login is the bounded fallback. Do not treat standalone IG consent as recovery of the Facebook Page. |
| Supa Quick BFN | The official Supa Quick directory verifies the Bloemfontein CBD franchise, but no exact branch Instagram account was verified. | Access/ownership unknown or blocked | Confirm which Bloemfontein franchise the Dynamics client represents and the exact branch account. Do not map national Supa Quick or another franchise. Then use Page-first or verified standalone. |
| Supa Quick Centurion | The official Supa Quick directory verifies Centurion-area stores, but no exact Dynamics-client branch Instagram account was verified. | Access/ownership unknown or blocked | CA must identify the exact store (for example Centurion Lifestyle versus another Centurion franchise) and exact account before any OAuth/mapping. |
| The Staffordshire | Historical/current directory evidence references `@thestaffordshirepub`, but no current first-party site-to-profile link was available, so the handle is not promoted to verified truth. | Access/ownership unknown or blocked | Client/CA must confirm the handle and ownership. Try exact Page-linked discovery first; use standalone only after Meta proves Business/Creator identity. |
| Tobich Optics | No Instagram link appears on the current official website; no exact official handle was verified. | Access/ownership unknown or blocked | Confirm whether reporting covers the Windhoek group or a specific practice/location, then obtain the exact owner-confirmed handle. Use Page-first or verified standalone. |
| We Ar Fuels | `@we_ar_fuels`, linked directly by the current official website. | Access/ownership unknown or blocked | Try Page-linked discovery first. If absent and the owner proves Business/Creator access, use standalone Instagram Login and require the exact `/me` username. |

## Counts

- 6 exact official handles verified: Bouwer & Coetzee, Emmanuel, Novus Steel, Piek Group, Red Oak, We Ar Fuels.
- 1 corporate handle found but deliberately **not** assigned to the branch client: PSG Bloemfontein.
- 1 historical handle found but deliberately left unverified: The Staffordshire.
- 9 clients have no exact official Instagram handle verified from approved evidence.
- 17 of 17 remain `access/ownership unknown or blocked` for connection purposes. Public evidence cannot truthfully establish professional type, owner access or Page linkage.
- 0 were marked “no Instagram account”; absence cannot be inferred from a failed search.
- 0 were marked personal/non-professional; that requires owner/provider evidence.
- 0 were marked ready for production mapping.

## Official Meta contract used

Meta's current documentation states that Instagram API with Instagram Login:

- serves Instagram professional Business and Creator accounts;
- does not require a linked Facebook Page;
- uses `instagram_business_basic` and `instagram_business_manage_insights` for account/media insights;
- authorizes at `https://www.instagram.com/oauth/authorize`;
- exchanges the code at `https://api.instagram.com/oauth/access_token` and long-lived tokens at `https://graph.instagram.com/access_token`;
- exposes exact `user_id`, `username` and `account_type` through `/me`;
- requires Advanced Access when serving professional accounts the app does not own/manage;
- returns missing insight data as an empty dataset rather than zero.

Sources:

- [Instagram API with Instagram Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login)
- [Business Login for Instagram](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login)
- [Get started with Instagram Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/get-started)
- [Instagram Platform insights](https://developers.facebook.com/documentation/instagram-platform/insights)

## Phase-1 implementation boundary

The prepared fallback:

1. accepts an exact active Dynamics `client_id` from an authenticated admin/manager;
2. refuses to start when the client already has a canonical active Instagram mapping;
3. binds a hashed, one-time OAuth state to that exact client and staff actor;
4. requests only the two reporting permissions above;
5. verifies one exact Business/Creator `/me` identity and cross-checks its app-scoped user ID against the token response;
6. persists metadata and its server-only token atomically as `pending_review`;
7. prevents one Instagram account identity from being assigned to two clients;
8. deliberately does **not** write `meta_client_assets`, run sync, create reports/facts/checkpoints, or publish anything.

The existing `meta_client_assets` row remains the only canonical reporting mapping. A later CA-approved activation must explicitly review the pending identity, bind it to that existing authority, and teach the existing Meta connector to select the standalone token for Instagram only. That activation belongs with the shared Meta worker owner; it is intentionally not implemented in #471 Phase 1.

## CA actions before any live use

1. Resolve the 11 unresolved/unsafe identity cases directly with clients, including the Bohemia name difference, HMHI legal identity, exact Supa Quick stores, PSG national-versus-branch scope and Tobich location scope.
2. For each exact account, use the existing Meta asset discovery first. Record whether Meta returns it as the mapped Page's Instagram business account.
3. For a proven professional account that is absent from the Page route, decide whether CA wants standalone Instagram Login and obtain the account owner's consent at action time.
4. Before deployment, create/configure the Instagram product in the Meta App Dashboard, exact redirect URI, Instagram App ID/secret, explicit Graph version, required access level/app review and token lifecycle. None of this was performed here.
5. Review/apply the prepared migration and deploy the two Edge Functions only through a separately approved production gate.
6. Have the shared Meta worker owner implement/review the narrow canonical mapping/token-selection activation and token refresh before any pending connection can report.

## Evidence notes

First-party websites inspected on 22 Sep 2026 include Emmanuel Funeral Services, Novus Steel, Piek Group `.co.za`, Red Oak, We Ar Fuels, Central Canvas, Ehrlich Park Butchery, First Technology, Tobich Optics, PSG Bloemfontein and Supa Quick directories. Existing reviewed client intelligence was checked first for Bohemia, Bouwer & Coetzee, Central Canvas, Daisy & Co, Ehrlich Park Butchery, Emmanuel, First Technology and Piek Group. Search results and directories were used only to find or reject candidates, never as automatic mapping authority.
