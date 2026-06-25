# BeyondGorgeous — Version 2 Design Document

> Living architecture & design reference for the BeyondGorgeous e-commerce platform.
> Lives in Git, so every change is versioned. Update the version history table below on each meaningful edit.

---

## Document control

| Version | Date | Author | Summary of change |
|---------|------|--------|-------------------|
| 0.1.0 | 2026-06-25 | Ashish Jain (with Claude) | Initial draft: business model, layered architecture, data model, vendor integration, SEO, AI support, API surface, roadmap. |
| 0.2.0 | 2026-06-25 | Ashish Jain (with Claude) | Added multi-source catalog ingestion (API / spreadsheet / email / manual) as a PIM-style pipeline; added hybrid fulfillment (dropship + self-fulfilled) with inventory-by-location and an order-routing engine; expanded data model, API surface, tech stack, decisions and glossary. |
| 0.3.0 | 2026-06-25 | Ashish Jain (with Claude) | Made the design marketplace-ready (seller + listing/offer model; cart/orders reference listings; single-seller launch) and added ERP-style inventory management & replenishment (stock ledger, reorder policies, safety stock, purchase orders, auto-order / approval / alert modes). Expanded data model, API, roadmap (future phases 6 & 7), decisions and glossary. |

**Versioning scheme:** `MAJOR.MINOR.PATCH`
- `MAJOR` — fundamental architecture change (e.g. new business model, replatform).
- `MINOR` — new section, new subsystem, new phase added.
- `PATCH` — clarifications, typo fixes, small additions.

**Status legend used in this doc:** 🟢 decided · 🟡 proposed / default · 🔵 future · ⚪ open question.

---

## Table of contents

