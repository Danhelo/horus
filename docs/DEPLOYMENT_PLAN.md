# HORUS Deployment Plan

## Executive Summary

HORUS is a full-stack monorepo application with:
- **Frontend**: React SPA with Three.js (3D visualization)
- **Backend**: Hono API server with SQLite database
- **External dependency**: Neuronpedia API (required)
- **Static data**: ~12MB UMAP position files per model layer

This document outlines deployment strategies from simplest to most robust.

---

## Deployment Options

### Option 1: Managed Platform (Recommended for MVP)

**Best for**: Quick deployment, minimal DevOps overhead, cost-effective start

| Component | Platform | Why |
|-----------|----------|-----|
| Frontend | **Vercel** or **Cloudflare Pages** | Free tier, automatic builds, global CDN |
| Backend | **Railway** or **Render** | Easy Node.js hosting, persistent SQLite |
| Data files | Bundled with frontend | Simplest approach for 12MB |

**Estimated cost**: $0-20/month (free tiers available)

**Pros**:
- Zero infrastructure management
- Automatic SSL, CDN
- Git-based deploys

**Cons**:
- Limited control over infrastructure
- Potential cold starts on free tiers
- SQLite may need upgrading if traffic grows

---

### Option 2: Containerized (Docker + Cloud Run/Fly.io)

**Best for**: Production-ready, scalable, portable

| Component | Platform | Why |
|-----------|----------|-----|
| Frontend | **Cloudflare Pages** or Docker + Cloud Run | Static SPA or containerized |
| Backend | **Cloud Run** or **Fly.io** | Auto-scaling, persistent volumes |
| Database | SQLite on persistent volume | Simple, or migrate to **Turso** (SQLite edge) |
| Data files | CDN (R2, S3) | Separate from app for scalability |

**Estimated cost**: $10-50/month depending on traffic

**Pros**:
- Portable, reproducible deployments
- Auto-scaling
- Better production readiness

**Cons**:
- More setup required
- Need to manage Docker images

---

### Option 3: VPS / Dedicated Server

**Best for**: Full control, high traffic, cost-effective at scale

| Component | Platform | Why |
|-----------|----------|-----|
| Server | **Hetzner**, **DigitalOcean**, or **Linode** | Good price/performance |
| Reverse proxy | **Caddy** or nginx | Auto SSL, routing |
| Process manager | **PM2** or systemd | Keep Node.js running |
| Frontend | Served by Caddy/nginx | Same server or separate |

**Estimated cost**: $5-50/month

**Pros**:
- Full control
- Best cost/performance ratio at scale
- No cold starts

**Cons**:
- Manual server management
- Responsible for security updates

---

## Recommended Approach: Hybrid (Option 1 + Docker)

For HORUS, I recommend starting with **Option 1** for rapid deployment, with **Docker configuration** added for portability:

```
Phase 1: Deploy to managed platforms (Vercel + Railway)
Phase 2: Add Docker support for local development parity
Phase 3: Migrate to containerized deployment if needed
```

---

## Implementation Plan

### Phase 1: Prepare for Deployment

#### 1.1 Environment Configuration

Create production environment files:

```bash
# packages/backend/.env.production
NODE_ENV=production
PORT=3001
DATABASE_URL=./data/app.db
NEURONPEDIA_API_KEY=${NEURONPEDIA_API_KEY}  # Set in platform secrets

# packages/frontend/.env.production
VITE_API_URL=https://api.your-domain.com
```

#### 1.2 Backend Production Build

The backend is already configured for production builds:

```bash
cd packages/backend
pnpm build  # Outputs to dist/index.js
```

Entry point: `node dist/index.js`

#### 1.3 Frontend Production Build

```bash
cd packages/frontend
pnpm build  # Outputs to dist/
```

Output: Static SPA in `dist/` directory

#### 1.4 Database Migrations

Ensure database schema is production-ready:

```bash
cd packages/backend
pnpm drizzle-kit push  # Push schema to SQLite
```

---

### Phase 2: Platform Deployment

#### Frontend: Vercel Deployment

1. **Connect repository** to Vercel
2. **Configure build**:
   - Root directory: `packages/frontend`
   - Build command: `pnpm build`
   - Output directory: `dist`
   - Install command: `pnpm install`
3. **Set environment variables**:
   - `VITE_API_URL`: Backend URL

**vercel.json** (create in `packages/frontend/`):
```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "dist",
  "installCommand": "cd ../.. && pnpm install",
  "framework": "vite"
}
```

#### Backend: Railway Deployment

1. **Create new project** on Railway
2. **Connect repository**
3. **Configure**:
   - Root directory: `packages/backend`
   - Build command: `pnpm build`
   - Start command: `node dist/index.js`
4. **Set environment variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `3001` (Railway auto-assigns)
   - `NEURONPEDIA_API_KEY`: Your API key
   - `DATABASE_URL`: `./data/app.db`
5. **Add persistent volume** for SQLite:
   - Mount path: `/app/data`

**railway.json** (create in `packages/backend/`):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30
  }
}
```

---

### Phase 3: Docker Configuration (Optional but Recommended)

#### Dockerfile for Backend

Create `packages/backend/Dockerfile`:

```dockerfile
FROM node:20-slim AS builder

WORKDIR /app
RUN corepack enable pnpm

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
RUN pnpm --filter @horus/backend build

# Production image
FROM node:20-slim AS runner

WORKDIR /app
RUN corepack enable pnpm

# Copy built artifacts
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]
```

#### Dockerfile for Frontend

Create `packages/frontend/Dockerfile`:

```dockerfile
FROM node:20-slim AS builder

