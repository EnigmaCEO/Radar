# Radar SaaS

## Manual Delivery Matching

- Manual delivery now normalizes SCE alerts before watchlist matching.
- Broad enabled watchlists with no filters are treated as match-all above `minSeverity`.
- Severity ranking is canonicalized as `info < watch < warning < critical`.
- Manual delivery responses include debug counters and per-watchlist/per-alert match details.
- Destination gating still respects cadence, enabled state, minimum severity, and channel availability.

## Dashboard Alerts

- Overview now computes active alert totals and severity counts from the full active alert fetch set.
- Recent alerts on Overview remain a 5-item preview and can show `Showing 5 of N active alerts`.
- Alerts page severity-first sorting behavior is preserved through shared alert feed helpers.
- Coverage gaps are now treated as a separate monitor-health class from findings in the dashboard UI.
- The dashboard now accepts explicit SCE coverage fields when present: `lastSuccessfulObservationAt`, `lastObservationAttemptAt`, `consecutiveFailedCycles`, `objectState`, `failureCause`, and `coverageTier`.
- The Overview page now shows an observability card derived from current catalog size minus active coverage-gap alerts, while waiting for a dedicated SCE cycle summary endpoint.

## Coverage Gap Contract

- Recommended alert-level SCE fields for monitor-health / coverage events:
  - `signalClass: "coverage"`
  - `lastSuccessfulObservationAt`
  - `lastObservationAttemptAt`
  - `consecutiveFailedCycles`
  - `objectState` such as `unknown`
  - `failureCause` such as `status_source_unavailable`
  - `coverageTier` such as `unresolved`, `coverage_warning`, or `coverage_critical`
- Recommended summary-level SCE endpoint shape for honest coverage reporting on Overview:
  - `cycleAt`
  - `totalObjects`
  - `observedObjects`
  - `unobservedObjects`
- Recommended separation of concerns:
  - alert-level coverage facts belong on `/v1/sce/radar/alerts` and `/v1/sce/radar/alert-ledger`
  - cycle-level observability totals belong on a dedicated summary endpoint, not inferred from the alert list

## Delivery Modes

- Delivery destinations now store `deliveryMode` with `alert_fanout` as the default.
- Manual delivery now applies each destination's configured mode: `alert_fanout`, `public_thread`, or `digest`.
- Delivery destinations now also support `announcement_feed` for one-post-per-alert announcement channels.
- `public_thread` requires an approved thread payload and preserves post order instead of sending raw alert fanout.
- `alert_fanout` and `digest` now format matched alerts into grouped situational briefings for Discord and Telegram.
- `announcement_feed` now sends one deterministic public-style post per eligible `alert_opened`, `alert_updated`, or `severity_changed` event, with server-generated tags, details links, and event-level dedupe through delivery logs.
- Webhook deliveries keep raw alert data and now include a structured grouped briefing payload built from SCE explanation fields.
- Dry-run manual delivery now returns sanitized rendered preview messages per destination so operators can inspect Telegram text, Discord embeds/posts, and webhook JSON before live send.
- Briefing formatting now normalizes provider/title casing, compresses evidence into shorter operator-readable notes, and keeps Telegram preview truncation metadata aligned with the actual delivery text.
- Oversized Telegram briefings now split into multiple ordered delivery parts instead of truncating a single message, and dry-run previews expose the same multipart output.
- Single-group Telegram briefings now skip the duplicated top-level situation summary, and destination helper copy now steers public/community feeds toward `public_thread` instead of raw alert fanout.
- Telegram alert fanout now uses a compact operational format with explicit breached threshold names and values on each alert line, avoiding ambiguous `vs 12h` shorthand when feeds in the same cluster have different warning/critical schedules.

## Alert Ledger Delivery

- Manual delivery now fetches SCE ledger events from `/v1/sce/radar/alert-ledger` using server-side `since` and `until`.
- Ledger events carry explicit `signalClass`, event identity, and evidence metadata into Radar's delivery matching path.
- Alert normalization now preserves SCE explanation fields such as `whatHappened`, `whyItMatters`, `severityExplanation`, `radarStatus`, and `nextWatch` for downstream delivery formatting.
- Resolved ledger events are excluded from broad/manual fanout unless a watchlist explicitly requests `resolved` status.
- Manual delivery results now expose ledger event counts alongside unique matched alert counts, grouped briefing counts, generated group counts, message totals, and sanitized dry-run preview bodies.
- Manual delivery responses now separate delivery-ready `matchedAlerts` from `excludedEvents`, while preserving `alertResults` as a backward-compatible full debug section for the operator panel.

