# AI Workforce — Shopify Commerce Platform Source Pack

Last updated: 2026-07-26
Status: Actual researched platform pack; all production knowledge remains review-gated.
Scope: Shopify storefronts, Shopify Admin, Shopify POS, product data, inventory, checkout, orders, returns, refunds, analytics, pixels and privacy.

## Purpose

Create a source-backed Shopify layer for CG Dynamics so staff can ask practical questions such as:

- Is this Shopify product really in stock?
- Why does Shopify show sales that differ from GA4 or accounting?
- Does a refund mean inventory was restocked?
- Can this customer be included in a marketing audience?
- Which product variant, location and market does this price belong to?
- Is a discount code, automatic discount or sale price being used?
- Why does a Shopify order differ from a fulfilled or retained sale?

This pack does not treat Shopify as the legal, accounting or warehouse system of record for every client. Exact source ownership must be configured per client.

## Canonical Shopify commerce model

```text
Product
→ product variant
→ inventory item
→ inventory level by location
→ selling channel / market
→ cart
→ checkout
→ order
→ payment transaction
→ fulfilment order
→ fulfilment / delivery / collection
→ return request
→ return
→ refund
→ restock decision
→ retained revenue
```

These are separate records and states. The AI must not collapse them.

## Source register

### Source S1 — Shopify product variants

Publisher: Shopify Developer Documentation
Canonical sources:

- https://shopify.dev/docs/api/admin-graphql/latest/queries/productVariants
- https://shopify.dev/docs/api/admin-graphql/latest/objects/ProductVariant

Source type: official API documentation
Freshness: versioned; re-check API release used by the integration

Verified findings:

- A product variant is a specific version of a product, commonly differentiated by options such as size or colour.
- Variant records can carry their own SKU, barcode, price, image/media, tax/delivery settings and inventory relationship.
- Shopify’s current product model connects variants to inventory, fulfilment and sales channels.
- Variant queries support pagination and bulk workflows.

Knowledge rules:

- Product-level stock or price must not be assumed for every variant.
- A product can be active while a specific variant is unavailable.
- SKU, barcode and title are not interchangeable identifiers.
- Large catalogues require full pagination; first-page-only syncs are invalid.

### Source S2 — Inventory by item and location

Publisher: Shopify Developer Documentation / Shopify Help Center
Canonical sources:

- https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryItem
- https://help.shopify.com/en/manual/products/inventory

Verified findings:

- Inventory is connected to product variants through inventory items.
- Inventory quantities can differ by location.
- Inventory tracking and inventory policy affect whether customers may continue ordering when stock reaches zero.
- Shopify inventory management is intended to reduce overselling, but operational accuracy still depends on correct receiving, transfers, adjustments, fulfilment and external-system sync.

Knowledge rules:

- “In stock” must retain variant, location and channel scope.
- Available quantity is not the same as total physical stock, committed stock or sellable stock in every integration.
- Continuing to sell when out of stock may be an intentional inventory policy, not a sync error.
- POS and online inventory should be reconciled by exact location.

### Source S3 — Shopify order object

Publisher: Shopify Developer Documentation
Canonical source:

- https://shopify.dev/docs/api/admin-graphql/latest/objects/Order

Verified findings:

- Shopify’s Order object connects customer, product, payment and fulfilment information.
- Apps require appropriate scopes and may have limited historical order access by default unless extended access is approved.
- Order records can be edited, cancelled, partially fulfilled, partially refunded or otherwise changed after creation.

Knowledge rules:

- An order is not automatically paid, fulfilled, delivered or retained.
- Historical sync requirements must be explicit; default API access may not include the full lifetime of orders.
- Order edits and cancellations require change-history handling.
- One order may contain multiple fulfilments, refunds and transactions.

### Source S4 — Returns and exchanges

Publisher: Shopify Help Center / Shopify Developer Documentation
Canonical sources:

- https://help.shopify.com/en/manual/fulfillment/managing-orders/returns
- https://help.shopify.com/en/manual/orders/refunds-returns/exchanges
- https://shopify.dev/docs/api/admin-graphql/latest/objects/Return

Verified findings:

