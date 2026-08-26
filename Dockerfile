FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma.config no generate: placeholders (não conecta no build)
ENV DIRECT_URL="postgresql://alar:alar@db:5432/alar"
ENV DATABASE_URL="postgresql://alar:alar@db:5432/alar"
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
EXPOSE 3001
# DIRECT_URL (ou DATABASE_URL) deve existir no painel Railway — ver DEPLOY.md
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