WORKDIR /app
RUN corepack enable pnpm

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY packages/shared ./packages/shared
COPY packages/frontend ./packages/frontend

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter @horus/frontend build

# Serve with nginx
FROM nginx:alpine AS runner

COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### nginx.conf for Frontend SPA

Create `packages/frontend/nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Cache data files
    location /data/ {
        expires 1d;
        add_header Cache-Control "public";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### Docker Compose

Create `docker-compose.yml` at repository root:

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: packages/frontend/Dockerfile
      args:
        VITE_API_URL: http://localhost:3001
    ports:
      - "3000:80"
    depends_on:
      - backend

  backend:
    build:
      context: .
      dockerfile: packages/backend/Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - NEURONPEDIA_API_KEY=${NEURONPEDIA_API_KEY}
      - DATABASE_URL=/app/data/app.db
    volumes:
      - backend-data:/app/data

volumes:
  backend-data:
```

---

### Phase 4: CI/CD Enhancements

Update `.github/workflows/ci.yml` to add deployment:

```yaml
# Add to existing ci.yml after build job
deploy-frontend:
  needs: build
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
        working-directory: packages/frontend

deploy-backend:
  needs: build
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Deploy to Railway
      uses: bervProject/railway-deploy@main
      with:
        railway_token: ${{ secrets.RAILWAY_TOKEN }}
        service: horus-backend
```

---

## Security Considerations

### Environment Variables
- Never commit `.env` files
- Use platform secrets for `NEURONPEDIA_API_KEY`
- Rotate API keys periodically

### CORS Configuration
Update `packages/backend/src/app.ts` for production:

```typescript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL, // Add production frontend URL
].filter(Boolean);
```

### Rate Limiting
Already implemented:
- 10 requests/min per IP for generation endpoints
- Neuronpedia proxy respects upstream limits (100 steers/hour)

### Database Security
- SQLite file should be in a persistent volume with restricted permissions
- Consider encryption at rest for sensitive deployments

---

## Monitoring & Observability

### Health Checks
Backend already exposes `GET /health`:
- Use for load balancer health checks
- Configure Railway/Docker health checks

### Logging
Add structured logging for production:

```typescript
// packages/backend/src/middleware/logger.ts
import { logger } from 'hono/logger';

export const productionLogger = logger((str, ...rest) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    message: str,
    ...rest
  }));
});
```

### Metrics (Future)
Consider adding:
- Request latency histograms
- Neuronpedia API call counts
- Cache hit/miss ratios
- Feature activation distributions

---

## Scaling Considerations

### When to Scale

| Metric | Threshold | Action |
|--------|-----------|--------|
| Response time > 500ms | Sustained | Add caching layer |
| SQLite write contention | >10 concurrent writes | Migrate to Turso/PostgreSQL |
| Memory > 512MB | Sustained | Increase instance size |
| Users > 1000 concurrent | Sustained | Add read replicas |

### Horizontal Scaling Path

1. **Current**: Single SQLite instance
2. **Medium**: Turso (distributed SQLite)
3. **Large**: PostgreSQL with read replicas

### CDN for Data Files

If data files grow beyond 50MB:
1. Move to Cloudflare R2 or AWS S3
2. Serve via CDN with long cache headers
3. Update frontend to fetch from CDN URL

---

## Cost Estimates

### MVP Deployment (Free Tiers)

| Service | Cost |
|---------|------|
| Vercel (Frontend) | $0 |
| Railway (Backend) | $0-5/month |
| **Total** | **$0-5/month** |

### Production Deployment

| Service | Cost |
|---------|------|
| Vercel Pro | $20/month |
| Railway Pro | $20/month |
| Cloudflare R2 (data) | $0.015/GB |
| **Total** | **~$45/month** |

### High-Traffic Deployment

| Service | Cost |
|---------|------|
| Cloud Run (Backend) | $50-200/month |
| Cloudflare Pages (Frontend) | $0 |
| Turso (Database) | $29/month |
| Cloudflare R2 (data) | $5/month |
| **Total** | **~$100-250/month** |

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests pass (`pnpm test`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Type check passes (`pnpm typecheck`)
- [ ] Environment variables documented
- [ ] NEURONPEDIA_API_KEY obtained

### Frontend Deployment
- [ ] `VITE_API_URL` configured
- [ ] Build artifacts verified
- [ ] SPA routing configured (nginx or platform)
- [ ] Data files included in build

### Backend Deployment
- [ ] Database volume mounted
- [ ] Health check endpoint verified
- [ ] CORS origins updated for production
- [ ] Rate limiting configured
- [ ] Secrets set in platform

### Post-Deployment
- [ ] Health check passing
- [ ] Frontend can reach backend
- [ ] Neuronpedia API calls working
- [ ] Graph loading correctly
- [ ] Feature search functional

---

## Quick Start Commands

### Local Production Test
```bash
# Build all packages
pnpm build

# Start backend
cd packages/backend
NODE_ENV=production node dist/index.js &

# Serve frontend (use any static server)
cd packages/frontend
npx serve dist -l 3000
```

### Docker Production Test
```bash
# Build and run
docker-compose up --build

# Access at http://localhost:3000
```

---

## Next Steps

1. **Immediate**: Choose deployment platform (recommend Vercel + Railway)
2. **Short-term**: Add Docker configuration for parity
3. **Medium-term**: Set up CI/CD auto-deploy
4. **Long-term**: Add monitoring and consider scaling path

---

*Document created: 2026-01-12*
*HORUS v0.1.0 Deployment Planning*
