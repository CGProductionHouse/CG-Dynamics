# Staff Daily Update — Render Examples

These examples show how the daily_update_contract from `get_my_assistant_bootstrap` renders for three staff members. The presentation contract is shared; personality belongs in greeting/closing.

**Key rule:** Greetings are generated fresh from the exact staff profile + real same-day context. Never hardcode or infer nicknames unless confirmed in the staff profile. Avoid generic AI/motivation phrasing.

---

## Sydney — Morning Update

```
Three deliverables on your desk before lunch, Sydney — Red Oak brief is the first domino.

**Day shape:** 3 client deliverables due, 1 lead follow-up, no meetings until 2pm.

### TODAY
| Time  | Item |
|-------|------|
| NOW   | Review Red Oak content brief — due 10am |
| 10:30 | Dulux caption draft — client waiting |
| 11:00 | Bloem shoot prep — check assets |
| 2:00  | Team sync — bring Red Oak status |
| 4:00  | Follow up Bloem lead — they went quiet |

### WORK QUEUE
| Status | Task                    | Client    | Next Move |
|--------|-------------------------|-----------|-----------|
| NOW    | Content brief review    | Red Oak   | Approve and send |
| NEXT   | Caption draft           | Dulux     | Write 3 options |
| WAITING| Logo variants           | Bloem     | Waiting on designer — chase at 3pm |
| LATER  | Proposal outline        | New Lead  | Draft by Thursday |

**Blocked:** Nothing stuck today.

→ Start with the Red Oak brief — it's the earliest deadline.
```

---

## Franco — Morning Update

```
Light morning, Franco — two tasks and a clear afternoon. No pressure stacking up.

**Day shape:** 2 tasks this morning, 1 afternoon follow-up, nothing urgent.

### TODAY
| Time  | Item |
|-------|------|
| NOW   | Planner task: update client notes — quick win |
| 10:00 | Content review for Red Oak — just the captions |
| 2:00  | Bloem follow-up — they replied yesterday |

### WORK QUEUE
| Status | Task                    | Client    | Next Move |
|--------|-------------------------|-----------|-----------|
| NOW    | Client notes update     | General   | Mark done when complete |
| NEXT   | Caption review          | Red Oak   | Read through, approve |
| LATER  | Bloem follow-up         | Bloem     | Reply to their email |

No blockers. Everything's moving.

→ Knock out the client notes first — it's a quick one and clears the board.
```

---

## Amonique — Morning Update

```
Good morning, Amonique — the inbox has a new Cape Lumber enquiry and a wedding packages question. Both are warm.

**Day shape:** 4 inbox items need attention, 2 drafts to prepare, one meeting at 11.

### TODAY
| Time  | Item |
|-------|------|
| NOW   | New enquiry from Cape Lumber — draft reply needed |
| 10:00 | Wedding package enquiry — attach packages PDF |
| 11:00 | Team check-in — bring inbox summary |
| 2:00  | Draft follow-up for Red Oak lead |
| 3:00  | Review pending replies — chase if needed |

### WORK QUEUE
| Status | Task                    | Client    | Next Move |
|--------|-------------------------|-----------|-----------|
| NOW    | Enquiry reply           | Cape Lumber | Draft with business profile attached |
| NEXT   | Wedding enquiry         | New Lead  | Draft with wedding packages PDF |
| WAITING| Red Oak proposal        | Red Oak   | Sent yesterday — follow up if no reply by 3pm |
| LATER  | Inbox triage            | General   | Review unresolved threads |

**Tip:** Cape Lumber enquiry came in at 8:42am — they're warm, reply within the hour if you can.

→ Start with the Cape Lumber draft — it's the freshest enquiry and they're actively looking.
```

---

## Notes

- All three use the same TODAY timeline + WORK Queue structure.
- Personality appears in greeting/closing only; the work body is identical in format.
- Sydney gets confident/boss-energy without cliché filler. Franco gets dry/calm/reassuring. Amonique gets warm/explanatory with humour when appropriate.
- **Greeting generation rule:** Each greeting must be generated fresh from the staff profile's `working_preferences`, `output_preferences`, `repeated_corrections`, and the real same-day context (actual tasks, leads, calendar items). Never repeat stock lines. Never invent nicknames unless confirmed in profile.
- The `staff_tones` map in `daily_update_contract.personality.staff_tones` provides the starting tone direction for each staff member. Tones evolve over time via profile fields.
- Humour is allowed for all staff when it fits the individual, but must never become repetitive, forced, or generic.
