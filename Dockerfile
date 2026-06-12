FROM node:22-alpine AS app-deps

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile

FROM app-deps AS api-runtime

COPY tsconfig.json drizzle.config.ts ./
COPY drizzle drizzle
COPY src src

EXPOSE 3000

CMD ["pnpm", "start"]

# Keep this image tag aligned with the Playwright version in pnpm-lock.yaml.
FROM mcr.microsoft.com/playwright:v1.60.0-noble AS worker-runtime

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json

RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 pnpm install --frozen-lockfile

COPY tsconfig.json drizzle.config.ts ./
COPY drizzle drizzle
COPY scripts scripts
COPY src src

CMD ["sh", "scripts/run-collector-worker-container.sh"]

FROM app-deps AS web-build

COPY apps/web apps/web

RUN pnpm --filter @fgc/web build

FROM nginx:1.27-alpine AS web-gateway

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 80
