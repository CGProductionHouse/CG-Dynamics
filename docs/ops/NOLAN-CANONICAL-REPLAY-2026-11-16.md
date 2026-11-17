# Nolan canonical replay manifest — 16 November 2026

Scope: repository SQL at base commit `2d2fc2a66d01aeadac38489d0a4ccfdb9b1d72b9`; only the Nolan test/harness/docs change in this continuation. This is local PostgreSQL evidence, not a production schema inventory.

202 of 213 files fully applied. Every failed file may have applied statements before its first error unless its own transaction rolled back. No failure below is counted as successful replay. All files that own profiles/native command-centre schema and policies applied fully.

Runtime: Debian 13 x86_64, Node 24.19.0, Docker 28.4.0, PostgreSQL 17.12 from `postgres@sha256:a77aa70e641402a21411b92b721c58d10f23b50ae5fdd2333efd22d166e1e5f7`. Installed extensions: pgcrypto 1.3, plpgsql 1.0.

Platform scaffolding: PostgreSQL 17; synthetic auth.users/auth.uid/auth.role and API default grants; no GoTrue/storage/vault/cron/net. `auth.users` has synthetic id/email/invited_at/raw_user_meta_data columns. Identity is supplied through a test-session GUC, not a verified JWT. Actual repository signup triggers create the synthetic profiles. Default public-table/sequence grants explicitly emulate the Supabase API roles; the private decision table revokes them itself. No storage/vault/cron/net or Auth/API services are mocked.

## Replay gaps

### supabase/phase-22a-content-guide-publication-gate.sql

```text
ERROR:  operator does not exist: date = text
```

### supabase/phase-24b-ingestion-support.sql

```text
ERROR:  relation "storage.buckets" does not exist
```

### supabase/phase-24f-client-candidate-cards.sql

```text
ERROR:  insert or update on table "skill_cards" violates foreign key constraint "skill_cards_active_client_id_fkey"
DETAIL:  Key (active_client_id)=(079df21e-783a-4648-b3fa-0acae6e68867) is not present in table "clients".
```

### supabase/phase-28a-marketing-library-repo-source-registration.sql

```text
ERROR:  duplicate key value violates unique constraint "marketing_library_sources_title_year_edition_uidx"
DETAIL:  Key (lower(btrim(title)), COALESCE(publication_year, '-1'::integer), lower(btrim(COALESCE(edition, ''::text))))=(tiktok creative center, -1, ) already exists.
```

### supabase/migrations/20260907150843_content_review_foundation.sql

```text
ERROR:  relation "storage.buckets" does not exist
```

### supabase/migrations/20260909110000_client_contact_pilot_backfill.sql

```text
ERROR:  Expected exactly one Cape Lumber client, found 0
CONTEXT:  PL/pgSQL function inline_code_block line 10 at RAISE
```

### supabase/migrations/20260909120000_client_contact_piek_backfill.sql

```text
ERROR:  Expected exactly one Piek Group client, found 0
CONTEXT:  PL/pgSQL function inline_code_block line 7 at RAISE
```

### supabase/migrations/20260909130000_client_contact_wiseride_backfill.sql

```text
ERROR:  Expected exact WiseRide client 504113ee-fba9-4993-807e-a86066615212, found 0 matching rows
CONTEXT:  PL/pgSQL function inline_code_block line 10 at RAISE
```

### supabase/migrations/20260910100000_client_runtime_projection_backfill.sql

```text
ERROR:  Client runtime projection identity check failed: expected 52, matched 0 exact active UUID+name rows
CONTEXT:  PL/pgSQL function inline_code_block line 14 at RAISE
```

### supabase/migrations/20260910120000_client_contact_securiforce_backfill.sql

```text
ERROR:  Expected exactly one SecuriForce client, found 0
CONTEXT:  PL/pgSQL function inline_code_block line 9 at RAISE
```

### supabase/migrations/20260921143900_peyper_bonds_alissa_contact.sql

```text
ERROR:  insert or update on table "client_contacts" violates foreign key constraint "client_contacts_client_id_fkey"
DETAIL:  Key (client_id)=(a8dc70e6-fb42-4fbd-8a38-ce5f53fdee4b) is not present in table "clients".
```

## Actual profile/native-task policy catalogue

These expressions come from pg_policies after the complete replay attempt, before applying the draft decision SQL. The decision relation itself has RLS enabled and no direct API table grants; its checked RPCs remain separately tested.

### command_centre_tasks / command_centre_tasks: manager delete

Command: `DELETE`; roles: `public`.

```sql
USING: is_manager()
WITH CHECK: None
```

### command_centre_tasks / command_centre_tasks: manager insert admin

Command: `INSERT`; roles: `public`.

```sql
USING: None
WITH CHECK: (is_manager() AND (bucket = 'Admin / To Do'::text))
```

### command_centre_tasks / command_centre_tasks: manager select all

Command: `SELECT`; roles: `public`.

```sql
USING: is_manager()
WITH CHECK: None
```

### command_centre_tasks / command_centre_tasks: manager update

Command: `UPDATE`; roles: `public`.

```sql
USING: is_manager()
WITH CHECK: is_manager()
```

### command_centre_tasks / command_centre_tasks: staff insert operational

Command: `INSERT`; roles: `public`.

```sql
USING: None
WITH CHECK: (is_staff() AND (bucket IS DISTINCT FROM 'Admin / To Do'::text))
```

### command_centre_tasks / command_centre_tasks: staff select operational

Command: `SELECT`; roles: `public`.

```sql
USING: (is_staff() AND (bucket IS DISTINCT FROM 'Admin / To Do'::text))
WITH CHECK: None
```

### command_centre_tasks / command_centre_tasks: staff update operational

Command: `UPDATE`; roles: `public`.

```sql
USING: (is_staff() AND ((assigned_to_user_id IS NULL) OR (assigned_to_user_id = auth.uid())))
WITH CHECK: (is_staff() AND (bucket IS DISTINCT FROM 'Admin / To Do'::text) AND ((assigned_to_user_id IS NULL) OR (assigned_to_user_id = auth.uid())))
```

### profiles / profiles: admin reads all

Command: `SELECT`; roles: `public`.

