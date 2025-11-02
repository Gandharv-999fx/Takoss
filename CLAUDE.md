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
- Executes 6 phases in sequence with AI-powered code generation:
  1. **Requirements Analysis** - Uses LangChain to extract entities, features, relationships, and UI requirements
  2. **Complexity Estimation** - Rule-based scoring to determine project complexity
  3. **Database Schema** - Generates complete Prisma schema from entities with AI refinement
  4. **Frontend Components** - Generates React/TypeScript components for ALL UI requirements with proper dependencies
  5. **Backend API** - Generates Express routes with CRUD operations, validation, and Prisma integration
  6. **Deployment Configuration** - Creates Dockerfile, docker-compose.yml, and CI/CD configs
- Includes visualization (DAG) and plain-language project explanation
- Returns `GenerationResult` with actual generated code from all phases

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
- Generates complete project structure:
  - **Frontend**: Vite + React + TypeScript with Tailwind CSS
  - **Backend**: Express + TypeScript with Prisma
  - **Config files**: package.json, tsconfig.json, vite.config.ts, tailwind.config.js
  - **Deployment**: Dockerfile, docker-compose.yml, .dockerignore
  - **Environment**: .env.example with all required variables
- Creates ZIP archives for download
- Manages project metadata (`takoss.json`)
- File tree browsing and individual file access

### API Request Flow

1. **User Registration/Login** → JWT token issued → Frontend stores in localStorage
2. **Create Project Request** → `POST /api/generate` with auth header
3. **Orchestrator Execution** → 6 phases executed sequentially with AI code generation:
   - Phase 1: Analyze requirements → Extract entities, features, UI requirements
   - Phase 2: Estimate complexity → Calculate complexity score
   - Phase 3: Generate database schema → Create and refine Prisma schema
   - Phase 4: Generate frontend → Create React components with Tailwind
   - Phase 5: Generate backend → Create Express routes with Prisma integration
   - Phase 6: Generate deployment → Create Docker configs and CI/CD
4. **File Generation** → ProjectWriter creates complete project structure from generated code
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

## Recent Bug Fixes & Improvements (2025-11-02)

### Critical Fixes

The system had a major logical issue where it was only generating placeholder boilerplate code instead of actual functional applications. The following fixes were implemented:

**1. Fixed Code Generation (Priority 1)**
- ✅ **ProjectWriter**: Now uses actual generated code instead of hardcoded placeholders
- ✅ **Component Storage**: SimpleTakossOrchestrator now stores generated component code (not just count)
- ✅ **All UI Requirements**: Now processes ALL UI requirements instead of just the first one
- ✅ **Database Schema**: Implemented actual Prisma schema generation from entities with AI refinement

**2. AI Model Optimization (Priority 1)**
- ✅ **Token Limit**: Increased from 4000 → 8192 tokens for better code generation
- ✅ **System Prompts**: Added comprehensive code generation guidelines
- ✅ **Temperature**: Optimized to 0.2 for consistent code output (was unset, used defaults)
- ✅ **Configurable Settings**: Made temperature and token limits configurable per task

**3. Backend & Deployment Generation (Priority 2)**
- ✅ **Backend API**: Integrated APIEndpointDecomposer to generate Express routes with CRUD, validation, and Prisma
- ✅ **Deployment Configs**: Integrated DeploymentTaskDecomposer to generate Dockerfile, docker-compose.yml, CI/CD

**4. Infrastructure Documentation (Priority 4)**
- ✅ **Marked Unused Files**: Added clear comments to unused infrastructure (~2000+ lines):
  - `src/core/promptChainOrchestrator.ts` - BullMQ-based task orchestration (kept for reference)
  - `src/core/taskDecomposer.ts` - Dynamic task decomposition (kept for reference)
  - `src/core/queueManager.ts` - Queue management with Redis (kept for reference)
  - `src/core/contextAccumulator.ts` - Redis-based context sharing (kept for reference)
  - `src/templates/promptTemplates.ts` - Static prompt templates (kept for reference)

### What Was Broken

**Root Cause**: The SimpleTakossOrchestrator was a placeholder implementation that:
1. Generated component code but immediately discarded it (only stored count)
2. Used hardcoded placeholder files in ProjectWriter
3. Didn't actually generate database schemas, backend routes, or deployment configs
4. Had AI token limits too low for code generation (4000 vs 8192)
5. Had no system prompts to guide code quality

**What Works Now**:
- ✅ Full React component generation with proper TypeScript and Tailwind
- ✅ Complete Prisma schema generation from entities
- ✅ Express API routes with CRUD operations, validation, and error handling
- ✅ Dockerfile, docker-compose.yml, and CI/CD configs
- ✅ Proper monorepo structure with frontend/backend workspaces
- ✅ All configuration files (package.json, tsconfig.json, vite.config.ts, etc.)

## Architecture Overview

**Active System**: SimpleTakossOrchestrator (6-phase direct execution pipeline)

**Unused Infrastructure** (kept for reference):
- PromptChainOrchestrator - Complex BullMQ + Redis orchestration for distributed tasks
- TaskDecomposer - Dynamic task tree decomposition
- QueueManager - BullMQ queue management
- ContextAccumulator - Redis-based context sharing

These were part of an earlier complex architecture but the current system uses a simpler, production-ready approach with direct execution and in-memory context passing.

The system is now **production-ready** and **fully functional** with zero external dependencies beyond PostgreSQL and AI API keys.
