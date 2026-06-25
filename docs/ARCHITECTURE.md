# BeyondGorgeous — Version 2 Design Document

> Living architecture & design reference for the BeyondGorgeous e-commerce platform.
> Lives in Git, so every change is versioned. Update the version history table below on each meaningful edit.

---

## Document control

| Version | Date | Author | Summary of change |
|---------|------|--------|-------------------|
| 0.1.0 | 2026-06-25 | Ashish Jain (with Claude) | Initial draft: business model, layered architecture, data model, vendor integration, SEO, AI support, API surface, roadmap. |
| 0.2.0 | 2026-06-25 | Ashish Jain (with Claude) | Multi-source catalog ingestion (PIM hub) and hybrid fulfillment (dropship + self-fulfilled) with order routing. |
| 0.3.0 | 2026-06-25 | Ashish Jain (with Claude) | Marketplace-ready (seller + listing/offer model, single-seller launch) and ERP-style inventory & replenishment. |
| 0.4.0 | 2026-06-25 | Ashish Jain (with Claude) | Multi-role design review folded in: customers/guest-checkout/phone-OTP, orders + returns/refunds, payments incl. COD + RBI tokenization, promotions/coupons, notifications (email/SMS/WhatsApp), tax/GST & invoicing, content/merchandising/reviews, data & platform architecture (data-access layer, search index, event/outbox, money minor units, API versioning), engineering foundations (Phase 0), batch/lot + expiry (FEFO) and vendor scorecards, and a compliance & legal section (DPDP, e-commerce rules + grievance officer, cosmetics/CDSCO). |

**Versioning scheme:** `MAJOR.MINOR.PATCH` — MAJOR = fundamental change; MINOR = new section/subsystem/phase; PATCH = clarification/fix.

**Status legend:** 🟢 decided · 🟡 proposed / default · 🔵 future · ⚪ open question.

---

## Table of contents