```sql
USING: is_admin()
WITH CHECK: None
```

### profiles / profiles: admin updates all

Command: `UPDATE`; roles: `public`.

```sql
USING: is_admin()
WITH CHECK: None
```

### profiles / profiles: read own row

Command: `SELECT`; roles: `public`.

```sql
USING: (id = auth.uid())
WITH CHECK: None
```

## Exact ordered file manifest

Order includes foundation-before-addition sorting plus four documented dependency moves. SQL contents are unmodified; SHA256 binds this receipt to exact files.

| File | Result | SHA256 |
| --- | --- | --- |
| `supabase/schema.sql` | Applied | `7f7fd501f1e64065b58b2c16969223ab6eb72627a3b208a425145be1b0bed796` |
| `supabase/phase-3c-report-system.sql` | Applied | `9da314e5e3b4bfc752795a5ab4a0e8a5516769d7a4023db991bbf76bee0b90e6` |
| `supabase/phase-3d-admin-management.sql` | Applied | `a1209e8247e700ce06ef4b851e4052ea92f4d577ecaedf507fcffaa678794d17` |
| `supabase/phase-3e-master-reports.sql` | Applied | `a9ee405e61b467fcb4171ceab797675edbd9340ada7fe71216cd8a4b5d3bf5a1` |
| `supabase/phase-3f-user-emails-invites.sql` | Applied | `90c1663d95e38caa328fb00dc23923056f0d7384cb583a0d875a76f7bc9f8b7e` |
| `supabase/phase-3g-team-read-only.sql` | Applied | `9777ba2e24d8b78b1c172f5ce6498c651ef84296da11490145f99d542c14a3bf` |
| `supabase/phase-3h-manual-platform-metrics.sql` | Applied | `404ecd2b720b310461b6737a36743bad73603a546738d9a49b34e541fb1213c7` |
| `supabase/phase-3j-client-package-and-strategy.sql` | Applied | `0cbd5902bf4718a79a546fbc0425d2625b81313e3683e4e22261345eac258b86` |
| `supabase/phase-3k-strategy-options.sql` | Applied | `52d04b73f5b2a254f20a986026d45beae7d72997f32118a4dd631b1bb81c5fd0` |
| `supabase/phase-4a-meta-sync-foundation.sql` | Applied | `76a53295dfacd7c3d135d9141a5ab2ff59c054fe46e17242ab1fb1df08886a54` |
| `supabase/phase-4b-cg-assistant-audit.sql` | Applied | `721fe2fff71a63fda3198fae538e437dc3792670507521257f058ec7e17bba15` |
| `supabase/phase-4b-meta-oauth-security.sql` | Applied | `c261ac0737030ab1eac127a9f9b36431fa541d2a58818e8f2095633e29c25f9d` |
| `supabase/phase-5-cg-command-centre.sql` | Applied | `24d1743ddd582a1917e0dc6e49ae06e45fb1ac962e53000ebd87985fe7363a4b` |
| `supabase/phase-5a-tiktok-provider-foundation.sql` | Applied | `f357b159f6a702b08793008b87c053ef9041f9ba64f91bdaebe925f8a5e390f1` |
| `supabase/phase-6-cg-planner-core.sql` | Applied | `307fdf263afb47c7b7972226145c42438ac8966b3b37bbdcb4efa79846d7e089` |
| `supabase/phase-6b-cg-planner-seed.sql` | Applied | `8c81b7dac3ffa1a5982c7fc20b7e0c13d4fc0d8907ad349c5afb8657f5bb99d3` |
| `supabase/phase-6e-teams-planner-import.sql` | Applied | `58ad3da5a5a7d6a881fbe599350493784c06a97db930398efb72c98a3e390c6c` |
| `supabase/phase-6f-staff-production-status-rls.sql` | Applied | `b57fe26af72ee35c0b4d506ebd132293355fa304b48b70e69bde7717f04e8f5c` |
| `supabase/phase-7a-client-request-package-link.sql` | Applied | `747465155a5aa8ae00d906b764b8158c9261f1c91c3fbccb18031f89dd58bf1c` |
| `supabase/phase-7b-helper-names.sql` | Applied | `f3e8a0f275cfeee70d2be1e4f30bd55337a80b6f61f229245e073bc6b7275f45` |
| `supabase/phase-7c-dynamics-timer.sql` | Applied | `67e525524c98d8672cd4788c85a1ca8b140cb61196551107701648d0b04b0c98` |
| `supabase/phase-8a-client-brand-workflow.sql` | Applied | `63d9911a72255f5e4c47ff4b98365463621ef28aa00a8804bbd43e4c1fbaee65` |
| `supabase/phase-8b-client-content-links.sql` | Applied | `7920072a8eeb530df2177fb843a4785d3429a2db593e86191e2253a819ce1075` |
| `supabase/phase-9a-planner-task-archive.sql` | Applied | `a2be61d5fd0ad7b9c3f381df16129408804cb0dbbcb371e683fa767eb4a457c9` |
| `supabase/phase-10a-company-calendar-events.sql` | Applied | `08a386797934d598a822550e22f36d9ab6e2b0ddc6d3cf7078c32b5965893500` |
| `supabase/phase-10b-cg-calendar-teams-seed-2026.sql` | Applied | `a8e725c962e97ef134fbad441bd689abaecfac2d05e7fe411066366bdc8cb457` |
| `supabase/phase-11a-client-portal-read-access.sql` | Applied | `c66e6c00dfc430d7d02132a16321d1f7d6be7618801808de3a7464ace0f4944d` |
| `supabase/phase-11b-meta-instagram-not-applicable.sql` | Applied | `ec3969f5648387f51414509a7a4ddfe230e749694e865fc95561b48737afd6bd` |
| `supabase/phase-12a-meta-sync-queue.sql` | Applied | `ba2e1c6118a30ce0fbde0bf8b141d3fd5250aa7823f58883eb9b1308d31c9ed5` |
| `supabase/phase-13a-recurring-tasks.sql` | Applied | `01cbe78ba8146c1c4a715aac527ef27d32321ab271a60df86b75a9dfc1588f12` |
| `supabase/phase-14a-workforce-roles.sql` | Applied | `f7571a485a8e04acd612cb6ee6c5034654b59d9877f988353ffad92d7bbc7737` |
| `supabase/phase-14b-staff-role-alias.sql` | Applied | `765b0bc0d67eaa1850690c3ef721e872c6a0e1a911e74ffb191696403a382fa7` |
| `supabase/phase-15a-microsoft-source-tracking.sql` | Applied | `6af1c737b91954c0d94e2488778485e4cff4c9055a0c6527631b7b6e4d6fe5d2` |
| `supabase/phase-16a-operational-task-permissions.sql` | Applied | `f43a0b261dc1cceb6b9762ed5243514aee793465cac4fa69d8293926bf26d5a5` |
| `supabase/phase-16b-calendar-manager-permissions.sql` | Applied | `0f039d91465e69598833d017b5daac9beaaf356f4008633346848a2b6201f5db` |
| `supabase/phase-17a-microsoft-transition-sync.sql` | Applied | `85c782e3f3f53437340080ae25c2fb512b94dc490a6f8aab93491c9de1d11ffd` |
| `supabase/phase-18a-marketing-library-foundation.sql` | Applied | `3dd40a115a24b31c6523cbbf1e84ef0f7559716239f1d5a09f939b9dd5fdd625` |
| `supabase/phase-18b-platform-expert-foundation.sql` | Applied | `61a56e703c63474ae90395ec0d5b308565216dc16fec20fd7b2d1b49cbdb3cdd` |
| `supabase/phase-18c-skill-card-review-gate.sql` | Applied | `e1e50370212198cdacface5c9c6319658ece10911fa55283b4daf19880d98b13` |
| `supabase/phase-18d-initial-skill-card-batch.sql` | Applied | `190dc1179166a84872f039b4852f675c564bc46ca23344f5f83ea4f037260851` |
| `supabase/phase-18e-marketing-library-function-hardening.sql` | Applied | `40f5b30836337e0d670806cde1a747125322eeffd8dc58e67781de2cbebe2f31` |
| `supabase/phase-19a-secure-admin-invites.sql` | Applied | `df7c886a92120bfca637d9beb8ad8a65ff0c85302650e4af417a580b802817b4` |
| `supabase/phase-19b-microsoft-assignee-mappings.sql` | Applied | `2eb43d7020aa7e43f3e0ec0c53890a1569f098a9f402219d9cbf2c7232754297` |
| `supabase/phase-19c-microsoft-sync-apply-reliability.sql` | Applied | `fe6a1f72d4e31c5c7d1913030aeeba76d94ddc80b5221b94be6d1eec5c4639bf` |
| `supabase/phase-19d-content-workflow-mvp.sql` | Applied | `b4109ca222d63a05b4d8271ec84268963fc5a7a733f74c128cbf0e057dc6226e` |
| `supabase/phase-19e-video-production-pipeline.sql` | Applied | `3e599c89a190976b264bf8fce2a9ad079fd44181d11332f8a4d0467d924cc2a9` |
| `supabase/phase-19f-unify-content-runs.sql` | Applied | `460342ff0096c683e9e101410196595c79f716ad53436d69a9f92fcaf6537281` |
| `supabase/phase-20a-google-ads-reporting.sql` | Applied | `407d1995db7b242eec1d360c61f23f11983baa68986c86e13a081a3c043da927` |
| `supabase/phase-20b-google-ads-shared-accounts.sql` | Applied | `188a526ba96b2044397437591c31d89b552227c4d7ff9b36f721fd56a2ad7d15` |
| `supabase/phase-20c-google-ads-client-dashboard.sql` | Applied | `33edf0168aabbe1feadd205b2f2f565bf5d12701a53363a77888159883619156` |
| `supabase/phase-20d-meta-reporting-truth.sql` | Applied | `a595b02d4c74fbb2b4bf0b222019cf52dea64c89614249ef4dc4a881dcf618af` |
| `supabase/phase-5b-tiktok-metric-registry.sql` | Applied | `8f79d7ca4fb2de0742004ac5ee5f0eb2a159f52e1b43e848b4b21ff6cbbbb0fe` |
| `supabase/phase-20e-facts-client-access-and-curation.sql` | Applied | `b03598fa28ca847431c212c6cf11b81feb37a160eed2b5c97d982522932bd071` |
| `supabase/phase-20f-meta-v25-metric-contract.sql` | Applied | `c68dd8dcc439782da82b14499a3a7241e46b5993d23e5dd03cc96bf310c98243` |
| `supabase/phase-20g-meta-invalid-unique-viewer-repair.sql` | Applied | `413d294cf6a4bfa0db52663825bb4cdd6b6955f26cefcf311cc909a9be216a75` |
| `supabase/phase-21a-microsoft-link-existing.sql` | Applied | `3807ba81ab3c1d9263feca075f66d6a4912157dfc556218fdc2b23325b1355cb` |
| `supabase/phase-21b-microsoft-package-template-correction.sql` | Applied | `d610847874f6ab29a90466787f0acb981f564ad65efaf7d7f811231cd0dd2461` |
| `supabase/phase-22a-content-guide-publication-gate.sql` | FAILED; see above | `f909b0eaade3cd79106eb85973245b0c474f79140ae356cbeac79c7daaf1efad` |
| `supabase/phase-23a-ai-workforce-source-rights.sql` | Applied | `28f72cad0a97f685b4208e486a5ef18831baeaefaed6fa1a983de615f254ed3f` |
| `supabase/phase-24a-marketing-library-source-reconciliation.sql` | Applied | `49dfdb9136a92b58a8c4499efb05218f182e3ee40dd5dbd73d7485c63a2b43b9` |
| `supabase/phase-24b-ingestion-support.sql` | FAILED; see above | `66dfa6f1d0588b5ffaf65cc0c0a8b2172b4fa2e7c266d0c37b1aa53eb5e54b04` |
| `supabase/phase-24c-hopkins-card-reconciliation.sql` | Applied | `2581fda584b09956f26ba556fd1c99bb295bb000e2510fa52c83e1d4a40b64b5` |
| `supabase/phase-24d-client-industry-profiles.sql` | Applied | `32ccc994f744ef10f0c0b3d3983e5d7de5dfdabbd3379b1e6788cb26aa227e41` |
| `supabase/phase-24e-agriculture-library.sql` | Applied | `7fc224f239e4950fed0a3fbcedc234a2c7a87975540178fbc1d4bc02c2e3b651` |
| `supabase/phase-24f-client-candidate-cards.sql` | FAILED; see above | `3a694b9db06ea48215f1e61ece41539da43431ec3cbd7906aa5605b893290dbe` |
| `supabase/phase-25a-social-platform-completion.sql` | Applied | `58ade30f8b59bca9f7fc4511d373ead5cbfad68049c98889b8dd689d787c9a3d` |
| `supabase/phase-25b-social-official-sources.sql` | Applied | `e878e9a7475f2cbf94594c2b6d8990885a667bad4284c71b8d9cfa457546477c` |
| `supabase/phase-25c-social-surfaces.sql` | Applied | `e6513111c19ecdd64ac9f9738ca3fc7568d604c7fe9011f0871347f26ddf17f4` |
| `supabase/phase-25d-social-knowledge.sql` | Applied | `a65edb24cc2402118b6f5c06738b4d6d0e53bf6788f32cf539ba950d50d21ed2` |
| `supabase/phase-25e-historical-social-references.sql` | Applied | `435272af4fee701b1c6fc78ea887bf188636351d7cc315260a9930b458b9ae6b` |
| `supabase/phase-26a-skill-card-governance-fields.sql` | Applied | `af719796f2b79c77ac8608f4c7d1da8bc57b1672407680ff82910e70e3f14e0c` |
| `supabase/phase-26b-platform-rights-risk-knowledge.sql` | Applied | `1ad7680109ebfbf5b0ce87a169cfbb5cea7d26fe07f566ff655b72e58668b4b7` |
| `supabase/phase-27a-microsoft-plan-source-registry.sql` | Applied | `4e2191dd42b4d44865ed45dad24bdbbe7aabe1ce3edd43807d001ac0fa49e138` |
| `supabase/phase-28a-marketing-library-repo-source-registration.sql` | FAILED; see above | `a10858866cb7ef767846a3b443a22ac80d61b0aa1a4a3c82e45fe435a868e4d8` |
| `supabase/phase-28a-microsoft-durable-preview-jobs.sql` | Applied | `dd944c3d14de4d4b6dd9bacdb9732819ee66afaa29ef85d309ed5c1c1fd644fa` |
| `supabase/phase-29a-client-portal-calendar-release.sql` | Applied | `4cec657efa78a708feb9e9018bdb8fd9c831e419ee4759b8dc1856d6a945b1d7` |
| `supabase/phase-29a-content-batch-200-behavioural-economics.sql` | Applied | `2b270536cb4d7128b8b918807e4fdfa47e987e28ab1f32d98fef4c5bc10d9744` |
| `supabase/phase-29b-production-security-hardening.sql` | Applied | `9c3df06571fe1f735e4122a366134b99b646eb4ff9cdd69c806f0cc43732e9bc` |
| `supabase/phase-29c-meta-sync-worker-leases.sql` | Applied | `cf7dda067d0d565532b7faed203f1a274d996353e743d1309fe99c82ac2b9922` |
| `supabase/phase-security-admin-isolation.sql` | Applied | `2d911e05c647a78a89bd3c273447d406cb82d492530efee59e2e6a404451a0e0` |
| `supabase/migrations/20260725170354_package_classification_client_guard.sql` | Applied | `7f465419f2bd1ec83f253e79dc592ce5ec3eca37c6c3d4c85f5bcf40ba03f4ba` |
| `supabase/migrations/20260725172531_content_guideline_document_model.sql` | Applied | `7bc51e4e5f2af06703d3622c1af866b0c9c606698be60d2a7475a91cd22e1ff1` |
| `supabase/phase-5c-tiktok-client-mapping.sql` | Applied | `f0662fa1f31578f7a1a90cceb96117701a2f10f52258173f3077e7e11323f276` |
| `supabase/phase-19g-content-guideline-multi-month.sql` | Applied | `b441d2c75d1d2f6dd75831199192a8adce72b50a9a35b84082436a12f65b26f2` |
| `supabase/phase-30a-content-run-voice-debrief.sql` | Applied | `527241a1b6bf2b7cf6b0621b957357fbb25ede1e16d4db842c26e6d081ae6106` |
| `supabase/migrations/20260725211500_content_run_schedule_linkage.sql` | Applied | `51e4af23c63610d9b36d45bb3b1556347b80e2cd2e6ae9cb4401aa807defcbab` |
| `supabase/migrations/20260725224500_microsoft_sync_audit_actions.sql` | Applied | `fbe5e794def35107d01dfb9b79d7d553b169612204412b329e8679d792f9ec5a` |
| `supabase/migrations/20260725233500_microsoft_calendar_client_enrichment.sql` | Applied | `942ac9bed3bc42f975c20cc0e686c32d66bbe936d40371ea51ba1562daff7405` |
| `supabase/migrations/20260726075342_content_run_client_propagation.sql` | Applied | `e6643d1b74300e1314737592011909f7e9513ddc56541d4f2a76a9a58a5d848e` |
| `supabase/migrations/20260728123000_microsoft_apply_recovery.sql` | Applied | `aef52377df89041c283a0c6b51d94ec6e62bfdae5cab60d12aecd87a5ff6c9bf` |
| `supabase/migrations/20260728180000_planner_multi_assignment.sql` | Applied | `1239ba5e1b9ba6a9f3b00ea05fb19ae449d45bed02f3780f8af2d231a4ac7560` |
| `supabase/migrations/20260731090000_client_schedule_change_approval.sql` | Applied | `d5f5426c4e040fb286ca9b20db298e4d7aed68ea9753f405c5640971138d7135` |
| `supabase/migrations/20260731100000_assistant_notifications.sql` | Applied | `50128e8f83df7acd44e7c2bb5aedb91a0a1fbab4a4abd8642f18782903eb4e8b` |
| `supabase/migrations/20260801090000_durable_background_jobs.sql` | Applied | `1563f8d63590d0d2be4504f424f2d7d56fc5e0533d848bdaebb03fb6ef1eeb54` |
| `supabase/migrations/20260801120000_assistant_task_actions_and_memory.sql` | Applied | `94445ee3a2eed728178987717f4540bc4f55fe386ffa6d77d7e6ce266d19e201` |
| `supabase/migrations/20260801150000_assistant_meeting_debrief_content_and_reports.sql` | Applied | `7dd42753bbde3c54032fa0ce3c17543c80025a3f08c4b36b0c953a522d230125` |
| `supabase/migrations/20260801160000_assistant_hardening_notifications_and_rls.sql` | Applied | `779b6e9bfd7d54488e3261bf4a8dc62de7196d72fbcd8e89f240b1ed5bb71e87` |
| `supabase/migrations/20260801170000_backend_acceptance_hardening.sql` | Applied | `41f49d9cafa9d7d01c2f19191c8b2a3f3ca86010f481543f0bfa7ec8645cad66` |
| `supabase/migrations/20260801180000_client_schedule_acceptance_hardening.sql` | Applied | `50da4715155acef2deba38a5cbdd7f8db4de404396c8112f8e60ddfd6cfc2be1` |
| `supabase/migrations/20260801190000_client_report_safe_projection.sql` | Applied | `304494c1a03680fe63f5280aec8fe332a899ae0217bfb8a0a2128f86b7d2ace2` |
| `supabase/migrations/20260801200000_ai_usage_provider_health.sql` | Applied | `dd02de402d1f2c16a92dc16d3cc441ec1ef59810f9b5ed159219a9b386f9527a` |
| `supabase/migrations/20260802120000_ai_health_route_scoped_reservations.sql` | Applied | `46f3e09e71a9181ca584e3bec193387e83e1395a31ab38d0c71b24592e770105` |
| `supabase/migrations/20260802130000_marketing_ai_department.sql` | Applied | `cdb3c624e9b566196528fe80bf128ef4172a7d622dd05ff08ce7f073614f500b` |
| `supabase/migrations/20260803090000_skill_card_review_workflow.sql` | Applied | `d9272761303cdf7da44c0bbeee768327d4259d6bc8f3c4ec9f3befa638aeabc7` |
| `supabase/migrations/20260803140000_skill_card_routing_review.sql` | Applied | `ca785b700fd51fb07b4403a93fa88001f0aa7d16d65be4c1e182c7274abb91ff` |
| `supabase/migrations/20260803160000_strategy_research_historical_knowledge.sql` | Applied | `563ce51450e4bb8474712a74956f39c27be042a61a1b45eba1f7d2af03f952cd` |
| `supabase/migrations/20260803163045_personal_daily_assistant.sql` | Applied | `6d837298c9fa83b095b16cbe858ddb53b545536a155d92308816fb1a15e15cac` |
| `supabase/migrations/20260803194000_allow_daily_assistant_ai_replay.sql` | Applied | `c16ac3b8b07c2f161a3d4ae5f71b9300cc5160c01319c586d0f49a5c06acd389` |
| `supabase/migrations/20260804070651_iphone_web_push_notifications.sql` | Applied | `c435776dcbc8f42ed33cf1f62c2a9306f430bbd33d120add5884314838beed95` |
| `supabase/migrations/20260804081500_web_push_multi_device_counts.sql` | Applied | `2f73fb62818088ecefe2c41ffcb45208dc350a0d9ca9e7e80d0e8b84d5111be6` |
| `supabase/migrations/20260804130000_meta_sync_durable_recovery.sql` | Applied | `aaec94e139fb707d5de704eba0727851da4da3cc9d47f2cf3635b90d30943766` |
| `supabase/migrations/20260804140000_meta_sync_recovery_progress_watermark.sql` | Applied | `2d1315b5ab208f6d85cdd9c7d9baa156deed5b62e128accdb1f7e9716679e1d3` |
| `supabase/migrations/20260804150000_meta_sync_rate_limit_cooldown.sql` | Applied | `6a3008fc10a90bf38a89505f657b46f775c2eef602b6959efabce99b04593cc5` |
| `supabase/migrations/20260805090000_meta_sync_failed_item_retry.sql` | Applied | `55e3b49940ce3b04f7cd477021a29a3bc0f63ba7fd2efed737141a13d20a116a` |
| `supabase/migrations/20260805100000_canonical_staff_identity.sql` | Applied | `dbd8b0243bf4d3b3ef85374205f518d7b65ad8993222cc839bfe81df81b8db16` |
| `supabase/migrations/20260805110000_canonical_task_authority.sql` | Applied | `72064b9c09962a644f0c1751f20dd267eb59875ea0956cd981c934095aebcb24` |
| `supabase/migrations/20260805120000_canonical_ownership_notifications.sql` | Applied | `dd3e16a3d8bde6cabad10bc3f182b573370ed79ff7ad43ab497b44de2d1ea63b` |
| `supabase/migrations/20260805130000_client_aliases_directory.sql` | Applied | `ea3660fa8af35ef05978257f448e67e4c6e510ed79f8658d9e13f3a7d6d2c792` |
| `supabase/migrations/20260806090000_staff_invitation_lifecycle.sql` | Applied | `3ae5710bcf8b8890c0b2487d29c427378e59b4529898457156aa7527358afa39` |
| `supabase/migrations/20260806090001_assistant_linked_completed_authority.sql` | Applied | `bf500336e0acd4b63038573df8930709d517a98cd56623de83d3462713450f82` |
| `supabase/migrations/20260806091000_staff_invitation_acceptance.sql` | Applied | `8eeaca59e2d904e885eb16b3b78c6dbd17fb5cfc6fd1dbb57f1dbfcd2d957af2` |
| `supabase/migrations/20260806092000_staff_invitation_integrity.sql` | Applied | `5929df39aca015d09609d133433233f727ebcd83fc419f120e7098bcfe13d088` |
| `supabase/migrations/20260806093000_staff_identity_alias_rule_fidelity.sql` | Applied | `f09557d5ccabd170ee7d0bf67e334ddec896c7e39949769b797650f942f6e51c` |
| `supabase/migrations/20260809090000_planner_workload_completed_authority.sql` | Applied | `ee1836c62b1ecb9bec203e2fc121c35bb57f27f774da4379fef52245b8ffc28a` |
| `supabase/migrations/20260809120000_calendar_outlook_identity.sql` | Applied | `0e6bd53a00042c15d4cefb38c24357ade057d462644c9ab13716d9f7ab50083b` |
| `supabase/migrations/20260809130000_client_portal_visibility_contract.sql` | Applied | `ec0cfb34c2fb40ea82be0839cb8201acbe307bc151cf01f98c7ce0c6e07cf970` |
| `supabase/migrations/20260902100000_client_onboarding_foundation.sql` | Applied | `3544e60ecf0dce80de0cc15045de9def7b36e0f9d8bc8c5c2ec05294c96e346b` |
| `supabase/migrations/20260902110000_client_onboarding_upload_phase2.sql` | Applied | `ea2d6095682c826b943b698ada917996e51a9c94799c9a34c2ce145d1130b8ba` |
| `supabase/migrations/20260907114531_client_onboarding_upload_limit_50mb.sql` | Applied | `eecd29d2cbdd340433f9eb3f58373b9bd4070318a55f6851d3a5ea28551b5116` |
| `supabase/migrations/20260907150843_content_review_foundation.sql` | FAILED; see above | `713ca9e422943ee83016a324b7ad45f3593f75a329979cde3d3c19d256fbc85b` |
| `supabase/migrations/20260907163000_content_review_source_guards.sql` | Applied | `e41eacc67e619821d0a9f4696754a3313b821174e708ddea1966df5f3994f83a` |
| `supabase/migrations/20260908100000_client_guides.sql` | Applied | `bd65181e91c1ce1faf7e9ec0d5c6f63ace7e1ff569beb2f768a89aa6cfcf04c1` |
| `supabase/migrations/20260908100000_meta_native_metric_identity.sql` | Applied | `5bc9d1dba13bf8211c406add021c454f1ee4173c9bb91290f43f550decb82c35` |
| `supabase/migrations/20260908105000_marketing_library_source_identifier_unique.sql` | Applied | `fd4a991acb439d430d4e9ef395fd2a79fc8ff5fb93e4fc1eac3a562b16e5c161` |
| `supabase/migrations/20260908110000_client_intelligence_registration.sql` | Applied | `5f7e432d3cb7c692fb8dd639b56da98968e2d0d94a33e779a30f8847946d1f35` |
| `supabase/migrations/20260908110000_meta_sync_parallel_lane_safety.sql` | Applied | `085eb0798c9183ebfbb737151021d091c500873fda8ea16591f3a7e3bc2b165c` |
| `supabase/migrations/20260908120000_client_project_mappings.sql` | Applied | `738fa18e0877619c8b9512a3ff77e7802f04714e11621e5d3986b3f7fa8c9491` |
| `supabase/migrations/20260908120000_meta_sync_fencing_and_idempotency.sql` | Applied | `2ac29d2b33e773ff590d2c604d4630a12aa14f867d3353e054b618ace6590d51` |
| `supabase/migrations/20260908130000_client_onedrive_production_mapping.sql` | Applied | `68a9dfea8acf43af0a8546ca051ff28f58e891758e15108b689fd3fc790d5b3d` |
| `supabase/migrations/20260908130000_meta_token_lifecycle_diagnostics.sql` | Applied | `81ca7e70c9795a89dcca16de9a06c6ed02a0c6dd6fb41e5b6c5a258fd1bd94be` |
| `supabase/migrations/20260908140000_meta_incremental_asset_checkpoints.sql` | Applied | `d0033d86c0210cadf91c61197a07bfc614eea18ae0384daf87a7e46e80e34c7f` |
| `supabase/migrations/20260908150000_client_onedrive_production_mapping.sql` | Applied | `9aca414d84c37ffb3963a1198904c819e77e4cd95d8d62d4101913e4b993b11a` |
| `supabase/migrations/20260908181448_google_ads_v2_native_settings.sql` | Applied | `df4fb25e77e1693251f606d39b0734227c52a45ba783ed0461e81810dc5aca8f` |
| `supabase/migrations/20260908220000_staff_assistant_workspaces.sql` | Applied | `dd291286b7fd3fec84931cb977057a471d5a8417e1d583402ab5d497aaeac7ec` |
| `supabase/migrations/20260909090000_microsoft_oauth_tokens.sql` | Applied | `7b48424442cf13427be379c657c29ff0856fc71eb98ecbddb45cf8c8ab9ae4d9` |
| `supabase/migrations/20260909100000_client_contacts.sql` | Applied | `d200e64498424e1de6efc2f5fbef9f03629d2e495849bde7ff14d9fb9c115684` |
| `supabase/migrations/20260909110000_client_contact_pilot_backfill.sql` | FAILED; see above | `ccac2a9ab342d69967d5feabb5460f9e86f5d79cef783b690bc11649662bb427` |
| `supabase/migrations/20260909120000_client_contact_piek_backfill.sql` | FAILED; see above | `f582e0bc317db5e8d7956e0e003d2ab75dbea1553401f12c0df817695b1e8f11` |
| `supabase/migrations/20260909130000_client_contact_wiseride_backfill.sql` | FAILED; see above | `656746629e4205cb7949dfc8a8dc7f997628287cb30f80dd2ae20910ba4b8385` |
| `supabase/migrations/20260909133000_mcp_idempotency_log.sql` | Applied | `6a7f906a1101022fd46d6da1ef2eb1b2bfd167249fd508c9de497136e69df1b7` |
| `supabase/migrations/20260909140000_create_assistant_recurring_task.sql` | Applied | `327e602bee69d6cb74e0c73dcbcfaa702edfceb3f8b81ebaec7326777eef6aad` |
| `supabase/migrations/20260909150000_add_staff_email_collateral_fields.sql` | Applied | `7e888df6f7abcda8390194deb2c985774698553a7041a69e857289c13c9af3d5` |
| `supabase/migrations/20260909160000_content_run_closeout_tracking.sql` | Applied | `bc71cfd67677ca466cee6f0d9f0ca6271b9367817e8d1592aa3b10ab08ba54d2` |
| `supabase/migrations/20260909190000_mcp_dual_principal_audit.sql` | Applied | `5e911c357eb806124caca1fe683a136dffd2dc5eeeff3b2c084aff765e090f0d` |
| `supabase/migrations/20260910100000_client_runtime_projection_backfill.sql` | FAILED; see above | `38fc8bc28f1d3224ce5bac28721d22c907df5a483f323d30ceb36f6a7255aaa3` |
| `supabase/migrations/20260910120000_client_contact_securiforce_backfill.sql` | FAILED; see above | `8f81665d56b543327c67c9f33ca59bfac6a19b55b252e0e8686fe768bfb8f1c9` |
| `supabase/migrations/20260910120000_microsoft_sync_pagination_cursor.sql` | Applied | `9e4594cc7e25bc305c8b047f7412e5b9f2f0839695d62d7eb94cf7fc25c9ba56` |
| `supabase/migrations/20260911160000_client_workspace_actions.sql` | Applied | `2bd1b5c7e3579bf7b129bea1e4edb055bdc79a57528bd9a2561749e7b30094b1` |
| `supabase/migrations/20260911170000_mcp_staff_write_actor.sql` | Applied | `0bc17c5ef5f9144db3a745f444f70bed6f3641db6a233cee15c21dbfbfeeb59f` |
| `supabase/migrations/20260911171000_mcp_lead_update_actor.sql` | Applied | `30aad72bee9d7494d863ecc5c55acc84ce273bf65d94fea5dd60a3525497b66d` |
| `supabase/migrations/20260917173138_canonical_monthly_client_strategy.sql` | Applied | `51f37b22d558822493116a3f669dfdab0d2be6d08b0ad0cb303e7de413e2fac4` |
| `supabase/migrations/20260918101500_client_portal_access.sql` | Applied | `60e0aa7eb7555c2d4cac9009bca87f15a5517f40ee40c6940fa0142a4d434865` |
| `supabase/migrations/20260918113000_client_portal_library_foundation.sql` | Applied | `6031c1de5964b1d1f4a1bb5d0dc0df884ebf1b160e316deef87d9ba1e82c4747` |
| `supabase/migrations/20260918120000_cg_hours_client_registry_bridge.sql` | Applied | `033a8642f491a8c3c42ccce327ae809299e0b0e550cbcefcf13c41cdd511a8bf` |
| `supabase/migrations/20260918140000_website_report_snapshots.sql` | Applied | `458c898a5a6901f42f3c85a7e3082974bf24da756a34ac14901e809be915c9db` |
| `supabase/migrations/20260919100000_client_portal_remove_photography.sql` | Applied | `f130e19fd98fc895039f954752e00dd80f1eb39f6270c750975c45ee691a15f1` |
| `supabase/migrations/20260921090000_content_production_autopilot.sql` | Applied | `bae9c15d50b3d92ee46f6dcc7898af2a875200e792b0f38c9cf008f57ce4473c` |
| `supabase/migrations/20260921120000_daily_dynamics_service_reconciliation.sql` | Applied | `b127640144d204a39a3b7228658b8ac1df1c2155e5104c0aacc5f2192f2a26bc` |
| `supabase/migrations/20260921140000_content_autopilot_corrections.sql` | Applied | `288f670dc68209ef5df007ca1809e249378d3afd8ab47d18ae420b1ae46e9fb5` |
| `supabase/migrations/20260921143900_peyper_bonds_alissa_contact.sql` | FAILED; see above | `c6aa0b94dc6e85d85bf116cf3992a3c8e934f894ddf37971370c7c6724c994d9` |
| `supabase/migrations/20260922120000_system_worker_profile.sql` | Applied | `6b6e69ab7a7de21c9c2485d45fb6ebb41f963a79208b34d5fc16a6010cb169a1` |
| `supabase/migrations/20260922140000_instagram_login_fallback_foundation.sql` | Applied | `ef2ef01a8c44bc959e5c8903aab0849b9032859b62d2883a1581503e87aa8461` |
| `supabase/migrations/20260922142000_extend_background_jobs_allowed_type_for_autopilots.sql` | Applied | `bc730a2a632b9d4e8eb9b8af620da85eae68938dc5c765a647d0d7525ace5786` |
| `supabase/migrations/20260922144059_standalone_instagram_token_encryption.sql` | Applied | `ea50b78e5e2495f08dd8215aa0d8b8753d9b0ff03734f1704941f9c85ce3be3e` |
| `supabase/migrations/20260922153348_extend_background_jobs_for_tiktok_freshness.sql` | Applied | `b74bd62e0d2a9eae046c52a0c9eb4efb0c59c6cd9a706d19e6408d6d05cd0125` |
| `supabase/migrations/20260922154243_meta_post_engagement_truth.sql` | Applied | `edeeca3f860600601a3da1ad09f860c017cb80fa066db40b77f6933ea231fbfd` |
| `supabase/migrations/20260923110000_active_client_package_strategy_authority.sql` | Applied | `ffc411c92609a759685903fc2cc437237d1dbf331a05a920f0d565cbfc80394c` |
| `supabase/migrations/20260923120000_instagram_connection_review_binding.sql` | Applied | `9ff061dc68d71d5d5ba2ca96e3926a774d54ec73ca4a2932156d433521909e8d` |
| `supabase/migrations/20260923122616_preserve_unknown_package_confirmation.sql` | Applied | `c60994197735fe94d59120baf7b1a29089ab438fb1e694fcf8fc0b8a298e5148` |
| `supabase/migrations/20260923143000_tiktok_exact_account_identity.sql` | Applied | `4873daf0c204f7e5e609673b90907c916d7ee8bea6eabcc8e15abe6f2872c2f3` |
| `supabase/migrations/20260923160000_website_snapshot_period_contract.sql` | Applied | `7b8962243dc94f06a0214e0be9d6c8b92ecd7b52c21a6c3a807d9f3829e08b2b` |
| `supabase/migrations/20260923193000_monthly_strategy_context_amend.sql` | Applied | `5639d48a8d245120c115335efa6e6b45ed7b73e43a135cb918caed2838831722` |
| `supabase/migrations/20260927143000_client_portal_provision_job.sql` | Applied | `866db715fa9fbbaa9293e6e09ca28242d7cd7c73fd3e04d845f4e6a040a9fa79` |
| `supabase/migrations/20261001131621_instagram_provider_callbacks.sql` | Applied | `dbe9c9517ecfce9bb5a9ffe74bcacc6dc7fa13d300d49f0b8cdc2e878d9a1374` |
| `supabase/migrations/20261001181932_website_enquiry_transaction.sql` | Applied | `ab1edae6f6c6bc9c79a36d6014e6dc99a2ad92ebeced028c19ca3f598fb92d72` |
| `supabase/migrations/20261002085355_website_enquiry_intake_guard.sql` | Applied | `f9626d81b21afd149d12896a7d8f456cb0eedfa1e77ed44066717b31f215cbc3` |
| `supabase/migrations/20261002090000_website_lead_lifecycle.sql` | Applied | `04355828ac849940ce87aac2ead677fa2229a2968bd033926584c7be0aa2cf16` |
| `supabase/migrations/20261002110000_website_enquiry_delivery_runtime.sql` | Applied | `eb0ebafb232d0ebb9029f34d8082631d283ffe39bb1e87c403bfd998c51a07fa` |
| `supabase/migrations/20261002124434_client_service_entitlements.sql` | Applied | `0e852cf98fdb71ee1b312b66ff134c848133153502675775712358f684fb9ccf` |
| `supabase/migrations/20261002140000_website_enquiry_delivery_suppression.sql` | Applied | `a4678fa8c868e5939b59d918615fc5c39ab58dfa9c1338d572bb987be26f63c3` |
| `supabase/migrations/20261002140843_client_entitlement_resolution_queue.sql` | Applied | `3a69b15081aba99d44d544057a4e9f3f07e5ad7c70c92c1f84f726e87c0bbb09` |
| `supabase/migrations/20261002160000_website_enquiry_delivery_ses_events.sql` | Applied | `acf9d5783c2b00b27c69e76d99a1aad9b5cb223dd5c15ed6bbb65f7b64cc09a4` |
| `supabase/migrations/20261003010000_website_lead_breakdown.sql` | Applied | `b7b4a8013ab22e7072f0cc2b193d816fd6aa857b6e1cc79932ab9e98b459ac1f` |
| `supabase/migrations/20261003085222_client_registry_identity_history_guard.sql` | Applied | `310f4b44a47f124ca0e3ae61b3440c13324210df901a7ae3bc1c95252f6f11da` |
| `supabase/migrations/20261007100000_client_portal_post_assets.sql` | Applied | `e05f0b1d25352e0dd4b5b68433242c362fd7169da2a04a2176c51ea65e709580` |
| `supabase/migrations/20261007102349_skill_card_review_revision_binding.sql` | Applied | `d22eeb8c031bff7a322d46ae38bf48b2aa733a55aa6f80b7a9be9f4cfdd0c057` |
| `supabase/migrations/20261011100300_guard_monthly_strategy_generation.sql` | Applied | `9cc7e3ae334357a874b35a137c75e1ffd1cb6cdf088bd007fa61129a20eebec6` |
| `supabase/migrations/20261011100320_review_client_context_updates.sql` | Applied | `741edb7e65bc8fa51c7984450fe8df82f1f1597d620756efc205fb5d74fe253b` |
| `supabase/migrations/20261013225255_client_strategy_gold_projection.sql` | Applied | `cb554ed021540834869237915062b956223ba49da2c4e6a70f57d0b249884d3b` |
| `supabase/migrations/20261016075631_google_ads_daily_refresh.sql` | Applied | `5ee1df671a0501ad3ff04f649ddd62d41e572f4a6ac947d772b56fe9cfeae876` |
| `supabase/migrations/20261018155046_planner_native_lifecycle_guards.sql` | Applied | `0d47abaf68a2b1230fe55fa8fcbbd8e94cfc27e64e4a46e1446125e7e4cd20b6` |
| `supabase/migrations/20261018164542_mcp_operational_atomic_receipts.sql` | Applied | `cb0c603d4612a9ab697d831255c44ea8744c33e6e9fd3d7a86359863ae829024` |
| `supabase/migrations/20261019082434_mcp_schedule_source_readonly_page.sql` | Applied | `f4be65ccf0927302a48a7d239eafdd734e582e57abf82c4fab2a2aee8fccea2f` |
| `supabase/migrations/20261025091300_planner_guarded_staff_edits.sql` | Applied | `6654ea115df913c2498852e2ecca723355fe0f9c01be6eef09c768d08c71f534` |
| `supabase/migrations/20261025135859_calendar_creation_attempt_identity.sql` | Applied | `98159e550abf1be40a1173326dacedff1e4283fa7dfc3c4a84fd20ede775bacc` |
| `supabase/migrations/20261102113000_client_report_public_post_images.sql` | Applied | `dd9426346c067fef78f2ce3b20d1facb18df2609d8107d4c5881549dd49305d9` |
| `supabase/migrations/20261102120810_client_plan_date_sharing.sql` | Applied | `a251da9163bd2d3beb57811c46725334b706ebddc450b4aa78f00b061859cf03` |
| `supabase/migrations/20261103051651_client_calendar_repost_label.sql` | Applied | `091a3fd72febab97593f4b6a193a9a6e750d19e25074793635385d7313cab3e9` |
| `supabase/migrations/20261103102248_client_plan_source_date_following.sql` | Applied | `79e24411992f31eadb7449fce588ff68603002444a6a1418ea967d12f26fe6d0` |
| `supabase/migrations/20261103145536_quarantine_legacy_tiktok_client_mismatch.sql` | Applied | `38b9d99051a0bab18e9794e8f76803008b8b1741d64b9df1fbfee69e3def60d6` |
| `supabase/migrations/20261109093718_public_content_guideline_shares.sql` | Applied | `ec1d83bb0f08ff48d62e70d416337f6b2dfa6f7cf1157402fe65521e88f99e2a` |
| `supabase/migrations/20261109112347_guideline_video_client_review.sql` | Applied | `25fd6b452db28be1ae91b1ff60df64948e2c71aa5f7de17c274ee190b922af0c` |
| `supabase/migrations/20261109115055_guideline_inspiration_links.sql` | Applied | `58fe6053aa33d0dab356bc84f28f71c7dc8e9808a53a08812448c3486cce7d13` |
