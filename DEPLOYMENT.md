# 🚀 Takoss Deployment Guide

## Complete Implementation Summary

✅ **100% Complete** - All critical features implemented and ready for production!

### What's Been Built

#### Backend (100%)
- ✅ 22 AI-powered prompts (Requirements → Visualization)
- ✅ SimpleTakossOrchestrator - Full generation pipeline
- ✅ REST API with Express + Socket.IO
- ✅ Authentication system (JWT + API keys)
- ✅ File output system with ZIP generation
- ✅ Project management endpoints
- ✅ Prisma ORM with PostgreSQL
- ✅ User, ApiKey, and Project models

#### Frontend (100%)
- ✅ React 18 + TypeScript + Vite
- ✅ Tailwind CSS v4 with creative/playful design
- ✅ React Router with protected routes
- ✅ Zustand global state management
- ✅ React Query for API calls
- ✅ Adaptive UI (wizard for beginners, quick form for experienced)
- ✅ Login/Register pages
- ✅ Onboarding page (experience level selection)
- ✅ Dashboard with project list
- ✅ New project creation (adaptive forms)
- ✅ Project details with file browser
- ✅ Framer Motion animations
- ✅ Dark mode support

#### DevOps (100%)
- ✅ Docker Compose production configuration
- ✅ Backend Dockerfile with multi-stage build
- ✅ Frontend Dockerfile with Nginx
- ✅ Environment variable configuration
- ✅ Health checks and auto-restart policies

---

## Prerequisites

- **Node.js** 18+
- **Docker** & **Docker Compose** (for containerized deployment)
- **PostgreSQL** 16+ (if running without Docker)
- **Claude API Key** from [Anthropic Console](https://console.anthropic.com/)

---

## Quick Start (Docker - Recommended)

### 1. Clone and Configure

```bash
cd ~/Takoss

# Copy environment file
cp .env.example .env

# Edit with your values
nano .env
```

### 2. Set Required Environment Variables

```bash
# In .env file:
CLAUDE_API_KEY=sk-ant-api03-your-actual-key
JWT_SECRET=generate-a-random-32-char-string
POSTGRES_PASSWORD=your-secure-password
```

### 3. Start All Services

```bash
# Start database, backend, and frontend
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f
```

### 4. Access the Application

- **Frontend:** http://localhost
- **Backend API:** http://localhost:3000
- **Health Check:** http://localhost:3000/health

### 5. Create First User

Navigate to http://localhost and click "Create Account"

---

## Manual Setup (Without Docker)

### 1. Database Setup

```bash
# Install PostgreSQL 16
# Create database
createdb takoss

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/takoss
```

### 2. Backend Setup

```bash
cd ~/Takoss

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Build TypeScript
npm run build

# Start backend server
export CLAUDE_API_KEY="your-key"
export JWT_SECRET="your-secret"
node dist/examples/startServer.js
```

Backend will start on http://localhost:3000

### 3. Frontend Setup

```bash
cd ~/Takoss/frontend

# Install dependencies
npm install

# Create .env file
echo "VITE_API_URL=http://localhost:3000" > .env

# Build for production
npm run build

# Serve with a static file server
npx serve -s dist -p 80
```

Frontend will be available on http://localhost

---

## Environment Variables Explained

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `CLAUDE_API_KEY` | API key from Anthropic | `sk-ant-api03-...` |
| `JWT_SECRET` | Secret for JWT token signing | 32+ random characters |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `POSTGRES_PASSWORD` | PostgreSQL password (Docker only) | Secure password |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Backend server port | `3000` |
| `VITE_API_URL` | Frontend API URL | `http://localhost:3000` |

---

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)
- `POST /api/auth/api-keys` - Create API key (requires auth)
- `GET /api/auth/api-keys` - List API keys (requires auth)
- `DELETE /api/auth/api-keys/:keyId` - Delete API key (requires auth)

### Project Generation

- `POST /api/generate` - Generate application (requires auth)
  ```json
  {
    "projectName": "My Blog",
    "description": "A modern blog platform",
    "requirements": "User auth, posts, comments, search"
  }
  ```

### Project Management

- `GET /api/projects` - List all projects (requires auth)
- `GET /api/projects/:projectId` - Get project details (requires auth)
- `GET /api/projects/:projectId/download` - Download project ZIP (requires auth)
- `GET /api/projects/:projectId/files/*` - Get file content (requires auth)
- `DELETE /api/projects/:projectId` - Delete project (requires auth)

### Public Endpoints

- `GET /health` - Health check
- `GET /api/examples` - Get example projects

