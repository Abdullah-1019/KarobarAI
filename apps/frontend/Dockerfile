# Dev-mode image (Vite dev server, hot reload). Production build is Implementation Plan Phase 13.
FROM node:20-slim

WORKDIR /workspace

RUN corepack enable

COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN pnpm install --frozen-lockfile=false

COPY packages/shared packages/shared
COPY apps/frontend apps/frontend
COPY tsconfig.base.json tsconfig.base.json

WORKDIR /workspace/apps/frontend

EXPOSE 5173

CMD ["pnpm", "dev", "--", "--host"]
