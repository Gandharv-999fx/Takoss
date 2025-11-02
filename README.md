# Takoss - AI-Powered Full-Stack Application Builder

Takoss is an AI-powered full-stack application builder platform that generates complete web applications from natural language descriptions. Simply describe your application idea, choose your preferred AI model (Claude or Gemini), and Takoss will generate a complete full-stack project with React frontend, Express backend, Prisma database schemas, and Docker deployment configurations.

## ✨ Key Features

- **🤖 Multiple AI Model Support**: Choose between Claude Sonnet 4.5 or Google Gemini 2.0 Flash
- **🎨 Complete Frontend Generation**: React + TypeScript + Tailwind CSS components
- **⚙️ Full Backend API**: Express.js REST endpoints with Prisma ORM integration
- **🗄️ Database Schema**: Auto-generated Prisma schemas with PostgreSQL
- **🚀 Docker Ready**: Dockerfile and docker-compose.yml for instant deployment
- **🔐 Authentication**: JWT-based authentication with user management
- **📊 Real-time Progress**: Live generation progress tracking via WebSocket

## Core Components

1. **Requirements Analyzer**: Extracts entities, features, and UI requirements from natural language
2. **Complexity Estimator**: Calculates project complexity and estimates development effort
3. **Code Generators**: Specialized generators for frontend, backend, and deployment configurations
4. **Model Selector**: Intelligent routing between Claude and Gemini based on task and user preference

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
- Docker and Docker Compose
- **At least one AI API key:**
  - **Claude API key** from [Anthropic](https://console.anthropic.com/) (recommended)
  - **Gemini API key** from [Google AI Studio](https://makersuite.google.com/app/apikey) (alternative)

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

# Edit .env and configure required variables:
# - CLAUDE_API_KEY=sk-ant-...      (Required if using Claude)
# - GEMINI_API_KEY=...             (Required if using Gemini)
# - JWT_SECRET=your-secret-key     (Required - 32+ characters)
# - POSTGRES_PASSWORD=...          (Required for Docker)
# - DATABASE_URL=...               (Auto-configured in Docker)
```

**Important**: You need at least ONE of the AI API keys:
- **Claude**: Best for code quality and complex applications
- **Gemini**: Faster and more cost-effective alternative

Users can select their preferred model when creating projects in the web interface.

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

## 🎯 Usage

### Production Deployment (Docker)

```bash
# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start all services
docker-compose -f docker-compose.production.yml up -d

# Access the application
# Frontend: http://localhost
# Backend API: http://localhost:3000
```

### Using the Web Interface

1. **Register/Login**: Create an account at `http://localhost`
2. **Create New Project**: Click "New Project" button
3. **Choose AI Model**: Select between Claude Sonnet or Google Gemini
4. **Describe Your App**: Enter project name, description, and detailed requirements
5. **Generate**: Click "Generate Project" and watch real-time progress
6. **Download**: Once complete, download your full-stack application as a ZIP file

### Model Selection

The platform supports two AI models:

**Claude Sonnet 4.5** (`claude-sonnet-4-5-20250929`)
- ✅ Best code quality and architectural decisions
- ✅ Excellent for complex applications
- ✅ Superior TypeScript type generation
- ⚠️ Requires Claude API credits

**Google Gemini 2.0 Flash** (`gemini-2.0-flash-exp`)
- ✅ Faster generation speed
- ✅ More cost-effective
- ✅ Great for prototypes and MVPs
- ✅ Free tier available

**When to use which:**
- **Claude**: Production applications, complex business logic, enterprise projects
- **Gemini**: Rapid prototyping, learning projects, cost-conscious development

### What Gets Generated

Each project includes:
- ✅ **Frontend**: React + TypeScript + Tailwind CSS + Vite
- ✅ **Backend**: Express.js + TypeScript + Prisma ORM
- ✅ **Database**: Prisma schema with PostgreSQL
- ✅ **API**: RESTful endpoints with full CRUD operations
- ✅ **Auth**: JWT-based authentication structure
- ✅ **Docker**: Dockerfile and docker-compose.yml
- ✅ **Config**: All necessary configuration files (tsconfig, vite.config, etc.)

### Example Project Structure

```
generated-project/
├── frontend/
│   ├── src/
│   │   ├── components/    # Generated React components
│   │   ├── pages/         # Application pages
│   │   └── lib/           # Utilities and API client
│   ├── package.json
│   └── vite.config.ts
├── backend/
│   ├── src/
│   │   ├── handlers/      # API route handlers
│   │   ├── router.ts      # Express router
│   │   └── types/         # TypeScript types
│   └── package.json
├── prisma/
│   └── schema.prisma      # Database schema
├── Dockerfile
├── docker-compose.yml
└── README.md              # Generated project docs
```

## License

MIT