1. [Vision & business model](#1-vision--business-model)
2. [Architecture overview](#2-architecture-overview)
3. [Core principle: source of truth & field ownership](#3-core-principle-source-of-truth--field-ownership)
4. [Data model](#4-data-model)
5. [Marketplace readiness](#5-marketplace-readiness)
6. [Catalog ingestion (multi-source)](#6-catalog-ingestion-multi-source)
7. [Fulfillment models (hybrid)](#7-fulfillment-models-hybrid)
8. [Inventory management & replenishment (ERP)](#8-inventory-management--replenishment-erp)
9. [SEO architecture](#9-seo-architecture)
10. [AI customer support & Jira](#10-ai-customer-support--jira)
11. [API surface](#11-api-surface)
12. [Technology stack](#12-technology-stack)
13. [Cross-cutting concerns](#13-cross-cutting-concerns)
14. [Phased roadmap](#14-phased-roadmap)
15. [Open decisions](#15-open-decisions)
16. [Glossary](#16-glossary)

---

## 1. Vision & business model

BeyondGorgeous is a **private-label beauty brand** with a **hybrid supply-and-fulfilment model**, designed to be **marketplace-ready**. We own the brand, the storefront, the customer relationship, the marketing content, and pricing. Behind us sit **multiple whitelisted vendors** (e.g. [BO International](https://www.bointernational.net/), and more over time) plus, for some products, **our own stock**.

**Launch posture:** we go live as a **single-seller store** (BeyondGorgeous is the only seller). The data model and architecture are, however, **seller-aware from day one**, so opening the platform to third-party sellers later is an *additive* change, not an expensive rebuild (see Section 5).

Two supply/fulfillment realities coexist and the system handles both per product:
1. **Vendor dropship** — the vendor produces, labels, packs and ships directly to the customer.
2. **Self-fulfilled** — for products we own/stock, we hold inventory and ship via shipping partners. Owned stock is managed with ERP-style inventory control and replenishment (Section 8).

Catalog data arrives **many different ways** — vendor APIs, spreadsheets, emails, or manual entry — and the system absorbs all of them without bespoke manual effort (Section 6).

### Guiding ideas
1. **Clear ownership of every piece of data** (Section 3) so external data flows in automatically.
2. **One canonical catalog, many ingestion sources** (Section 6).
3. **Marketplace-ready, single-seller launch** (Section 5) — never limit future scalability with today's simplicity.
4. **Stock as a ledger, not a number** (Section 8) — auditable inventory that can drive automated replenishment.
5. **The storefront never depends on a vendor being fast or online.** Vendor data is cached as last-known-good and degrades gracefully.

### Goals
- Robust, maintainable platform that scales from single-seller to marketplace without redesign.
- Automated catalog data and automated stock replenishment, minimising manual effort.
- Manual control whenever wanted (manual upload, field locks, approval gates, manual reorder).
- Hybrid fulfillment: dropship and self-fulfilled, chosen per product.
- AI customer support with Jira escalation.
- Strong organic discoverability on Google (Section 9).

### Owned domains
- `beyondgorgeous.in` — 🟢 primary, live.
- `www.beyondgorgeous.in` — 🟢 live.
- `beyondgorgeous.online` / `www.beyondgorgeous.online` — 🟢 301-redirect to `.in`.
- `beyondgorgeous.app` — 🔵 reserved for future mobile app / PWA / API host.

---

## 2. Architecture overview

The system is a **modular monolith** running on Cloudflare Workers — one deployable application, cleanly divided into modules. We deliberately avoid microservices: at our scale they would add large operational complexity for no benefit. Clean internal boundaries keep the option open to split later if ever needed.

### Layers (top to bottom)

| Layer | Responsibility |
|-------|----------------|
| **Actors** | Customers, founder/admin, vendors, sellers (future), support agents. |
| **Edge / UI** | Next.js storefront + admin panel, server-rendered on Cloudflare Workers. |
| **Application core** | Catalog, Marketplace/Listings, Ingestion, Cart & Orders, Fulfillment, Inventory & Replenishment, Customers, Support & AI. |
| **Integration layer** | Adapters/connectors: ingestion sources, payments, shipping, purchasing (POs), AI, Jira. |
| **Async backbone** | Queues (async jobs, retries) and Cron triggers (scheduled sync, replenishment runs). |
| **Data stores** | D1 (SQL), R2 (images + feed files), KV (cache/sessions/flags). |
| **External partners** | Vendor/supplier systems, Razorpay, courier APIs, Jira Cloud, Claude API. |

### Key flows
- **Browse/buy:** Customer → storefront → catalog/listings/cart/orders → D1 → render.
- **Catalog ingestion:** Any source (API/spreadsheet/email/manual) → pipeline → normalise → validate → (approve) → publish.
- **Order fulfilment:** Order paid → routing engine picks source per line item (dropship vendor or our warehouse) → ship → tracking back → customer notified.
- **Replenishment:** Stock decrement / scheduled run → policy check → auto-PO, draft-for-approval, or alert.
- **Support escalation:** Chatbot can't resolve → Jira ticket with context.

---

## 3. Core principle: source of truth & field ownership

**Every field has exactly one owner.** We never hand-edit a vendor-owned field; the vendor never touches a we-owned field. This is what removes manual catalog maintenance.

| Field | Owner | Updated by | Notes |
|-------|-------|-----------|-------|
| Name, description, how-to-use | **Us** (or seller) | Admin panel | Marketing content. |
| Images, marketing tags | **Us** (or seller) | Admin panel | e.g. "Bestseller". |
| Selling price | **Seller** (us at launch) | Admin / listing | Customer-facing price on the listing. |
| Vendor cost price | Vendor | Ingestion | Basis for margin. |
| Stock — dropship | Vendor | Ingestion | Auto-updates availability. |
| Stock — self-fulfilled | **Us** | Stock ledger (Section 8) | Derived from movements. |
| Lead time, weight, dimensions | Vendor / us | Ingestion / admin | Feeds shipping & replenishment. |
| Discontinued flag | Vendor | Ingestion | Auto-hides listing. |

**Override locks:** every externally-owned field carries an optional lock. When locked, ingestion skips it and our manual value wins.

---

## 4. Data model

Stored in **Cloudflare D1** (SQLite). Grouped by concern:

### Catalog (the "what")
- **categories** — hierarchical (`parent_id`), `name`, `slug`, `position`, SEO fields, `image`.
- **brands** — `name`, `slug`, `logo`, `description`.
- **products** — the canonical spec: `name`, `slug`, `brand_id`, `category_id`, `description`, `how_to_use`, `ingredients`, `additional_info`, `status`, SEO fields. *(A product is the catalog entity, independent of who sells it.)*
- **variants** — physical SKU/spec: `product_id`, `name` (shade/size), `sku`, `color_code`, `position`, `mrp`. *(Spec only — price/stock live on the listing.)*
- **product_images / variant_images** — `url` (R2), `alt_text`, `position`.
- **product_attributes** — `attribute_name`, `attribute_value` (filtering).
- **product_tags** — `tag`.

### Marketplace (the "who sells it")
- **sellers** — `name`, `type` (house / third_party), `status`, `commission_rate`, `payout_account`, `gstin`, contact. House seller (BeyondGorgeous) seeded as seller #1.
- **listings** (offers) — the sellable unit: `seller_id`, `variant_id`, `selling_price`, `currency`, `condition`, `fulfillment_type` (dropship / self / hybrid), `status`, field-lock flags. *Cart and orders reference a listing, never a bare product.* At launch: one seller, one listing per variant.

### Inventory & fulfillment (the "how much / where / who ships")
- **locations** — fulfilment nodes: our warehouse(s) and each vendor source; `type` (warehouse / vendor), `name`, region.
- **stock_ledger** — immutable inventory movements: `listing_id`/`variant_id`, `location_id`, `type` (receipt / sale / return / adjustment / transfer / reservation_release), `qty` (+/−), `ref` (order/PO id), `created_at`. **On-hand is derived from this ledger.**
- **inventory_snapshot** — maintained roll-up per (variant/listing × location): `on_hand`, `reserved`; `available = on_hand − reserved`. Prevents overselling.
- **reorder_policies** — per (variant/listing × location): `safety_stock`, `reorder_point`, `reorder_qty`, `max_level`, `lead_time_days`, `preferred_vendor_id`, `replenishment_mode` (auto_po / approval / alert_only), `is_active`.
- **purchase_orders** / **purchase_order_lines** — replenishment POs: vendor, status (draft → sent → confirmed → partially_received → received → closed/cancelled), expected_date, costs; lines map to `vendor_sku` / variant + qty.
- **stock_alerts** — low-stock / out-of-stock / overstock / PO-overdue (surfaced in admin and optionally raised as Jira tickets).

### Vendor & ingestion (the "where data comes from")
- **vendors** — `name`, `status`, contact, default `fulfillment_type`. (A vendor may be internal — our own production/warehouse — or external.)
- **ingestion_sources** — `vendor_id`, `type` (api / spreadsheet / email / sftp / manual), `config`, `is_active`.
- **field_mappings** — per source: `source_field` → `canonical_field` + transform.
- **ingestion_batches** — one row per received file/email/API run; status, counts, errors (audit).
- **staging_items** — raw rows awaiting validation/approval.
- **vendor_products** — `vendor_sku` → our `variant_id`; `last_synced_at`, sync state.

### Later phases add
`customers`, `addresses`, `carts`, `cart_items` (→ listing), `orders`, `order_items` (→ listing, with seller stamped), `shipments`, `payments`, `seller_payouts`, `reviews`, `support_tickets`.

### Decisions
- 🟡 **Full variants** (shade/size each its own SKU).
- 🟡 **Product/listing separation from day one** — cart and orders reference listings. This is the hinge that makes multi-seller additive.
- 🟡 **Stock-ledger inventory** — on-hand derived from movements, not a bare counter.
- 🟡 **Seller-, vendor-, fulfillment-, and inventory-ready schema in Phase 1**, even though filled manually/single-seller at first — so later automation and marketplace need no rework.

---

## 5. Marketplace readiness

**Goal:** never let today's single-seller simplicity force an expensive redesign if we open to third-party sellers. We launch single-seller but design seller-aware.

### 5.1 The model
- A **seller** owns **listings**; a **listing** is a seller's offer (price, stock, fulfilment) on a catalog **variant**.
- **Cart and orders reference the listing**, so they already carry "which seller, at what price, fulfilled how." Adding more sellers is then additive.
- Multiple sellers listing the same variant later = the familiar **"buy box"** (choose a default/winning offer). Not built now, but unblocked.
- Inventory, fulfilment, and (future) payouts are all scoped per seller via `seller_id`.

### 5.2 What this unblocks later (built only when needed)
- Seller onboarding & KYC; a seller admin portal.
- **Commission & automated payouts** — enabled by choosing a payments gateway with marketplace split-settlement (**Razorpay Route**), so no payments re-integration is required.
- Per-seller shipping, SLAs, ratings/reviews, and seller store pages (with their own SEO).
- Per-seller GST/tax and invoicing.
- Dispute/return handling per seller.

### 5.3 What we deliberately do NOT build at launch
- Any seller-facing UI, commissions, or payouts. There is exactly one (house) seller.
- The buy-box / multi-offer selection logic.

### 5.4 Cost/benefit
We pay a small Phase-1 cost (cart/orders point at listings; a `sellers` row exists) to avoid a catalog-and-order rebuild later. Considered worthwhile per the scalability requirement.

---

## 6. Catalog ingestion (multi-source)

One canonical catalog, many ingestion sources. BeyondGorgeous acts as its own **PIM (Product Information Management) hub** in a hub-and-spoke model — a standard pattern for multi-vendor catalogs.

### 6.1 Source connectors (the "spokes")

| Source type | How it works | Best for |
|-------------|--------------|----------|
| **Vendor API** | Push (webhooks) + scheduled pull via a per-vendor **adapter**. | Real-time stock/price. |
| **Spreadsheet / CSV upload** | Upload in admin; stored in R2; parsed. | Bulk edits, smaller vendors, manual control. |
| **Scheduled file pull** | Cron fetches from SFTP / Google Sheet / R2 drop folder. | "Drop a file" vendors. |
| **Email-in** | Dedicated inbox routed via Cloudflare Email Routing to a Worker that parses attachments. | Email-only vendors. |
| **Manual entry** | Admin form. | New items, one-offs. |

> Adding a vendor = create an `ingestion_source` + a `field_mapping` (and, for an API vendor, one adapter). The core catalog never changes.

### 6.2 The pipeline
```
receive → normalise → validate → map → (review/approve) → publish (upsert)
```
New items and large changes pause in `staging_items` for human approval; routine stock/price updates auto-publish. Field-ownership locks are always respected.

### 6.3 Reliability
- Runs through **Queues**; a slow/large feed never blocks the storefront; failures retry with backoff.
- **Idempotent** — re-sending the same file/webhook is harmless (row hashing).
- **Partial failure** — one bad row is quarantined; the rest publishes.
- **Full audit** — every batch, change and error logged and viewable in admin.

---

## 7. Fulfillment models (hybrid)

Both methods are supported, selectable per listing via `fulfillment_type`:

| Model | Who ships | Inventory truth | Tracking |
|-------|-----------|-----------------|----------|
| **Dropship** | Vendor | Vendor stock (via ingestion) | Vendor → ingested → customer |
| **Self-fulfilled** | Us, via courier partner | Our stock ledger (Section 8) | We generate label; partner tracking |
| **Hybrid (same listing)** | Either source | Sum across locations | Depends on chosen source |

An **order-routing engine** decides, per line item, where it's fulfilled — based on fulfillment type, live availability, and (later) cost and destination — and can **split a single order** across a vendor and our warehouse. Stock is **reserved** at checkout to prevent overselling. Self-fulfilled lines ship via a courier **aggregator** (one integration, many couriers); dropship lines use the vendor's shipping with tracking ingested back.

---

## 8. Inventory management & replenishment (ERP)

Designed like an ERP planner. Applies primarily to **owned / self-fulfilled stock**; pure dropship mirrors vendor stock via ingestion, but the same engine can alert on low vendor stock or trigger a pre-buy.

### 8.1 Stock as a ledger
On-hand is **derived from `stock_ledger`** movements (receipts, sales, returns, adjustments, transfers), not stored as a bare number. This gives a full audit trail and the data for replenishment and (later) forecasting.

### 8.2 Stock states (per SKU per location)
- **on_hand** — physically held.
- **reserved** — allocated to open orders.
- **available** = on_hand − reserved.
- **on_order (incoming)** — open purchase-order quantity.
- **projected** = available + on_order.

### 8.3 Reorder policy (per SKU per location)
`safety_stock`, `reorder_point (ROP)`, `reorder_qty` (fixed or EOQ later), `max_level`, `lead_time_days`, `preferred_vendor_id` (internal or external), and `replenishment_mode`.

### 8.4 Replenishment engine
Runs on a **schedule (Cron)** and **event-driven** on every stock decrement. When `available` (or `projected`) ≤ `reorder_point`, it acts per mode:

| Mode | Action |
|------|--------|
| **auto_po** | Create and send a Purchase Order to the preferred vendor for `reorder_qty`. |
| **approval** | Create a draft PO + alert for human approval. |
| **alert_only** | Raise a low-stock alarm / Jira ticket; no PO. |

### 8.5 Purchasing & receiving
- **Purchase Orders** have a lifecycle (draft → sent → confirmed → partially_received → received → closed). **Sending a PO reuses the integration layer outbound** (API or email to the vendor) — the mirror image of ingestion.
- **Goods receipt** posts ledger entries (on_hand up, on_order down).
- **Internal vs external vendors** use the same PO mechanism; a "vendor" can be our own production/warehouse.

### 8.6 Alerts & alarms
Low-stock, out-of-stock, overstock, and PO-overdue surface on the admin dashboard and optionally create **Jira tickets** (reusing the support integration).

### 8.7 Safety stock — now vs later
- **Launch:** simple fixed safety stock and reorder point per SKU.
- **Later:** statistical safety stock (service level × demand variability × √lead-time) using sales velocity computed from the ledger; optional demand forecasting.

### 8.8 Phasing
- **Phase 1:** schema (ledger, snapshot, locations, reorder-policy fields) exists; manual stock entry; low-stock visibility in admin.
- **Future (Phase 6):** replenishment engine, POs, goods receipt, auto-ordering, alerts/Jira.

---

## 9. SEO architecture

SEO is a rendering decision, not a late add-on.

- **Server-side rendering** for all public pages so Google receives complete HTML. ⚠️ Action item: the current category page is a client component (`useParams`) and must be rebuilt server-side (Phase 1).
- **Clean, keyword-rich, stable URLs**; slugs in the DB (change requires a 301).
- **Per-page metadata** — unique title, description, **canonical URL** (filter/sort/pagination pages canonical to the clean category URL; filter combinations `noindex`); Open Graph + Twitter cards.
- **Structured data (JSON-LD)** — Product (price, availability, `aggregateRating`), BreadcrumbList, Organization, WebSite + SearchAction; Review later. Drives rich results.
- **Crawlability** — auto-generated XML sitemap (regenerated on catalog change), robots.txt (disallow `/admin`, cart, checkout, account, raw filters), descriptive image `alt_text`.
- **Operational** — Google Search Console; preserve 301s; keep out-of-stock pages indexed with availability marked.
- **Marketplace note:** future seller store pages get their own canonical URLs and metadata.

---

## 10. AI customer support & Jira

- **Chatbot (Claude API)** answers from the product catalog, the signed-in customer's order data, and a curated FAQ.
- **Escalation:** unresolved issues auto-create a **Jira ticket** with transcript + order context; the customer gets a reference.
- Guardrails: the bot never performs irreversible actions (refunds, cancellations) itself — it raises a ticket.
- Reuses the same Jira integration as inventory alarms (Section 8.6).

---

## 11. API surface

Grouped by caller, each with its own auth model.

| Group | Caller | Auth | Examples |
|-------|--------|------|----------|
| **Storefront** | Website | Public / session | products, listings, cart, checkout, order history, chat |
| **Admin** | Founder | Cloudflare Access | catalog, listings, sellers, inventory, reorder policies, POs, orders, ingestion review |
| **Seller (future)** | Third-party sellers | Seller auth, scoped | manage own listings, stock, orders, payouts |
| **Ingestion** | Vendor systems / feeds | API key + signed | stock/price webhooks, uploads |
| **Purchasing (outbound)** | Our system → vendors | Per-vendor creds | send/receive POs |
| **Webhook receivers** | Razorpay, couriers | Signature verified | payment, shipment updates |
| **Internal jobs** | Cron + Queues | Internal | feed pulls, replenishment runs, routing, emails, sitemap |

---

## 12. Technology stack

All Cloudflare-native to stay on the current platform.

| Need | Service | Notes |
|------|---------|-------|
| Hosting / compute | Cloudflare Workers | Already deployed. |
| Framework | Next.js (App Router) | Already in use. |
| Database | Cloudflare D1 (SQL) | Catalog, listings, inventory, orders, customers. |
| File / image storage | Cloudflare R2 | Images + raw feed files. |
| Async jobs | Cloudflare Queues | Ingestion, routing, replenishment, emails. |
| Scheduled tasks | Workers Cron Triggers | Feed pulls, replenishment runs, sitemap. |
| Email ingestion | Cloudflare Email Routing → Worker | Parse vendor feed emails. |
| Cache / sessions | Cloudflare KV | Fast key-value. |
| Admin auth | Cloudflare Access | Protects `/admin`. |
| AI chatbot | Claude API (latest model) | Customer support. |
| Payments | Razorpay (+ **Route** for marketplace split) | 🟡 proposed — UPI, cards, net banking, wallets. |
| Shipping (self-fulfilled) | Courier aggregator, e.g. Shiprocket | 🟡 proposed. |
| Support tickets | Jira Cloud | Escalations & inventory alarms. |

---

## 13. Cross-cutting concerns

- **Security:** least-privilege auth per API group; admin behind Cloudflare Access; signed vendor webhooks; secrets in Workers secret store; card data via Razorpay only. **Seller data isolation** via `seller_id` row scoping (ready for marketplace).
- **Resilience:** storefront reads last-known-good from our DB; external calls timed-out, retried, circuit-broken; queues absorb spikes.
- **Idempotency:** all ingestion, webhook, and replenishment handlers safe to receive duplicates.
- **Data quality:** validation gates + human approval for new items.
- **Auditability:** stock ledger and ingestion batches give a full history of inventory and catalog changes.
- **Observability:** structured logs; per-source ingestion metrics; replenishment/PO metrics; alerts on failures, payment errors, low stock.
- **Privacy/compliance:** minimal customer data; secure addresses & order history; per-seller GST/tax when marketplace opens.

---

## 14. Phased roadmap

Five core phases to a sellable store, then two future expansion tracks. Durations are indicative for an assistant-led build with the founder as product owner.

| Phase | Status | Deliverables |
|-------|--------|--------------|
| **1 — Catalog + admin + manual ingestion** | 🟡 next | Seller-aware, fulfillment- and inventory-ready D1 schema (incl. sellers, listings, stock ledger, reorder-policy fields); `/admin` behind Cloudflare Access; product/listing/category/brand/variant/inventory management; R2 image upload; manual entry + spreadsheet/CSV upload through the ingestion pipeline; 15–20 dummy "Beyond Gorgeous" products; SSR public pages + SEO foundation. |
| **2 — Customers + cart** | 🔵 | Signup/login, profiles, cart, wishlist; cart/orders reference listings; stock reservation. |
| **3 — Checkout + payments** | 🔵 | Razorpay (Route-capable), order lifecycle, confirmation emails, richer SEO offers. |
| **4 — Fulfillment + vendor automation** | 🔵 | Order routing (dropship + self-fulfilled, split shipments); shipping via aggregator; dropship tracking ingestion; automated ingestion (API webhooks, scheduled pulls, email-in). |
| **5 — AI support + Jira** | 🔵 | Chatbot, ticket escalation, FAQ knowledge base. |
| **6 — Inventory & replenishment (ERP)** | 🔵 | Replenishment engine (auto-PO / approval / alert), purchase orders, goods receipt, safety-stock policies, low-stock alarms/Jira. |
| **7 — Marketplace enablement** | 🔵 | Seller onboarding & portal, multi-offer buy box, commission & payouts (Razorpay Route), per-seller shipping/ratings/tax. |

Phase 1 lays the seller-, fulfillment- and inventory-ready foundation, so phases 6 and 7 are **additive, not rebuilds**.

---

## 15. Open decisions

| # | Decision | Status | Default / recommendation |
|---|----------|--------|--------------------------|
| 1 | Schema scope | 🟡 | Full seller/fulfillment/inventory-ready from day one. |
| 2 | Variants | 🟡 | Full variants. |
| 3 | Product/listing separation | 🟡 | Adopt now; cart/orders reference listings. |
| 4 | Inventory model | 🟡 | Stock ledger (derived on-hand). |
| 5 | Payment gateway | 🟡 | Razorpay, with Route for future marketplace split. |
| 6 | Shipping aggregator (self-fulfilled) | 🟡 | Shiprocket. |
| 7 | Replenishment default mode | 🟡 | `alert_only` / `approval` at launch; `auto_po` opt-in per SKU. |
| 8 | Safety-stock method | 🟡 | Fixed per SKU now; statistical later. |
| 9 | Per-vendor data delivery method | ⚪ | TBD per vendor (API vs spreadsheet/email). |
| 10 | Email-in address & format | ⚪ | Define a `feeds@` inbox + expected columns. |
| 11 | Self-fulfilled vs dropship at launch | ⚪ | Likely all dropship initially. |
| 12 | Marketplace go/no-go & timing | ⚪ | Design now; build (Phase 7) only if/when needed. |
| 13 | Chatbot scope at launch | ⚪ | FAQ + order status; expand later. |

---

## 16. Glossary

- **Modular monolith** — one application divided into clean internal modules, not separate services.
- **Seller / merchant** — an entity that lists and sells products and receives payment; at launch there is one "house" seller (BeyondGorgeous).
- **Listing / offer** — a seller's sellable unit (price, stock, fulfilment) for a catalog variant; cart and orders reference listings.
- **Buy box** — when multiple sellers offer the same item, the logic that picks the default/winning offer (future).
- **Marketplace split settlement** — paying multiple sellers from one customer payment (e.g. Razorpay Route).
- **PIM** — Product Information Management; the central hub that owns and distributes product data.
- **Hub-and-spoke** — many sources feed one central hub that normalises and distributes data.
- **Ingestion pipeline** — receive → normalise → validate → map → approve → publish.
- **Adapter / connector** — a translator converting one source's format into our standard format.
- **Field mapping** — config saying "their column = our field," so onboarding a feed needs no new code.
- **Idempotent upsert** — insert-or-update that is safe to repeat.
- **Dropshipping** — the vendor ships directly to the customer; we hold no stock.
- **Self-fulfilled** — we hold inventory and ship via a shipping partner.
- **Courier aggregator** — one integration giving access to many couriers.
- **Order routing** — deciding which location/source fulfils each item of an order.
- **Stock ledger** — immutable record of inventory movements; on-hand is derived from it.
- **On-hand / reserved / available / on-order** — physically held / allocated to orders / sellable now / inbound on open POs.
- **Safety stock** — buffer stock held to absorb demand/lead-time variability.
- **Reorder point (ROP)** — stock level at which replenishment is triggered.
- **Reorder quantity / EOQ** — how much to reorder; EOQ = economic order quantity (cost-optimal lot size).
- **Lead time** — time from placing a PO to stock being available.
- **Purchase order (PO)** — an order we place on a vendor to replenish stock.
- **Goods receipt (GRN)** — recording stock received against a PO; posts ledger entries.
- **Replenishment** — restocking via auto-PO, approval, or alert when stock is low.
- **SSR** — server-side rendering, for SEO and speed.
- **JSON-LD** — structured data enabling Google rich results.
- **Canonical URL** — the one official URL for a page.
- **Slug** — the human-readable part of a URL.
