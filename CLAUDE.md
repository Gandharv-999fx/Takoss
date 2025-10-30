# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Takoss** is a production-ready AI-powered full-stack application builder that generates complete web applications from natural language requirements. The system uses Claude Sonnet and Gemini AI models to generate frontend (React), backend (Express), database schemas (Prisma), authentication, and deployment configurations.

## Quick Start

### Development (Local)
```bash
# 1. Install dependencies
npm install
cd frontend && npm install

# 2. Set up environment
cp .env.example .env
# Edit .env: Add CLAUDE_API_KEY, JWT_SECRET, POSTGRES_PASSWORD

# 3. Database setup
npx prisma generate
npx prisma migrate dev

# 4. Build
npm run build
cd frontend && npm run build

# 5. Start backend server
node dist/examples/startServer.js
```

### Production (Docker)
```bash
# 1. Configure environment
cp .env.example .env
# Edit with production values

# 2. Start all services
docker-compose -f docker-compose.production.yml up -d

# Access: http://localhost (frontend), http://localhost:3000 (API)
```

## Required Environment Variables

```bash
# AI Models
CLAUDE_API_KEY=sk-ant-api03-...     # Required - from console.anthropic.com
GEMINI_API_KEY=...                  # Optional - from makersuite.google.com

# Database
DATABASE_URL=postgresql://...       # PostgreSQL connection string
POSTGRES_PASSWORD=...               # For Docker deployment

# Authentication
JWT_SECRET=...                      # 32+ character random string

# Server
NODE_ENV=production                 # production or development
PORT=3000                          # Backend API port

# Frontend
VITE_API_URL=http://localhost:3000 # Backend URL for frontend
```

## Current Architecture (Production System)

### Full-Stack Application

**Backend** (Node.js + Express + TypeScript)
- **REST API** (`src/api/server.ts`) - Express server with Socket.IO
- **Orchestrator** (`src/orchestrator/simpleTakossOrchestrator.ts`) - Main generation pipeline
- **Authentication** (`src/auth/`) - JWT tokens + API keys with bcrypt
- **File Output** (`src/output/projectWriter.ts`) - Write projects to disk and create ZIPs
- **22 AI Prompts** (`src/prompts/`) - Specialized prompts for each generation phase
- **Database** (Prisma + PostgreSQL) - User, Project, ApiKey models

**Frontend** (React + TypeScript + Vite)
- **Pages** - Login, Register, Onboarding, Dashboard, NewProject, ProjectDetails
- **Components** - Layout, ProjectCard, CodeViewer, FileTree, ProgressTracker, etc.
- **State Management** - Zustand for global state, React Query for API
- **Styling** - Tailwind CSS v4 with custom creative/playful design
- **Routing** - React Router v6 with protected routes
- **Animations** - Framer Motion

**DevOps**
- **Docker Compose** - PostgreSQL, Backend, Frontend (Nginx)
- **Multi-stage builds** - Optimized production images
- **Health checks** - All services monitored

### Key Components

**SimpleTakossOrchestrator** (`src/orchestrator/simpleTakossOrchestrator.ts`)
- Main generation pipeline orchestrator
- Executes 22 AI prompts in sequence across 7 phases:
  1. Requirements Analysis
  2. Architecture Design
  3. Database Schema Design
  4. Frontend Generation
  5. Backend Generation
  6. Deployment Configuration
  7. Visualization & Documentation
- Returns `GenerationResult` with all phase outputs

**TakossAPIServer** (`src/api/server.ts`)
- Express.js REST API with Socket.IO
- Authentication middleware integration
- Project management endpoints
- File download/upload handling

**AuthService** (`src/auth/authService.ts`)
- User registration with bcrypt hashing
- JWT token generation (7-day expiry)
- API key management for programmatic access
- OAuth structure (Google/GitHub ready)

**ProjectWriter** (`src/output/projectWriter.ts`)
- Writes generated projects to `./output/projects/`
- Creates ZIP archives for download
- Manages project metadata (`takoss.json`)
- File tree browsing and individual file access

### API Request Flow

1. **User Registration/Login** → JWT token issued → Frontend stores in localStorage
2. **Create Project Request** → `POST /api/generate` with auth header
3. **Orchestrator Execution** → 22 prompts executed sequentially across 7 phases
4. **File Generation** → ProjectWriter writes files to `./output/projects/{projectId}/`
5. **ZIP Creation** → Archive created for download
6. **Response** → Project metadata returned with success status
7. **View/Download** → User can browse files or download ZIP

### API Endpoints

