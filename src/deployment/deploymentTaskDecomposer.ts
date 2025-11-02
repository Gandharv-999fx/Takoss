import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { ModelService } from '../core/modelService';
import { ModelName } from '../types/modelConfig';
import { v4 as uuidv4 } from 'uuid';

/**
 * Deployment Task Decomposition - Generates deployment configuration files
 * Creates Dockerfile, docker-compose.yml, vercel.json, and CI/CD pipelines
 */

export interface DeploymentConfig {
  appName: string;
  hasBackend: boolean;
  hasFrontend: boolean;
  hasDatabase: boolean;
  databaseType?: 'postgresql' | 'mysql' | 'mongodb';
  hasRedis: boolean;
  platform: 'docker' | 'vercel' | 'railway' | 'aws' | 'heroku';
  nodeVersion?: string;
  buildCommand?: string;
  startCommand?: string;
  envVars?: Record<string, string>;
}

export interface DeploymentArtifact {
  id: string;
  fileName: string;
  description: string;
  content: string;
  type: 'dockerfile' | 'compose' | 'config' | 'script' | 'ci-cd';
}

export interface DeploymentPlan {
  id: string;
  config: DeploymentConfig;
  artifacts: DeploymentArtifact[];
  instructions: string[];
}

export class DeploymentTaskDecomposer {
  private model: ChatAnthropic;
  private modelService?: ModelService;
  private useModelService: boolean = false;

