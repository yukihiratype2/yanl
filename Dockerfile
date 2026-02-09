FROM oven/bun:1.2.15 AS builder

WORKDIR /app

# Install dependencies with workspace support.
COPY package.json bun.lock ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN bun install --frozen-lockfile

# Copy sources and build frontend for production.
COPY backend backend
COPY frontend frontend
COPY docker docker
RUN bun --cwd frontend run build

FROM oven/bun:1.2.15 AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV FRONTEND_PORT=3000
ENV BACKEND_PORT=3001
ENV BACKEND_INTERNAL_URL=http://127.0.0.1:3001

# Runtime deps and built assets.
COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/backend /app/backend
COPY --from=builder /app/frontend /app/frontend
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/docker/entrypoint.sh /app/docker/entrypoint.sh

RUN mkdir -p /app/backend/data /app/backend/log \
  && chmod +x /app/docker/entrypoint.sh

VOLUME ["/app/backend/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "const p=process.env.FRONTEND_PORT||'3000';fetch('http://127.0.0.1:'+p+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker/entrypoint.sh"]
