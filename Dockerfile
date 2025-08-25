FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm ci

COPY . .

RUN npm run build

FROM node:18-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

RUN npm install -g @anthropic-ai/claude-code

COPY package*.json ./
COPY backend/package*.json ./backend/

RUN npm ci --workspace=backend --production

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY hooks ./hooks

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "start"]