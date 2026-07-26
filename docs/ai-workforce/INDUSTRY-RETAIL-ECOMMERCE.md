# AI Workforce — Retail and Ecommerce Industry Library

Last updated: 2026-07-26
Status: Actual researched industry pack; all production knowledge remains review-gated.
Territory: South Africa, with international platform-operation sources where required.

## Purpose

Create a trustworthy industry layer for:

- physical retail;
- ecommerce stores;
- omnichannel retailers;
- catalogue-led businesses;
- direct-to-consumer brands;
- marketplaces;
- click-and-collect;
- local inventory retail;
- subscription and repeat-purchase businesses.

This pack supports marketing strategy, social content, paid media, product feeds, website intelligence, conversion reporting, fulfilment, returns and retention. It does not replace legal, tax, product-safety, payment-security or platform-specific professional advice.

## Industry structure

The AI must separate these journeys:

1. Product discovery
   - search, social, creator, marketplace or direct traffic;
   - category and product consideration;
   - price, stock and delivery assessment.

2. Purchase
   - product selection;
   - variant selection;
   - cart;
   - checkout;
   - payment;
   - order confirmation.

3. Fulfilment
   - stock allocation;
   - picking and packing;
   - dispatch;
   - delivery or collection;
   - failed-delivery or delay handling.

4. Returns and service recovery
   - return request;
   - eligibility assessment;
   - collection/drop-off;
   - inspection;
   - refund, repair, replacement or rejection;
   - complaint resolution.

5. Retention
   - repeat purchase;
   - replenishment;
   - loyalty;
   - subscription renewal;
   - cross-sell and win-back;
   - suppression where the customer opts out.

A product view, add-to-cart, checkout, paid order, fulfilled order and retained customer are different outcomes.

## Source register

### Source R1 — Consumer Protection Act 68 of 2008

Publisher: South African Government
Canonical page: https://www.gov.za/documents/consumer-protection-act
Source type: legislation
Rights treatment: official_reference; legal-risk flag
Freshness: verify amendments and sector rules

Verified high-level purpose:

- promote a fair, accessible and sustainable consumer marketplace;
- improve consumer information;
- prohibit unfair marketing and business practices;
- establish consistent consumer-protection norms and enforcement.

Retail and ecommerce implications:

- price, quantity, availability, product description, warranty, delivery, promotion and return claims must be supportable;
- “free”, “limited”, “last chance”, “exclusive”, “sale”, “half price”, “lifetime”, “guaranteed” and comparative claims require material conditions and evidence;
- product photography must not materially misrepresent the supplied item;
- mandatory charges should not appear only at the last checkout step;
- return, refund, repair and replacement rights depend on the legal basis and transaction facts, not one universal store rule;
- store policy must not be presented as removing statutory rights.

Prohibited overclaims:

- “No refunds under any circumstances.”
- “All sale goods have no rights.”
- “Lifetime guarantee” without exact duration, scope and exclusions.
- “Only one left” when inventory evidence does not support scarcity.

### Source R2 — Electronic Communications and Transactions Act 25 of 2002

Publisher: South African Government
Canonical page: https://www.gov.za/documents/electronic-communications-and-transactions-act
Source type: legislation governing electronic communications and transactions
Rights treatment: official_reference; legal-risk flag
Freshness: verify consolidated amendments

Verified scope:

- facilitates and regulates electronic communications and transactions;
- supports electronic contracting and consumer-facing electronic commerce;
- includes online-consumer disclosure and transaction requirements;
- has been amended by later legislation including the Consumer Protection Act and Cybercrimes Act.

Ecommerce implications:

- online merchants need clear identity and contact information;
- product/service descriptions, prices, payment methods, delivery terms and return/cancellation information should be visible before purchase;
- order confirmation, error correction and secure transaction processes matter;
- the AI must distinguish statutory cooling-off or cancellation contexts from ordinary store-choice returns;
- exact rights can depend on product type, transaction type and exclusions, so the Assistant must not issue case-specific legal conclusions.

### Source R3 — Statistics South Africa Retail Trade Sales P6242.1

Publisher: Statistics South Africa
Canonical publication page: https://www.statssa.gov.za/?PPN=P6242.1&page_id=1854
Archive: https://www.statssa.gov.za/?PPN=P6242.1&page_id=1866
Source type: official monthly economic statistics
Rights treatment: official_reference; retain month, category and comparison basis
Freshness: monthly

Verified findings:

