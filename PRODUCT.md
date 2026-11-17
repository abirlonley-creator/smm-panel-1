<!-- impeccable:product-schema 1 -->

# Aura SMM — Product Truth

## 1. Product Overview & Purpose
Aura SMM is a high-performance Social Media Marketing (SMM) management and automated organic delivery platform. It bridges creators, marketing agencies, and resellers with automated upstream fulfillment providers while eliminating the synthetic patterns that trigger platform anti-bot filters and shadowbans.

### Core Value Proposition
- **Organic Pacing & Anti-Bot Evasion**: Unlike conventional SMM panels that blast static batches at fixed intervals, Aura SMM implements biological arrival curves (S-Curve, Viral Burst, Steady Human, Prime Peak Hours, and Stealth Trickle), non-round quantities ($Q \not\equiv 0 \pmod 5$), anti-harmonic periodicity disruption, and Views-First gating.
- **Unified Multi-Provider Routing**: Seamlessly routes specific metrics (views, likes, saves, shares/reposts) to specialized upstream providers (e.g., XMedia for high-volume views, ZeoFame for micro-engagement waves) with automatic failover, balance monitoring, and zero double-spend idempotency.
- **Developer-First API (v2)**: Standard SMM v2-compliant REST API allowing agencies, bots, and third-party panels to automate orders, query balances, and stream order statuses using secure SHA-256 encrypted API keys.
- **Dual Operating Modes**: Full B2C creator interface alongside an isolated Admin Command Center with live financial telemetry, maintenance controls, and urgent balance alerts.

---

## 2. Target Audience & User Personas

1. **Independent Creators & Influencers**
   - *Goal*: Boost post momentum and trigger the TikTok/Instagram recommendation algorithms safely without risking account penalties or suspicious spikes.
   - *Behavior*: Uses `/engagement` to preview delivery schedules, pick custom pacing models (e.g., S-Curve or Prime Evening Boost), and fund wallets via crypto/Binance Pay.

2. **Marketing Agencies & SMM Resellers**
   - *Goal*: Resell high-retention engagement or execute high-volume campaigns for multiple client rosters.
   - *Behavior*: Connects external systems via `/api-docs` and `/api-keys` using the v2 JSON endpoint, requiring 99.9% uptime, strict idempotency, and predictable margin controls.

3. **Platform Administrators**
   - *Goal*: Monitor order delivery pipelines, track provider balances, manage service margins, and safeguard user experience during maintenance.
   - *Behavior*: Operates inside `/admin`, receives real-time balance shortage alerts, configures provider mappings, and toggles global "Under Update" maintenance with admin bypass.

---

## 3. Platform Specifications
- **Platform**: `web`
- **Primary Form Factor**: Desktop dashboard with full responsive mobile optimization.
- **Framework & Runtime**: Next.js 14 (App Router), React 18, Node.js.
- **Styling**: Tailwind CSS with custom enterprise palette, Lucide React icons.
- **Persistence & State**: Prisma ORM with relational SQL schema, secure AES-256 encrypted provider keys.

---

## 4. Key Workflows & Features

### A. TikTok Organic Engagement Engine (`/engagement`)
- **Pacing Models**:
  - `S-Curve`: Biological FYP adoption curve (warm-up $\to$ discovery peak $\to$ tail).
  - `Burst`: Front-loaded momentum rush in initial 1–2 hours ($1.65\times$ early weight) for instant ranking.
  - `Normal`: Continuous steady human browsing pace.
  - `Peak Hours`: Heavy prime-time weighting (18:00–22:00 IST/BST) with night cooldowns.
  - `Stealth`: Cautious micro-batch trickle pacing.
- **Anti-Bot Protections**:
  - Exact target conservation ($\sum Q \equiv \text{target}$).
  - Multiples of 5 eliminated to prevent round-number bot flagging.
  - Views-First Gate: Auxiliary engagement (likes, saves, shares) is throttled until sufficient views are confirmed.
  - Interactive plan preview with real-time recalculation, batch breakdown, and local clock-time timestamps.

### B. Standard Orders & Custom Combos (`/order`, `/orders`, `/combos`)
- Single and bulk link submission with automatic TikTok URL canonicalization.
- Multi-step combo execution across multiple platforms.
- Live order status badges (`PENDING`, `PROCESSING`, `IN_PROGRESS`, `COMPLETED`, `PARTIAL`, `CANCELLED`).

### C. Financials & Wallet Management (`/wallet`)
- Real-time balance display with multi-currency conversion.
- Automated crypto deposit integration (Binance Pay) with transaction reference hashing and audit logging.
- Proactive balance guards: Prevent order submission if user balance or upstream admin provider balance is depleted.

### D. System Administration & Under Update Mode (`/admin`, `/maintenance`)
- **Provider Balance Telemetry**: Real-time polling of upstream provider funds with automated warning alerts.
- **Under Update System**: When maintenance mode is activated, standard users are cleanly redirected to `/maintenance` with zero data exposure. The administrator retains unrestricted access across all application panels.

---

## 5. Technical & Design Constraints

### Design Philosophy: Antithesis of "AI Slop"
- **No Cliché Aesthetics**: Strictly avoid tacky purple/pink neon gradient overlays, generic card grids with no hierarchy, or unstyled default components.
- **Data Density & Clarity**: Present clear tabular figures with tabular mono numbers (`font-mono`) for metrics, quantities, and balances.
- **Palette Discipline**:
  - Canvas: Clean white (`#FFFFFF`) with soft grayish-blue tint (`#F8F9FD`).
  - Borders: Crisp dividers (`#DEE0ED`).
  - Text: High-contrast deep navy (`#252943`).
  - Primary Accent: Precision electric cobalt (`#3A4EFB`).
  - Status Indicators: Emerald (`#10B981`) for security/success, Rose (`#F43F5E`) for likes, Amber (`#F59E0B`) for saves/warnings, Purple (`#8B5CF6`) for shares.
- **Responsiveness**: All tables and metric strips must gracefully adapt to mobile viewports without horizontal clipping or broken layouts.

### Security & Idempotency Rules
- API keys and upstream provider credentials must **never** be logged to stdout, exposed in client responses, or rendered on public DOM nodes.
- Provider dispatches must enforce unique idempotency keys (`orderRef-metric-batchIndex`) and transactional state transitions (`queued -> sending -> sent -> completed | failed`).

---

## 6. Voice & Tone
- **Professional, Precise, and Authoritative**: Communicate with the clarity and confidence of a modern fintech platform (Stripe, Linear, Binance).
- **Zero Vague Jargon**: Provide exact batch quantities, minute offsets, and human behavior ratings instead of generic marketing claims.
- **Transparent Feedback**: In error states (e.g., insufficient funds or provider maintenance), clearly state the root cause and provide direct, actionable steps (e.g., "Add ₹45 more" or "Contact 24/7 Telegram support").
