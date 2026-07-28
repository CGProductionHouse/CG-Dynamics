# CG Dynamics Game Plan — Agent Queue Discipline

Last updated: 28 July 2026
Status: Canonical delivery rule

## Purpose

Prevent CG Dynamics development from fragmenting across simultaneous prompts and unfinished branches.

## Active-agent rule

When OpenCode, Claude, Codex or another coding agent is already working on an issued mission:

- do not issue another implementation prompt to that same workflow before its result is received and reviewed;
- treat the current mission as the only active implementation mission;
- record all new screenshots, complaints, workflow decisions and product ideas in the GitHub game plan or the relevant canonical addendum;
- classify each new item as launch blocker, next queued mission, later milestone or product direction;
- do not ask CA to resend the information later;
- do not imply that the newly recorded item is being implemented immediately;
- do not start a conflicting branch or parallel implementation unless CA explicitly asks for parallel agents;
- after the active result arrives, inspect the resulting branch or PR against current `main`, verify what actually shipped, then choose the next single mission from the recorded queue.

## Current active mission

The current OpenCode mission is the Microsoft reconciliation failed-apply recovery.

Until its result is received and reviewed:

- Microsoft recovery remains the only active OpenCode implementation task;
- all navigation, staff assignment, AI-agent, Assistant-shell, Work/Planner and staff-management feedback is recorded only;
- no additional OpenCode prompt should be issued as though it is ready to run now.

## Recorded next launch-critical items

These are queued, not currently issued:

1. Teams-level canonical staff assignment and multi-assignee workflow.
2. Consolidate My Work and Planner into one reliable Work area.
3. Users and permissions under an authorised Admin area.
4. Shorter launch-ready navigation.
5. App-wide contextual Assistant shell.
6. One logical personal agent per staff member.
7. Master coordination agent for management visibility and confirmed actions.

The exact next mission must be selected only after reviewing the active Microsoft recovery result and the latest production state.