1. [Vision & business model](#1-vision--business-model)
2. [Architecture overview](#2-architecture-overview)
3. [Source of truth & field ownership](#3-source-of-truth--field-ownership)
4. [Data model](#4-data-model)
5. [Marketplace readiness](#5-marketplace-readiness)
6. [Catalog ingestion (multi-source)](#6-catalog-ingestion-multi-source)
7. [Fulfillment, serviceability & COD](#7-fulfillment-serviceability--cod)
8. [Inventory & replenishment (ERP)](#8-inventory--replenishment-erp)
9. [Customers, accounts & checkout](#9-customers-accounts--checkout)
10. [Orders, returns & refunds](#10-orders-returns--refunds)
11. [Payments](#11-payments)
12. [Promotions & pricing](#12-promotions--pricing)
13. [Notifications & messaging](#13-notifications--messaging)
14. [Tax & invoicing (GST)](#14-tax--invoicing-gst)
15. [Content, merchandising & reviews](#15-content-merchandising--reviews)
16. [SEO architecture](#16-seo-architecture)
17. [AI customer support & Jira](#17-ai-customer-support--jira)
18. [Data & platform architecture](#18-data--platform-architecture)
19. [Engineering foundations & delivery](#19-engineering-foundations--delivery)
20. [API surface](#20-api-surface)
21. [Technology stack](#21-technology-stack)
22. [Cross-cutting concerns](#22-cross-cutting-concerns)
23. [Compliance & legal](#23-compliance--legal)
24. [Phased roadmap](#24-phased-roadmap)
25. [Open decisions](#25-open-decisions)
26. [Glossary](#26-glossary)

---

## 1. Vision & business model

BeyondGorgeous is a **private-label beauty brand** with a **hybrid supply-and-fulfilment model**, designed to be **marketplace-ready** and **India-first**. We own the brand, storefront, customer relationship, content, and pricing. Behind us sit **multiple whitelisted vendors** (e.g. [BO International](https://www.bointernational.net/)) for dropship, plus **our own stock** for self-fulfilled lines.

**Launch posture:** single-seller store, **seller-aware** schema so third-party sellers can be added later without a rebuild. **India-first** means: INR pricing, GST-compliant invoices, **cash-on-delivery (COD)**, **phone-OTP login**, **guest checkout**, and **WhatsApp/SMS** notifications.

### Guiding ideas
1. **One owner per field** (Section 3) — external data flows in automatically.
2. **One canonical catalog, many ingestion sources** (Section 6).
3. **Marketplace-ready, single-seller launch** (Section 5).
4. **Stock as a ledger, with batch & expiry** (Section 8).
5. **Compliance and engineering foundations are designed in, not bolted on** (Sections 19, 23).
6. **API-first / headless** so the future `.app` mobile client reuses the same APIs (Section 18).
7. **The storefront never depends on a vendor being fast or online** — last-known-good caching, graceful degradation.

### Owned domains
- `beyondgorgeous.in` (primary, live) · `www.beyondgorgeous.in` (live) · `beyondgorgeous.online`/`www` (301 → `.in`) · `beyondgorgeous.app` (🔵 reserved: mobile app / PWA / API host).

---

## 2. Architecture overview

A **modular monolith** on Cloudflare Workers — one deployable app, cleanly divided into modules; microservices deliberately avoided at this scale.

| Layer | Responsibility |
|-------|----------------|
| **Actors** | Customers, founder/admin, vendors, sellers (future), support agents. |
| **Edge / UI** | Next.js storefront + admin panel, server-rendered on Workers. |
| **Application core** | Catalog · Marketplace/Listings · Ingestion · Customers & Auth · Cart & Checkout · Orders & Returns · Payments · Promotions · Fulfillment · Inventory & Replenishment · Notifications · Tax · Content & Reviews · Support & AI. |
| **Integration layer** | Adapters: ingestion sources, payments (Razorpay), shipping/serviceability, purchasing (POs), messaging (email/SMS/WhatsApp), AI, Jira. |
| **Async backbone** | Queues + an **outbox/event log** (reliable side-effects); Cron triggers (sync, replenishment). |
| **Data stores** | D1 (SQL, via a data-access layer), R2 (images + feed files), KV (cache/sessions/flags), a **search index**, an **analytics/event sink**. |
| **External partners** | Vendor systems, Razorpay, courier APIs, messaging providers, Jira Cloud, Claude API. |

---

## 3. Source of truth & field ownership

Every field has exactly one owner; we never hand-edit a vendor-owned field and vice-versa. Override **locks** let our manual value win per field when needed.

| Field | Owner | Updated by |
|-------|-------|-----------|
| Name, description, how-to-use, images, tags | Us / seller | Admin |
| Selling price | Seller (us at launch) | Listing |
| Vendor cost, lead time | Vendor | Ingestion |
| Stock — dropship | Vendor | Ingestion (auto) |
| Stock — self-fulfilled | Us | Stock ledger (Section 8) |
| Discontinued | Vendor | Ingestion (auto-hides listing) |

---

## 4. Data model

Cloudflare D1 (SQL), accessed through a thin **data-access layer** (Section 18) to avoid lock-in. **All monetary values are integer minor units (paise) + a currency code — never floats.** Grouped by concern:

- **Catalog:** categories (tree), brands, products (canonical spec), variants (SKUs), product/variant images (with `alt_text`), product_attributes, product_tags.
- **Marketplace:** sellers (house seller #1), listings (offers: seller + variant + price + fulfillment_type + status). Cart/orders reference **listings**.
- **Inventory & fulfilment:** locations; **stock_ledger** (immutable movements) → **inventory_snapshot** (on_hand, reserved, available); **lots/batches** (`batch_no`, `mfg_date`, `expiry_date`, qty) for **FEFO**; reorder_policies; purchase_orders / po_lines; goods_receipts; stock_alerts; vendor_scorecards.
- **Customers & auth:** customers, **auth_identities** (phone-OTP primary; email/social optional), addresses (Indian format + pincode), carts, cart_items (→ listing), wishlists, **back_in_stock_subscriptions**.
- **Orders & returns:** orders (with a **state machine**, seller stamped per item), order_items (→ listing, with tax + batch allocated), shipments, **returns/RMA**, refunds, cancellations.
- **Payments:** payment_methods (incl. **COD**), payments/transactions, **idempotency_keys**, reconciliations, refunds.
- **Promotions:** coupons, discount_rules, applied_discounts.
- **Tax:** tax_rates, **hsn_codes**, invoices (GST), credit_notes.
- **Notifications:** templates, notification_log (email/SMS/WhatsApp), consent flags.
- **Content & reviews:** cms_blocks (banners/collections), blog_posts, reviews (with photos + moderation), product_recommendations.
- **Vendor & ingestion:** vendors (internal/external), ingestion_sources, field_mappings, ingestion_batches, staging_items, vendor_products.
- **Platform:** events/outbox, audit_log, feature_flags, consents (DPDP).

### Key data decisions
- 🟡 Full variants; product/listing separation; stock-ledger inventory **with batch/expiry**; money as **minor units + currency**; **idempotency keys** on payment/order writes; seller/fulfillment/inventory/compliance-ready schema from Phase 1.

---

## 5. Marketplace readiness

Single-seller launch, seller-aware design. The hinge: separate catalog **product** from a seller's **listing/offer**, and have **cart & orders reference the listing**. Sellers seeded with the house seller; third-party sellers are additive later. Choose **Razorpay Route** (split settlement) so future payouts need no re-integration. Future (not built now): seller onboarding & KYC, portal, multi-offer **buy box**, commissions/payouts, per-seller shipping/ratings/tax/store-pages.

---

## 6. Catalog ingestion (multi-source)

BeyondGorgeous is its own **PIM hub** (hub-and-spoke). Sources — **vendor API** (adapter; webhooks + pull), **spreadsheet/CSV upload**, **scheduled file pull** (SFTP/Google Sheet/R2), **email-in** (Cloudflare Email Routing → Worker), **manual entry** — all funnel into one pipeline:

`receive → normalise → validate → map → (review/approve) → publish (idempotent upsert)`

New items/large changes pause for approval; routine stock/price auto-publish. Runs on Queues (non-blocking, retried, idempotent, audited). Onboarding a vendor = an `ingestion_source` + `field_mapping` (+ one adapter for APIs).

---

## 7. Fulfillment, serviceability & COD

Per-listing `fulfillment_type`:

| Model | Who ships | Inventory truth | Tracking |
|-------|-----------|-----------------|----------|
| Dropship | Vendor | Vendor (ingested) | Ingested back |
| Self-fulfilled | Us, via courier aggregator | Stock ledger | From partner |
| Hybrid | Either | Sum across locations | Per source |

An **order-routing engine** chooses a source per line item (type, availability, later cost/destination) and can split an order. Stock is **reserved** atomically at checkout (D1 transaction) to prevent oversell. Self-fulfilled ships via a courier **aggregator** (e.g. Shiprocket); dropship uses vendor shipping with tracking ingested.

**India specifics:** **pincode serviceability** check (delivery + COD availability) at product and checkout; **COD** supported with **RTO (return-to-origin) handling** and reconciliation; COD fraud controls (order limits, risk flags).

---

## 8. Inventory & replenishment (ERP)

- **Stock as a ledger** — on-hand derived from movements (receipt/sale/return/adjustment/transfer); auditable.
- **Batch/lot & expiry** — cosmetics carry MFG/expiry/batch; we track lots and allocate by **FEFO (first-expiry-first-out)**, support expiry alerts and **recall** by batch.
- **States per SKU/location:** on_hand, reserved, available (= on_hand − reserved), on_order, projected (= available + on_order).
- **Reorder policy per SKU:** safety_stock, reorder_point, reorder_qty (EOQ later), lead_time, preferred_vendor (internal/external), `replenishment_mode` = **auto_po** / **approval** / **alert_only**.
- **Replenishment engine** (Cron + event-driven); **purchase orders** (draft→sent→confirmed→received) sent outbound via the integration layer (API/email); **goods receipt** with QC posts ledger entries; low/out/overstock + overdue-PO **alarms → Jira**.
- **Vendor scorecards** — lead-time adherence, defect/RTO rate → drive preferred-vendor selection.
- **Costing** — landed cost for margin; **ABC/XYZ**, dead-stock/aging, and demand forecasting later (data captured from the ledger now).

---

## 9. Customers, accounts & checkout

- **Guest checkout** is first-class (no forced registration); an account can be created post-purchase from the same details.
- **Auth:** **phone number + OTP** is the primary method (India); email/password and social optional. Sessions in KV. Rate-limited; **Turnstile** on auth and checkout to deter abuse.
- **Addresses:** Indian format with pincode; serviceability-aware; multiple saved addresses.
- **Cart & wishlist:** cart_items reference listings; cart survives login (merge guest → account); **back-in-stock** subscriptions tie to inventory.

---

## 10. Orders, returns & refunds

- **Order state machine:** created → payment_pending → confirmed → processing → (per-item) shipped → delivered → closed; plus cancelled, returned, refunded, RTO. Supports **partial fulfilment/shipment** and per-seller splits.
- **Cancellations** (pre-dispatch) and **returns/RMA** (post-delivery) with reasons, windows, and approval; reverse pickup via courier; **refunds** to original method (or store credit), with COD refunds via UPI/bank.
- Returned stock re-enters the ledger (with QC and batch/expiry check).
- Every transition emits an **event** (outbox) → notifications, analytics, ERP.

---

## 11. Payments

- **Gateway:** Razorpay (UPI, cards, net-banking, wallets), **Route-capable** for future seller payouts.
- **COD:** supported as a payment method with serviceability gating, COD fees (optional), and reconciliation on delivery.
- **Compliance:** PCI scope kept with Razorpay; **RBI card-tokenization** (never store raw card data).
- **Reliability:** **idempotency keys** on payment/order creation; signed payment **webhooks**; reconciliation jobs; **abandoned-cart / failed-payment recovery** via notifications.

---

## 12. Promotions & pricing

- **Coupon engine** (e.g. `GORGEOUS20`): code, type (percent/amount/free-ship), scope (cart/category/product/seller), constraints (min cart, usage limits, validity, first-order), stacking rules.
- **Automatic discount rules** (e.g. "buy 2 get 1") and price lists; margin guardrails using landed cost.
- Applied discounts recorded per order for accounting and reporting.

---

## 13. Notifications & messaging

- A **notifications service** abstracts channels: **email, SMS, WhatsApp** (WhatsApp Business API via a provider — key for India), and in-app.
- Driven by **domain events** (order placed/shipped/delivered, OTP, refund, back-in-stock, abandoned cart) through the outbox for guaranteed delivery; templated and consent-aware.
- Provider-agnostic adapters so SMS/WhatsApp/email providers can be swapped.

---

## 14. Tax & invoicing (GST)

- **GST from day one:** tax computed per line using **HSN codes** and applicable rates (CGST/SGST/IGST by state); **compliant tax invoices** generated and stored (R2), with credit notes for returns; e-invoicing if turnover thresholds are crossed.
- Tax is a distinct module so rules can change without touching catalog/orders; per-seller GST handled when marketplace opens.

---

## 15. Content, merchandising & reviews

- **CMS-lite:** manage homepage banners, **collections**, featured lists, and a **blog** (how-to/ingredient content — the dominant organic-traffic driver for beauty) from admin, instead of hardcoding.
- **Merchandising:** bundles, cross-sell/upsell, "shop the look", and later **personalised recommendations** (an AI opportunity).
- **Reviews/UGC:** ratings + text + photos, verified-purchase badge, **moderation**; feeds Review structured data (Section 16) and conversion.

---

## 16. SEO architecture

- **Server-side rendering** for all public pages (⚠️ rebuild the current client-component category page server-side — Phase 1). Define an **SSR/ISR + edge-cache** strategy with **tag-based invalidation** on catalog change.
- **Clean stable slugs**; per-page title/description/**canonical** (filters `noindex`); Open Graph/Twitter cards.
- **Structured data (JSON-LD):** Product (price, availability, rating), BreadcrumbList, Organization, WebSite+SearchAction, **Review**.
- **Crawlability:** auto sitemap (regenerated on change), robots.txt, image `alt_text`, **Cloudflare Images** optimisation, Core Web Vitals budget; Google Search Console.
- Out-of-stock pages stay indexed with availability marked; future seller store pages get their own canonical URLs.

---

## 17. AI customer support & Jira

Claude-powered chatbot grounded in catalog, the signed-in customer's orders, and FAQ/policies. Unresolved issues **auto-create a Jira ticket** with context; the bot never performs irreversible actions (refunds/cancellations) — it escalates. Shares the Jira integration with inventory alarms (Section 8).

---

## 18. Data & platform architecture

Cross-system technical decisions that protect scalability:

- **Data-access layer** — all DB access goes through a repository layer, so D1 can be replaced (or augmented) without rewriting business logic. Avoids lock-in.
- **D1 scalability cap** — D1 (SQLite) has single-primary writes and size/concurrency limits. Catalog/orders fit well; **search, filtering, and analytics will outgrow it**, so:
  - **Search index** — product search/facets via a dedicated index (Cloudflare AI Search / external), not `LIKE` on D1.
  - **Analytics/event sink** — high-volume events go to an analytics store, **not** D1.
- **Event/outbox pattern** — domain events are persisted (outbox) and dispatched via Queues so side-effects (notifications, analytics, ERP) are never lost.
- **API-first / headless** — storefront, admin, and future mobile app (`.app`) all consume the same versioned APIs.
- **API versioning** — all public APIs under `/v1`; additive evolution, deprecate with notice.
- **Money** — integer minor units + currency code everywhere.
- **Idempotency** — idempotency keys on all mutating commerce endpoints and webhooks.

---

## 19. Engineering foundations & delivery

Established up front (Phase 0) — non-negotiable before real money flows:

- **Environments:** separate dev / staging / production (Cloudflare) with isolated D1/R2/KV and secrets.
- **CI/CD:** automated build, test, and deploy; preview deployments per branch; no direct-to-prod from a laptop.
- **Database migrations:** disciplined, versioned D1 schema migrations (Wrangler), applied through CI.
- **Testing:** unit tests + **Playwright** e2e for critical flows (checkout, payment, returns); a QA gate per phase.
- **Observability:** structured logs, metrics, **error tracking**, alerts, and **SLOs**; per-source ingestion and replenishment metrics.
- **Backups & DR:** scheduled **D1 exports**, **R2 versioning**, documented recovery.
- **Security hardening:** Cloudflare **WAF**, **rate limiting**, bot management, **Turnstile** on auth/checkout (anti-carding); secret + dependency scanning; least-privilege.
- **Performance:** Cloudflare Images (replace `unoptimized: true`), performance budgets, edge caching.
- **Frontend system:** a reusable **component/design system**, accessibility (**WCAG/ARIA**), skeleton/error states, analytics event instrumentation, PWA-readiness for `.app`.

---

## 20. API surface

| Group | Caller | Auth | Examples |
|-------|--------|------|----------|
| Storefront `/v1` | Website / app | Public / session | products, listings, search, cart, checkout, orders, returns, chat |
| Admin `/v1` | Founder | Cloudflare Access | catalog, listings, inventory, POs, orders, returns, promotions, content, CMS |
| Seller `/v1` (future) | Sellers | Seller auth, scoped | own listings, stock, orders, payouts |
| Ingestion | Vendors / feeds | API key + signed | stock/price webhooks, uploads |
| Purchasing (outbound) | Us → vendors | Per-vendor creds | send/receive POs |
| Webhooks | Razorpay, couriers, messaging | Signature verified | payment, shipment, message status |
| Internal jobs | Cron + Queues + outbox | Internal | feed pulls, replenishment, routing, notifications, sitemap, reconciliation |

---

## 21. Technology stack

| Need | Service |
|------|---------|
| Compute / framework | Cloudflare Workers + Next.js (App Router) |
| Database | Cloudflare D1 (SQL) via data-access layer |
| Search | Dedicated search index (Cloudflare AI Search / external) |
| File / image storage | Cloudflare R2 + **Cloudflare Images** |
| Async / events | Cloudflare Queues + outbox; Cron Triggers |
| Email ingestion | Cloudflare Email Routing → Worker |
| Cache / sessions / flags | Cloudflare KV |
| Admin auth | Cloudflare Access |
| Customer auth | Phone-OTP (provider) + sessions in KV |
| AI chatbot | Claude API (latest model) |
| Payments | Razorpay (+ Route, COD) |
| Shipping | Courier aggregator (e.g. Shiprocket) |
| Messaging | Email + SMS + WhatsApp providers |
| Bot/security | Turnstile, WAF, rate limiting |
| Support tickets | Jira Cloud |
| Observability | Logs/metrics + error tracking |

---

## 22. Cross-cutting concerns

- **Security:** least-privilege per API group; admin behind Cloudflare Access; signed webhooks; secrets store; WAF/rate-limit/Turnstile; RBI tokenization; seller_id row isolation.
- **Resilience:** storefront reads last-known-good; external calls timed-out/retried/circuit-broken; queues + outbox absorb failures.
- **Idempotency:** all commerce mutations and webhooks safe to repeat.
- **Auditability:** stock ledger, ingestion batches, and an audit_log give full history.
- **Observability:** logs, metrics, error tracking, SLOs, alerts.
- **Privacy/compliance:** consent capture, minimal data, retention limits (Section 23).

---

## 23. Compliance & legal (India)

Treated as a first-class workstream (parallel to Phases 0–3):

- **Consumer Protection (E-Commerce) Rules, 2020** — published **return/refund/shipping policies**, seller/contact details, and a **Grievance Officer** (mandatory).
- **GST** — registration, compliant tax invoices (HSN, GSTIN), credit notes, e-invoicing if threshold crossed.
- **DPDP Act 2023** — consent capture (incl. cookie/analytics consent), privacy policy, data-principal rights, breach notification, retention limits.
- **Cosmetics regulation** — Drugs & Cosmetics Act / CDSCO labeling rules; import licensing if imported; accurate ingredient/claim data; expiry/batch handling (Section 8).
- **Payments** — PCI via Razorpay; RBI card-tokenization (no card storage).
- **Marketplace (future)** — seller KYC, per-seller GST and invoicing.

---

## 24. Phased roadmap

Foundations first, then commerce, then automation; two future expansion tracks. A **compliance & external-onboarding workstream** (GST registration, Razorpay KYC, policies/Grievance Officer, DPDP, cosmetics labeling, vendor-feed confirmation) runs **in parallel from Phase 0**.

| Phase | Status | Deliverables |
|-------|--------|--------------|
| **0 — Foundations** | 🟡 next | Dev/staging/prod environments; CI/CD; D1 migration framework; test harness (unit + e2e); observability & backups; WAF/rate-limit/Turnstile; Cloudflare Images; base design system; data-access layer; outbox scaffold; legal policies + Grievance Officer + consent scaffolding. |
| **1 — Catalog + admin + ingestion** | 🔵 | Seller/fulfillment/inventory/tax-ready schema (incl. batch/expiry, money minor units); admin panel; manual + spreadsheet ingestion; SSR catalog pages + SEO foundation; CMS-lite for banners/collections; 15–20 dummy products. |
| **2 — Customers + cart** | 🔵 | Phone-OTP + guest checkout; profiles/addresses (pincode); cart/wishlist; back-in-stock; cart→order references listings; atomic reservation. |
| **3 — Checkout, payments & tax** | 🔵 | Razorpay + **COD**; GST invoices; order state machine; refunds; transactional notifications (email/SMS/WhatsApp); basic coupons; abandoned-cart recovery. |
| **4 — Fulfillment + vendor automation** | 🔵 | Order routing (dropship + self, splits); shipping + **serviceability/COD/RTO**; dropship tracking; automated ingestion; **returns/RMA** reverse logistics. |
| **5 — Reviews, content & AI support** | 🔵 | Reviews/UGC (+ Review schema); content/blog/merchandising; chatbot + Jira. |
| **6 — Inventory & replenishment (ERP)** | 🔵 | Replenishment engine (auto-PO/approval/alert), POs, goods receipt + QC, FEFO ops, vendor scorecards, low-stock alarms. |
| **7 — Marketplace enablement** | 🔵 | Seller portal, buy box, commissions/payouts (Route), per-seller shipping/ratings/tax. |

Phase 0 + the Phase-1 schema make every later phase **additive, not a rebuild**.

---

## 25. Open decisions

| # | Decision | Status | Position |
|---|----------|--------|----------|
| 1 | Schema scope | 🟢 | Full seller/fulfillment/inventory/tax/compliance-ready from day one |
| 2 | Variants | 🟢 | Full variants |
| 3 | Product/listing separation | 🟢 | Cart/orders reference listings |
| 4 | Inventory model | 🟢 | Stock ledger **+ batch/expiry (FEFO)** |
| 5 | Payments | 🟢 | Razorpay (+Route) **and COD** |
| 6 | Customer auth | 🟢 | **Phone-OTP primary + guest checkout** |
| 7 | Money representation | 🟢 | Integer minor units + currency |
| 8 | API design | 🟢 | API-first, versioned `/v1` |
| 9 | Search | 🟢 | Dedicated index (not D1 LIKE) |
| 10 | Data access | 🟢 | Repository layer to avoid D1 lock-in |
| 11 | Reliability | 🟢 | Event/outbox pattern; idempotency keys |
| 12 | Tax | 🟢 | GST from day one |
| 13 | Replenishment default | 🟡 | alert/approval at launch; auto_po opt-in |
| 14 | Shipping aggregator | 🟡 | Shiprocket |
| 15 | Messaging providers (SMS/WhatsApp) | ⚪ | TBD (e.g. Gupshup/Twilio/Meta WABA) |
| 16 | Per-vendor data method | ⚪ | TBD per vendor |
| 17 | Self-fulfilled vs dropship at launch | ⚪ | Likely all dropship initially |
| 18 | Marketplace go/no-go & timing | ⚪ | Design now; build (Phase 7) only if needed |
| 19 | Recommendations engine | 🔵 | Later (AI) |

---

## 26. Glossary

- **Guest checkout** — buying without creating an account.
- **OTP** — one-time password (phone login).
- **COD** — cash on delivery. **RTO** — return-to-origin (undelivered COD/parcel returned). **RMA** — return merchandise authorisation.
- **FEFO** — first-expiry-first-out (vs FIFO); used for dated cosmetics. **Batch/lot** — a production run with its own expiry.
- **Serviceability** — whether a pincode can be delivered to (and supports COD).
- **HSN** — tax classification code. **GSTIN** — GST registration number. **e-invoice** — government-validated GST invoice above a turnover threshold.
- **DPDP Act 2023** — India's data-protection law. **Grievance Officer** — mandated complaint contact under the E-Commerce Rules.
- **Tokenization** — replacing card numbers with tokens (RBI rule; we never store cards).
- **Seller / listing (offer) / buy box** — sells; a seller's sellable unit; default-offer selection across sellers.
- **Stock ledger** — immutable inventory movements; on-hand derived from it.
- **on-hand / reserved / available / on-order** — held / allocated / sellable now / inbound on POs.
- **Safety stock / reorder point / EOQ / lead time** — buffer / trigger level / cost-optimal lot / PO-to-stock time.
- **PO / GRN** — purchase order / goods receipt note.
- **Outbox pattern** — persist events then dispatch, so side-effects are never lost.
- **Data-access layer** — repository abstraction over the database to avoid lock-in.
- **SSR / ISR** — server-side / incremental rendering. **Core Web Vitals** — Google's UX performance metrics.
- **WAF / Turnstile / SLO** — web firewall / bot challenge / service-level objective.
- **PIM** — product information management hub. **Idempotency key** — makes a repeated request safe.
