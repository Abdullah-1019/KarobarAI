# KarobarAI

Final Year Project — AI-powered e-commerce platform for micro-sellers in Pakistan.

Blueprint docs: see [`docs/`](docs/) (PRD, TRD, App Flow, UI/UX, Schema, Implementation Plan).

## Status

**Feature 0 (Project Foundation)** + **Database feature** done. No auth/catalog/order business
logic yet — this stage proves the stack boots, the full schema is migrated, and every later
feature has a folder (and a table) to land in.

## Stack

- `apps/frontend` — React 18 + TypeScript + Vite (PWA scaffold)
- `apps/backend` — Node 20 + Express + TypeScript + Prisma (full schema: 28 tables/enums per
  `docs/KarobarAI-05-Schema.md` §1-§15)
- `apps/ai-service` — Python 3.11 + FastAPI (internal-only, no AI logic yet)
- `packages/shared` — cross-app TS types/enums/error codes (empty placeholders)
- PostgreSQL 16 (Docker) or a native Postgres install for local dev, Redis 7, MinIO (dev object
  storage), Nginx (reverse proxy)

## Prerequisites

- Node.js 20.x (see `.nvmrc`) and [pnpm](https://pnpm.io) ≥ 9
- Python 3.11 (see `.python-version`)
- Docker + Docker Compose

## Quick start (Docker — recommended)

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up --build
```

- Web (via Nginx): http://localhost:8080
- Web (direct, Vite dev server): http://localhost:5173
- API: http://localhost:4000/health (also via Nginx: http://localhost:8080/api/health)
- AI service: internal-only — not reachable from the host (TRD §8)
- MinIO console: http://localhost:9001

## Quick start (without Docker, using a native Postgres install)

Each developer runs their **own** local Postgres — nobody connects to a teammate's database over
the network. What you share via git is the schema (`prisma/schema.prisma`) and the migration
files (`prisma/migrations/*`); running the migrations locally recreates the same tables.

**One-time setup**, using `psql` from your Postgres install (adjust the path/port if needed):

```sql
-- Connect as your Postgres superuser (e.g. psql -U postgres) and run:
CREATE ROLE karobarai LOGIN PASSWORD 'karobarai';
CREATE DATABASE karobarai OWNER karobarai;
-- Needed once so `prisma migrate dev` can manage its shadow database:
ALTER ROLE karobarai CREATEDB;
GRANT pg_signal_backend TO karobarai;
```

Then:

```bash
cp .env.example .env
# Native install (not Docker) -> point DATABASE_URL / REDIS_URL at localhost:
#   DATABASE_URL=postgresql://karobarai:karobarai@localhost:5432/karobarai?schema=public
#   REDIS_URL=redis://localhost:6379

pnpm install
pnpm --filter @karobarai/backend prisma:generate   # generate the Prisma Client
pnpm --filter @karobarai/backend prisma:migrate     # apply migrations (creates all 28 tables)
pnpm --filter @karobarai/backend prisma:seed        # seed categories + platform_config

pnpm dev:backend    # http://localhost:4000/health
pnpm dev:frontend   # http://localhost:5173

# ai-service (separate terminal)
cd apps/ai-service
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

You can also just run `cd apps/backend && npm run dev` (or `cd apps/frontend && npm run dev`)
directly — pnpm's install already populates each app's own `node_modules`. Don't run
`npm install` inside `apps/*` though: `@karobarai/shared` uses pnpm's `workspace:*` protocol,
which plain npm doesn't understand — reinstall from the repo root with `pnpm install`.

## Common commands

| Command | Purpose |
|---|---|
| `pnpm install` | install all workspace dependencies |
| `pnpm build` | build all TS packages/apps |
| `pnpm typecheck` | TypeScript project-wide type-check |
| `pnpm test` | run tests in each workspace |
| `pnpm --filter @karobarai/backend prisma:generate` | regenerate Prisma client |
| `pnpm --filter @karobarai/backend prisma:migrate` | create/apply a migration from schema.prisma changes |
| `pnpm --filter @karobarai/backend prisma:seed` | seed categories + platform_config |
| `pnpm --filter @karobarai/backend prisma:studio` | browse the database in Prisma Studio |
| `docker compose -f infra/docker-compose.yml up --build` | full stack, one command |
| `docker compose -f infra/docker-compose.yml down -v` | stop stack and drop volumes |
