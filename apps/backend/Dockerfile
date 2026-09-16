# Dev-mode image (hot reload). Production multi-stage build is Implementation Plan Phase 13.
FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

RUN corepack enable

COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/backend/package.json apps/backend/package.json

RUN pnpm install --frozen-lockfile=false --prod=false

COPY packages/shared packages/shared
COPY apps/backend apps/backend
COPY tsconfig.base.json tsconfig.base.json

WORKDIR /workspace/apps/backend

RUN pnpm exec prisma generate

EXPOSE 4000

CMD ["pnpm", "dev"]
