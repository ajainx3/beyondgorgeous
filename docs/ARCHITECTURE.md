# BeyondGorgeous — Version 2 Design Document

> Living architecture & design reference for the BeyondGorgeous e-commerce platform.
> Lives in Git, so every change is versioned. Update the version history table below on each meaningful edit.

---

## Document control

| Version | Date | Author | Summary of change |
|---------|------|--------|-------------------|
| 0.1.0 | 2026-06-25 | Ashish Jain (with Claude) | Initial draft: business model, layered architecture, data model, vendor integration, SEO, AI support, API surface, roadmap. |

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
5. [Vendor integration](#5-vendor-integration)
6. [SEO architecture](#6-seo-architecture)
7. [AI customer support & Jira](#7-ai-customer-support--jira)
8. [API surface](#8-api-surface)
9. [Technology stack](#9-technology-stack)
10. [Cross-cutting concerns](#10-cross-cutting-concerns)
11. [Phased roadmap](#11-phased-roadmap)
12. [Open decisions](#12-open-decisions)
13. [Glossary](#13-glossary)

---

## 1. Vision & business model

BeyondGorgeous is a **private-label, vendor-fulfilled beauty brand**. We own the brand, the storefront, the customer relationship, the marketing content, and pricing. Whitelisted vendors (e.g. [BO International](https://www.bointernational.net/)) handle production, labelling, packing, and shipping.

This is *not* a traditional store that holds its own inventory. It is closer to a **supplier-fulfilled single-brand marketplace**. The architecture is therefore designed around two ideas:

1. **Clear ownership of every piece of data** (see Section 3) so vendor data flows in automatically and we never duplicate manual effort.
2. **The storefront must never depend on a vendor's system being fast or online.** Vendor outages degrade gracefully; they never take the shop down.

### Goals
- Robustness and easy maintainability.
- Automation of catalog data (stock, price, availability) from vendor systems.
- A real, sellable catalog managed by us, organised in proper categories.
- AI customer support with escalation to human agents via Jira.
- Strong organic discoverability on Google (see Section 6).

### Owned domains
- `beyondgorgeous.in` — 🟢 primary, live.
- `www.beyondgorgeous.in` — 🟢 live.
- `beyondgorgeous.online` / `www.beyondgorgeous.online` — 🟢 301-redirect to `.in`.
- `beyondgorgeous.app` — 🔵 reserved for future mobile app / PWA / API host.

---

## 2. Architecture overview

The system is a **modular monolith** running on Cloudflare Workers — one deployable application, cleanly divided into modules inside. We deliberately avoid microservices: at our scale they would add large operational complexity for no benefit. Clean internal boundaries keep the option open to split later if ever needed.

### Layers (top to bottom)

| Layer | Responsibility |
|-------|----------------|
| **Actors** | Customers, you (admin), vendors, support agents. |
| **Edge / UI** | Next.js storefront + admin panel, server-rendered on Cloudflare Workers. |
| **Application core** | Modules: Catalog, Cart & Orders, Customers, Support & AI. |
| **Integration layer** | Your adapters to the outside world: vendor connectors, payments, shipping, AI + Jira. |
| **Async backbone** | Queues (async jobs, retries) and Cron triggers (scheduled sync). |
| **Data stores** | D1 (SQL), R2 (images), KV (cache/sessions/flags). |
| **External partners** | Vendor systems, Razorpay, courier APIs, Jira Cloud, Claude API. |

> A rendered diagram of these layers is maintained in the chat/visual companion to this doc. Keep this table as the canonical text version.

### Key flows
- **Browse/buy:** Customer → storefront → catalog/cart/orders → D1 → render.
- **Vendor sync:** Vendor → (webhook or polled by Cron) → Queue → vendor adapter → normalise → D1.
- **Order fulfilment:** Order paid → routed to the vendor that makes each item → vendor ships → tracking flows back → customer notified.
- **Support escalation:** Chatbot can't resolve → creates Jira ticket with order + conversation context → agent handles it.

---

## 3. Core principle: source of truth & field ownership

**Every field has exactly one owner.** We never hand-edit a vendor-owned field; the vendor never touches a we-owned field. This is what removes manual catalog maintenance.

| Field | Owner | Updated by | Notes |
|-------|-------|-----------|-------|
| Product name, description, "how to use" | **Us** | Admin panel | Marketing content. |
| Images, marketing tags/badges | **Us** | Admin panel | e.g. "Bestseller". |
| Selling price | **Us** | Admin (markup rule over cost) | Customer-facing price. |
| Vendor cost price | Vendor | Auto-sync | Basis for our margin. |
| Stock / availability | Vendor | Auto-sync | "Out of stock" flips automatically. |
| Lead time, weight, dimensions | Vendor | Auto-sync | Feeds shipping calc. |
| Discontinued flag | Vendor | Auto-sync | Auto-hides product from store. |

**Override locks:** every vendor-owned field carries an optional lock. When locked, sync skips that field and our manual value wins. This gives us full control when we need it without losing automation everywhere else.

> Example: a product going out of stock requires *no* manual action — `stock` is vendor-owned and syncs on its own. This is the default behaviour, not a special feature.

---

## 4. Data model

Stored in **Cloudflare D1** (SQLite). Core entities and relationships:

```
brands (1) ───< products
categories (self-referencing tree) (1) ───< products
products (1) ───< variants            (shades / sizes)
products (1) ───< product_images
products (1) ───< product_attributes  (filterable: skin type, finish, concern…)
products (1) ───< product_tags        (Bestseller, New…)
variants (1) ───< variant_images
vendors  (1) ───< vendor_products ───(maps to)─── products / variants
```

### Key tables (conceptual)

- **categories** — hierarchical (parent_id self-reference), `name`, `slug`, `position`, `seo_title`, `seo_description`, `image`.
- **brands** — `name`, `slug`, `logo`, `description`.
- **products** — `name`, `slug`, `brand_id`, `category_id`, `description`, `how_to_use`, `ingredients`, `additional_info`, `status` (draft/active/archived), `seo_title`, `seo_description`, marketing fields, timestamps.
- **variants** — `product_id`, `name` (e.g. shade/size), `sku`, `mrp`, `selling_price`, `vendor_cost`, `stock`, `color_code`, `position`, field-lock flags.
- **product_images / variant_images** — `url` (R2), `alt_text` (SEO), `position`.
- **product_attributes** — `product_id`, `attribute_name`, `attribute_value` (drives filtering).
- **product_tags** — `product_id`, `tag`.
- **vendors** — `name`, `status` (whitelisted/paused), `adapter_key`, credentials reference, contact.
- **vendor_products** — maps a vendor's SKU to our product/variant; holds `vendor_sku`, `last_synced_at`, sync state.

Later phases add: `customers`, `addresses`, `carts`, `cart_items`, `orders`, `order_items`, `payments`, `shipments`, `reviews`, `support_tickets`.

### Variants decision
🟡 **Full variants** (each shade/size has its own SKU, price, stock, images). Beauty products require this to match Nykaa. Alternative (simple one-price products) rejected — would force a migration later.

### Schema scope decision
🟡 **Full vendor-ready schema from day one.** Vendor tables and field-ownership locks are created in Phase 1 even though they are filled manually at first. This avoids rework when automation lands in Phase 4.

---

## 5. Vendor integration

### Adapter pattern
Each vendor has a different API. We isolate that behind a per-vendor **adapter** — a small translator that speaks the vendor's format on one side and our standard catalog format on the other. The core system only ever sees the standard format. Onboarding a new vendor = writing one new adapter; nothing else changes.

### Sync mechanisms (layered for safety)
1. **Webhooks (push)** — vendor notifies us instantly on stock/price change. Fast, but not solely trusted.
2. **Scheduled poll (pull)** — a Cron job periodically asks each vendor "what changed?". Safety net for missed webhooks.
3. **Manual re-sync** — admin button to force a refresh.

All sync runs through **Queues**: a slow/down vendor never blocks the storefront, and failed jobs retry with backoff. Webhook handlers are **idempotent** (safe to receive the same event twice).

### Order routing / fulfilment
Because each product/variant maps to a vendor, an order automatically routes each line item to the correct vendor for fulfilment — including splitting a single order across multiple vendors. Courier tracking returns via webhook and updates the order; the customer is notified.

### Resilience rules
- Storefront reads from our D1 (last-known-good), never live from a vendor.
- Vendor down → we keep serving cached catalog; sync resumes when it recovers.
- Every external call has timeouts, retries, and circuit-breaking.

---

## 6. SEO architecture

Goal: BeyondGorgeous products and category pages rank in Google for relevant product and keyword searches, and show rich results (price, rating, availability).

### 6.1 Rendering — the foundation
- **Server-side rendering / static generation** for all public pages (Next.js on Workers). Google must receive fully-rendered HTML, not an empty shell filled by JavaScript.
  - ⚠️ Action item: the current category page is a client component (`useParams`). For SEO it must be re-built as a **server component** that renders product data in the HTML. Tracked in Phase 1.
- Fast Core Web Vitals — Cloudflare's edge already helps; we keep images optimised and lazy-loaded.
- Mobile-first, responsive (already in place).

### 6.2 URL structure
Clean, keyword-rich, stable slugs:
```
/                                         (home)
/{category}/                              e.g. /makeup/
/{category}/{subcategory}/                e.g. /makeup/lipstick/
/product/{product-slug}/                  e.g. /product/beyond-gorgeous-matte-lipstick-ruby/
```
- Slugs are stored in the DB and never change once live (changing a slug requires a 301 redirect to preserve ranking).

### 6.3 Per-page metadata
Every page emits:
- Unique `<title>` and meta description (editable per product/category via `seo_title` / `seo_description` fields).
- **Canonical URL** to prevent duplicate-content penalties (critical for filtered/sorted/paginated listing pages — those carry a canonical pointing to the clean category URL, and filter combinations are `noindex`).
- Open Graph + Twitter Card tags for rich social sharing previews.

### 6.4 Structured data (JSON-LD) — drives rich results
Injected into page HTML so Google can show enhanced listings:
- **Product** schema — name, brand, image, description, `offers` (price, currency, availability), `aggregateRating` (stars in search results). Availability auto-reflects vendor stock.
- **BreadcrumbList** — shows the category path in search results.
- **Organization** — brand identity, logo, social profiles.
- **WebSite** + `SearchAction` — enables a Google sitelinks search box.
- Later: **Review** schema once customer reviews exist.

### 6.5 Crawlability
- **XML sitemap**, auto-generated from the database (all active products + categories), regenerated on catalog change and submitted to Google Search Console.
- **robots.txt** — allow public pages; disallow `/admin`, cart, checkout, account, and raw filter URLs.
- Internal linking: categories link to products, related products link to each other.
- All images carry descriptive `alt_text` (already a DB field).

### 6.6 Operational SEO
- Register the site in **Google Search Console**; submit sitemap; monitor coverage & Core Web Vitals.
- 301 redirects preserved (e.g. `.online` → `.in` already done).
- Out-of-stock products stay indexed (with availability marked) rather than 404-ing, to retain ranking.

### 6.7 SEO build phasing
SEO is layered in across phases, not bolted on at the end:
- **Phase 1:** SSR product/category pages, slugs, metadata, Product + Breadcrumb JSON-LD, sitemap, robots.txt.
- **Phase 3+:** richer offers data once real pricing/stock is live.
- **Reviews phase:** Review/Rating schema.

---

## 7. AI customer support & Jira

- **Chatbot (Claude API)** answers from three context sources: the product catalog, the signed-in customer's own order data ("where is my order?"), and a curated FAQ/policies set.
- **Escalation:** when the bot cannot resolve an issue (damage, refund, complaint), it **auto-creates a Jira ticket** containing the conversation transcript and order context, and returns the ticket reference to the customer.
- Human agents resolve tickets in Jira Cloud; status updates can flow back to the customer.
- Guardrails: the bot never performs irreversible actions (refunds, cancellations) on its own — it raises a ticket for a human.

---

## 8. API surface

APIs are grouped by caller, each with its own auth model.

| Group | Caller | Auth | Examples |
|-------|--------|------|----------|
| **Storefront API** | Our website | Public / session | list & search products, cart, checkout, order history, chat |
| **Admin API** | You | Cloudflare Access | CRUD products/variants/images, set prices, manage vendors, view orders |
| **Vendor API** | Vendor systems | API key + signed (HMAC) webhooks | inbound stock/price/shipment updates |
| **Webhook receivers** | Razorpay, couriers | Signature verification | payment confirmed, shipment updated |
| **Internal jobs** | Cron + Queues | Internal | scheduled vendor sync, email/notification dispatch, sitemap regen |

(Concrete endpoint paths to be detailed per phase as they are built.)

---

## 9. Technology stack

All Cloudflare-native to stay on the current platform.

| Need | Service | Notes |
|------|---------|-------|
| Hosting / compute | Cloudflare Workers | Already deployed. |
| Framework | Next.js (App Router) | Already in use. |
| Database | Cloudflare D1 (SQLite) | Catalog, orders, customers. |
| Image storage | Cloudflare R2 | Product images; 10 GB free tier. |
| Async jobs | Cloudflare Queues | Vendor sync, emails, retries. |
| Scheduled tasks | Workers Cron Triggers | Polling sync, sitemap regen. |
| Cache / sessions / flags | Cloudflare KV | Fast key-value. |
| Admin auth | Cloudflare Access | Protects `/admin`. |
| AI chatbot | Claude API (latest model) | Customer support. |
| Payments | Razorpay | 🟡 proposed — UPI, cards, net banking, wallets (India). |
| Support tickets | Jira Cloud | Escalations. |

---

## 10. Cross-cutting concerns

- **Security:** least-privilege auth per API group; admin behind Cloudflare Access; vendor webhooks signature-verified; secrets in Workers secrets store; no credentials in code. Payment card data never touches our servers (handled by Razorpay).
- **Resilience:** storefront reads from our own DB; external calls are timed-out, retried, and circuit-broken; queues absorb spikes and failures.
- **Idempotency:** all webhook handlers safe to receive duplicates.
- **Observability:** structured logs, sync success/failure metrics per vendor, alerting on repeated sync failures or payment errors.
- **Automation:** scheduled vendor sync, auto-hide discontinued products, auto-regenerate sitemap, auto-create Jira tickets.
- **Privacy/compliance:** collect minimal customer data; clear policies; secure handling of addresses and order history.

---

## 11. Phased roadmap

| Phase | Status | Deliverables |
|-------|--------|--------------|
| **1 — Catalog + admin** | 🟡 next | Vendor-ready, variant-capable D1 schema; password-protected `/admin`; product/category/brand/variant management; R2 image upload; 15–20 dummy "Beyond Gorgeous" products; SSR public product & category pages with SEO foundation (Section 6.7). |
| **2 — Customers + cart** | 🔵 | Signup/login, profiles, cart, wishlist. |
| **3 — Checkout + payments** | 🔵 | Razorpay, order lifecycle, confirmation emails, richer SEO offers. |
| **4 — Vendor automation** | 🔵 | Vendor adapters, stock/price sync, order routing to vendors, courier tracking. |
| **5 — AI support + Jira** | 🔵 | Chatbot, ticket escalation, FAQ knowledge base. |

Phase 1 uses the vendor-ready schema so later phases require **no rework** of the catalog.

---

## 12. Open decisions

| # | Decision | Status | Default / recommendation |
|---|----------|--------|--------------------------|
| 1 | Schema scope (full vendor-ready vs lean) | 🟡 | Full vendor-ready from day one. |
| 2 | Variants (full vs simple) | 🟡 | Full variants. |
| 3 | Payment gateway | 🟡 | Razorpay (India-first). |
| 4 | First real vendor & their API capabilities | ⚪ | TBD — confirm BO International's integration options. |
| 5 | Courier/shipping partner | ⚪ | TBD — e.g. Shiprocket (aggregator) vs direct. |
| 6 | Chatbot scope at launch | ⚪ | Start FAQ + order-status; expand later. |

---

## 13. Glossary

- **Modular monolith** — one application, internally divided into clean modules (not separate deployed services).
- **Adapter** — a small translator module that converts one vendor's data format to our standard format.
- **Webhook** — an automatic notification one system sends another when something changes.
- **Idempotent** — an operation that has the same result whether it runs once or many times (so duplicate webhooks are harmless).
- **SSR (server-side rendering)** — the server sends fully-built HTML so search engines and browsers get complete content immediately.
- **JSON-LD / structured data** — machine-readable data embedded in a page that lets Google show rich results (price, stars, breadcrumbs).
- **Canonical URL** — the one "official" URL for a page, told to Google to avoid duplicate-content issues.
- **Slug** — the human-readable part of a URL (e.g. `beyond-gorgeous-matte-lipstick-ruby`).
- **Source of truth** — the single place a given piece of data is authoritatively owned and edited.
- **D1 / R2 / KV / Queues** — Cloudflare's SQL database / file storage / key-value cache / background job system.
