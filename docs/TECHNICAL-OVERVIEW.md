# BeyondGorgeous — Technical Overview

> A readable summary of how BeyondGorgeous is built and where it's going.
> For the exhaustive specification see **[ARCHITECTURE.md](ARCHITECTURE.md)** · for scope, milestones and risks see the **[Design &amp; Roadmap](BeyondGorgeous-Design-and-Roadmap.docx)** · for screens see the **[UI Mockups](UI-Mockups.html)**.
> Aligned with design spec **v0.4.0**.

---

## 1. What we're building

BeyondGorgeous is a **private-label beauty brand** with a **hybrid, vendor-fulfilled supply chain**, built **India-first** and **marketplace-ready**.

- **We own** the brand, storefront, pricing, content, and customer relationship.
- **Vendors** (e.g. BO International) handle production, labelling, packing and shipping for dropship lines; we self-fulfil the lines we stock.
- **Launch is single-seller**, but the design supports adding third-party sellers later with no rebuild.

The guiding rule that makes this maintainable: **every field has exactly one owner.** Stock and cost are owned by vendors and sync in automatically; name, images and price are owned by us. No data is ever maintained twice.

---

## 2. Architecture

<p align="center">
  <img src="assets/architecture.svg" alt="Architecture" width="100%">
</p>

A **modular monolith** on **Cloudflare Workers** — one cleanly-divided application. Microservices are deliberately avoided at this scale; clean internal boundaries keep the option open for later.

| Layer | Role |
|-------|------|
| **Edge / UI** | Next.js storefront + admin, server-rendered |
| **Application core** | Catalog · Ingestion · Customers · Cart & Orders · Fulfillment · Inventory · Notifications · Support |
| **Integration** | Adapters to vendors, payments, shipping, messaging, AI, Jira |
| **Async backbone** | Queues + event/outbox; scheduled Cron jobs |
| **Data** | D1 (SQL) · R2 (files) · KV (cache) · search index |

---

## 3. The platform

| Need | Choice |
|------|--------|
| Compute & framework | Cloudflare Workers + Next.js |
| Database | Cloudflare D1 (SQL), behind a data-access layer |
| Files & images | Cloudflare R2 + Cloudflare Images |
| Background work | Cloudflare Queues + Cron |
| Cache & sessions | Cloudflare KV |
| Payments | Razorpay (UPI/cards/wallets) + cash-on-delivery |
| Shipping | Courier aggregator (e.g. Shiprocket) |
| Messaging | Email · SMS · WhatsApp |
| AI support | Claude API |

All on one platform — simple to operate, low fixed cost, global by default.

---

## 4. Core subsystems

**🛍️ Catalog & ingestion.** One canonical catalog fed by many sources — a PIM-style hub. Vendors send data by API, spreadsheet, scheduled file, email, or manual entry; one pipeline normalises, validates, and publishes it. Onboarding a new vendor is configuration, not new code.

**📦 Inventory (ERP-grade).** Stock is a **ledger of movements** (auditable on-hand), not a bare number. Cosmetics-aware: **batch/lot and expiry with FEFO**, recall-by-batch. Per-SKU reorder policies drive **automated replenishment** — auto-purchase-order, approve-first, or alert-only.

**🚚 Fulfillment.** Dropship and self-fulfilled, chosen per product. An order-routing engine picks the right source per item (and can split an order); pincode serviceability and COD/RTO handling for India.

**💳 Checkout & payments.** Guest checkout, phone-OTP login, Razorpay + COD, idempotent and reconciled. GST-compliant invoicing built in.

**🤖 Support.** A Claude-powered assistant grounded in the catalog and the customer's own orders, escalating to Jira when it can't resolve an issue.

---

## 5. Data & scalability

- **Money** is stored as integer minor units — never floats.
- **API-first / versioned (`/v1`)** so a future mobile app reuses the same APIs.
- **Event/outbox pattern** so side-effects (notifications, analytics, ERP) are never lost.
- **Known limit, handled:** D1 is excellent for catalog and orders but not for heavy search or analytics — so search runs on a dedicated index and analytics on a separate sink, with a data-access layer keeping a migration path open.

---

## 6. Built to be compliant (India)

Treated as a first-class workstream, not an afterthought:

- **GST** invoicing (HSN codes), credit notes
- **Consumer Protection (E-Commerce) Rules** — published policies + Grievance Officer
- **DPDP Act** — consent, privacy, retention
- **Cosmetics labelling** (CDSCO) — ingredients, batch, expiry
- **Payments** — PCI handled by Razorpay; RBI card-tokenization

---

## 7. Delivery approach

Work is staged into phases (0–7), each with clear exit criteria, and gated by **client sign-off checkpoints** — including an early **UI-mockup sign-off** so layout and flow are agreed *before* expensive build. This freezes scope progressively and keeps changes cheap.

| Phase | Focus |
|-------|-------|
| 0 | Foundations (environments, CI/CD, tests, security) |
| 1 | Catalog & admin |
| 2 | Customers & cart |
| 3 | Checkout, payments & tax |
| 4 | Fulfillment & vendor automation |
| 5 | Reviews, content & AI support |
| 6 | Inventory & replenishment (ERP) |
| 7 | Marketplace *(future)* |

---

<p align="center"><sub>For the complete specification, see <a href="ARCHITECTURE.md">ARCHITECTURE.md</a>.</sub></p>
