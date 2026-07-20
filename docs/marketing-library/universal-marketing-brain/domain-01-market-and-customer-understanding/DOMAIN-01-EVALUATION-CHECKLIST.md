# Domain 01 Evaluation Checklist

Last updated: 2026-07-20
Status: Implementation-ready evaluation standard

Use this checklist before any customer insight, audience statement, strategy recommendation or campaign brief is activated.

## Evidence integrity

- Is every material claim linked to a source record?
- Is the evidence marked observed, reported, measured, inferred or assumed?
- Are direct quotes preserved separately from interpretation?
- Are dates, context and collection method recorded?
- Are private or identifying details removed where necessary?
- Is sample size visible?
- Are contradictions retained rather than silently discarded?

## Customer understanding

- Are buyer, user, payer, influencer, approver, recommender and blocker separated?
- Is the trigger or occasion identified?
- Is the current alternative identified, including delay or doing nothing?
- Is the desired progress described functionally, emotionally, socially and by identity where evidence supports it?
- Are anxieties, objections and trade-offs classified rather than grouped as price resistance?
- Is natural customer language available?
- Are contextual constraints such as place, time, urgency and other people included?

## Reasoning quality

- Does confidence match the strength and recurrence of the evidence?
- Are assumptions framed as open research questions?
- Has demographic stereotyping been avoided?
- Has one memorable anecdote been prevented from becoming a market truth?
- Has stated preference been separated from actual behaviour?
- Is the insight commercially relevant to a real objective?
- Can the system explain how the recommendation follows from the evidence?

## Activation gate

An insight may be activated only when it includes:

- concise insight statement;
- linked evidence;
- applicable segment and situation;
- confidence level;
- limitations;
- contradictions;
- recommended use;
- prohibited misuse;
- review or expiry rule.

## Failure conditions

Reject or return for research when:

- the persona is invented;
- evidence is missing;
- the trigger is replaced by generic demographics;
- a customer quote has been rewritten and presented as verbatim;
- identity motives are asserted without support;
- multiple decision roles are collapsed into one imaginary person;
- all objections are answered with discounts;
- certainty is higher than the evidence allows;
- private information is exposed;
- the proposed output cannot be traced back to a real business or customer situation.

## Implementation test cases

### Pass

A restaurant insight links repeated booking messages, review language and transaction patterns showing that group celebrations are frequently triggered by birthdays and visitors from out of town. It records confidence, exceptions, exact phrases and applicable days.

### Fail

The system states that the target customer is a 32-year-old professional who enjoys premium dining without any supporting evidence.

### Pass

An architecture brief distinguishes landowner, spouse, financier and municipal approver, and records different risks for each role.

### Fail

The brief assumes the person making the first enquiry is the only decision-maker.

## Domain completion result

Domain 1 passes documentation review when all queued Skill Cards exist, use this checklist, link to traceable sources, and are represented in the implementation data model.