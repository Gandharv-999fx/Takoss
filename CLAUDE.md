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

## Architecture Overview

**Takoss has TWO systems that coexist:**

### 1. Original Complex System (Advanced Task Decomposition)
**Location:** `src/core/*`

**Purpose:** Hierarchical task decomposition with queue-based parallel execution

**Components:**
- **TaskDecomposer** (`taskDecomposer.ts`) - Breaks down requirements into hierarchical task trees
- **PromptChainOrchestrator** (`promptChainOrchestrator.ts`) - Manages execution via BullMQ queues
- **QueueManager** (`queueManager.ts`) - Redis-backed job queue with retry logic
- **PromptTemplateManager** (`promptTemplateManager.ts`) - Reusable prompt templates
- **ModelService** (`modelService.ts`) - AI model execution (Claude/Gemini)
- **Advanced Features:**
  - Context Accumulation (`contextAccumulator.ts`)
  - Adaptive Prompt Refinement (`adaptivePromptRefinement.ts`)
  - Self-Correcting Loop (`selfCorrectingLoop.ts`)
  - Human-in-the-Loop (`humanInTheLoop.ts`)
  - Template Library Service (`templateLibraryService.ts`)

**Dependencies:** Redis (required), BullMQ, Socket.IO

**Use Case:** Complex applications requiring fine-grained task control, parallel execution, and advanced AI orchestration

---

### 2. Production REST API System (Simple & Complete)
**Location:** `src/api/*`, `src/orchestrator/*`, `src/auth/*`, `frontend/*`

**Purpose:** Production-ready full-stack application with authentication and web UI

**Backend Components:**
- **TakossAPIServer** (`src/api/server.ts`) - Express REST API with Socket.IO
  - **NEW:** Real-time streaming support via Server-Sent Events (SSE)
  - **Endpoints:** `/api/generate` (non-streaming), `/api/generate/stream` (SSE)
- **SimpleTakossOrchestrator** (`src/orchestrator/simpleTakossOrchestrator.ts`) - Sequential pipeline (22 prompts)
  - **NEW:** Extends EventEmitter for real-time progress events
  - **Events:** phase_start, phase_progress, phase_complete, error, complete
- **AuthService** (`src/auth/authService.ts`) - JWT + API key authentication with bcrypt
- **ProjectWriter** (`src/output/projectWriter.ts`) - File output and ZIP generation
- **Database** (Prisma + PostgreSQL) - User, ApiKey, Project models

**Frontend Components:**
- **Pages:** Login, Register, Onboarding, Dashboard, NewProject, ProjectDetails
- **Components:** Layout, ProjectCard, CodeViewer, FileTree, ProgressTracker, LoadingSpinner, EmptyState
  - **NEW:** ProgressTracker automatically displays real-time streaming progress
- **Hooks:** useAuth, useProjects, useTheme
  - **NEW:** useProjects now uses streaming API with progress callbacks
- **State:** Zustand + React Query
  - **NEW:** Progress state updates in real-time during generation
- **API Client:** (`frontend/src/lib/api.ts`)
  - **NEW:** generateApplicationStreaming() method with SSE support
- **Styling:** Tailwind CSS v4 with animations

**DevOps:**
- Docker Compose (PostgreSQL, Backend, Frontend/Nginx)
- Multi-stage builds
- Health checks

**Dependencies:** PostgreSQL (required), No Redis needed

**Use Case:** Production deployment with web UI, user authentication, and simple project generation

---

## Which System to Use?

**Use Original Complex System when:**
- You need fine-grained control over task decomposition
- Parallel execution of independent tasks is critical
- You want advanced features (self-correction, human-in-loop)
- You're building complex multi-phase applications
- You have Redis infrastructure available

**Use Production REST API System when:**
- You want a complete working system with UI
- User authentication and project management are needed
- Sequential execution is acceptable
- You want to deploy quickly with Docker
- You prefer simplicity over advanced orchestration

---

## Original Complex System - Technical Details

### Core Data Structures

**SubtaskTree** (`src/types/interfaces.ts`)
```typescript
{
  id: string;
  name: string;
  description: string;
  rootTaskId: string;
  root: TaskNode;  // Direct access to root node
  tasks: Record<string, TaskNode>;  // ID-based lookup map
  appRequirements: AppRequirement[];
}
```

**TaskNode** (`src/types/interfaces.ts`)
```typescript
{
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  type: 'feature' | 'component' | 'function' | 'schema' | 'style' | 'test' | 'other';
  children: string[];  // Child task IDs
  subtasks?: TaskNode[];  // Alternative: direct child objects
  promptTemplate?: string;  // Template ID reference
  prompt?: string;  // Actual prompt text
  dependencies?: string[];  // Task dependencies
  requiresPreviousResults?: boolean;  // Context propagation flag
  result?: string;  // Generated code/output
  createdAt: Date;
  updatedAt: Date;
}
```

