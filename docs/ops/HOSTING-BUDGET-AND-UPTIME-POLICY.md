# Client uptime and hosting budget policy — #679

CA instruction, 3 October 2026. Applies to CG agents, automation and new-app planning.
Client production availability is a release requirement, not a disposable development resource.

The current executable finish/release plan is
`LOCAL-FIRST-LAUNCH-FINISH-2026-10-05.md` (#668/#679). Finish and verify locally;
prefer one production-target prebuilt staged artifact and same-deployment promotion
only in an explicitly authorized release window. No Vercel command today.

## Hard development limits

- ZERO unapproved cloud builds/deployments. Local code, tests, production builds and
  browser fixtures first. Batch changes into reviewed release candidates.
- Dynamics `vercel.json` must retain `git.deploymentEnabled=false` for every branch.
  This prevents automatic Git deployments, not CLI/dashboard/manual deployments.
- No documentation-only Vercel builds, repeated preview churn, same-SHA redeploys,
  cloud retry loops or cloud builds merely to obtain a green check.
- GitHub push/merge is not deployment authority. During the freeze record Vercel
  acceptance BLOCKED rather than bypassing the guard or claiming it passed.
- An approved release permits at most ONE preview and ONE production build for the
  specified SHA/project, unless CA explicitly authorizes another attempt.
- No new hosting projects, paid add-ons, extra seats or unlimited spend by default.
- Never pause a client site, delete deployments/data, alter DNS or remove budget
  protection to keep development running. Such changes require explicit CA authority.

## Required release packet

Before a cloud operation: exact repo/SHA/project/team/environment; local tests/build/
lint/diff evidence; timestamped current-cycle usage and remaining headroom; maximum
additional spend approved by CA; production serving/storage reserve; rollback deployment;
affected-domain uptime checks before/after; owner and stopping condition. Missing or
delayed billing evidence is a blocker, not an assumption of spare capacity.

At 50% of the approved extra budget reassess forecast/reserve; at 75% stop discretionary
development cloud work and escalate. At/beyond the reserve or cap, no new builds.
These are agent rules, not a claim dashboard alerts/limits were configured.

## Incident / structural gate

The previous $1 on-demand cap paused 15 projects on a shared team. CA temporarily
raised it to $5, Pause ON, and authorized resuming those projects. Last observed extra
usage was $1.02; it is historical, delayed billing evidence, not a current forecast.
The $20 Pro fee and $5 extra cap are distinct. Neither is permission for further spend.

Build CPU/storage caused substantial usage; freezing builds does not eliminate serving
or retained-storage charges. Do not promise a finite usage cap can guarantee uptime.
Production and development currently share a failure domain. The durable follow-up is
CA-approved isolation or fixed-cost hosting with sufficient capacity, rollback, domains,
data/security and availability checks. No migration/financial change is authorized here.

On a suspected outage: bounded read-only domain/status/budget checks, record timestamp
and failing URL, halt development cloud work, escalate exact restore action. Never
rebuild blindly or repeatedly raise a budget. Resume only with existing CA authority.

## Cross-project enforcement

Each existing/new project must record its owner, canonical live domains, hosting team,
paid services, expected costs/limits, automatic triggers, guarded release path and rollback.
Verify the deployment guard in that repository before pushing. Shared instructions do
not prove other repositories are guarded. Keep client-specific content out of shared rules.
Track unguarded repositories as OPEN; do not claim the fleet is protected until verified.

Official references:
- https://vercel.com/docs/project-configuration/git-configuration
- https://vercel.com/docs/spend-management
- https://vercel.com/docs/projects/managing-projects
