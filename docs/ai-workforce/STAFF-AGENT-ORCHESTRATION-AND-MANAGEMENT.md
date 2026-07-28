# Staff Agent Orchestration and Management

Last updated: 28 July 2026
Status: confirmed product direction / implementation pending
Owner: CA

This document is a canonical addendum to `docs/current-product-game-plan.md` and must be read with Section 9, the CG Assistant product contract.

## 1. Confirmed product direction

CG Dynamics must not have only one generic chatbot shared by everyone.

Every active staff member should receive a personal CG agent operating inside the authorised staff app. Above the staff agents, CG Dynamics should have a master coordination agent that supports management, distributes context safely and helps coordinate work across the organisation.

The AI is part of CG Dynamics itself, not a separate novelty product.

## 2. Agent hierarchy

### Master coordination agent

The master agent operates at the management and company-coordination layer.

It should eventually be able to:

- understand the current operational state of the business;
- see authorised cross-team workload, deadlines, blockers and overdue work;
- coordinate tasks between staff agents;
- identify work that has no owner or unrealistic deadlines;
- detect duplicated, forgotten or conflicting work;
- summarise team progress for management;
- propose reassignment or reprioritisation;
- request updates from the relevant staff agent;
- help management create and distribute work;
- escalate unresolved blockers;
- coordinate specialist marketing agents where relevant;
- never bypass permissions, approvals or the canonical task system.

The master agent is not allowed to silently manage people, alter employment records, change permissions or make disciplinary decisions. It may surface facts, risks and proposals, but material management actions require an authorised human.

### Personal staff agents

Each active staff user receives a logical personal agent associated with that user account.

The staff agent should understand only the information the signed-in employee is authorised to access, including:

- their assigned work;
- due dates and priorities;
- visible clients and projects;
- current Content Runs and guidelines relevant to them;
- visible calendar and Client Schedule context;
- their own work history and recurring responsibilities;
- approved company processes and Marketing Library knowledge;
- manager-approved instructions or priorities;
- relevant messages, updates and blockers recorded inside CG Dynamics.

The personal agent should help the employee:

- understand what to work on next;
- plan and summarise the day;
- identify blockers and overdue work;
- draft progress updates;
- create or update low-risk work through confirmed actions;
- navigate directly to the correct record;
- prepare for Content Runs or editing work;
- complete post-run reporting;
- learn the employee’s recurring working context without inventing personal facts.

A personal agent is a governed software identity and context boundary, not necessarily a separate paid model instance. Multiple staff agents may use the same underlying model provider while preserving separate memory, permissions, conversations and audit records.

## 3. Staff management is an urgent operational mission

CG Dynamics must support real staff management as soon as possible.

The immediate operational goal is not surveillance. It is clear work ownership, accountability and support.

Management needs a truthful view of:

- every active staff user;
- current assigned work;
- due today, upcoming, overdue and blocked work;
- workload by person;
- unassigned work;
- tasks with no recent progress;
- work awaiting review or approval;
- content-production responsibilities;
- schedule conflicts;
- staff-reported blockers;
- changes in ownership and deadlines;
- a clear audit history.

Personal agents and the master agent must use the same canonical work records. They must not maintain a competing hidden task list.

## 4. Coordination model

The master agent should not simulate vague conversations between agents. Coordination should happen through structured, auditable records.

Examples:

1. The master agent detects an overdue design task assigned to one employee.
2. It reads the task, authorised context and latest progress state.
3. It asks that employee’s personal agent for an update or surfaces a proposed follow-up.
4. The employee responds through their normal CG Assistant surface.
5. The update is written to the canonical task only after confirmation.
6. Management sees the updated status and audit trail.

For reassignment:

1. The master agent identifies overload or a missed deadline.
2. It proposes a reassignment with reasons and impact.
3. An authorised manager confirms.
4. The canonical assignment changes.
5. Both affected personal agents receive the updated context.

## 5. Required technical boundaries

- Supabase remains the permanent data layer.
- Existing canonical task, client, scheduling, Content Run and guideline records remain source truth.
- Do not create separate private task stores for agents.
- Every agent request must carry a signed-in user, role and permission context.
- Personal-agent memory must be isolated by user and client permissions.
- The master agent receives only management-authorised cross-team views.
- Tool calls and writes must be logged.
- Writes require preview and confirmation unless a later low-risk policy explicitly permits otherwise.
- No raw OneDrive information may reach clients.
- No cross-client or cross-user leakage.
- No invented tasks, users, progress, blockers, performance or staff facts.
- Human approval remains required for publishing, spending, role changes, permissions, employment actions and destructive changes.

## 6. Model and runtime strategy

The orchestration architecture must be provider-agnostic.

Do not hard-code the product to one model, provider or agent framework. Use the existing AI router/provider abstraction and add capability routing so models can be replaced without rebuilding the staff-agent system.

Recommended logical layers:

- identity and permission envelope;
- personal-agent profile and memory boundary;
- master-agent coordination policy;
- canonical context retrieval;
- structured tool registry;
- proposed-action and confirmation workflow;
- audit ledger;
- provider/model router;
- evaluation and fallback handling.

A strong coding/reasoning model may be used for complex planning and tool decisions. Smaller or cheaper models may later handle classification, summaries and routine routing, but only after quality is proven.

## 7. OpenClaw or external agent framework decision

Do not adopt OpenClaw merely because multi-agent coordination is required.

First build the minimum safe orchestration inside the existing CG Dynamics architecture. Evaluate an external framework only if the current system cannot reliably provide:

- durable agent runs;
- permission-aware tool execution;
- resumable workflows;
- structured delegation;
- per-agent memory isolation;
- auditability;
- bounded retries;
- approval gates;
- operational observability.

An external always-on framework introduces additional security, credential, memory and supply-chain risk. Any proposal to add OpenClaw or a similar runtime requires a focused architecture and security review before production use.

## 8. Delivery sequence

### Stage 1 — launch-critical staff management

- consolidate My Work and Planner into one usable Work area;
- make assignments, due dates, priorities, blockers and ownership reliable;
- add management workload and overdue views;
- ensure Users and permissions are correct;
- connect the existing Assistant to the signed-in user’s canonical work context;
- provide a personal-agent identity in the UI without pretending unsupported capabilities are live.

### Stage 2 — personal staff agent

- persistent app-shell Assistant;
- per-user conversation and memory boundary;
- My Day, Work, Clients, CG Calendar, Client Schedule and Content context;
- confirmed task creation and updates;
- blocker reporting and progress updates;
- direct navigation actions;
- complete audit trail.

### Stage 3 — master coordination agent

- authorised cross-team workload summaries;
- unassigned, overdue and blocked-work detection;
- proposed follow-ups and reassignments;
- structured delegation to personal agents;
- management confirmation for writes;
- coordination dashboard and run history.

### Stage 4 — specialist and marketing coordination

- connect approved Marketing Library agents;
- connect client and campaign intelligence;
- allow the master agent to coordinate specialist outputs through governed artifacts;
- preserve client isolation and approval gates.

## 9. Definition of success

The first meaningful success is not a screen containing multiple agent names.

Success means:

- every staff member opens CG Dynamics and sees a useful personal assistant grounded in their real work;
- management sees truthful work ownership, deadlines and blockers;
- the master agent can coordinate through canonical records without hidden work;
- actions are safe, confirmed and auditable;
- the system helps staff complete work rather than creating more administration;
- the model provider can be changed without redesigning the product.
