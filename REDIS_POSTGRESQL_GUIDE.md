# Redis & PostgreSQL Guide for Takoss

This guide explains how Redis and PostgreSQL work in the Takoss platform and how to use them effectively.

---

## 📚 Table of Contents

1. [What are Redis and PostgreSQL?](#what-are-redis-and-postgresql)
2. [Why Takoss Needs Them](#why-takoss-needs-them)
3. [Installation & Setup](#installation--setup)
4. [Redis Basics](#redis-basics)
5. [PostgreSQL Basics](#postgresql-basics)
6. [How Takoss Uses Them](#how-takoss-uses-them)
7. [Common Operations](#common-operations)
8. [Troubleshooting](#troubleshooting)

---

## What are Redis and PostgreSQL?

### Redis - In-Memory Data Store

**Redis** (Remote Dictionary Server) is like a super-fast **filing cabinet in RAM**.

- **Speed**: Stores data in memory (RAM) instead of disk → **extremely fast** (microseconds vs milliseconds)
- **Use Cases**: Caching, session storage, real-time analytics, message queues
- **Data Structures**: Strings, lists, sets, hashes, sorted sets
- **Think of it as**: A temporary, lightning-fast notepad for your application

**Example**: Imagine you're cooking and need salt repeatedly. Instead of going to the pantry each time, you keep it on the counter (Redis) for quick access.

### PostgreSQL - Relational Database

**PostgreSQL** is like a **structured filing system on disk** with powerful organization.

- **Persistence**: Data stored permanently on disk
- **Structure**: Tables with rows and columns (like Excel spreadsheets)
- **Features**: Complex queries, transactions, relationships, constraints
- **Think of it as**: A permanent, organized library for your application

**Example**: Your bank account history - you need it stored forever, searchable, and reliable.

---

## Why Takoss Needs Them

### Redis (Port 6379)
Takoss uses Redis for **2 critical functions**:

#### 1. **Job Queue Management (BullMQ)**
- When you request an app, Takoss breaks it into many small tasks
- These tasks are queued in Redis
- Worker processes pick up tasks and execute them
- **Why Redis?**: Super fast, handles concurrent access, supports job retries

```
User Request → Task Decomposer → [Redis Queue] → Workers → Results
```

#### 2. **Context Accumulator (Prompt 3)**
- Stores results from completed tasks
- Passes context between dependent tasks
- Caches intermediate outputs
- **Why Redis?**: Fast reads/writes, automatic expiration (TTL), atomic operations

**Example Flow**:
```
Task 1: Generate User Model → Store in Redis
Task 2: Generate User Controller → Read User Model from Redis → Use as context
```

### PostgreSQL (Port 5432)
Takoss uses PostgreSQL for **Template Library (Prompt 4)**:

- **Stores**: Reusable prompt templates permanently
- **Tracks**: Template versions, usage analytics, performance metrics
- **Supports**: Full-text search, complex queries, relationships
- **Why PostgreSQL?**: Need permanent storage, complex queries, data integrity

**Example**:
```sql
-- Templates stored with versioning
PromptTemplate (v1) → "Generate React Component"
PromptTemplate (v2) → "Generate React Component" (improved)

-- Usage tracking
TemplateExecution → Which templates work best?
```

---

## Installation & Setup

### Option 1: Docker Compose (Recommended)

**What is Docker?** Think of it as a "shipping container" for software - runs anywhere identically.

```bash
# Start both Redis + PostgreSQL
docker-compose up -d

# Check if running
docker-compose ps

# View logs
docker-compose logs -f redis
docker-compose logs -f postgres

# Stop services
docker-compose down
```

**What happens?**
- Downloads Redis and PostgreSQL images (first time only)
- Starts both services in isolated containers
- Exposes ports: 6379 (Redis), 5432 (PostgreSQL)
- Persists data in Docker volumes (survives restarts)

### Option 2: Manual Installation

#### Windows
```powershell
# Redis (via WSL or Windows port)
# Download from: https://redis.io/download
# Or use Memurai (Windows fork): https://www.memurai.com/

# PostgreSQL
# Download installer: https://www.postgresql.org/download/windows/
```

#### Mac
```bash
# Install via Homebrew
brew install redis postgresql

# Start services
brew services start redis
brew services start postgresql
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt-get install redis-server postgresql

# Start services
sudo systemctl start redis
sudo systemctl start postgresql
```

### Verify Installation

```bash
# Test Redis connection
redis-cli ping
# Should return: PONG

# Test PostgreSQL connection
psql -U takoss -d takoss_db
# Should connect to database
```

---

## Redis Basics

### Data Types

#### 1. **Strings** (most common)
```bash
# Set a value
SET key "value"

# Get a value
GET key

# Set with expiration (60 seconds)
SETEX key 60 "temporary value"
```

**Takoss Example**:
```typescript
// Store task result
await redis.set('chain:123:result:task1', JSON.stringify(result));

// Retrieve it
const data = await redis.get('chain:123:result:task1');
```

#### 2. **Lists** (ordered collections)
```bash
# Add to list
RPUSH mylist "item1" "item2"

# Get list items
LRANGE mylist 0 -1
```

**Takoss Example** (Context History):
```typescript
// Append to execution history
await redis.rpush('chain:123:history', JSON.stringify(event));
```

#### 3. **Hashes** (key-value pairs within a key)
```bash
# Set hash fields
HSET user:1 name "Alice" age 30

# Get hash field
HGET user:1 name
```

### Key Concepts

#### TTL (Time To Live)
Redis can **automatically delete** data after a time period:

```bash
# Set key to expire in 3600 seconds (1 hour)
EXPIRE mykey 3600

# Check remaining TTL
TTL mykey
# Returns: seconds remaining or -1 (no expiration)
```

**Why Takoss Uses TTL**:
- Old task results aren't needed forever
- Automatic cleanup saves memory
- Default: 1 hour (configurable)

#### Atomic Operations
Redis operations are **atomic** (all-or-nothing):

```bash
# Increment counter atomically (thread-safe)
INCR page_views

# Multiple clients can do this simultaneously without conflicts
```

### Common Redis Commands

```bash
# Connect to Redis CLI
redis-cli

# List all keys (WARNING: slow on large databases)
KEYS *

# Find keys by pattern
KEYS chain:*

# Delete a key
DEL mykey

# Delete multiple keys
DEL key1 key2 key3

# Check if key exists
EXISTS mykey

# Get key type
TYPE mykey

# Clear entire database (DANGEROUS!)
FLUSHDB
```

---

## PostgreSQL Basics

### Database Structure

```
Database (takoss_db)
  └── Tables
        ├── prompt_templates (stores templates)
        ├── template_examples (stores examples)
        ├── template_executions (usage logs)
        └── template_collections (groups)
```

### SQL Primer

#### SELECT (Read Data)
```sql
-- Get all templates
SELECT * FROM prompt_templates;

-- Get specific columns
SELECT id, name, category FROM prompt_templates;

-- Filter results
SELECT * FROM prompt_templates WHERE category = 'FRONTEND';

-- Sort results
SELECT * FROM prompt_templates ORDER BY usage_count DESC;

-- Limit results
SELECT * FROM prompt_templates LIMIT 10;
```

####  INSERT (Create Data)
```sql
-- Add a new template
INSERT INTO prompt_templates (id, name, description, template, category)
VALUES (
  'uuid-here',
  'My Template',
  'Template description',
  'Template content...',
  'FRONTEND'
);
```

#### UPDATE (Modify Data)
```sql
-- Update a template
UPDATE prompt_templates
SET usage_count = usage_count + 1,
    last_used_at = NOW()
WHERE id = 'template-id';
```

#### DELETE (Remove Data)
```sql
-- Delete a template
DELETE FROM prompt_templates WHERE id = 'template-id';

-- Soft delete (mark inactive)
UPDATE prompt_templates SET is_active = false WHERE id = 'template-id';
```

### Prisma - The TypeScript ORM

**What is Prisma?** Think of it as a "translator" between TypeScript and SQL.

Instead of writing SQL:
```sql
SELECT * FROM prompt_templates WHERE category = 'FRONTEND';
```

You write TypeScript:
```typescript
const templates = await prisma.promptTemplate.findMany({
  where: { category: 'FRONTEND' }
});
```

**Benefits**:
- Type-safe (catches errors at compile time)
- Auto-completion in IDE
- Automatic migrations
- Relationships handled automatically

### Prisma Workflow

```bash
# 1. Define schema (prisma/schema.prisma)
model PromptTemplate {
  id    String  @id @default(uuid())
  name  String
  // ... other fields
}

# 2. Generate database migration
npm run prisma:migrate

# 3. Generate TypeScript client
npm run prisma:generate

# 4. Use in code
const template = await prisma.promptTemplate.create({
  data: { name: 'My Template', ... }
});
```

### Common Prisma Operations

```typescript
// CREATE
const template = await prisma.promptTemplate.create({
  data: { name: 'My Template', description: '...', ... }
});

// READ (single)
const template = await prisma.promptTemplate.findUnique({
  where: { id: 'template-id' }
});

// READ (multiple)
const templates = await prisma.promptTemplate.findMany({
  where: { category: 'FRONTEND' },
  orderBy: { createdAt: 'desc' }
});

// UPDATE
const updated = await prisma.promptTemplate.update({
  where: { id: 'template-id' },
  data: { usageCount: { increment: 1 } }
});

// DELETE
await prisma.promptTemplate.delete({
  where: { id: 'template-id' }
});

// SEARCH
const results = await prisma.promptTemplate.findMany({
  where: {
    name: { contains: 'React', mode: 'insensitive' }
  }
});
```

---

## How Takoss Uses Them

### Data Flow Diagram

```
┌─────────────┐
│ User Request│
│ "Build CRM" │
└──────┬──────┘
       │
       v
┌──────────────────┐
│ Task Decomposer  │
│ Creates Subtasks │
└──────┬───────────┘
       │
       v
┌──────────────────────────┐
│ Prompt Chain Orchestrator│
└────┬────────────────┬────┘
     │                │
     v                v
┌─────────┐    ┌─────────────────┐
│  Redis  │    │   PostgreSQL    │
│ (Queue) │    │ (Templates DB)  │
└────┬────┘    └────┬────────────┘
     │              │
     │              v
     │      ┌────────────────────┐
     │      │Get Template by ID  │
     │      │ "React Component"  │
     │      └───────┬────────────┘
     │              │
     │              v
     └───────>┌──────────────┐
              │ Queue Job    │
              │ Task 1       │
              └──────┬───────┘
                     │
                     v
              ┌──────────────┐
              │ Worker       │
              │ Executes     │
              │ with Claude  │
              └──────┬───────┘
                     │
                     v
              ┌──────────────────┐
              │ Store Result     │
              │ in Redis         │
              │ (Context Accum)  │
              └──────┬───────────┘
                     │
                     v
              ┌──────────────────┐
              │ Next Task Uses   │
              │ Previous Context │
              └──────────────────┘
```

### Example: Building a Todo App

1. **User Input**: "Build a Todo app with React and Express"

2. **Task Decomposer** breaks it down:
   - Task 1: Create React Component (TodoList)
   - Task 2: Create Express API Route (/api/todos)
   - Task 3: Connect Frontend to Backend

3. **Orchestrator** queues tasks in **Redis**:
   ```typescript
   // Task goes into BullMQ queue (stored in Redis)
   await queueManager.addJob({
     chainId: 'chain-123',
     taskId: 'task-1',
     prompt: '...',
     modelType: 'claude'
   });
   ```

4. **Worker** picks up Task 1:
   - Fetches template from **PostgreSQL**
   - Executes with Claude
   - Stores result in **Redis** (Context Accumulator)

5. **Task 2** starts:
   - Reads Task 1 result from **Redis**
   - Uses it as context
   - Generates API route that matches React component

---

## Common Operations

### Takoss-Specific Redis Operations

```typescript
import { ContextAccumulator } from './core/contextAccumulator';

const contextAccum = new ContextAccumulator();

// Store a result
await contextAccum.storeResult('chain-123', {
  id: 'result-1',
  taskId: 'task-1',
  status: 'success',
  output: 'Generated code here...',
  metadata: { ... }
});

// Retrieve a result
const result = await contextAccum.getResult('chain-123', 'task-1');

// Get execution history
const history = await contextAccum.getHistory('chain-123');

// Clean up old data
await contextAccum.cleanupChain('chain-123');

// Get statistics
const stats = await contextAccum.getChainStats('chain-123');
```

### Takoss-Specific PostgreSQL Operations

```typescript
import { TemplateLibraryService } from './core/templateLibraryService';

const templateService = new TemplateLibraryService();

// Create a template
const template = await templateService.createTemplate({
  name: 'Custom React Hook',
  description: 'Generate a custom React hook',
  template: 'You are an expert...',
  variables: ['hookName', 'description'],
  category: 'frontend',
  modelType: 'claude'
});

// Get templates by category
const frontendTemplates = await templateService.getTemplatesByCategory('frontend');

// Search templates
const results = await templateService.searchTemplates('react');

// Track usage
await templateService.recordTemplateUsage('template-id', {
  chainId: 'chain-123',
  taskId: 'task-1',
  modelType: 'claude',
  executionTime: 2500,
  promptTokens: 1000,
  completionTokens: 500,
  status: 'success'
});

// Get analytics
const analytics = await templateService.getTemplateAnalytics('template-id');
```

---

## Troubleshooting

### Redis Issues

#### Cannot connect to Redis
```bash
# Check if Redis is running
docker-compose ps
# OR
redis-cli ping

# Restart Redis
docker-compose restart redis

# Check logs
docker-compose logs redis
```

#### Redis out of memory
```bash
# Check memory usage
redis-cli INFO memory

# Clear database (CAREFUL!)
redis-cli FLUSHDB

# Reduce TTL in code to expire data faster
```

#### Lost connection errors
```typescript
// In code: Reconnect on error
redis.on('error', (err) => {
  console.error('Redis error:', err);
});

redis.on('reconnecting', () => {
  console.log('Reconnecting to Redis...');
});
```

### PostgreSQL Issues

#### Cannot connect to PostgreSQL
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check connection with psql
psql -h localhost -U takoss -d takoss_db

# Restart PostgreSQL
docker-compose restart postgres

# Check logs
docker-compose logs postgres
```

#### Prisma migration issues
```bash
# Reset database (DELETES ALL DATA!)
npm run db:reset

# Create new migration
npm run prisma:migrate

# Regenerate Prisma client
npm run prisma:generate
```

#### Database locked / connection pool exhausted
```typescript
// Increase connection pool in schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add connection pooling
  // connection_limit = 20
}
```

### General Docker Issues

```bash
# Remove all containers and volumes (NUCLEAR OPTION)
docker-compose down -v

# Remove unused images
docker system prune -a

# Check Docker disk usage
docker system df
```

---

## Next Steps

Now you understand:
- ✅ What Redis and PostgreSQL are
- ✅ Why Takoss needs them
- ✅ How to set them up
- ✅ Basic operations in both
- ✅ How Takoss uses them internally

**Ready to continue?** We can now:
1. Start the infrastructure
2. Run database migrations
3. Seed default templates
4. Test Phase 1 end-to-end

Let me know when you're ready to proceed!