- P6242.1 reports retail trade sales by type of business and includes VAT in actual-value reporting.
- The release is monthly and provides time-series downloads.
- The latest available release found during this research covered May 2026.
- In May 2026, real retail trade sales increased 2.3% year-on-year, while seasonally adjusted month-on-month sales increased 0.1%.
- Category contributions differed, with all “other” retailers, textiles/clothing/footwear/leather goods and general dealers contributing positively.

Safe candidate knowledge:

- retail context must retain exact date, category and comparison basis;
- year-on-year, month-on-month and three-month comparisons answer different questions;
- national retail movement does not prove one client’s ecommerce conversion, revenue, margin or market share;
- current-price turnover and real sales are different measures.

Prohibited overclaims:

- “Retail grew 2.3%, so this store should grow 2.3%.”
- “National sales prove the campaign worked.”
- “Retail growth means ecommerce growth.”

### Source R4 — Google Merchant Center price truth

Publisher: Google Merchant Center Help
Canonical sources:

- https://support.google.com/merchants/answer/6324371
- https://support.google.com/merchants/answer/12159029
- https://support.google.com/merchants/answer/9773429

Source type: official platform product-data requirements
Rights treatment: official_reference / metadata_and_link_only
Freshness: dynamic; re-verify before activation

Verified findings:

- submitted product price must match the price on the landing page;
- the submitted currency must match the targeted country and prominent landing-page price;
- sale dates and time zones matter;
- minimum order quantities or bundles require the submitted price to reflect the minimum purchasable amount;
- repeated or significant price mismatch can disapprove products or create account-level enforcement risk;
- automatic updates do not remove the merchant’s duty to keep feeds accurate.

Marketing and operational implications:

- website, structured data, feed and checkout must share one price truth;
- member, variant, subscription and regional prices need explicit handling;
- a social ad price should not remain live after the website sale ends;
- the AI should flag stale-price risk rather than guessing current price.

### Source R5 — Google Merchant Center availability truth

Publisher: Google Merchant Center Help
Canonical sources:

- https://support.google.com/merchants/answer/6324448
- https://support.google.com/merchants/answer/12470049
- https://support.google.com/merchants/answer/14819809

Source type: official platform inventory requirements
Rights treatment: official_reference / metadata_and_link_only
Freshness: dynamic

Verified findings:

- supported availability states include in stock, out of stock, preorder and backorder;
- availability should match the product feed, landing page and checkout;
- local inventory data should match actual store-level availability;
- repeated mismatch may disapprove products or place the account at risk;
- automatic item updates are not a substitute for frequent source updates.

Safe candidate knowledge:

- “in stock” is an operational claim, not merely a marketing label;
- a product can be visible online while unavailable for delivery in a specific region;
- store pickup, local stock and national ecommerce stock are distinct states;
- low-stock urgency requires real inventory evidence.

### Source R6 — Google Merchant Center structured-data consistency

Publisher: Google Merchant Center Help
Canonical sources:

- https://support.google.com/merchants/answer/15071338
- https://support.google.com/merchants/answer/15095088

Source type: official platform quality guidance
Rights treatment: official_reference

Verified findings:

- Merchant Center compares feed data with landing-page structured data;
- repeated microdata mismatches can disable automatic updates and put the account at risk;
- variant ambiguity, stale sale prices and inconsistent availability are common causes;
- automatic correction is not a substitute for a reliable catalogue source of truth.

Architecture implication:

CG Dynamics should eventually expose catalogue health states:

- synced;
- delayed;
- price_mismatch;
- availability_mismatch;
- variant_mismatch;
- structured_data_error;
- disapproved;
- account_risk;
- unknown.

### Source R7 — POPIA and ecommerce/customer data

Publishers: South African Government / Information Regulator
Canonical sources:

- https://www.gov.za/documents/protection-personal-information-act
- https://inforegulator.org.za/

Source type: privacy legislation and regulator source family
Rights treatment: official_reference; legal/privacy risk flag

Retail implications:

- names, phone numbers, email addresses, delivery addresses, purchase histories, loyalty IDs and behavioural profiles are personal information;
- payment-card data should not be copied into marketing tools or client reports;
- order fulfilment does not create unlimited permission for unrelated marketing;
- abandoned-cart, loyalty, win-back and lookalike-audience workflows require lawful basis, transparency and suppression handling;
- children’s data, health-product purchases and other sensitive contexts require heightened caution;
- customer-level purchase data must remain client-isolated.

### Source R8 — Google Analytics ecommerce measurement

Publisher: Google Analytics official documentation
Source family: https://support.google.com/analytics/
Source type: official measurement documentation
Rights treatment: official_reference / metadata_and_link_only
Freshness: dynamic

