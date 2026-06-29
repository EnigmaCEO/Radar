# Radar SaaS — Claude Code context

## Project overview
Next.js 14 (App Router) marketing + subscriber portal for **Radar by Sagitta** — DeFi infrastructure monitoring.

- **Domain**: radar.sagitta.systems
- **SCE API**: https://continuityengineserver.fly.dev (FastAPI, Fly.io)
- **Auth**: Email-only session cookie via `/saas/login`. Cookie name: `sce_session`
- **Billing**: Stripe subscriptions. Plans: `free` → `radar_live` → `radar_pro` → `managed`
- **Hosting**: Vercel (primary), region `sin1`

## Key files
- `src/lib/api.ts` — typed API client for the SCE backend
- `src/lib/api-types.ts` — TypeScript types mirroring backend Pydantic models (camelCase)
- `src/lib/auth-context.tsx` — React context for user session
- `src/middleware.ts` — Redirects unauthenticated users away from `/dashboard`
- `src/app/api/stripe/` — Checkout, portal redirect, and webhook handler

## Plans and entitlements
```
free       → daily briefs, read-only alerts, 1-day history, no watchlists
radar_live → 3 watchlists, 2 destinations, Discord + Telegram, 7-day history
radar_pro  → 10 watchlists, 10 destinations, +Webhook, 30-day history
managed    → unlimited everything, 365-day history
```

## Dev workflow
```bash
npm run dev          # Start dev server at localhost:3000
npm run build        # Verify build passes
```

Copy `.env.local.example` to `.env.local` and fill in keys before running.

## Backend API endpoints used
- `POST /saas/login` — email login, sets `sce_session` cookie
- `POST /saas/logout`
- `GET  /saas/me`
- `POST /saas/request-access`
- `GET  /v1/sce/radar/alerts` — list alerts (query params: status, severity, monitor_type, limit)
- `GET  /v1/sce/radar/clients/{id}`
- `GET  /v1/sce/radar/clients/{id}/entitlements`
- `GET  /v1/sce/radar/watchlists?client_id={id}`
- `POST /v1/sce/radar/watchlists`
- `PATCH /v1/sce/radar/watchlists/{id}`
- `DELETE /v1/sce/radar/watchlists/{id}`
- `GET  /v1/sce/radar/delivery-destinations?client_id={id}`
- `POST /v1/sce/radar/delivery-destinations`
- `DELETE /v1/sce/radar/delivery-destinations/{id}`

## Stripe webhook sync
`/api/stripe/webhook` handles `customer.subscription.{created,updated,deleted}` and PATCHes the
client's `plan` and `status` in the SCE backend using `X-SCE-Admin-Key`.

## CORS
The SCE API in production allows `https://radar.sagitta.systems` — add it to `ALLOWED_ORIGINS`
in the SCE API environment if not already present.
