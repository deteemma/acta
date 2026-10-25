# Image unique de l'application : l'API NestJS sert aussi le web compilé.
# Utilisée par les services « api » et « migrations ». Contexte : racine du dépôt.

FROM node:24.22.1-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --filter api... --filter web...
COPY shared shared
COPY api api
COPY web web
RUN pnpm --filter @app/shared build \
 && pnpm --filter api build \
 && pnpm --filter web build \
 && pnpm --filter api deploy --prod --legacy /out \
 && cp -r api/dist api/migrations /out/ \
 && cp -r web/dist /out/web

FROM node:24.22.1-alpine
ENV NODE_ENV=production \
    WEB_DIST_DIR=/app/web
WORKDIR /app
COPY --from=build /out /app/api-pkg
RUN mv /app/api-pkg/web /app/web \
 && mkdir -p /app/api \
 && mv /app/api-pkg/dist /app/api-pkg/migrations /app/api-pkg/node_modules /app/api-pkg/package.json /app/api/ \
 && rm -rf /app/api-pkg
USER node
EXPOSE 3000
CMD ["node", "api/dist/main.js"]