**PromptChainState** (`src/types/orchestrator.ts`)
- Tracks execution state with `progress` (0-100), `status`, `currentSubstepId`
- Accumulates results in `Record<string, SubstepResult>`
- Automatically transitions parent status to 'completed' when all children complete

**ExecutionContext** (`src/types/orchestrator.ts`)
- Carries `chainId`, `previousResults`, `variables`, `depth`, `parentTaskId` between steps
- Enables tasks to access results from parent/dependency tasks

### Original System Execution Flow

1. **Decomposition**: `TaskDecomposer.createSubtaskTree()` → Hierarchical `SubtaskTree`
2. **Find Atomic Tasks**: `findAtomicTasks()` → Returns leaf nodes with `promptTemplate`
3. **Create Chain**: `PromptChainOrchestrator.createChain()` → Initialize `PromptChainState`
4. **Queue Jobs**: Atomic tasks queued as `PromptJobData` via BullMQ
5. **Parallel Execution**: Workers process jobs concurrently from Redis queue
6. **Execute Prompts**: `ModelService.executePrompt()` → Claude or Gemini API call
7. **Store Results**: Update chain state and progress, emit Socket.IO events
8. **Propagate Context**: Child tasks receive parent results if `requiresPreviousResults` is true
9. **Status Updates**: Task status bubbles up - when all children complete, parent transitions to completed

### Integration Points (Original System)

**Redis**: Required for BullMQ queue system (default: `redis://localhost:6379`)

**Socket.IO**: Express + Socket.IO server for real-time progress updates
- Events: `progress_update`, `state_update`
- Clients subscribe to chains by ID

**BullMQ v4+**:
- No `QueueScheduler` (deprecated and removed)
- Uses `Worker` pattern for job processing
- No `timeout` property in `JobsOptions` (use job-level timeout handling)

**AI Models**:
- Import Anthropic SDK: `import Anthropic from '@anthropic-ai/sdk'` (default export)
- Uses messages API (SDK v0.39+), not legacy completions API
- Claude model: `claude-3-sonnet-20240229`
- Gemini model: `gemini-1.5-pro`

---

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

## Recent Changes (This Session)

**IMPORTANT:** The original complex system was NOT removed. We ADDED a new production-ready system alongside it.

### What Was Added (Production REST API System)

**New Components:**
- `src/api/server.ts` - Full REST API with authentication
- `src/orchestrator/simpleTakossOrchestrator.ts` - Sequential pipeline orchestrator
- `src/auth/authService.ts` - JWT and API key authentication
- `src/auth/authMiddleware.ts` - Authentication middleware
- `src/output/projectWriter.ts` - File output and ZIP generation
- `frontend/*` - Complete React application (23 files)
  - 6 pages (Login, Register, Onboarding, Dashboard, NewProject, ProjectDetails)
  - 7 components (Layout, ProjectCard, CodeViewer, FileTree, etc.)
  - 3 custom hooks (useAuth, useProjects, useTheme)
  - API client and Zustand store
- `docker-compose.production.yml` - Production deployment configuration
- `Dockerfile.backend` and `frontend/Dockerfile` - Container builds
- Updated Prisma schema with User, ApiKey, Project models

**Documentation Added:**
- `DEPLOYMENT.md` (500+ lines) - Complete deployment guide
- `FRONTEND_COMPONENTS.md` (400+ lines) - Component reference
- `SESSION_COMPLETE.md` - Implementation summary
- `STREAMING.md` (600+ lines) - **NEW:** Real-time streaming implementation guide
- `SYSTEM_COMPARISON.md` (500+ lines) - Comparison of both systems
- `INDUSTRY_COMPARISON.md` (500+ lines) - Comparison with industry leaders

### What Still Exists (Original Complex System)

**All original components remain fully functional:**
- `src/core/taskDecomposer.ts` - Hierarchical task decomposition
- `src/core/promptChainOrchestrator.ts` - Queue-based orchestration
- `src/core/queueManager.ts` - BullMQ job queue management
- `src/core/promptTemplateManager.ts` - Template system
- `src/core/modelService.ts` - AI model execution
- Advanced features: Context accumulation, adaptive refinement, self-correction, human-in-loop
- Redis and BullMQ dependencies still in package.json

### Current State

**Two parallel systems:**
1. **Original System** - Complex, feature-rich, requires Redis
2. **New Production System** - Simple, complete with UI, PostgreSQL-only

Both are **production-ready** and serve different use cases. Choose based on your requirements.
