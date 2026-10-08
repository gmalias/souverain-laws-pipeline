# souverain-laws-pipeline — Docker imajı
# Build:  docker compose build
# Run:    docker compose run --rm pipeline
FROM node:22-slim

# git: push için; chromium + bağımlılıkları: Légifrance (Akamai bot duvarı) için
RUN apt-get update && apt-get install -y --no-install-recommends git \
        libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
        libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
        libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Playwright chromium (headless)
RUN npx playwright install chromium --with-deps

COPY . .

# root olarak çalıştırmayız; git kimliği container içinde kurulur (push/push.js)
RUN useradd -m crawler && chown -R crawler /app
USER crawler

# Varsayılan: tek crawl çalıştır
CMD ["node", "src/main.js", "crawl"]