---

## Authentication Methods

### 1. JWT Token (for web frontend)

```bash
# Login to get token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/projects
```

### 2. API Key (for programmatic access)

```bash
# Create API key (requires JWT token first)
curl -X POST http://localhost:3000/api/auth/api-keys \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My API Key"}'

# Use API key
curl -H "x-api-key: YOUR_API_KEY" \
  http://localhost:3000/api/projects
```

---

## Deployment Options

### Option 1: Single Server (Docker Compose)

Best for: Small-medium deployments, single server

```bash
# On your server
git clone <your-repo>
cd Takoss
cp .env.example .env
# Edit .env with production values
docker-compose -f docker-compose.production.yml up -d
```

### Option 2: Cloud Platforms

#### Railway (Backend)

1. Push code to GitHub
2. Create new Railway project
3. Add PostgreSQL service
4. Deploy backend from GitHub
5. Set environment variables in Railway dashboard

#### Vercel (Frontend)

```bash
cd frontend
npm install -g vercel
vercel --prod
```

Set environment variable: `VITE_API_URL=https://your-backend.railway.app`

### Option 3: Kubernetes

See `k8s/` directory for Kubernetes manifests (to be added if needed)

---

## Database Migrations

### Create New Migration

```bash
# After modifying prisma/schema.prisma
npx prisma migrate dev --name your_migration_name
```

### Apply Migrations in Production

```bash
# Automatically applied on container startup
# Or manually:
npx prisma migrate deploy
```

### Reset Database (Development Only!)

```bash
npx prisma migrate reset
```

---

## Monitoring & Logs

### Docker Logs

```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f backend
```

### Health Checks

```bash
# Backend health
curl http://localhost:3000/health

# Frontend health
curl http://localhost/health

# Database
docker-compose -f docker-compose.production.yml exec postgres pg_isready
```

---

## Backup & Restore

### Backup Database

```bash
docker-compose -f docker-compose.production.yml exec postgres \
  pg_dump -U takoss takoss > backup-$(date +%Y%m%d).sql
```

### Restore Database

```bash
docker-compose -f docker-compose.production.yml exec -T postgres \
  psql -U takoss takoss < backup-20241030.sql
```

### Backup Generated Projects

```bash
tar -czf projects-backup-$(date +%Y%m%d).tar.gz output/projects/
```

---

## Troubleshooting

### Backend Won't Start

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs backend

# Common issues:
# 1. Missing CLAUDE_API_KEY
# 2. Database not ready (wait for health check)
# 3. Port 3000 already in use
```

### Frontend Build Fails

```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Database Connection Fails

```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.production.yml ps

# Check DATABASE_URL is correct
echo $DATABASE_URL
```

### "Cannot find module" Errors

```bash
# Regenerate Prisma client
npx prisma generate

# Rebuild backend
npm run build
```

---

## Security Checklist

- [ ] Change default `JWT_SECRET` to a strong random string
- [ ] Use strong `POSTGRES_PASSWORD`
- [ ] Enable HTTPS (use nginx reverse proxy or cloud provider SSL)
- [ ] Rotate API keys regularly
- [ ] Set up firewall rules (only expose ports 80, 443)
- [ ] Enable rate limiting (can be added to nginx)
- [ ] Regular database backups
- [ ] Keep dependencies updated (`npm audit fix`)

---

## Performance Tuning

### PostgreSQL

```bash
# Increase connection pool
# In DATABASE_URL: ?connection_limit=20

# Enable connection pooling with PgBouncer (recommended for high load)
```

### Backend

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096"

# Use PM2 for process management
npm install -g pm2
pm2 start dist/examples/startServer.js -i max
```

### Frontend

- Already optimized with Vite build
- Nginx configured with gzip compression
- Static assets cached for 1 year

---

## Next Steps

1. ✅ **Deploy to production** using Docker Compose
2. 🔧 **Set up custom domain** and SSL certificate
3. 📊 **Add monitoring** (e.g., PM2, DataDog, New Relic)
4. 🔐 **Implement OAuth** (Google/GitHub) - structure already in code
5. 🎨 **Customize branding** - update logos and colors
6. 📧 **Add email notifications** for generation completion
7. 💳 **Add payment/billing** if making it a SaaS

---

## Support & Contributing

- **Issues:** GitHub Issues
- **Docs:** This file + inline code comments
- **AI Architecture:** See `PROMPTS.md` for 22 prompt details

---

## License

MIT License - See LICENSE file

---

**🎉 Congratulations!** You have a fully functional AI-powered application builder ready for production deployment!
