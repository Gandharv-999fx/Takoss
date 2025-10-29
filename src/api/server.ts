import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import { SimpleTakossOrchestrator, ProjectRequest } from '../orchestrator/simpleTakossOrchestrator';

export class TakossAPIServer {
  private app: Express;
  private server: http.Server;
  private io: SocketIOServer;
  private orchestrator: SimpleTakossOrchestrator;
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    this.orchestrator = new SimpleTakossOrchestrator(process.env.CLAUDE_API_KEY);

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json({ limit: '50mb' }));
  }

  private setupRoutes(): void {
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    this.app.post('/api/generate', async (req: Request, res: Response) => {
      try {
        const request: ProjectRequest = req.body;
        const result = await this.orchestrator.generateApplication(request);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.get('/api/examples', (req: Request, res: Response) => {
      res.json([
        { name: 'Blog', requirements: 'Create a blog with posts and comments' },
        { name: 'Todo App', requirements: 'Build a task management system' },
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
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
