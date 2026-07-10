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
