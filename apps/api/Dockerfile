FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.5.2 --activate

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/core/package.json packages/core/package.json
COPY apps/api/package.json apps/api/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS build

COPY packages packages
COPY apps/api apps/api

RUN pnpm --filter @dtpm/contracts build \
  && pnpm --filter @dtpm/core build \
  && pnpm --filter @dtpm/api build \
  && pnpm deploy --legacy --filter @dtpm/api --prod /prod/api

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=build /prod/api ./
COPY --from=build /app/apps/api/migrations ./migrations

EXPOSE 3000

CMD ["node", "dist/main.js"]
