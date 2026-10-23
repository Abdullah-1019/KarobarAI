# Shared PostgreSQL development mode

The base `docker-compose.yml` keeps the local PostgreSQL database. The optional
`docker-compose.shared.yml` sends only the API to the `DATABASE_URL` in the root
`.env` and uses Redis database 15 for its cache and jobs. The browser still calls
the API on `localhost:4000`. Neither mode applies Prisma migrations on API startup.

Before using a shared database, verify its target, take and test a backup with
PostgreSQL client tools at least as new as the server, and apply reviewed migrations
separately. Never use `prisma migrate dev` or `prisma migrate reset` on it.

From the repository root, with `.env` pointing to the intended shared database:

```powershell
docker compose -f infra/docker-compose.yml up -d redis minio ollama ai-service web
docker compose --env-file .env -f infra/docker-compose.yml -f infra/docker-compose.shared.yml up -d --build --no-deps api
Invoke-WebRequest -UseBasicParsing http://localhost:4000/ready
```

The `--no-deps` flag avoids starting local PostgreSQL for the shared API. Check
`/ready` after startup; `/health` alone does not test database connectivity.
The shared database initially has only reference categories and configuration,
so public store/product lists remain empty until real accounts and listings exist.

To switch the API back to the existing local development database without
changing or restoring the shared database:

```powershell
docker compose -f infra/docker-compose.yml up -d postgres redis
docker compose -f infra/docker-compose.yml up -d --build --no-deps api
Invoke-WebRequest -UseBasicParsing http://localhost:4000/ready
```

The root `.env` is private and must never be committed. Shared and local modes
use different Redis logical databases, but the same Redis server; do not run two
API modes on port 4000 at once. Monitor the shared provider's connection limit:
the backend uses one Prisma client per API process, while one-off CLI and seed
containers open additional connections. Keep production pooling/connection
settings appropriate to the provider before scaling beyond local development.

`SEED_REFERENCE_ONLY=true` with `pnpm exec prisma db seed` inserts only missing
platform configuration and categories. It does not overwrite existing values or
create demo users/products. Run it only against a verified intended target.
