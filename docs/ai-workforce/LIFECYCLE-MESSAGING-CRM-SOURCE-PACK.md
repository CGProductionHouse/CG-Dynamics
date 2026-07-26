# AI Workforce — Lifecycle Messaging, Email, WhatsApp and CRM Source Pack

Last updated: 2026-07-26
Status: Research pack; all implementation remains review-gated.

## Purpose

Prepare the AI Workforce to plan and evaluate customer communication after acquisition, not only ads and social posts.

The target lifecycle is:

```text
Audience / visitor
→ subscriber or lead
→ first response
→ qualification
→ nurture
→ sales handoff
→ customer
→ retention / repeat purchase
→ reactivation
```

The system must distinguish:

- transactional communication;
- service communication;
- marketing communication;
- sales follow-up;
- customer-support communication;
- consented versus non-consented contact;
- platform-delivered versus CRM-delivered communication.

## Priority official source families

### WhatsApp Business

Use as official_reference / metadata_and_link_only unless a page explicitly permits broader reuse.

- Meta / WhatsApp Business Platform documentation
- WhatsApp Business Messaging Policy
- WhatsApp Commerce Policy
- Message-template policy and categories
- User opt-in requirements
- Quality rating and messaging limits
- Read-rate and delivery-status definitions
- Business broadcasts and user-control announcements

Key research claims to capture only after exact-page verification:

- Business-initiated messages require approved templates on the platform.
- Marketing messages should be expected, relevant and limited to avoid overload.
- Users must retain practical control to stop or reduce business messages.
- Read receipts, delivery and replies are different events and must not be collapsed.
- A sent template is not proof of delivery, reading, reply, lead quality or sale.

Official starting point:
- https://about.fb.com/news/2025/04/ways-to-manage-your-businesses-chats-on-whatsapp/

### Email marketing and transactional email

Official or regulatory source targets:

- South African Information Regulator guidance under POPIA
- Consumer Protection Act direct-marketing provisions
- Electronic Communications and Transactions Act where applicable
- FTC CAN-SPAM guidance as useful comparative compliance, not South African law
- Sender-domain authentication documentation from major mailbox providers
- DMARC, DKIM and SPF standards or official provider documentation
- Official ESP documentation for bounce, complaint, delivery and open/click metrics

Important rules:

- Compliance depends on the recipient, jurisdiction, relationship and message purpose.
- A marketing email and a transactional email are not interchangeable.
- Open rate can be distorted by privacy features and automated image loading.
- Clicks can include scanners or security systems.
- Delivery means acceptance by receiving infrastructure, not inbox placement or human attention.
- Unsubscribe, suppression and consent evidence must be retained.

Official comparative source:
- https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business

## CRM and lead-stage model

Recommended canonical lifecycle stages:

- new;
- attempted_contact;
- contacted;
- engaged;
- qualified;
- proposal_or_quote;
- converted;
- lost;
- invalid;
- duplicate;
- do_not_contact.

Do not automatically infer stage from channel events.

Examples:

- email opened ≠ contacted;
- WhatsApp delivered ≠ engaged;
- form submitted ≠ qualified;
- ad-platform conversion ≠ customer;
- invoice issued ≠ payment received;
- no reply ≠ lost.

Every lifecycle record should retain:

- client_id;
- lead_id;
- source platform;
- campaign / form / landing-page identifiers;
- consent source and timestamp where applicable;
- channel;
- message purpose;
- send / delivery / read / reply timestamps where available;
- assigned person;
- current stage;
- stage-change history;
- next action;
- follow-up date;
- suppression or do-not-contact state;
- qualification reason;
- conversion evidence;
- value only when verified.

## Candidate knowledge packets

Create as experimental or needs_review only.

### Packet 1 — Channel-purpose matching

Principle:
Use the channel according to user expectation and urgency. Service updates, support, sales follow-up and promotional broadcasts should not be treated as the same communication class.

Limitation:
Platform policy and legal requirements vary by country, consent and message type.

### Packet 2 — Message-sequence design

Principle:
A lifecycle sequence should have one clear objective per message and should stop or branch when the recipient replies, converts, opts out or becomes ineligible.

Limitation:
No universal sequence length or sending cadence should be presented as fact.

### Packet 3 — Lead-response speed

Status:
Research question, not approved principle.

Required evidence:
Find current, credible primary or peer-reviewed evidence before creating any time-to-response rule. Do not repeat unsupported internet claims such as fixed five-minute conversion multipliers.

### Packet 4 — Deliverability truth

Principle:
Sent, delivered, opened, clicked, replied and converted are different states with different technical limitations.

Application:
Reports and AI recommendations must preserve these distinctions.

### Packet 5 — Consent and suppression

Principle:
A suppression or opt-out state overrides marketing automation. Client-isolated suppression records must not be bypassed by another workflow.

## AI workflows to support later

- lead-response draft;
- first-contact WhatsApp message;
- email nurture sequence;
- quote follow-up;
- no-response follow-up;
- reactivation sequence;
- post-purchase check-in;
- review request;
- renewal reminder;
- abandoned-enquiry follow-up;
- internal lead-summary and next-action recommendation.

Every output must show:

- objective;
- audience / lifecycle stage;
- channel;
- message classification;
- consent or eligibility assumption;
- source-backed rules used;
- client claims needing verification;
- stop conditions;
- measurement plan.

## Product implications

Future Leads Hub / CRM modules should support:

- one lead timeline across sources;
- channel-specific delivery and reply events;
- consent and suppression;
- assignment and follow-up;
- templates separated by purpose;
- sequence enrollment with stop conditions;
- exports and client-visible status reporting;
- internal-only notes and diagnostics;
- service upsell state when lifecycle automation is not enabled.

## Review order

1. South African direct-marketing and consent rules.
2. WhatsApp messaging policy, template categories and opt-in.
3. Email authentication and deliverability definitions.
4. Canonical CRM stages and event distinctions.
5. Sequence-design principles.
6. Lead-response research.
7. Client-facing reporting language.

## Safety

- Do not send or automate messages from research mode.
- Do not infer consent.
- Do not treat foreign law as South African law.
- Do not create universal cadence rules without evidence.
- Do not store one client's contacts or suppression data in another client's context.
- Do not call a delivered or opened message a lead or sale.
- Do not activate any knowledge item before human review.