- Shopify distinguishes return requests, returns, exchanges and refunds.
- A merchant can create a return, provide shipping instructions, inspect returned goods and issue a refund.
- Exchange inventory is not necessarily reserved at the time the return is created.
- Return reasons can be recorded and analysed.

Knowledge rules:

- Return requested, return approved, item received, exchange processed and refund issued are separate states.
- A return does not automatically mean a refund.
- A refund does not automatically prove the item was physically returned.
- An exchange does not automatically reserve replacement stock.

### Source S5 — Refund object and restocking

Publisher: Shopify Developer Documentation
Canonical sources:

- https://shopify.dev/docs/api/admin-graphql/latest/objects/Refund
- https://shopify.dev/docs/api/admin-graphql/latest/objects/RefundLineItem

Verified findings:

- Refund records retain amounts, payment transactions, line items, shipping, taxes, duties, fees and currency context.
- Refund line items can record whether and where inventory was restocked.
- Partial refunds and multi-component refunds are supported.

Knowledge rules:

- Refund amount, returned item value and restocked inventory are different facts.
- Refunds may include shipping, tax or fee adjustments.
- Restock state and location must be retained.
- Presentment currency and shop currency must not be mixed.

### Source S6 — Discounts

Publisher: Shopify Help Center
Canonical sources:

- https://help.shopify.com/en/manual/discounts
- https://help.shopify.com/en/manual/discounts/discount-methods
- https://help.shopify.com/en/manual/discounts/discount-methods/automatic-discounts

Verified findings:

- Shopify supports discount codes, automatic discounts and sale prices.
- Different discount methods can have different application and combination behaviour.
- Automatic discounts require qualifying products to be present in the cart.

Knowledge rules:

- Discount code, automatic discount and compare-at sale are different mechanisms.
- “Promotion active” requires start/end dates, eligibility and actual checkout behaviour.
- Discount amount should be tied to the actual order allocation, not only the advertised headline.
- Discounted revenue must not be reported as full-price revenue.

### Source S7 — Product and inventory analytics

Publisher: Shopify Help Center
Canonical sources:

- https://help.shopify.com/en/manual/products/analytics
- https://help.shopify.com/en/manual/reports-and-analytics/shopify-reports/report-types/analytics-fields

Verified findings:

- Shopify product analytics can include sell-through rate, days of inventory remaining and inventory value.
- Shopify reporting fields include total sales, discounts, returns and refund identifiers.
- Shopify’s “total sales” is a platform-defined metric and is not automatically identical to accounting revenue, cash received, gross profit or retained revenue.

Knowledge rules:

- Always show Shopify metric definitions alongside reported values.
- Gross sales, total sales, net sales and retained revenue are separate.
- Product analytics depend on Shopify’s inventory and order data quality.
- Margin and profit require cost and accounting truth, not sales values alone.

### Source S8 — Customer Privacy API

Publisher: Shopify Developer Documentation
Canonical source:

- https://shopify.dev/docs/api/customer-privacy

Verified findings:

- Shopify’s Customer Privacy API supports checking data-processing permissions and registering consent decisions.
- Consent decisions can apply to Shopify-managed surfaces including pixels, audiences and checkout.
- Privacy behaviour can depend on region and merchant configuration.

Knowledge rules:

- A Shopify customer record is not blanket marketing consent.
- Analytics, marketing and data-sale/sharing consent may be separate.
- Consent state must be evaluated before activating pixels or audiences where applicable.
- Shopify consent configuration does not replace South African POPIA review.

### Source S9 — Web Pixels API

Publisher: Shopify Developer Documentation
Canonical sources:

- https://shopify.dev/docs/api/pixels
- https://shopify.dev/docs/api/web-pixels-api/standard-api

Verified findings:

- Shopify web-pixel extensions subscribe to events emitted by Shopify.
- Pixels run in sandboxed contexts and can access customer event and privacy information through supported APIs.
- Pixel event collection should respect customer privacy state.

Knowledge rules:

- A pixel event is an observed platform event, not accounting truth.
- Duplicate pixels or overlapping integrations can double-count events.
- Browser and consent restrictions can create undercounting.
- Checkout events, payment records and fulfilled orders should be reconciled rather than assumed equal.

### Source S10 — REST product-variant deprecation

Publisher: Shopify Developer Documentation
Canonical source:

