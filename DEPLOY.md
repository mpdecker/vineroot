# Vineroot â€” deployment

_Last updated: 2026-07-01 (Phase 2 readiness pass)_

## Stack

pnpm project under `C:\Development\Vineroot`

## Prerequisites

- CI workflow: `.github/workflows/ci.yml` (if present)
- Copy `.env.example` â†’ `.env.local` / host secrets

## Environment

| Variable | Purpose |
|----------|---------|
| POSTGRES_USER | Required at deploy |
| POSTGRES_PASSWORD | Required at deploy |
| POSTGRES_DB | Required at deploy |
| DATABASE_URL | Required at deploy |
| SUPABASE_URL | Required at deploy |
| SUPABASE_ANON_KEY | Required at deploy |
| SUPABASE_SERVICE_ROLE_KEY | Required at deploy |
| PM_ORCHESTRATOR_SECRET | Required at deploy |
| REDIS_URL | Required at deploy |
| JWT_SECRET | Required at deploy |
| JWT_REFRESH_SECRET | Required at deploy |
| JWT_EXPIRY | Required at deploy |
| JWT_REFRESH_EXPIRY | Required at deploy |
| PORT | Required at deploy |
| NODE_ENV | Required at deploy |
| NEXT_PUBLIC_API_URL | Required at deploy |
| NEXT_PUBLIC_WS_URL | Required at deploy |

## Local dev

```bash
cd C:\Development\Vineroot
npm ci
npm run dev
```

## Build & test

```bash
npm test
npm run build
```

## Host

Docker Compose (see docker-compose.yml) or Vercel for web tier

## Smoke check

- [ ] Local dev server starts without env errors
- [ ] Test command exits 0 (or documented skip reason in READINESS.md)
- [ ] Production URL / store build succeeds

## Rollback

Redeploy the previous host build (Vercel promotion rollback, EAS prior build, or Docker image tag).
