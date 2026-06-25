# BeyondGorgeous — Version 2 Design Document

> Living architecture & design reference for the BeyondGorgeous e-commerce platform.
> Lives in Git, so every change is versioned. Update the version history table below on each meaningful edit.

---

## Document control

| Version | Date | Author | Summary of change |
|---------|------|--------|-------------------|
| 0.1.0 | 2026-06-25 | Ashish Jain (with Claude) | Initial draft: business model, layered architecture, data model, vendor integration, SEO, AI support, API surface, roadmap. |
| 0.2.0 | 2026-06-25 | Ashish Jain (with Claude) | Added multi-source catalog ingestion (API / spreadsheet / email / manual) as a PIM-style pipeline; added hybrid fulfillment (dropship + self-fulfilled) with inventory-by-location and an order-routing engine; expanded data model, API surface, tech stack, decisions and glossary. |

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
5. [Catalog ingestion (multi-source)](#5-catalog-ingestion-multi-source)
6. [Fulfillment models (hybrid)](#6-fulfillment-models-hybrid)
7. [SEO architecture](#7-seo-architecture)
8. [AI customer support & Jira](#8-ai-customer-support--jira)
9. [API surface](#9-api-surface)
10. [Technology stack](#10-technology-stack)
11. [Cross-cutting concerns](#11-cross-cutting-concerns)
12. [Phased roadmap](#12-phased-roadmap)
13. [Open decisions](#13-open-decisions)
14. [Glossary](#14-glossary)

---

## 1. Vision & business model

BeyondGorgeous is a **private-label beauty brand** with a **hybrid supply and fulfillment model**. We own the brand, the storefront, the customer relationship, the marketing content, and pricing. Behind us sit **multiple whitelisted vendors** (e.g. [BO International](https://www.bointernational.net/), and more over time) plus, for some products, **our own stock**.

Two supply/fulfillment realities coexist and the system must handle both per product:
1. **Vendor dropship** — the vendor produces, labels, packs and ships directly to the customer.
2. **Self-fulfilled** — for products we own/stock, we hold inventory and ship via shipping partners (couriers / aggregators).

Catalog data likewise arrives **many different ways** — vendor APIs, spreadsheets, emails, or manual entry — and the system must absorb all of them without bespoke manual effort each time.

The architecture is therefore built around three ideas:
1. **Clear ownership of every piece of data** (Section 3) so external data flows in automatically.
2. **One canonical catalog, many ingestion sources** (Section 5) — a hub-and-spoke pipeline normalises everything into our standard format.
3. **The storefront never depends on a vendor's system being fast or online.** Vendor outages degrade gracefully; they never take the shop down.

### Goals
- Robustness and easy maintainability.
- Automated catalog data (stock, price, availability, new items) from many source types.
- Manual control whenever we want it (manual upload, field locks, approval gates).
- A real, sellable catalog organised into proper categories.
- Hybrid fulfillment: dropship and self-fulfilled, chosen per product.
- AI customer support with Jira escalation.
- Strong organic discoverability on Google (Section 7).

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
| **Actors** | Customers, you (admin), vendors, support agents. |
| **Edge / UI** | Next.js storefront + admin panel, server-rendered on Cloudflare Workers. |
| **Application core** | Modules: Catalog, Ingestion, Cart & Orders, Fulfillment, Customers, Support & AI. |
| **Integration layer** | Adapters/connectors to the outside world: ingestion sources, payments, shipping, AI + Jira. |
| **Async backbone** | Queues (async jobs, retries) and Cron triggers (scheduled sync/pull). |
| **Data stores** | D1 (SQL), R2 (images + feed files), KV (cache/sessions/flags). |
| **External partners** | Vendor systems, Razorpay, courier/shipping APIs, Jira Cloud, Claude API. |

### Key flows
- **Browse/buy:** Customer → storefront → catalog/cart/orders → D1 → render.
- **Catalog ingestion:** Any source (API/spreadsheet/email/manual) → ingestion pipeline → normalise → validate → (approve) → publish to D1.
- **Order fulfilment:** Order paid → routing engine picks source per line item (dropship vendor or our warehouse) → ship → tracking flows back → customer notified.
- **Support escalation:** Chatbot can't resolve → Jira ticket with order + conversation context → agent handles it.

---

## 3. Core principle: source of truth & field ownership

**Every field has exactly one owner.** We never hand-edit a vendor-owned field; the vendor never touches a we-owned field. This is what removes manual catalog maintenance.

| Field | Owner | Updated by | Notes |
|-------|-------|-----------|-------|
| Product name, description, "how to use" | **Us** | Admin panel | Marketing content. |
| Images, marketing tags/badges | **Us** | Admin panel | e.g. "Bestseller". |
| Selling price | **Us** | Admin (markup rule over cost) | Customer-facing price. |
| Vendor cost price | Vendor | Ingestion | Basis for our margin. |
| Stock / availability (dropship) | Vendor | Ingestion | "Out of stock" flips automatically. |
| Stock (self-fulfilled) | **Us** | Warehouse/admin | Our own inventory count. |
| Lead time, weight, dimensions | Vendor / Us | Ingestion / admin | Feeds shipping calc. |
| Discontinued flag | Vendor | Ingestion | Auto-hides product. |

**Override locks:** every externally-owned field carries an optional lock. When locked, ingestion skips that field and our manual value wins. Full control where we need it, automation everywhere else.

> Example: a dropship product going out of stock requires *no* manual action — `stock` is vendor-owned and updates through ingestion. Default behaviour, not a special feature.

---

## 4. Data model

Stored in **Cloudflare D1** (SQLite). Core entities and relationships:

```
brands (1) ───< products
categories (self-referencing tree) (1) ───< products
products (1) ───< variants               (shades / sizes)
products (1) ───< product_images
products (1) ───< product_attributes     (filterable)
products (1) ───< product_tags
variants (1) ───< variant_images
variants (1) ───< inventory              (per location/source)
locations (1) ───< inventory             (our warehouse(s) + vendor sources)

vendors (1) ───< ingestion_sources       (how a vendor sends us data)
ingestion_sources (1) ───< field_mappings (their fields → our fields)
ingestion_sources (1) ───< ingestion_batches (each run/file/email)
ingestion_batches (1) ───< staging_items  (raw rows pending validate/approve)
vendors (1) ───< vendor_products          (their SKU → our variant)
```

### Catalog tables
- **categories** — hierarchical (`parent_id`), `name`, `slug`, `position`, `seo_title`, `seo_description`, `image`.
- **brands** — `name`, `slug`, `logo`, `description`.
- **products** — `name`, `slug`, `brand_id`, `category_id`, `description`, `how_to_use`, `ingredients`, `additional_info`, `status` (draft/active/archived), `seo_title`, `seo_description`, timestamps.
- **variants** — `product_id`, `name` (shade/size), `sku`, `mrp`, `selling_price`, `vendor_cost`, `color_code`, `position`, `fulfillment_type` (dropship / self / hybrid), field-lock flags.
- **product_images / variant_images** — `url` (R2), `alt_text` (SEO), `position`.
- **product_attributes** — `attribute_name`, `attribute_value` (drives filtering).
- **product_tags** — `tag`.

### Inventory & fulfillment tables
- **locations** — fulfillment nodes: our warehouse(s) and each vendor-as-source; `type` (warehouse / vendor), `name`, address/region.
- **inventory** — `variant_id`, `location_id`, `quantity_available`, `quantity_reserved`. Unified availability = sum of available across locations. Prevents overselling.

### Vendor & ingestion tables
- **vendors** — `name`, `status` (whitelisted/paused), contact, default `fulfillment_type`.
- **ingestion_sources** — `vendor_id`, `type` (api / spreadsheet / email / sftp / manual), `config` (endpoint, inbox, schedule), `is_active`.
- **field_mappings** — per source: `source_field` → `canonical_field` + optional transform (unit, currency, value remap). Declarative, so onboarding a new feed = config, not code.
- **ingestion_batches** — one row per received file/email/API run: `source_id`, `received_at`, `status` (received/validated/published/failed), counts, error summary. Audit trail.
- **staging_items** — raw normalised rows awaiting validation/approval before they touch the live catalog.
- **vendor_products** — maps `vendor_sku` → our `variant_id`; `last_synced_at`, sync state.

### Later phases add
`customers`, `addresses`, `carts`, `cart_items`, `orders`, `order_items`, `shipments`, `payments`, `reviews`, `support_tickets`.

### Decisions
- 🟡 **Full variants** (each shade/size = own SKU, price, inventory, images). Required to match Nykaa.
- 🟡 **Full vendor-ready + fulfillment-ready schema from day one.** Vendor, ingestion, inventory, location and `fulfillment_type` structures exist in Phase 1 even if filled manually at first — so later automation needs no rework.

---

## 5. Catalog ingestion (multi-source)

The single most important integration idea: **one canonical catalog, many ingestion sources.** We act as our own **PIM (Product Information Management) hub** — the centre of a hub-and-spoke model. Raw data arrives from many source types; a single pipeline normalises, validates, and publishes it. This is a well-established industry pattern for multi-vendor catalogs.

### 5.1 Source connectors (the "spokes")
All of these feed the *same* pipeline:

| Source type | How it works | Best for |
|-------------|--------------|----------|
| **Vendor API** | Push (webhooks) + scheduled pull. Per-vendor **adapter** translates their API to our format. | Tech-capable vendors, real-time stock/price. |
| **Spreadsheet / CSV upload** | You (or vendor) upload a file in admin; stored in R2; parsed into the pipeline. | Smaller vendors, bulk edits, your manual control. |
| **Scheduled file pull** | Cron fetches from SFTP / a shared Google Sheet / an R2 drop folder. | Vendors who "drop a file" on a schedule. |
| **Email-in** | A dedicated inbox (e.g. `feeds@…`) routed via Cloudflare Email Routing to a Worker that parses the attachment. | Vendors who only email price/stock sheets. |
| **Manual entry** | Admin form to create/edit a product directly. | New items, one-offs, full hands-on control. |

> Adding a new vendor = create an `ingestion_source` + a `field_mapping` (and, for an API vendor, one adapter). The core catalog never changes.

### 5.2 The pipeline (every source funnels through this)
```
receive → normalise → validate → map → (review/approve) → publish (upsert)
```
1. **Receive** — raw payload/file/email lands; an `ingestion_batch` is recorded; raw file kept in R2 for audit.
2. **Normalise** — adapter/parser turns the source format into standard rows.
3. **Validate** — rules catch missing images, bad prices, unknown categories, malformed data *before* it reaches customers.
4. **Map** — `field_mappings` translate source fields → canonical fields (with unit/currency transforms).
5. **Review / approve** — **new items** and large changes land in `staging_items` for a human OK in admin; routine stock/price updates on existing items can auto-publish. (Approval is configurable per source.)
6. **Publish (upsert)** — idempotent upsert keyed on `(vendor_id, vendor_sku)`: existing variants update, genuinely new ones are created. Respects field-ownership locks (Section 3).

### 5.3 Reliability
- Runs through **Queues**: a slow/large feed never blocks the storefront; failures retry with backoff.
- **Idempotent** — re-sending the same file/webhook is harmless (change-detection via row hashing).
- **Partial failure** — one bad row is quarantined with a clear error; the rest of the batch still publishes.
- **Full audit** — every batch, every change, every error is logged and viewable in admin.

---

## 6. Fulfillment models (hybrid)

We support **both** fulfillment methods, selectable per variant via `fulfillment_type`:

| Model | Who ships | Inventory source of truth | Tracking |
|-------|-----------|---------------------------|----------|
| **Dropship** | Vendor ships directly to customer | Vendor stock (via ingestion) | Vendor → ingested back to us → customer |
| **Self-fulfilled** | We ship from our warehouse via a shipping partner | Our own inventory count | We generate the label; partner provides tracking |
| **Hybrid (same product)** | Either source can fulfil | Sum across locations | Depends on which source is chosen |

### 6.1 Unified inventory
Stock lives in the **inventory** table as `(variant × location)`. A variant can have stock in our warehouse *and* at one or more vendors. Customer-facing availability = sum of available across all locations. A single source of truth across nodes is what prevents overselling and stockouts.

### 6.2 Order routing engine
When an order is paid, a routing step decides, **per line item**, where it's fulfilled — considering:
- `fulfillment_type` of the variant,
- live availability at each location,
- (later) cost, region/destination, and delivery speed.

It can **split one order** across multiple sources (e.g. item A dropships from BO International, item B ships from our warehouse). This is standard intelligent order-routing / OMS behaviour.

### 6.3 Stock reservation
At checkout, stock is **reserved** (`quantity_reserved`) so two customers can't buy the last unit. Reservation is released if payment fails or times out.

### 6.4 Shipping partners
- **Self-fulfilled** → integrate a courier **aggregator** (🟡 e.g. Shiprocket) to access many couriers, generate labels, and pull tracking. One integration, many couriers.
- **Dropship** → vendor uses their own shipping; we only **ingest the tracking number** and surface it to the customer.

---

## 7. SEO architecture

Goal: BeyondGorgeous products and category pages rank in Google for relevant searches, with rich results (price, rating, availability).

### 7.1 Rendering — the foundation
- **Server-side rendering / static generation** for all public pages. Google must receive fully-rendered HTML, not a JavaScript shell.
  - ⚠️ Action item: the current category page is a client component (`useParams`). For SEO it must be rebuilt as a **server component**. Tracked in Phase 1.
- Fast Core Web Vitals (Cloudflare edge helps); optimised, lazy-loaded images.
- Mobile-first, responsive (in place).

### 7.2 URL structure
```
/                                         (home)
/{category}/                              e.g. /makeup/
/{category}/{subcategory}/                e.g. /makeup/lipstick/
/product/{product-slug}/                  e.g. /product/beyond-gorgeous-matte-lipstick-ruby/
```
Slugs stored in DB; never change once live (a change requires a 301 to preserve ranking).

### 7.3 Per-page metadata
- Unique `<title>` + meta description (editable via `seo_title` / `seo_description`).
- **Canonical URL** to avoid duplicate content (filter/sort/pagination pages canonical to the clean category URL; filter combinations `noindex`).
- Open Graph + Twitter cards for rich social previews.

### 7.4 Structured data (JSON-LD) — drives rich results
- **Product** — name, brand, image, description, `offers` (price, currency, availability), `aggregateRating` (stars in results). Availability reflects unified inventory.
- **BreadcrumbList**, **Organization**, **WebSite** + `SearchAction`. Later: **Review** schema.

### 7.5 Crawlability
- **XML sitemap** auto-generated from the DB (active products + categories), regenerated on catalog change, submitted to Search Console.
- **robots.txt** — allow public pages; disallow `/admin`, cart, checkout, account, raw filter URLs.
- Internal linking; descriptive image `alt_text` (already a DB field).

### 7.6 Operational SEO
- Google **Search Console**: submit sitemap, monitor coverage & Core Web Vitals.
- Preserve 301s (`.online` → `.in` already done).
- Out-of-stock products stay indexed (availability marked) rather than 404-ing.

### 7.7 SEO build phasing
- **Phase 1:** SSR product/category pages, slugs, metadata, Product + Breadcrumb JSON-LD, sitemap, robots.txt.
- **Phase 3+:** richer offers once real pricing/stock live.
- **Reviews phase:** Review/Rating schema.

---

## 8. AI customer support & Jira

- **Chatbot (Claude API)** answers from: product catalog, the signed-in customer's order data, and a curated FAQ/policies set.
- **Escalation:** unresolved issues (damage, refund, complaint) **auto-create a Jira ticket** with transcript + order context; the customer gets a ticket reference.
- Human agents resolve in Jira Cloud; status can flow back to the customer.
- Guardrails: the bot never performs irreversible actions (refunds, cancellations) itself — it raises a ticket for a human.

---

## 9. API surface

Grouped by caller, each with its own auth model.

| Group | Caller | Auth | Examples |
|-------|--------|------|----------|
| **Storefront API** | Our website | Public / session | list & search products, cart, checkout, order history, chat |
| **Admin API** | You | Cloudflare Access | CRUD products/variants/images, set prices, manage vendors & sources, review ingestion, manage inventory, view/route orders |
| **Ingestion API** | Vendor systems / feeds | API key + signed (HMAC) | inbound stock/price webhooks, feed-pull config, file-upload, email-in handler |
| **Webhook receivers** | Razorpay, couriers | Signature verification | payment confirmed, shipment/tracking updated |
| **Internal jobs** | Cron + Queues | Internal | scheduled feed pulls, ingestion processing, order routing, email dispatch, sitemap regen |

(Concrete endpoint paths detailed per phase as built.)

---

## 10. Technology stack

All Cloudflare-native to stay on the current platform.

| Need | Service | Notes |
|------|---------|-------|
| Hosting / compute | Cloudflare Workers | Already deployed. |
| Framework | Next.js (App Router) | Already in use. |
| Database | Cloudflare D1 (SQLite) | Catalog, inventory, orders, customers. |
| File / image storage | Cloudflare R2 | Product images + raw ingestion feed files. |
| Async jobs | Cloudflare Queues | Ingestion, order routing, emails, retries. |
| Scheduled tasks | Workers Cron Triggers | Feed pulls, sitemap regen. |
| Email ingestion | Cloudflare Email Routing → Worker | Parse vendor feed emails/attachments. |
| Cache / sessions / flags | Cloudflare KV | Fast key-value. |
| Admin auth | Cloudflare Access | Protects `/admin`. |
| AI chatbot | Claude API (latest model) | Customer support. |
| Payments | Razorpay | 🟡 proposed — UPI, cards, net banking, wallets (India). |
| Shipping (self-fulfilled) | Courier aggregator | 🟡 e.g. Shiprocket — many couriers, labels, tracking. |
| Support tickets | Jira Cloud | Escalations. |

---

## 11. Cross-cutting concerns

- **Security:** least-privilege auth per API group; admin behind Cloudflare Access; vendor/ingestion webhooks signature-verified; secrets in Workers secrets store; card data never touches our servers (Razorpay).
- **Resilience:** storefront reads from our own DB (last-known-good); external calls timed-out, retried, circuit-broken; queues absorb spikes/failures.
- **Idempotency:** all ingestion and webhook handlers safe to receive duplicates.
- **Data quality:** validation gates + human approval for new items prevent bad data reaching customers.
- **Observability:** structured logs; per-source ingestion success/failure metrics; alerting on repeated failures, payment errors, low stock.
- **Automation:** scheduled feed pulls, auto-hide discontinued items, auto-regenerate sitemap, auto-create Jira tickets, auto stock-reservation.
- **Privacy/compliance:** minimal customer data; clear policies; secure handling of addresses & order history.

---

## 12. Phased roadmap

| Phase | Status | Deliverables |
|-------|--------|--------------|
| **1 — Catalog + admin + manual ingestion** | 🟡 next | Vendor-/fulfillment-ready D1 schema; `/admin` behind Cloudflare Access; product/category/brand/variant/inventory management; R2 image upload; **manual entry + spreadsheet/CSV bulk upload** through the ingestion pipeline (validate → review → publish); 15–20 dummy "Beyond Gorgeous" products; SSR public pages + SEO foundation (7.7). |
| **2 — Customers + cart** | 🔵 | Signup/login, profiles, cart, wishlist, stock reservation. |
| **3 — Checkout + payments** | 🔵 | Razorpay, order lifecycle, confirmation emails, richer SEO offers. |
| **4 — Fulfillment + vendor automation** | 🔵 | Order routing engine; self-fulfilled shipping via aggregator; dropship order routing + tracking ingestion; automated ingestion (vendor API webhooks, scheduled pulls, email-in). |
| **5 — AI support + Jira** | 🔵 | Chatbot, ticket escalation, FAQ knowledge base. |

Phase 1 uses the full vendor-/fulfillment-ready schema, so later phases require **no rework** of the catalog.

---

## 13. Open decisions

| # | Decision | Status | Default / recommendation |
|---|----------|--------|--------------------------|
| 1 | Schema scope (full vendor/fulfillment-ready vs lean) | 🟡 | Full from day one. |
| 2 | Variants (full vs simple) | 🟡 | Full variants. |
| 3 | Payment gateway | 🟡 | Razorpay (India-first). |
| 4 | Shipping aggregator for self-fulfilled | 🟡 | Shiprocket (many couriers, one integration). |
| 5 | Per-vendor data delivery method | ⚪ | TBD per vendor — confirm if BO International offers API, or spreadsheet/email only. |
| 6 | Email-in address & format conventions | ⚪ | TBD — define a `feeds@` inbox + expected sheet columns. |
| 7 | Which products are self-fulfilled vs dropship at launch | ⚪ | TBD — likely all dropship initially. |
| 8 | Chatbot scope at launch | ⚪ | Start FAQ + order-status; expand later. |

---

## 14. Glossary

- **Modular monolith** — one application, internally divided into clean modules (not separate deployed services).
- **PIM (Product Information Management)** — the central hub that owns and distributes product data; here, our own catalog acts as the PIM.
- **Hub-and-spoke** — many sources (spokes) feed one central hub that normalises and distributes data.
- **Ingestion pipeline** — the standard path every incoming feed follows: receive → normalise → validate → map → approve → publish.
- **Adapter / connector** — a small translator that converts one source's format into our standard format.
- **Field mapping** — declarative config saying "their column X = our field Y" so onboarding a feed needs no new code.
- **Staging** — a holding area where incoming data waits for validation/approval before going live.
- **Idempotent upsert** — inserting-or-updating in a way that's safe to repeat; re-sending the same data causes no duplicates or harm.
- **Dropshipping** — the vendor ships directly to the customer; we hold no stock.
- **Self-fulfilled (merchant-fulfilled)** — we hold inventory and ship it ourselves via a shipping partner.
- **3PL** — third-party logistics; an outside warehouse/shipping provider.
- **Courier aggregator** — one integration (e.g. Shiprocket) that gives access to many courier companies.
- **OMS / order routing** — deciding which location/source fulfils each item of an order.
- **Stock reservation** — temporarily holding stock for an in-progress order to prevent overselling.
- **Overselling** — selling more units than actually available; prevented by unified inventory + reservation.
- **Webhook** — an automatic notification one system sends another when something changes.
- **SSR (server-side rendering)** — the server sends fully-built HTML so search engines and browsers get complete content immediately.
- **JSON-LD / structured data** — machine-readable data in a page that lets Google show rich results (price, stars, breadcrumbs).
- **Canonical URL** — the one "official" URL for a page, told to Google to avoid duplicate-content issues.
- **Slug** — the human-readable part of a URL (e.g. `beyond-gorgeous-matte-lipstick-ruby`).
- **Source of truth** — the single place a given piece of data is authoritatively owned and edited.
- **D1 / R2 / KV / Queues** — Cloudflare's SQL database / file storage / key-value cache / background job system.
- **Cloudflare Email Routing** — routes inbound email to a Worker so feeds sent by email can be parsed automatically.
