import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { PromptJobData, SubstepResult } from '../types/orchestrator';

export class QueueManager {
  private connection: Redis;
  private promptQueue: Queue<PromptJobData, SubstepResult>;
  private worker: Worker<PromptJobData, SubstepResult>;

  constructor(
    private redisUrl: string = 'redis://localhost:6379',
    private concurrency: number = 5,
    private jobProcessor: (job: PromptJobData) => Promise<SubstepResult>
  ) {
    this.connection = new Redis(redisUrl);
    
    // Create the prompt queue
    this.promptQueue = new Queue<PromptJobData, SubstepResult>('prompt-execution', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });

    // Create the worker
    this.worker = new Worker<PromptJobData, SubstepResult>(
      'prompt-execution',
      async (job) => {
        return await this.jobProcessor(job.data);
      },
      {
        connection: this.connection,
        concurrency: this.concurrency,
      }
    );

    // Set up event handlers
    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`Job ${job?.id} failed with error:`, error);
    });
  }

  /**
   * Add a job to the prompt queue
   */
  public async addJob(
    jobData: PromptJobData,
    options?: { priority?: number; delay?: number }
  ): Promise<string> {
    const job = await this.promptQueue.add('execute-prompt', jobData, {
      priority: options?.priority,
      delay: options?.delay,
    });
    
    return job.id || 'unknown';
  }

  /**
   * Get a job by ID
   */
  public async getJob(jobId: string) {
    return await this.promptQueue.getJob(jobId);
  }

  /**
   * Pause the queue
   */
  public async pause() {
    await this.promptQueue.pause();
  }

  /**
   * Resume the queue
   */
  public async resume() {
    await this.promptQueue.resume();
  }

  /**
   * Clean up resources
   */
  public async close() {
    await this.worker.close();
    await this.promptQueue.close();
    await this.connection.quit();
  }
}