Measurement model:

- view_item;
- add_to_cart;
- begin_checkout;
- add_payment_info;
- purchase;
- refund;
- promotion view/click;
- item-level revenue and quantity.

Truth rules:

- an event firing does not prove the business process completed correctly;
- a purchase event can duplicate if transaction IDs are unstable or reused;
- reported revenue may exclude refunds, chargebacks, shipping, tax or offline adjustments depending on implementation;
- payment-authorised, order-paid, fulfilled and net-revenue states should be stored separately where the commerce system supports them;
- analytics revenue is not automatically accounting revenue.

### Source R9 — Consumer-facing review and testimonial truth

Source families:

- Consumer Protection Act;
- Advertising Regulatory Board Code;
- platform review policies;
- client’s verified order and consent records.

Knowledge rules:

- reviews must not be fabricated;
- incentives must not be hidden;
- staff, suppliers or owners must not be presented as independent customers;
- edited testimonials must preserve material meaning;
- a review does not prove the product performs universally;
- customer images and user-generated content require permission appropriate to the intended use.

### Source R10 — Payment, fraud and order-risk separation

Source families:

- payment provider documentation;
- acquiring-bank and card-scheme rules;
- Cybercrimes Act and privacy/security obligations;
- merchant’s verified fraud and chargeback records.

Safe knowledge:

- payment initiated, authorised, captured, settled, refunded and charged back are different states;
- fraud-screening approval does not guarantee a legitimate order;
- chargeback rate, failed-payment rate and conversion rate answer different operational questions;
- do not expose fraud rules or customer-risk data in client-facing reports;
- do not claim “100% secure” or “fraud proof”.

## Buyer decision drivers

### Product-level buyer needs

- correct product identity;
- accurate images and variants;
- current price;
- current stock;
- delivery cost and timing;
- returns and warranty;
- payment trust;
- verified reviews;
- size, compatibility or specifications;
- seller credibility.

### Omnichannel buyer needs

- branch-specific stock;
- collection readiness;
- consistent pricing;
- store hours;
- local returns;
- online-to-store continuity;
- clear support contact.

### Repeat-purchase buyer needs

- reliable replenishment;
- saved preferences;
- subscription control;
- simple cancellation;
- loyalty value;
- relevant rather than excessive messaging;
- quick service recovery.

## Canonical product truth model

Recommended product fields:

- client_id;
- source_system;
- product_id;
- sku;
- gtin/mpn where relevant;
- title;
- description;
- brand;
- category;
- variant attributes;
- price;
- compare_at_price;
- currency;
- VAT inclusion;
- availability;
- quantity where available;
- preorder/backorder date;
- location scope;
- shipping eligibility;
- product URL;
- primary image;
- feed_updated_at;
- website_checked_at;
- approval state;
- mismatch flags.

The source-of-truth hierarchy should be explicit. A spreadsheet, website, POS, ERP, ecommerce CMS and Merchant Center must not all independently overwrite one another without a defined owner.

## Order and fulfilment model

Recommended states:

- cart_created;
- checkout_started;
- payment_pending;
- payment_authorised;
- paid;
- stock_allocated;
- picking;
- packed;
- dispatched;
- ready_for_collection;
- delivered;
- collected;
- delivery_failed;
- cancelled;
- return_requested;
- returned;
- refunded;
- replaced;
- chargeback;
- disputed.

Do not call an order successful merely because the purchase event fired.

## Returns and service recovery

Required return fields:

- order_id;
- item_id;
- request date;
- reason;
- legal/policy basis;
- product condition;
- inspection state;
- collection/drop-off state;
- approved remedy;
- refund amount;
- refund completed date;
- customer communication state;
- dispute state.

Marketing should not hide high return rates behind gross-order growth. A strong report distinguishes:

- gross orders;
- cancelled orders;
- fulfilled orders;
- returned orders;
- refunded value;
- net retained revenue where verified.

## Website intelligence

Recommended Website tab metrics:

- product and category sessions;
- product views;
- search usage and zero-result searches;
- add-to-cart rate;
- checkout-start rate;
- payment completion rate;
- purchase rate;
- revenue where transaction tracking is verified;
- average order value;
- items per order;
- refund rate;
- return rate where integrated;
- repeat purchase rate;
- new versus returning customer revenue;
- device and channel split;
- page speed and checkout errors;
- product-feed approval health;
- price and stock mismatch counts;
- out-of-stock demand;
- delivery-region failures;
- promotion-code use;
- cart abandonment with tracking limitations.

## Lead and conversion model