**Authentication** (`/api/auth/*`)
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user (requires auth)
- `POST /api/auth/api-keys` - Create API key
- `GET /api/auth/api-keys` - List API keys
- `DELETE /api/auth/api-keys/:keyId` - Delete API key

**Project Generation** (`/api/*`)
- `POST /api/generate` - Generate new application (requires auth)
- `GET /api/projects` - List all projects (requires auth)
- `GET /api/projects/:projectId` - Get project details (requires auth)
- `GET /api/projects/:projectId/download` - Download ZIP (requires auth)
- `GET /api/projects/:projectId/files/*` - Get specific file (requires auth)
- `DELETE /api/projects/:projectId` - Delete project (requires auth)

**Public**
- `GET /health` - Health check
- `GET /api/examples` - Example project templates

### Database Schema (Prisma)

**User Model** - Authentication and user management
```prisma
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  password    String   // bcrypt hashed
  name        String?
  googleId    String?  @unique
  githubId    String?  @unique
  apiKeys     ApiKey[]
  projects    Project[]
  createdAt   DateTime @default(now())
  lastLoginAt DateTime?
}
```

**ApiKey Model** - Programmatic access
```prisma
model ApiKey {
  id         String    @id @default(uuid())
  key        String    @unique
  name       String
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  lastUsedAt DateTime?
  expiresAt  DateTime?
  createdAt  DateTime  @default(now())
}
```

**Project Model** - Generated project tracking
```prisma
model Project {
  id           String        @id @default(uuid())
  name         String
  description  String
  requirements String        @db.Text
  userId       String
  user         User          @relation(fields: [userId], references: [id])
  status       ProjectStatus @default(PENDING)
  projectPath  String?
  zipPath      String?
  createdAt    DateTime      @default(now())
  completedAt  DateTime?
}

enum ProjectStatus {
  PENDING
  GENERATING
  COMPLETED
  FAILED
}
```

### Frontend Architecture

**State Management**
- **Zustand** (`frontend/src/lib/store.ts`) - Global state for user, projects, theme, generation progress
- **React Query** - API data fetching, caching, and synchronization
- **localStorage** - JWT token persistence

**Key Frontend Hooks**
- `useAuth()` - Authentication utilities (login, register, logout)
- `useProjects()` - Project CRUD operations with React Query
- `useTheme()` - Theme switching (light/dark mode)

**Routing Structure**
```
/ (Dashboard) - Protected + Onboarding Required
/login - Public
/register - Public
/onboarding - Protected (first-time setup)
/new - Protected + Onboarding Required
/projects/:id - Protected + Onboarding Required
```

**Adaptive UI**
- Beginner users → 3-step wizard form with guidance
- Experienced users → Single-page quick form
- Selected during onboarding, stored in Zustand

### Important Implementation Notes

**Authentication**
- JWT tokens expire after 7 days
- API keys never expire unless manually deleted
- Both JWT and API key authentication supported
- Middleware: `authMiddleware.authenticate` accepts either method

**File Structure**
Generated projects written to: `./output/projects/{projectId}/`
```
{projectId}/
├── takoss.json          # Project metadata
├── README.md           # Generated documentation
├── frontend/           # React application
├── backend/            # Express API
├── prisma/            # Database schema
└── Dockerfile         # Deployment config
```

**Build System**
- Backend: TypeScript → `npm run build` → `dist/`
- Frontend: Vite → `npm run build` → `dist/`
- No `.js` extensions required in imports (standard module resolution)

**Error Handling**
All API errors return JSON:
```json
{ "error": "Error message here" }
```
With appropriate HTTP status codes (400, 401, 404, 500)

## Documentation

- **DEPLOYMENT.md** - Complete deployment guide (500+ lines)
- **FRONTEND_COMPONENTS.md** - Component API reference (400+ lines)
- **SESSION_COMPLETE.md** - Implementation summary
- **PROMPTS.md** - Details of 22 AI prompts (if exists)

## Recent Architecture Changes

This system was refactored from a complex task decomposition approach to a simpler, production-ready full-stack application:

**Removed:**
- BullMQ queue system (replaced with direct execution)
- Redis dependency (no longer needed)
- Complex task tree decomposition (replaced with sequential pipeline)
- QueueManager and related infrastructure

**Added:**
- Complete authentication system (JWT + API keys)
- Full React frontend with adaptive UI
- File output system with ZIP generation
- Docker production deployment
- REST API with proper authentication
- Database persistence with Prisma

The system is now **production-ready** and **fully functional** with zero external dependencies beyond PostgreSQL and AI API keys.