## Backend Extraction

- Backend extraction is now complete at the repo boundary: privileged account, watchlist, destination, MFA, delivery, and Stripe logic no longer lives under the public web app `src/` tree.
- The public Next.js app keeps only authenticated same-origin `/api/*` adapter routes that forward to the standalone backend.
- Frontend account and catalog code now use app-local contract types instead of Prisma/database helpers.

## Standalone Radar API

- A production-shaped Hono backend now lives under `apps/radar-api` with its own `package.json`, TypeScript config, server entrypoint, Dockerfile, Fly config, and environment template.
- The backend exposes account bootstrap, watchlist CRUD, destination CRUD, destination test send, manual delivery, MFA management, Stripe billing routes, and Stripe webhook handling behind an internal shared-secret boundary where appropriate.
- `apps/radar-api` is now self-contained: it carries its own Prisma schema, Prisma config, service layer, delivery helpers, and SCE/Auth0 integrations without importing from the public app.
- The Next.js `src/app/api/...` handlers are temporary same-origin adapters that always forward to `RADAR_API_BASE_URL`; they no longer execute privileged fallbacks locally.
- This repo can now be split into separate public/private repositories by moving `apps/radar-api` into a private service repo while leaving the public Next.js app as a thin frontend plus adapter layer.

## Product Model Update

- Public Record is now positioned as the public proof layer, not a free SaaS account tier.
- Effective plan semantics are:
  - `watch`: focused private monitoring with one asset lens or up to 5 exact catalog objects
  - `radar`: private monitoring across the standard Radar catalog with correlation and webhook delivery
  - `radar_intel`: aggregate infrastructure history and reports, no private watchlists or private alert destinations
  - `desk`: contracted institutional layer with raw history, signed receipts, API access, custom monitors, and review
- Legacy stored plan identifiers remain compatibility aliases:
  - `free` -> Public Record semantics
  - `radar_live` -> `watch`
  - `radar_pro` -> `radar`
  - `managed` -> `desk`

## Watchlist Scope Model

- Watchlists are now modeled around explicit coverage scopes instead of raw catalog caps.
- First-class standard scope types are:
  - `exact_objects`
  - `asset_lens`
  - `chain_lens`
  - `provider_lens`
  - `pillar_lens`
  - `full_catalog`
- Blank draft watchlists cover zero objects and cannot be saved.
- Legacy saved watchlists with no scope filters are displayed as `full_catalog` for compatibility, but new full-catalog coverage must be chosen explicitly.
- Internal operational tags such as `commercial_priority`, `technical_smoke`, `sagitta_dependency`, and `tier:*` are no longer exposed in the customer tag facet.

## Server-side Enforcement

- Plan restrictions are now enforced server-side in `apps/radar-api`; the client only reflects availability.
- Scope classification is resolved server-side from explicit `scopeType` when present, or inferred from submitted filters when unambiguous.
- Watch allows:
  - `exact_objects` up to 5 exact catalog objects
  - one `asset_lens`, even when it resolves to more than 5 catalog objects
- Watch rejects:
  - `chain_lens`
  - `provider_lens`
  - `pillar_lens`
  - `full_catalog`
  - `custom_monitor`
- Radar / Signal allows all standard catalog scopes without a 25-object full-catalog cap.
- Radar Intel rejects private watchlists and private alert destinations.
- Desk allows all standard scopes; custom monitors remain a contracted / future capability.
- Destination access is now enforced by channel and delivery mode instead of destination count:
  - Watch: Telegram and Discord only
  - Radar: Telegram, Discord, and webhook
  - Desk/internal: all currently supported channels and delivery modes
- Manual delivery is now restricted to Radar and Desk/internal plans.
- Private alert history queries now enforce plan-aware windows in the web app:
  - Watch: 30 days
  - Radar: 90 days
  - Desk/internal: unrestricted by app policy

## Public Surface Update

- The landing and pricing pages now present:
  - Public Record
  - Watch
  - Radar
  - Radar Intel
  - Desk
- Public alert detail pages now use a public-safe projection layer and render a CTA to monitor the object with Radar.
- A public `/alerts` page now acts as the public alert feed entry point for Public Record.
