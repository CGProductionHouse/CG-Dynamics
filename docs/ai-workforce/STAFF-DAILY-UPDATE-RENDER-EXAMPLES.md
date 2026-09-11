# Staff Daily Update — Render Examples

These examples show how the daily_update_contract from `get_my_assistant_bootstrap` renders for three staff members. The presentation contract is shared; personality belongs in greeting/closing.

**Key rule:** Greetings are generated fresh from the exact staff profile + real same-day context. Never hardcode or infer nicknames unless confirmed in the staff profile. Avoid generic AI/motivation phrasing.

---

## Sydney — Morning Update

```
Three deliverables on your desk before lunch, Sydney — Red Oak brief is the first domino.

**Day shape:** 3 client deliverables due, 1 lead follow-up, no meetings until 2pm.

### TODAY
| Time | Schedule | Context | Action |
|------|----------|---------|--------|
| NOW | Focus gap | Studio; 45 minutes before first commitment | Review Red Oak content brief |
| 10:30 | Dulux caption review | Remote; client waiting | Approve or return exact changes |
| 2:00 | Team sync | CG studio | Bring Red Oak status |

### WORK QUEUE
| State | Task | Next move | Due |
|-------|------|-----------|-----|
| NOW | Red Oak content brief review | Approve and send | 10:00 |
| NEXT | Dulux caption review | Approve or return changes | Today |
| WAITING | Bloem logo variants | Chase designer at 3pm | Friday |
| LATER | New lead proposal outline | Draft first section | Thursday |

**Blocked:** Nothing stuck today.

→ Start with the Red Oak brief — it's the earliest deadline.
```

---

## Franco — Morning Update

```
Light morning, Franco — two tasks and a clear afternoon. No pressure stacking up.

**Day shape:** 2 tasks this morning, 1 afternoon follow-up, nothing urgent.

### TODAY
| Time | Schedule | Context | Action |
|------|----------|---------|--------|
| NOW | Focus gap | CG studio; 40 minutes available | Update client notes |
| 10:00 | Red Oak content review | Remote; captions only | Review and record exact changes |
| 2:00 | Bloem follow-up | Remote; reply received yesterday | Reply in the existing thread |

### WORK QUEUE
| State | Task | Next move | Due |
|-------|------|-----------|-----|
| NOW | Client notes update | Complete in the focus gap | No due date |
| NEXT | Red Oak caption review | Review and record changes | Today |
| LATER | Bloem follow-up | Reply in the existing thread | Today |

No blockers. Everything's moving.

→ Knock out the client notes first — it's a quick one and clears the board.
```

## Franco — EOD Update

```
Solid close, Franco — the Red Oak run is captured; the upload still needs a verified finish.

### DONE TODAY
- Red Oak Video 1 and Video 2 confirmed captured against the canonical guideline.

### STILL OPEN
- Red Oak Video 3 — missed because the client contact left early; reshoot decision needed.
- OneDrive upload — PARTIAL; keep the run unresolved until the exact run folder verifies complete.

### TOMORROW
| Time | Schedule | Context | Action |
|------|----------|---------|--------|
| 9:00 | Editing handoff | CG studio; only verified footage is ready | Confirm the remaining upload, then hand over |

### BLOCKERS / PREP
- Assistant: finish exact same-client deliverable linkage; Franco does not choose IDs.
- Franco: confirm whether Video 3 must be reshot.

Reply naturally with the reshoot decision or any missed field fact and I’ll keep the exact records aligned.
```

---

## Amonique — Morning Update

```
Good morning, Amonique — the inbox has a new Cape Lumber enquiry and a wedding packages question. Both are warm.

**Day shape:** 4 inbox items need attention, 2 drafts to prepare, one meeting at 11.

### TODAY
| Time | Schedule | Context | Action |
|------|----------|---------|--------|
| NOW | Inbox focus gap | Remote; 50 minutes before meeting | Draft Cape Lumber reply |
| 11:00 | Team check-in | CG studio | Bring inbox summary |
| 2:00 | Red Oak lead follow-up | Remote | Draft in the existing thread |

### WORK QUEUE
| State | Task | Next move | Due |
|-------|------|-----------|-----|
| NOW | Cape Lumber enquiry reply | Draft with approved business profile | Today |
| NEXT | Wedding enquiry | Draft with approved wedding packages PDF | Today |
| WAITING | Red Oak proposal | Follow up if no reply by 3pm | Today |
| LATER | Inbox triage | Review unresolved owned/company-mail threads | Today |

**Tip:** Cape Lumber enquiry came in at 8:42am — they're warm, reply within the hour if you can.

→ Start with the Cape Lumber draft — it's the freshest enquiry and they're actively looking.
```

---

## Notes

- All morning updates use the exact `Time | Schedule | Context | Action` and `State | Task | Next move | Due` structures.
- Franco EOD shows the required exact Content Run, canonical guideline, Assistant-owned linkage and OneDrive evidence boundary.
- Personality appears in greeting/closing only; the work body is identical in format.
- Sydney gets confident/boss-energy without cliché filler. Franco gets dry/calm/reassuring. Amonique gets warm/explanatory with humour when appropriate.
- **Greeting generation rule:** Each greeting must be generated fresh from the staff profile's `working_preferences`, `output_preferences`, `repeated_corrections`, and the real same-day context (actual tasks, leads, calendar items). Never repeat stock lines. Never invent nicknames unless confirmed in profile.
- The `staff_tones` map in `daily_update_contract.personality.staff_tones` provides the starting tone direction for each staff member. Tones evolve over time via profile fields.
- Humour is allowed for all staff when it fits the individual, but must never become repetitive, forced, or generic.
