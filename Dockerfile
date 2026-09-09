FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm db:generate
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
RUN useradd --create-home --shell /bin/bash scrapo
COPY --from=build --chown=scrapo:scrapo /app /app
USER scrapo

FROM runtime AS api
EXPOSE 4000
CMD ["pnpm", "start:api"]

FROM runtime AS worker
CMD ["pnpm", "start:worker"]

FROM runtime AS web
EXPOSE 3000
CMD ["pnpm", "start:web"]