Retail does not always use a traditional lead. Separate:

- product enquiry;
- stock enquiry;
- quote request;
- wholesale/trade enquiry;
- account application;
- wishlist;
- back-in-stock request;
- abandoned cart;
- checkout;
- paid order;
- fulfilled order;
- repeat customer.

Cost per lead, cost per purchase and return-adjusted customer acquisition cost are not interchangeable.

## Paid media implications

Potential campaign groups:

- Shopping/product-feed campaigns;
- category and high-intent search;
- dynamic remarketing;
- new-customer acquisition;
- product launch;
- seasonal sale;
- local inventory;
- repeat-purchase/replenishment;
- wholesale/trade acquisition;
- creator/UGC campaigns with rights evidence.

Pre-launch checks:

- current price;
- current stock;
- landing-page match;
- variant availability;
- delivery area;
- promotion dates;
- coupon validity;
- return conditions;
- margin and fulfilment capacity;
- product approval state;
- tracking and transaction deduplication.

## Content strategy pillars

1. Product use and demonstration
2. Product comparison and selection
3. Size, fit, compatibility and specifications
4. Stock and availability truth
5. Delivery, collection and service expectations
6. Customer stories with permission
7. Behind-the-scenes fulfilment
8. Product care and maintenance
9. New arrivals and launches
10. Promotions with complete conditions
11. Social proof without fabrication
12. Returns, warranties and buying confidence
13. Local branch or store discovery
14. Repeat-purchase and replenishment education

## Reporting model

Report separately:

- reach and engagement;
- product-page traffic;
- add-to-cart;
- checkout starts;
- payment attempts;
- paid orders;
- fulfilled orders;
- delivered/collected orders;
- gross tracked revenue;
- refunds and returns;
- verified net revenue where available;
- new customers;
- repeat customers;
- average order value;
- cost per paid order;
- cost per new customer;
- return-adjusted acquisition metrics;
- product-feed disapprovals;
- price/stock mismatches;
- customer-service recovery.

Do not call tracked revenue profit. Do not call gross sales retained revenue.

## Candidate review-gated Skill Cards

### RSC-01 — Commerce outcomes require stage truth

Views, carts, checkouts, paid orders, fulfilled orders and retained revenue are different states.

### RSC-02 — Price and stock must match everywhere

Feed, landing page, structured data and checkout should share one current price and availability truth.

### RSC-03 — National retail data is context

Stats SA retail movement can describe dated category context but cannot prove one retailer’s performance.

### RSC-04 — Store policy cannot erase statutory rights

Returns and remedies must distinguish store choice from applicable legal rights.

### RSC-05 — Analytics revenue is not accounting truth

Tracked purchase events require reconciliation to payment, fulfilment, refunds and offline adjustments.

### RSC-06 — Scarcity requires evidence

Low-stock and urgency claims should come from current inventory, not manufactured pressure.

### RSC-07 — Product reviews require authenticity

Do not fabricate, disguise incentives or present insiders as independent customers.

### RSC-08 — Customer data remains purpose-bound

Order and fulfilment data does not create unlimited marketing permission.

### RSC-09 — Automatic feed fixes are not a source of truth

Automatic item updates may correct some mismatches but do not replace catalogue governance.

### RSC-10 — Returns belong in performance reporting

Gross order growth without cancellations, returns and refunds can materially mislead.

## Client classification prompts

For each active retail client, verify from official and internal evidence:

- physical, ecommerce or omnichannel;
- product categories;
- primary catalogue source;
- POS, ERP or CMS;
- branch/location model;
- stock ownership and update frequency;
- delivery regions;
- payment provider;
- returns and warranty model;
- wholesale/trade versus consumer split;
- repeat-purchase cycle;
- Google Merchant Center status;
- analytics ecommerce implementation;
- current claims and promotions;
- verified customer-outcome data.

Do not classify a client from its name alone.

## Remaining research questions

- exact current Information Regulator direct-marketing guidance and enforcement updates;
- sector-specific product safety and labelling for each retail category;
- marketplace seller obligations by platform;
- South African ecommerce fraud and payment data from authoritative primary sources;
- current local-inventory feature availability by platform and country;
- exact refund and cooling-off application by product and transaction type;
- integration-specific revenue reconciliation for each client stack.

## Activation rule

No knowledge in this pack enters normal production answers until:

- the exact source is reviewed;
- jurisdiction and date are retained;
- legal or policy limitations are stored;
- the card is approved;
- client-specific facts remain isolated;
- regression tests confirm that the Assistant does not invent price, stock, rights, revenue or return outcomes.