- https://shopify.dev/docs/api/admin-rest/latest/resources/product-variant

Verified finding:

- REST product-variant create/update/delete workflows were deprecated in favour of Shopify’s newer GraphQL product model.

Implementation implication:

- New CG integrations should use the supported GraphQL Admin API model rather than building new dependency on deprecated variant mutation patterns.
- API version must be pinned and reviewed before each Shopify quarterly version sunset.

## Recommended Shopify connection record

```text
shopify_connections
- id
- client_id
- shop_domain
- shop_name
- status
- api_version
- scopes_granted
- historical_order_access_state
- primary_currency
- markets_enabled
- pos_enabled
- inventory_locations_count
- customer_privacy_enabled
- web_pixels_detected
- last_successful_sync_at
- last_full_reconciliation_at
- sync_cursor_state
- error_state
- created_at
- updated_at
```

Never store Admin API credentials in documentation or client-visible records.

## Recommended canonical entities

- shopify_products
- shopify_product_variants
- shopify_inventory_items
- shopify_inventory_levels
- shopify_locations
- shopify_customers
- shopify_orders
- shopify_order_lines
- shopify_transactions
- shopify_fulfilments
- shopify_returns
- shopify_return_lines
- shopify_refunds
- shopify_refund_lines
- shopify_discounts
- shopify_markets
- shopify_pixel_events
- shopify_sync_runs

Every record must preserve `client_id`, Shopify global ID, source timestamps and deletion/archive state.

## Sync and reconciliation rules

1. Fully paginate every Shopify collection.
2. Store Shopify global IDs rather than relying only on titles or SKUs.
3. Use incremental sync plus scheduled full reconciliation.
4. Handle order edits, cancellations, refunds and returns idempotently.
5. Preserve shop and presentment currencies.
6. Reconcile inventory by location and variant.
7. Detect deleted, archived and merged catalogue records.
8. Store source `updatedAt` values.
9. Log permission/scope failures explicitly.
10. Never convert missing records to zero values.

## Shopify reporting truth model

Report separately:

- sessions and product views;
- add-to-cart events;
- checkout starts;
- orders created;
- payment authorised;
- payment captured;
- orders fulfilled;
- orders delivered where known;
- cancellations;
- returns requested;
- returns received;
- refunds issued;
- gross sales;
- discounts;
- returns/refunds;
- Shopify-defined total/net sales;
- retained revenue after returns where calculated;
- cost and gross profit only when verified cost data exists.

## Quick Assistant decision template

```text
Question: “Why is Shopify showing more sales than GA4?”

Answer structure:
1. Shopify metric and date range used.
2. GA4 metric and date range used.
3. Whether Shopify value includes tax, shipping, discounts or returns.
4. Consent/ad-blocking and browser tracking limitations.
5. Order edits, refunds or cancellations after the original event.
6. Currency and timezone alignment.
7. Reconciliation status.
8. Safe conclusion and unresolved gap.
```

## Candidate review-gated Skill Cards

### SSC-01 — Shopify product truth lives at variant level

Price, SKU, barcode, image and stock can differ by variant.

### SSC-02 — Inventory is location-scoped

A variant can be available at one location and unavailable at another.

### SSC-03 — Shopify order is not completed revenue

Order, payment, fulfilment, delivery, return and refund states remain separate.

### SSC-04 — Refund and restock are not the same event

A refund can occur without confirmed physical return or restock.

### SSC-05 — Shopify metrics use Shopify definitions

Do not rename Shopify total sales as accounting revenue or profit.

### SSC-06 — Consent applies to pixels and audiences

A customer record does not prove marketing consent.

### SSC-07 — Pixel events require reconciliation

Tracking events can undercount, duplicate or diverge from orders and payments.

### SSC-08 — Full pagination is mandatory

No Shopify catalogue, order or customer sync may rely on first-page results.

## Non-negotiable boundaries

- No price, stock, order, return or refund invented.
- No Shopify metric presented without its definition.
- No customer record treated as unlimited marketing permission.
- No restock inferred from refund alone.
- No order inferred as delivered without evidence.
- No profit calculated without verified cost data.
- No new integration built on deprecated REST variant mutation workflows.
- No client data promoted into universal knowledge.
- No production activation before review.