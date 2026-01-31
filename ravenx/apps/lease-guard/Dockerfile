FROM node:20-alpine
WORKDIR /app

COPY apps/lease-guard/package.json ./apps/lease-guard/package.json
COPY apps/lease-guard/server.mjs ./apps/lease-guard/server.mjs

ENV RAVENX_API_URL=http://api:8787
ENV POLL_INTERVAL_SECONDS=20

CMD ["node","apps/lease-guard/server.mjs"]
