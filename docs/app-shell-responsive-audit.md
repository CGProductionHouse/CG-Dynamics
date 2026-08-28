# App-shell responsive + IA audit (#181 / #182)

Status: in progress. Foundation + IA in PR #193; this rollout continues it.

## Shared system (source of truth)

- Tokens: `src/lib/layout.ts` — `PAGE_GUTTER` (`px-4 sm:px-6 lg:px-8`), `PAGE_MAX_WIDTH`
  (`wide`=7xl, `content`=6xl, `medium`=5xl, `narrow`=3xl, `full`), `PAGE_TOP`,
  `SECTION_GAP`, `CARD_PADDING/GAP`, `PAGE_HEADING/EYEBROW/DESCRIPTION`,
  `CONTROL_MIN_H`, `TOOLBAR_ROW`, `SCROLL_ROW`, `pageContainerClass()`.
- Primitives: `src/components/layout/PageShell.tsx` — `PageContainer`,
  `PageHeader`, `Section`, `Toolbar`.
- The `AdminLayout <main>` owns the bottom-nav / Assistant / safe-area offset;
  page containers never re-add bottom insets. The client portal shell
  (`ClientPortalShell`) already applies the standard gutter to `<main>`, so
  client pages must not add their own container.

## Information architecture (#182)

Daily nav (unchanged, already short): Hub · Work · Team Work (mgr) · CG Calendar ·
Client Schedule · Content · Clients — plus the Performance zone.

Grouped specialist parents (was 8 flat entries → 4):

| Parent | Access | Children (routes preserved) |
|---|---|---|
| Integrations `/admin/integrations` | manager | Microsoft **setup+sync**, Planner Import, Meta, Google Ads, CSV/import |
| Marketing `/admin/marketing` | manager | Library, Marketing AI, Skill Card Review |
| Users `/admin/users` | admin | users / invites |
| System `/admin/system` | admin | System Health, AI Usage Health (**diagnostics only**) |

Integrations vs System overlap resolved: **setup/sync/connection** → Integrations;
**health/diagnostics** → System. Microsoft setup no longer appears under System.

## Responsive gutter audit — admin routes

Standard gutter = `px-4 sm:px-6 lg:px-8`. "Std" = already compliant.

| Route / page | Before | After | Treatment |
|---|---|---|---|
| `/admin/integrations` IntegrationsPage | `p-4 sm:p-6 lg:p-8` | PageContainer(wide) | adopted (PR #193) |
| `/admin/marketing` MarketingWorkspacePage | new | PageContainer(wide) | new (PR #193) |
| `/admin/system` SystemHubPage | new | PageContainer(wide) | new (PR #193) |
| `/admin/users` UsersHub | `max-w-6xl … lg:px-8` (Std) | PageContainer(content) | adopted |
| `/admin/planner-import` PlannerImportPage | `max-w-6xl … lg:px-8` (Std) | PageContainer(content) | adopted |
| `/admin/cg-hub` CgHubPage | `max-w-6xl … lg:px-10` | `… lg:px-8` | gutter fixed |
| `/admin/work` MyWorkPage | `max-w-7xl … lg:px-10` (×7 bands) | `… lg:px-8` | gutter fixed |
| `/admin/ops-hub` OpsHubPage | `max-w-7xl … (no lg)` | `… lg:px-8` | gutter fixed |
| `/admin/content` ContentWorkflowPage | `max-w-6xl … (no lg)` | `… lg:px-8` | gutter fixed |
| `/admin/marketing-library` MarketingLibraryPage | `max-w-6xl … (no lg)` | `… lg:px-8` | gutter fixed |
| `/admin/microsoft-import` MicrosoftImportPage | `max-w-7xl … (no lg)` | `… lg:px-8` | gutter fixed |
| `/admin/integrations/google-ads` GoogleAdsIntegrationPage | `w-full max-w-7xl p-4 sm:p-6 lg:p-8` | `mx-auto … px-4 py-6 sm:px-6 lg:px-8` | gutter fixed |
| `/admin/integrations/meta` MetaIntegrationPage | `p-4 sm:p-6 lg:p-8` | `mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8` | gutter fixed |
| `/admin/import-health` ImportHealthPage | `max-w-7xl … lg:px-8` | — | Std (adopt later) |
| `/admin/ai-health` AiUsageHealthPage | `max-w-7xl … lg:px-8` | — | Std (adopt later) |
| `/admin/client-schedule` ClientSchedulePage | `max-w-7xl … lg:px-8` | — | Std (adopt later) |
| `/admin/cg-calendar` CompanyCalendarPage | `max-w-6xl … lg:px-8` | — | Std (adopt later) |
| `/admin/command-centre` CommandCentrePage | `max-w-5xl … lg:px-8` | — | Std (adopt later) |
| `/admin/package-master` PackageMasterPage | `max-w-5xl … lg:px-8` | — | Std (adopt later) |
| `/admin/clients` ClientsList | table-based | — | Std |
| `/admin/reports` ReportsManagement | Std | — | Std |
| `/admin/assistant` AssistantPage | Std | — | Std |
| `/admin/published` PublishedPreview | Std | — | Std |

Client portal routes (`/client/*`) inherit the shared gutter from
`ClientPortalShell` — no per-page container needed.

## Intentional horizontal-scroll surfaces (kept, contained)

These scroll inside their own container (not the page body): the Video Pipeline
board, the AI usage `DataTable` (`min-w-[640px]`), and the client-portal tab bar.
`SCROLL_ROW` is the shared token for such surfaces.

## Remaining work (device-verified)

- Adopt `PageContainer`/`PageHeader` on the "Std (adopt later)" pages for full
  primitive consumption (their gutters are already correct, so no visual risk).
- Authenticated device verification on small-iPhone / iPhone-15 / tablet /
  desktop, with programmatic `document.scrollWidth <= clientWidth` checks per
  route — not possible in the headless CI environment; requires a browser pass.
- #180 copy-noise pass where the shell touches screens.
