# Dev-mode image (Vite dev server, hot reload). Production build is Implementation Plan Phase 13.
FROM node:20-slim

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@12.11.2 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN pnpm install --frozen-lockfile --filter @karobarai/frontend...

COPY packages/shared packages/shared
COPY apps/frontend apps/frontend
COPY tsconfig.base.json tsconfig.base.json

WORKDIR /workspace/apps/frontend

EXPOSE 5173

# The Compose node_modules volume survives image rebuilds. Reconcile its links
# with this image's lockfile-backed virtual store before starting Vite.
CMD ["sh", "-c", "pnpm install --offline --frozen-lockfile --filter @karobarai/frontend... --force --package-import-method=copy --store-dir=/root/.local/share/pnpm/store && exec pnpm dev --host"]