  constructor(apiKey?: string, modelName?: string) {
    // If a Gemini model is specified, use ModelService
    if (modelName && modelName.includes('gemini')) {
      this.useModelService = true;
      this.modelService = new ModelService(
        process.env.CLAUDE_API_KEY,
        apiKey || process.env.GEMINI_API_KEY
      );
    }

    // Fallback to LangChain ChatAnthropic for Claude
    const effectiveModel = modelName && modelName.includes('claude') ? modelName : 'claude-sonnet-4-5-20250929';
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: effectiveModel as any,
      temperature: 0.3,
    });
  }

  /**
   * Generate complete deployment plan
   */
  public async generateDeploymentPlan(
    config: DeploymentConfig
  ): Promise<DeploymentPlan> {
    const artifacts: DeploymentArtifact[] = [];

    // Generate Dockerfile for backend
    if (config.hasBackend) {
      const dockerfile = this.generateDockerfile(config);
      artifacts.push(dockerfile);
    }

    // Generate docker-compose.yml
    if (config.hasBackend && config.hasDatabase) {
      const compose = this.generateDockerCompose(config);
      artifacts.push(compose);
    }

    // Generate .dockerignore
    if (config.hasBackend) {
      artifacts.push(this.generateDockerIgnore());
    }

    // Generate platform-specific configs
    switch (config.platform) {
      case 'vercel':
        if (config.hasFrontend) {
          artifacts.push(this.generateVercelConfig(config));
        }
        break;
      case 'railway':
        artifacts.push(this.generateRailwayConfig(config));
        break;
      case 'heroku':
        artifacts.push(this.generateProcfile(config));
        break;
    }

    // Generate GitHub Actions CI/CD
    artifacts.push(await this.generateGitHubActions(config));

    // Generate deployment instructions
    const instructions = this.generateInstructions(config, artifacts);

    return {
      id: uuidv4(),
      config,
      artifacts,
      instructions,
    };
  }

  /**
   * Generate Dockerfile for Node.js backend
   */
  private generateDockerfile(config: DeploymentConfig): DeploymentArtifact {
    const nodeVersion = config.nodeVersion || '18';

    const content = `# Multi-stage build for ${config.appName}

# Stage 1: Build
FROM node:${nodeVersion}-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:${nodeVersion}-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Expose port
EXPOSE ${config.hasBackend ? '3000' : '8080'}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:${config.hasBackend ? '3000' : '8080'}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["npm", "start"]
`;

    return {
      id: uuidv4(),
      fileName: 'Dockerfile',
      description: 'Multi-stage Dockerfile for Node.js application',
      content,
      type: 'dockerfile',
    };
  }

  /**
   * Generate docker-compose.yml
   */
  private generateDockerCompose(config: DeploymentConfig): DeploymentArtifact {
    const services: string[] = [];

    // App service
    services.push(`  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=\${DATABASE_URL}${config.hasRedis ? '\n      - REDIS_URL=redis://redis:6379' : ''}
    depends_on:${config.hasDatabase ? '\n      - db' : ''}${config.hasRedis ? '\n      - redis' : ''}
    restart: unless-stopped`);

    // Database service
    if (config.hasDatabase) {
      const dbType = config.databaseType || 'postgresql';

      if (dbType === 'postgresql') {
        services.push(`  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=\${POSTGRES_USER:-postgres}
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
      - POSTGRES_DB=\${POSTGRES_DB:-${config.appName}}
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped`);
      }
    }

    // Redis service
    if (config.hasRedis) {
      services.push(`  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped`);
    }

    const volumes: string[] = [];
    if (config.hasDatabase) volumes.push('  postgres_data:');
    if (config.hasRedis) volumes.push('  redis_data:');

    const content = `version: '3.8'

services:
${services.join('\n\n')}

${volumes.length > 0 ? `volumes:\n${volumes.join('\n')}` : ''}
`;

    return {
      id: uuidv4(),
      fileName: 'docker-compose.yml',
      description: 'Docker Compose configuration for local development and production',
      content,
      type: 'compose',
    };
  }

  /**
   * Generate .dockerignore
   */
  private generateDockerIgnore(): DeploymentArtifact {
    const content = `# Node
node_modules
npm-debug.log
yarn-error.log

# Environment
.env
.env.local
.env.*.local

# Build
dist
build
.next

# Testing
coverage
.nyc_output

# IDE
.vscode
.idea
*.swp
*.swo

# Git
.git
.gitignore

# Documentation
*.md
docs

# CI/CD
.github

# Misc
.DS_Store
*.log
`;

    return {
      id: uuidv4(),
      fileName: '.dockerignore',
      description: 'Docker ignore file to exclude unnecessary files',
      content,
      type: 'config',
    };
  }

  /**
   * Generate vercel.json for frontend deployment
   */
  private generateVercelConfig(config: DeploymentConfig): DeploymentArtifact {
    const content = `{
  "version": 2,
  "buildCommand": "${config.buildCommand || 'npm run build'}",
  "outputDirectory": "dist",
  "framework": "vite",
  "env": {
    "VITE_API_URL": "@api-url"
  },
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "${config.hasBackend ? 'https://your-backend-url.com/api/$1' : '/api/$1'}"
    },
    {
      "handle": "filesystem"
    },
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
`;

    return {
      id: uuidv4(),
      fileName: 'vercel.json',
      description: 'Vercel deployment configuration for frontend',
      content,
      type: 'config',
    };
  }

  /**
   * Generate railway.json
   */
  private generateRailwayConfig(config: DeploymentConfig): DeploymentArtifact {
    const content = `{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "${config.buildCommand || 'npm run build'}"
  },
  "deploy": {
    "startCommand": "${config.startCommand || 'npm start'}",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
`;

    return {
      id: uuidv4(),
      fileName: 'railway.json',
      description: 'Railway deployment configuration',
      content,
      type: 'config',
    };
  }

  /**
   * Generate Procfile for Heroku
   */
  private generateProcfile(config: DeploymentConfig): DeploymentArtifact {
    const content = `web: ${config.startCommand || 'npm start'}
release: npx prisma migrate deploy
`;

    return {
      id: uuidv4(),
      fileName: 'Procfile',
      description: 'Heroku Procfile for process types',
      content,
      type: 'config',
    };
  }

  /**
   * Generate GitHub Actions CI/CD workflow
   */
  private async generateGitHubActions(
    config: DeploymentConfig
  ): Promise<DeploymentArtifact> {
    const hasDatabaseStr = config.hasDatabase ? 'true' : 'false';

    const content = `name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:${config.hasDatabase ? `
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432` : ''}${config.hasRedis ? `
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379` : ''}

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '${config.nodeVersion || '18'}'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate
        if: ` + '${{ ' + hasDatabaseStr + ' }}' + `

      - name: Run linting
        run: npm run lint

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

      - name: Build
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to ${config.platform}
        run: |
          echo "Deploy to ${config.platform}"
          # Add platform-specific deployment commands
`;

    return {
      id: uuidv4(),
      fileName: '.github/workflows/ci-cd.yml',
      description: 'GitHub Actions CI/CD workflow',
      content,
      type: 'ci-cd',
    };
  }

  /**
   * Generate deployment instructions
   */
  private generateInstructions(
    config: DeploymentConfig,
    artifacts: DeploymentArtifact[]
  ): string[] {
    const instructions: string[] = [];

    instructions.push('# Deployment Instructions');
    instructions.push('');

    // Local Docker setup
    if (config.hasBackend) {
      instructions.push('## Local Docker Development');
      instructions.push('1. Ensure Docker and Docker Compose are installed');
      instructions.push('2. Create `.env` file with required environment variables');
      instructions.push('3. Run: `docker-compose up -d`');
      instructions.push('4. Access application at http://localhost:3000');
      instructions.push('');
    }

    // Platform-specific instructions
    switch (config.platform) {
      case 'vercel':
        instructions.push('## Deploy to Vercel');
        instructions.push('1. Install Vercel CLI: `npm i -g vercel`');
        instructions.push('2. Login: `vercel login`');
        instructions.push('3. Deploy: `vercel --prod`');
        instructions.push('4. Configure environment variables in Vercel dashboard');
        break;

      case 'railway':
        instructions.push('## Deploy to Railway');
        instructions.push('1. Install Railway CLI: `npm i -g @railway/cli`');
        instructions.push('2. Login: `railway login`');
        instructions.push('3. Initialize: `railway init`');
        instructions.push('4. Add PostgreSQL: `railway add postgresql`');
        instructions.push('5. Deploy: `railway up`');
        break;

      case 'docker':
        instructions.push('## Deploy with Docker');
        instructions.push('1. Build image: `docker build -t ${config.appName} .`');
        instructions.push('2. Run container: `docker run -p 3000:3000 ${config.appName}`');
        instructions.push('3. Or use docker-compose: `docker-compose up -d`');
        break;

      case 'heroku':
        instructions.push('## Deploy to Heroku');
        instructions.push('1. Install Heroku CLI');
        instructions.push('2. Login: `heroku login`');
        instructions.push('3. Create app: `heroku create ${config.appName}`');
        instructions.push('4. Add PostgreSQL: `heroku addons:create heroku-postgresql:hobby-dev`');
        instructions.push('5. Deploy: `git push heroku main`');
        break;
    }

    instructions.push('');
    instructions.push('## Environment Variables');
    instructions.push('Required environment variables:');
    if (config.hasDatabase) {
      instructions.push('- DATABASE_URL: PostgreSQL connection string');
    }
    if (config.hasRedis) {
      instructions.push('- REDIS_URL: Redis connection string');
    }
    instructions.push('- NODE_ENV: production');
    instructions.push('- JWT_SECRET: Secret key for JWT tokens');

    if (config.envVars) {
      Object.entries(config.envVars).forEach(([key, value]) => {
        instructions.push(`- ${key}: ${value}`);
      });
    }

    return instructions;
  }

  /**
   * Generate environment template file
   */
  public generateEnvTemplate(config: DeploymentConfig): DeploymentArtifact {
    const lines: string[] = [];

    lines.push('# Environment Configuration');
    lines.push('# Copy this file to .env and fill in the values');
    lines.push('');

    lines.push('# Application');
    lines.push('NODE_ENV=production');
    lines.push(`PORT=${config.hasBackend ? '3000' : '8080'}`);
    lines.push('');

    if (config.hasDatabase) {
      lines.push('# Database');
      lines.push('DATABASE_URL=postgresql://user:password@localhost:5432/dbname');
      lines.push('');
    }

    if (config.hasRedis) {
      lines.push('# Redis');
      lines.push('REDIS_URL=redis://localhost:6379');
      lines.push('');
    }

    lines.push('# Security');
    lines.push('JWT_SECRET=your-secret-key-here');
    lines.push('');

    if (config.hasFrontend) {
      lines.push('# Frontend');
      lines.push('VITE_API_URL=http://localhost:3000/api');
      lines.push('');
    }

    lines.push('# AI Services');
    lines.push('CLAUDE_API_KEY=your-claude-api-key');
    lines.push('GEMINI_API_KEY=your-gemini-api-key');

    return {
      id: uuidv4(),
      fileName: '.env.example',
      description: 'Environment variables template',
      content: lines.join('\n'),
      type: 'config',
    };
  }

  /**
   * Write all deployment artifacts to file system
   */
  public async writeArtifacts(
    plan: DeploymentPlan,
    outputDir: string
  ): Promise<void> {
    const fs = require('fs/promises');
    const path = require('path');

    for (const artifact of plan.artifacts) {
      const filePath = path.join(outputDir, artifact.fileName);

      // Create directory if needed
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, artifact.content, 'utf-8');
      console.log(`✓ Created ${artifact.fileName}`);
    }

    // Write instructions as DEPLOYMENT.md
    const instructionsPath = path.join(outputDir, 'DEPLOYMENT.md');
    await fs.writeFile(instructionsPath, plan.instructions.join('\n'), 'utf-8');
    console.log(`✓ Created DEPLOYMENT.md`);
  }
}
