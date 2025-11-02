import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import { SimpleTakossOrchestrator, ProjectRequest } from '../orchestrator/simpleTakossOrchestrator';
import { ProjectWriter } from '../output/projectWriter';
import { AuthService } from '../auth/authService';
import { authMiddleware } from '../auth/authMiddleware';

export class TakossAPIServer {
  private app: Express;
  private server: http.Server;
  private io: SocketIOServer;
  private orchestrator: SimpleTakossOrchestrator;
  private projectWriter: ProjectWriter;
  private authService: AuthService;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    this.orchestrator = new SimpleTakossOrchestrator(process.env.CLAUDE_API_KEY);
    this.projectWriter = new ProjectWriter();
    this.authService = new AuthService();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors({
      origin: true, // Reflect the request origin
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    this.app.use(express.json({ limit: '50mb' }));
  }

  private setupRoutes(): void {
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // ==================== AUTHENTICATION ROUTES ====================

    // Register new user
    this.app.post('/api/auth/register', async (req: Request, res: Response) => {
      try {
        const { email, password, name } = req.body;

        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await this.authService.register(email, password, name);
        res.json(result);
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });

    // Login user
    this.app.post('/api/auth/login', async (req: Request, res: Response) => {
      try {
        const { email, password } = req.body;

        if (!email || !password) {
          return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await this.authService.login(email, password);
        res.json(result);
      } catch (error: any) {
        res.status(401).json({ error: error.message });
      }
    });

    // Get current user (requires authentication)
    this.app.get('/api/auth/me', authMiddleware.verifyToken, async (req: Request, res: Response) => {
      try {
        const user = await this.authService.getUserById(req.userId!);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Create API key (requires authentication)
    this.app.post('/api/auth/api-keys', authMiddleware.verifyToken, async (req: Request, res: Response) => {
      try {
        const { name, expiresInDays } = req.body;

        if (!name) {
          return res.status(400).json({ error: 'API key name is required' });
        }

        const apiKey = await this.authService.createApiKey(req.userId!, name, expiresInDays);
        res.json(apiKey);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // List API keys (requires authentication)
    this.app.get('/api/auth/api-keys', authMiddleware.verifyToken, async (req: Request, res: Response) => {
      try {
        const apiKeys = await this.authService.listApiKeys(req.userId!);
        res.json(apiKeys);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete API key (requires authentication)
    this.app.delete('/api/auth/api-keys/:keyId', authMiddleware.verifyToken, async (req: Request, res: Response) => {
      try {
        const { keyId } = req.params;
        const success = await this.authService.deleteApiKey(req.userId!, keyId);

        if (!success) {
          return res.status(404).json({ error: 'API key not found' });
        }

        res.json({ success: true, message: 'API key deleted' });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // ==================== PROJECT GENERATION ROUTES ====================

    // Generate application (requires authentication - JWT or API key)
    this.app.post('/api/generate', authMiddleware.authenticate, async (req: Request, res: Response) => {
      try {
        const { selectedModel, ...rest } = req.body;

        // Validate API keys based on selected model
        if (selectedModel === 'gemini' && !process.env.GEMINI_API_KEY) {
          return res.status(400).json({
            error: 'Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables.'
          });
        }

        if ((!selectedModel || selectedModel === 'claude') && !process.env.CLAUDE_API_KEY) {
          return res.status(400).json({
            error: 'Claude API key not configured. Please add CLAUDE_API_KEY to your environment variables.'
          });
        }

        // Map selectedModel to customModels configuration
        let request: ProjectRequest = rest;

        if (selectedModel === 'gemini') {
          // NOTE: Current implementation uses LangChain which primarily supports Claude
          // This configuration is set for future compatibility when Gemini support is fully integrated
          // For now, the system will use the model selector strategy but execution still uses Claude API
          request.customModels = {
            requirementsAnalysis: 'gemini-2.0-flash-exp' as any,
            schemaGeneration: 'gemini-2.0-flash-exp' as any,
            componentGeneration: 'gemini-2.0-flash-exp' as any,
            apiGeneration: 'gemini-2.0-flash-exp' as any,
            deploymentGeneration: 'gemini-2.0-flash-exp' as any,
          };
          console.log(`\n🤖 Model Selection: Gemini (gemini-2.0-flash-exp) - Note: Backend uses LangChain which primarily uses Claude`);
        } else {
          // Default to Claude (or use explicit 'claude' value)
          request.customModels = {
            requirementsAnalysis: 'claude-sonnet-4-5-20250929' as any,
            schemaGeneration: 'claude-sonnet-4-5-20250929' as any,
            componentGeneration: 'claude-sonnet-4-5-20250929' as any,
            apiGeneration: 'claude-sonnet-4-5-20250929' as any,
            deploymentGeneration: 'claude-sonnet-4-5-20250929' as any,
          };
          console.log(`\n🤖 Model Selection: Claude Sonnet 4.5`);
        }

        const result = await this.orchestrator.generateApplication(request);

        // Write project to disk
        if (result.success) {
          const project = this.projectWriter.convertGenerationToProject(
            result.projectId,
            request.projectName,
            request.description,
            request.requirements,
            result
          );

          await this.projectWriter.writeProject(project);
          console.log(`✅ Project written to disk: ${result.projectId} (User: ${req.userId})`);
        }

        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // List all projects (requires authentication)
    this.app.get('/api/projects', authMiddleware.authenticate, async (req: Request, res: Response) => {
      try {
        const projects = await this.projectWriter.listProjects();
        res.json(projects);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get project details (requires authentication)
    this.app.get('/api/projects/:projectId', authMiddleware.authenticate, async (req: Request, res: Response) => {
      try {
        const { projectId } = req.params;
        const project = await this.projectWriter.getProjectStructure(projectId);

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        res.json(project);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Download project as zip (requires authentication)
    this.app.get('/api/projects/:projectId/download', authMiddleware.authenticate, async (req: Request, res: Response) => {
      try {
        const { projectId } = req.params;
        const zipPath = await this.projectWriter.createZipArchive(projectId);

        res.download(zipPath, `${projectId}.zip`, (err) => {
          if (err) {
            console.error('Download error:', err);
            res.status(500).json({ error: 'Download failed' });
          }
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get specific file from project (requires authentication)
    // Using app.use to handle wildcard paths in Express v5
    this.app.use('/api/projects/:projectId/files', authMiddleware.authenticate, async (req: Request, res: Response, next) => {
      if (req.method !== 'GET') {
        return next();
      }

      try {
        const { projectId } = req.params;
        // Extract the file path from the URL (everything after /files/)
        const match = req.url.match(/^\/(.*)$/);
        const filePath = match ? match[1] : '';

        const content = await this.projectWriter.readProjectFile(projectId, filePath);

        if (!content) {
          return res.status(404).json({ error: 'File not found' });
        }

        res.type('text/plain').send(content);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Delete project (requires authentication)
    this.app.delete('/api/projects/:projectId', authMiddleware.authenticate, async (req: Request, res: Response) => {
      try {
        const { projectId } = req.params;
        const success = await this.projectWriter.deleteProject(projectId);

        if (!success) {
          return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ success: true, message: 'Project deleted' });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get example projects
    this.app.get('/api/examples', (req: Request, res: Response) => {
      res.json([
        {
          name: 'Blog Platform',
          description: 'A modern blog with authentication',
          requirements: 'Create a blog with user auth, posts, comments, and search',
        },
        {
          name: 'Task Manager',
          description: 'Team task management system',
          requirements: 'Build a task app with teams, assignments, and deadlines',
        },
        {
          name: 'E-commerce Store',
          description: 'Online shopping platform',
          requirements: 'E-commerce with products, cart, checkout, and orders',
        },
      ]);
    });
  }

  public async start(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server.listen(this.port, () => {
        console.log(`\nTakoss API Server: http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    await this.orchestrator.close();
    await this.authService.close();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
