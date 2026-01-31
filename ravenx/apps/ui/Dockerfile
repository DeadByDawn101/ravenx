FROM node:20-alpine AS build
WORKDIR /app

# Workspace manifests
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
COPY apps/ui/package.json apps/ui/package.json
COPY apps/api/package.json apps/api/package.json

RUN corepack enable && corepack prepare pnpm@9.12.2 --activate
RUN pnpm -w install --frozen-lockfile || pnpm -w install

COPY apps/ui apps/ui
RUN pnpm -C apps/ui build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/apps/ui/dist /app/dist
COPY apps/ui/server.mjs /app/server.mjs
EXPOSE 8080
ENV PORT=8080
ENV RAVENOS_API_URL=http://api:8787
CMD ["node","/app/server.mjs"]
