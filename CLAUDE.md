# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Takoss is an AI-powered full-stack application builder that generates complete web applications from natural language descriptions using a hierarchical task decomposition approach. The system breaks down high-level requirements into atomic, executable tasks that guide AI models (Claude and Gemini) through iterative code generation.

## Development Commands

### Infrastructure Setup (First Time)
```bash
docker-compose up -d              # Start Redis + PostgreSQL
cp .env.example .env              # Create environment file and add API keys
npx prisma generate               # Generate Prisma client
npx prisma migrate dev            # Run database migrations
```

**Required Services:**
- Redis (port 6379) - For BullMQ job queues and context caching
- PostgreSQL (port 5432) - For prompt template library
- Optional GUIs: Redis Commander (8081), PgAdmin (5050)

### Building and Running
- **Build**: `npm run build` - Compiles TypeScript to `dist/`
- **Run demo**: `npm start` - Executes compiled code from `dist/index.js`
- **Development mode**: `npm run dev` - Runs directly from TypeScript source using ts-node
- **Tests**: `npm test` - Runs Jest test suite

### TypeScript Configuration
- Target: ES2020, Module system: NodeNext (ESM-style)
- All internal imports must use `.js` extensions: `import { X } from './core/file.js'`
- Output: `dist/`, Source: `src/`

## Core Architecture

### Three-Layer System

**1. Task Decomposition Layer** (`src/core/taskDecomposer.ts`)
- Recursively decomposes high-level app requirements into hierarchical `SubtaskTree`
- Configurable via `TaskDecompositionConfig` (maxDepth, minTaskSize)
- Groups tasks by type: feature, component, function, schema, test, style, other
- Produces atomic tasks (leaf nodes) that map to specific prompt templates
- Key method: `createSubtaskTree()` returns `SubtaskTree` with root TaskNode and ID-based lookup map

**2. Prompt Template Layer** (`src/core/promptTemplateManager.ts`)
- Manages reusable `PromptTemplate` objects for different component types
- Categories: frontend, backend, database, auth, testing, deployment, other
- Variable substitution using `{{variable}}` syntax
- Templates specify preferred model type (claude/gemini/any)
- Templates defined in `src/templates/promptTemplates.ts` with UUID identifiers

**3. Execution Layer** (`src/core/promptChainOrchestrator.ts` + `queueManager.ts` + `modelService.ts`)
- **PromptChainOrchestrator**: Manages parallel execution via BullMQ queue
  - Creates `PromptChainState` to track execution progress (0-100%)
  - Real-time updates via Socket.IO (default port 3001)
  - Context propagation: child tasks receive parent results
- **QueueManager**: Handles job queuing with Redis backend
  - BullMQ v4+ (QueueScheduler removed, uses Worker pattern)
  - Retry logic with exponential backoff (3 attempts default)
  - Configurable concurrency
- **ModelService**: Executes prompts using AI models
  - Claude via `@anthropic-ai/sdk` (model: `claude-3-sonnet-20240229`)
  - Gemini via `@google/generative-ai` (model: `gemini-1.5-pro`)
  - Requires API keys: `process.env.CLAUDE_API_KEY`, `process.env.GEMINI_API_KEY`

### Key Data Structures

**SubtaskTree** (`src/types/interfaces.ts`)
```typescript
{
  id: string;
  name: string;
  root: TaskNode;  // Direct access to root node
  tasks: Record<string, TaskNode>;  // ID-based lookup map
  appRequirements: AppRequirement[];
}
```

**TaskNode** (`src/types/interfaces.ts`)
```typescript
{
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  type: 'feature' | 'component' | 'function' | 'schema' | 'style' | 'test' | 'other';
  children: string[];  // Child task IDs
  subtasks?: TaskNode[];  // Alternative: direct child objects
  promptTemplate?: string;  // Template ID reference
  prompt?: string;  // Actual prompt text
  dependencies?: string[];  // Task dependencies
  requiresPreviousResults?: boolean;  // Context propagation flag
  result?: string;  // Generated code/output
}
```

**PromptChainState** (`src/types/orchestrator.ts`)
- Tracks execution state with `progress` (0-100), `status`, `currentSubstepId`
- Accumulates results in `Record<string, SubstepResult>`
- Automatically transitions parent status to 'completed' when all children complete

**ExecutionContext** (`src/types/orchestrator.ts`)
- Carries `chainId`, `previousResults`, `variables`, `depth`, `parentTaskId` between steps
- Enables tasks to access results from parent/dependency tasks

### Task Execution Flow

1. **Decomposition**: `TaskDecomposer.createSubtaskTree()` → Hierarchical `SubtaskTree`
2. **Find Atomic Tasks**: `findAtomicTasks()` → Returns leaf nodes with `promptTemplate`
3. **Create Chain**: `PromptChainOrchestrator.createChain()` → Initialize `PromptChainState`
4. **Queue Jobs**: Atomic tasks queued as `PromptJobData` via BullMQ
5. **Execute**: `ModelService.executePrompt()` → Claude or Gemini API call
6. **Store Results**: Update chain state and progress, emit Socket.IO events
7. **Propagate Context**: Child tasks receive parent results if `requiresPreviousResults` is true

### Integration Points

**Redis**: Required for BullMQ queue system (default: `redis://localhost:6379`)

**Socket.IO**: Express + Socket.IO server for real-time progress updates
- Events: `progress_update`, `state_update`
- Clients subscribe to chains by ID

**AI Models**:
- Import Anthropic SDK: `import Anthropic from '@anthropic-ai/sdk'` (default export)
- Uses messages API (SDK v0.39+), not legacy completions API

### Important Implementation Details

**Module Imports**: All internal imports require `.js` extensions due to NodeNext resolution:
```typescript
import { TaskDecomposer } from './core/taskDecomposer.js';
```

**BullMQ v4+ Changes** (documented in FIXES.md):
- `QueueScheduler` is deprecated and removed
- Use `Worker` pattern for job processing
- No `timeout` property in `JobsOptions` (use job-level timeout handling)

**Error Handling**: Always use type assertions in catch blocks:
```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
}
```

**Status Propagation**: Task status updates bubble up the tree automatically - when all children reach 'completed', the parent transitions to 'completed'.

## Recent Fixes Applied

See `FIXES.md` for comprehensive list of 21 fixes applied including:
- Interface extensions (TaskNode, SubtaskTree)
- BullMQ v4+ migration (removed QueueScheduler)
- Anthropic SDK updates (default import, messages API)
- Error handling improvements
- TypeScript configuration (`skipLibCheck: true`)
