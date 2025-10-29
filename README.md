# Takoss - AI-Powered Full-Stack Application Builder

Takoss is an AI-powered full-stack application builder platform that generates complete web applications from natural language descriptions. The platform works by breaking down user requirements into a hierarchical tree of specific, executable substeps that guide AI models through code generation iteratively.

## Core Components

1. **Task Decomposition Engine**: Breaks down high-level app descriptions into a hierarchical tree of specific, executable tasks.
2. **Prompt Template System**: Manages templates for generating prompts for different types of application components.
3. **AI Model Integration**: Interfaces with Claude and Gemini AI models to execute the atomic tasks.

## Project Structure

```
src/
├── core/
│   ├── taskDecomposer.ts       # Core task decomposition algorithm
│   ├── promptTemplateManager.ts # Manages prompt templates
│   └── aiModelService.ts       # Integrates with LangChain and AI models
├── templates/
│   └── promptTemplates.ts      # Collection of prompt templates
├── types/
│   └── interfaces.ts           # TypeScript interfaces
└── index.ts                    # Demo application
```

## Key Features

- **Recursive Task Decomposition**: Breaks down complex tasks until reaching atomic, executable prompts
- **Hierarchical Task Tree**: Organizes tasks in a structured tree for better management
- **Prompt Template System**: Reusable templates for common application components
- **LangChain Integration**: Leverages LangChain for AI model interaction
- **TypeScript Type Safety**: Strong typing throughout the codebase

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for Redis and PostgreSQL)
- Claude API key from [Anthropic](https://console.anthropic.com/)
- Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd takoss
npm install
```

### 2. Start Infrastructure Services

Start Redis and PostgreSQL using Docker Compose:

```bash
# Start core services (Redis + PostgreSQL)
docker-compose up -d

# OR start with optional GUI tools (Redis Commander + PgAdmin)
docker-compose --profile tools up -d

# Verify services are running
docker-compose ps
```

**Service URLs:**
- Redis: `localhost:6379`
- PostgreSQL: `localhost:5432`
- Redis Commander (optional): `http://localhost:8081`
- PgAdmin (optional): `http://localhost:5050` (login: `admin@takoss.local` / `admin`)

### 3. Configure Environment Variables

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your API keys
# CLAUDE_API_KEY=sk-ant-...
# GEMINI_API_KEY=...
```

### 4. Set Up Database

```bash
# Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate dev --name init

# Seed default prompt templates (once implemented)
npm run seed
```

### 5. Build and Run

```bash
# Build the TypeScript project
npm run build

# Run the demo application
npm start

# OR run in development mode with hot reload
npm run dev
```

### 6. Stop Infrastructure

```bash
# Stop services
docker-compose down

# Stop and remove volumes (will delete data)
docker-compose down -v
```

## Usage Example

```typescript
// Initialize components
const promptManager = new PromptTemplateManager(promptTemplates);
const aiService = new AIModelService(promptManager, process.env.CLAUDE_API_KEY);
const taskDecomposer = new TaskDecomposer(config, promptManager);

// Create a subtask tree from app requirements
const appTree = await taskDecomposer.createSubtaskTree(
  'My App',
  'App description',
  requirements
);

// Find atomic tasks that can be executed by AI models
const atomicTasks = taskDecomposer.findAtomicTasks(appTree);

// Execute tasks with AI models
for (const task of atomicTasks) {
  const result = await aiService.executeTask(task);
  taskDecomposer.updateTaskStatus(appTree, task.id, 'completed', result);
}
```

## License

MIT