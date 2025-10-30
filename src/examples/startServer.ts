import { TakossAPIServer } from '../api/server';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  try {
    console.log('Starting Takoss API Server...');
    
    // Validate required environment variables
    if (!process.env.CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY is required in environment variables');
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is required in environment variables');
    }

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in environment variables');
    }

    // Create and start server
    const server = new TakossAPIServer(PORT);
    await server.start();

    console.log(`Takoss API Server running on port ${PORT}`);
    console.log(`API documentation: http://localhost:${PORT}/api/docs`);
    console.log(`Health check: http://localhost:${PORT}/health`);

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
