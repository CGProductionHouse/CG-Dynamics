# Website Performance Reporting Goal

Status: planned product goal
Primary zone: CG Dynamics -> Performance
Upstream system: CG Website Builder / Website System

## Goal

CG Dynamics must eventually include a proper website-performance reporting interface for CG-managed client websites.

This must become part of the normal monthly client report, not a separate manual spreadsheet/dashboard exercise.

The report should answer:

- how many people used the client's website;
- which pages they used;
- how they reached it;
- what came from search, social, campaigns, referrals, ChatGPT/AI assistants or Direct/Unknown traffic where evidence exists;
- what actions visitors took;
- how many real enquiries/conversions happened;
- which sources/pages produced those enquiries/conversions;
- how the period compares with the previous period;
- what CG recommends doing next.

## Ownership boundary

CG Dynamics should **not** implement provider-specific analytics collection independently.

The Website Builder is the website reporting/data integration layer.

Preferred architecture:

`client website -> Vercel Web Analytics + first-party conversion attribution -> CG Website Builder normalized report API/snapshot -> CG Dynamics Performance -> client report`

This keeps Vercel/Supabase/provider credentials and website-specific integration details out of the CG Dynamics client UI.

## Required CG Dynamics surface

Inside Performance / Client Preview, add a Website section that can show for a selected month:

- visitors;
- page views;
- comparison vs prior period;
- top pages;
- traffic source mix;
- referrer/source breakdown;
- organic search traffic;
- paid campaign traffic where identified;
- social traffic by platform where identified;
- ChatGPT / AI referral traffic where identified;
- key CTA/conversion events;
- enquiry count;
- conversion rate when a valid denominator exists;
- top conversion pages/sources;
- concise interpretation and next actions;
- data-quality warnings when attribution/features are unavailable.

The client-facing report should use the same approved monthly snapshot as the internal Performance view so the numbers cannot drift between surfaces.

## Attribution rules

Never guess how a visitor arrived.

Use evidence in this order:

1. UTM parameters;
2. verified campaign/ad parameters when intentionally supported;
3. referrer host;
4. Direct / Unknown.

Normalised categories should include:

- Organic Search
- Paid Search
- Instagram
- Facebook
- TikTok
- LinkedIn
- Other Social
- ChatGPT / AI Search
- Other AI Assistant
- Referral Website
- Email / Campaign
- Direct / Unknown

The report must show unknown attribution honestly.

## ChatGPT / AI visibility

The Website System already handles the discoverability foundation (crawlability, metadata, structured data, Search Console/entity consistency and `OAI-SearchBot`).

The reporting layer adds measurement.

OpenAI currently documents that ChatGPT search referral URLs include `utm_source=chatgpt.com`. The Website Builder should classify this and pass it into the normalized CG report.

AI/source attribution is not guaranteed to be complete because referrers can be stripped and links can be copied/pasted.

## Conversion reporting

Useful standard conversion types include, where relevant:

- enquiry form submitted;
- phone click;
- WhatsApp click;
- email click;
- directions/map click;
- booking/reservation click;
- menu/document open;
- ecommerce add-to-cart;
- checkout start;
- purchase.

CG Dynamics does not need the private contents of enquiry messages just to report a conversion count/source.

## Data contract

CG Dynamics should consume a stable, authenticated Website Builder reporting contract rather than querying Vercel directly.

Conceptual monthly payload:

```json
{
  "clientId": "...",
  "websiteId": "...",
  "period": { "from": "...", "to": "..." },
  "traffic": {
    "visitors": 0,
    "pageviews": 0,
    "topPages": [],
    "sources": [],
    "referrers": []
  },
  "conversions": {
    "total": 0,
    "byType": [],
    "bySource": [],
    "topPages": []
  },
  "dataQuality": {
    "knownGaps": []
  }
}
```

The final schema must be typed/versioned and tenant-safe.

## Security / privacy

- No Vercel or Supabase privileged token in the client browser.
- No cross-client data leakage.
- Client preview sees only the mapped client's approved website snapshot.
- Aggregate reporting by default.
- No unnecessary PII or enquiry message content in analytics/reporting storage.
- Role-gate internal notes/recommendations where required.

## Delivery order

This is a real product goal, but it should be implemented in the correct dependency order:

1. Website System analytics/reporting standard and instrumentation.
2. Website Builder Vercel analytics adapter + first-party conversion adapter.
3. Website Builder normalized monthly report API/snapshots.
4. Website Builder internal analytics/reporting UI.
5. CG Dynamics client-to-website mapping + connector.
6. Performance website panel.
7. Client Preview / monthly report integration.
8. Optional PDF/export/automated narrative.
9. Later enrichment with Search Console, ad platforms and ecommerce revenue attribution.

Do not build CG Dynamics charts first and then discover that the upstream data model is inconsistent.

## Definition of done

The feature is done when CA/Amonique can open a client in CG Dynamics, choose a month and produce/share a website-performance report without manually opening Vercel/analytics dashboards or counting form submissions, and the report can truthfully explain traffic source and conversions to the extent the underlying evidence allows.

Canonical upstream roadmap:

`CGProductionHouse/cg-website-editor/docs/website-analytics-reporting-roadmap.md`
