import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PromptChainState, ProgressUpdateEvent } from '../types/orchestrator';

export class SocketServer {
  private app: express.Application;
  private httpServer: any;
  private io: Server;

  constructor(private port: number = 3001) {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.io = new Server(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    this.setupRoutes();
    this.setupSocketHandlers();
  }

  private setupRoutes(): void {
    this.app.get('/health', (req, res) => {
      res.status(200).send({ status: 'ok' });
    });
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      socket.on('subscribe', (chainId: string) => {
        socket.join(chainId);
        console.log(`Client ${socket.id} subscribed to chain ${chainId}`);
      });
      
      socket.on('unsubscribe', (chainId: string) => {
        socket.leave(chainId);
        console.log(`Client ${socket.id} unsubscribed from chain ${chainId}`);
      });
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  public start(): void {
    this.httpServer.listen(this.port, () => {
      console.log(`Socket.IO server listening on port ${this.port}`);
    });
  }

  public emitProgressUpdate(update: ProgressUpdateEvent): void {
    this.io.to(update.chainId).emit('progress_update', update);
  }

  public emitStateUpdate(chainId: string, state: PromptChainState): void {
    this.io.to(chainId).emit('state_update', state);
  }

  public close(): void {
    this.io.close();
    this.httpServer.close();
  }
}