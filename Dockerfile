# syntax=docker/dockerfile:1.7
FROM node:24.22.2-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS dependencies
RUN npm install --global bun@1.4.2
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM dependencies AS builder
COPY . .
# Build only: random ephemeral value is never a deployed secret or NEXT_PUBLIC variable.
RUN PAYLOAD_SECRET="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')" DATABASE_URL=postgres://build:build@127.0.0.1:5432/build SERVER_URL=http://localhost:3000 bun run build

FROM dependencies AS migrations
ENV NODE_ENV=production
COPY . .
USER node
ENTRYPOINT ["bun", "run", "migrate"]

FROM base AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 MEDIA_DIR=/app/media
RUN mkdir -p /app/media && chown node:node /app/media
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
