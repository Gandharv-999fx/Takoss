# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Takoss is an AI-powered full-stack application builder that generates complete web applications from natural language descriptions. It uses a hierarchical task decomposition approach to break down complex requirements into atomic, executable tasks that guide AI models through iterative code generation.

## Development Commands

### Building and Running
- **Install dependencies**: `npm install`
- **Build project**: `npm run build` (compiles TypeScript to JavaScript in `dist/`)
- **Run demo**: `npm start` (runs the compiled demo from `dist/index.js`)
- **Run in development**: `npm run dev` (runs directly from TypeScript source)
- **Run tests**: `npm test` (runs Jest test suite)

### TypeScript Configuration
- Target: ES2020
- Module system: NodeNext (ESM-style imports with `.js` extensions required)
- Output directory: `dist/`
- Source directory: `src/`

## Architecture Overview

### Core System Design

Takoss operates on a **three-layer architecture**:

1. **Task Decomposition Layer** (`TaskDecomposer`)
   - Recursively breaks down high-level app requirements into a hierarchical tree
   - Stops decomposition at configurable depth (`maxDepth`) or minimum task size
   - Groups requirements by type (feature, component, function, schema, test, style)
   - Produces atomic tasks that map to specific prompt templates

2. **Prompt Template Layer** (`PromptTemplateManager`)
   - Manages reusable templates for different component types
   - Categories: frontend, backend, database, auth, testing, deployment
   - Variable substitution system using `{{variable}}` syntax
   - Templates specify preferred model type (Claude/Gemini)

3. **Execution Layer** (`PromptChainOrchestrator` + `AIModelService`)
   - **Orchestrator**: Manages parallel execution of atomic tasks via BullMQ queue
   - **Queue Manager**: Handles job queuing with Redis backend, retry logic, concurrency control
   - **Model Service**: Executes prompts using Claude (Anthropic SDK) or Gemini (Google Generative AI)
   - Real-time progress updates via Socket.IO on port 3001
   - Context propagation: tasks can access results from parent/dependency tasks

### Key Data Structures

- **SubtaskTree**: Contains hierarchical TaskNode structure with root task and ID-based lookup map
- **TaskNode**: Represents a unit of work with status, type, children IDs, prompt template reference, and optional result
- **PromptChainState**: Tracks execution state including progress (0-100), current substep, and accumulated results
- **ExecutionContext**: Carries chainId, previous results, variables, depth, and parent task info between execution steps

### Integration Points

- **AI Models**:
  - Claude via `@anthropic-ai/sdk` (model: `claude-3-sonnet-20240229`)
  - Gemini via `@google/generative-ai` (model: `gemini-1.5-pro`)
  - API keys: `process.env.CLAUDE_API_KEY`, `process.env.GEMINI_API_KEY`
  
- **Queue System**: Requires Redis instance at `redis://localhost:6379` (configurable)

- **WebSocket**: Express + Socket.IO server for real-time updates (default port 3001)

### Module Import Conventions

All internal imports use `.js` extensions due to NodeNext module resolution:
```typescript
import { TaskDecomposer } from './core/taskDecomposer.js';
```

### Prompt Template System

Templates are defined in `src/templates/promptTemplates.ts` with:
- Unique UUID identifier
- Category classification (frontend/backend/database/auth/testing/deployment/other)
- Variable list for substitution
- Optional model preference and examples

Default template mappings configured in `TaskDecompositionConfig.defaultPromptTemplates` by task type.

### Task Execution Flow

1. Create `SubtaskTree` from app requirements → Task decomposition
2. Find atomic tasks (leaf nodes with `promptTemplate` assigned)
3. Create `PromptChain` → Initialize execution state
4. Queue atomic tasks → BullMQ jobs with context
5. Process jobs → Model execution with Claude/Gemini
6. Store results → Update chain state and progress
7. Propagate context → Child tasks receive parent results

### Status Propagation

Task status updates propagate up the tree: when all children of a parent reach 'completed', the parent automatically transitions to 'completed'.
