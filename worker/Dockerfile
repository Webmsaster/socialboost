FROM node:20-bookworm-slim

# ffmpeg + the DejaVu font referenced by render.ts
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev=false

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# Drop dev deps after the build to keep the image small.
RUN npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/server.js"]
