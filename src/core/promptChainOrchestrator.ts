import { v4 as uuidv4 } from 'uuid';
import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import EventEmitter from 'events';
import { 
  PromptChainState, 
  ExecutionContext, 
  SubstepResult, 
  PromptJobData,
  OrchestratorConfig,
  ProgressUpdateEvent
} from '../types/orchestrator';
import { QueueManager } from './queueManager';
import { ModelService } from './modelService';
import { ContextAccumulator } from './contextAccumulator';
import { SubtaskTree, TaskNode } from '../types/interfaces';

export class PromptChainOrchestrator extends EventEmitter {
  private chains: Map<string, PromptChainState> = new Map();
  private queueManager: QueueManager;
  private modelService: ModelService;
  private contextAccumulator: ContextAccumulator;
  private io: Server | null = null;
  
  constructor(
    private config: OrchestratorConfig = {
      redisUrl: 'redis://localhost:6379',
      concurrency: 3,
      maxRetries: 3,
      defaultTimeout: 60000,
      socketEnabled: true,
      socketPort: 3001
    }
  ) {
    super();
    this.modelService = new ModelService();
    this.contextAccumulator = new ContextAccumulator(config.redisUrl);
    this.queueManager = new QueueManager(
      config.redisUrl,
      config.concurrency,
      this.processJob.bind(this)
    );

    if (config.socketEnabled) {
      this.setupSocketIO(config.socketPort || 3001);
    }
  }
  
  /**
   * Set up Socket.IO server for real-time updates
   */
  private setupSocketIO(port: number): void {
    const app = express();
    const httpServer = createServer(app);
    this.io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      socket.on('subscribe', (chainId: string) => {
        socket.join(chainId);
        console.log(`Client ${socket.id} subscribed to chain ${chainId}`);
        
        // Send current state if available
        const chain = this.chains.get(chainId);
        if (chain) {
          socket.emit('state_update', chain);
        }
      });
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
    
    httpServer.listen(port, () => {
      console.log(`Socket.IO server listening on port ${port}`);
    });
  }
  
  /**
   * Create a new prompt chain execution
   */
  public async createChain(name: string, subtaskTree: SubtaskTree): Promise<string> {
    const chainId = uuidv4();
    
    const chain: PromptChainState = {
      id: chainId,
      name,
      status: 'pending',
      progress: 0,
      startTime: new Date(),
      subtaskTree,
      results: {},
    };
    
    this.chains.set(chainId, chain);
    return chainId;
  }
  
  /**
   * Start executing a prompt chain
   */
  public async executeChain(chainId: string): Promise<void> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain with ID ${chainId} not found`);
    }
    
    // Update chain status
    chain.status = 'running';
    this.updateChain(chain);
    
    // Start with the root task
    const rootTask = chain.subtaskTree.root;
    await this.executeTask(chainId, rootTask);
  }
  
  /**
   * Execute a task and its subtasks
   */
  private async executeTask(chainId: string, taskNode: TaskNode, parentTaskId?: string): Promise<void> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain with ID ${chainId} not found`);
    }
    
    // If task has no children, treat it as atomic
    if (taskNode.children.length === 0) {
      const context: ExecutionContext = {
        chainId,
        previousResults: chain.results,
        variables: {},
        taskNode,
        parentTaskId,
        depth: parentTaskId ? this.getTaskDepth(parentTaskId, chain) : 0
      };
      
      // Create and format the prompt with accumulated context
      const prompt = await this.formatPrompt(taskNode, context);

      // Log task start to history
      await this.contextAccumulator.appendToHistory(chainId, taskNode.id, 'start', {
        prompt: prompt.substring(0, 200) + '...' // Store truncated prompt
      });

      // Determine model type based on task requirements
      const modelType = taskNode.metadata?.preferredModel === 'claude' ? 'claude' : 'gemini';
      
      // Create job data
      const jobData: PromptJobData = {
        chainId,
        taskId: taskNode.id,
        context,
        prompt,
        modelType,
        timeout: this.config.defaultTimeout
      };
      
      // Add job to queue
      await this.queueManager.addJob(jobData);
      
      // Update current substep
      chain.currentSubstepId = taskNode.id;
      this.updateChain(chain);
      
      // Emit progress update
      this.emitProgressUpdate(chain);
    } 
    // If task has children, execute them in sequence
    else if (taskNode.children && taskNode.children.length > 0) {
      // Get child tasks from the subtask tree
      const chain = this.chains.get(chainId);
      if (!chain) {
        throw new Error(`Chain with ID ${chainId} not found`);
      }
      
      for (const childId of taskNode.children) {
        // Find the child task in the tree
        const childTask = this.findTaskById(childId, chain);
        if (childTask) {
          await this.executeTask(chainId, childTask, taskNode.id);
        }
      }
    }
  }
  
  /**
   * Process a job from the queue
   */
  private async processJob(jobData: PromptJobData): Promise<SubstepResult> {
    const { chainId, taskId, context, prompt, modelType } = jobData;
    const chain = this.chains.get(chainId);
    
    if (!chain) {
      throw new Error(`Chain with ID ${chainId} not found`);
    }
    
    try {
      const startTime = Date.now();
      
      // Execute the prompt with the specified model
      const response = await this.modelService.executePrompt(prompt, modelType);
      
      const executionTime = Date.now() - startTime;
      
      // Create result
      const result: SubstepResult = {
        id: uuidv4(),
        taskId,
        status: 'success',
        output: response.content,
        generatedCode: response.generatedCode,
        metadata: {
          modelName: response.metadata.modelName,
          executionTime,
          promptTokens: response.metadata.promptTokens,
          completionTokens: response.metadata.completionTokens,
          timestamp: new Date()
        }
      };
      
      // Store result in memory
      chain.results[taskId] = result;

      // Persist result to Redis
      await this.contextAccumulator.storeResult(chainId, result);

      // Persist all chain results
      await this.contextAccumulator.storeChainResults(chainId, chain.results);

      // Log to history
      await this.contextAccumulator.appendToHistory(chainId, taskId, 'complete', {
        status: 'success',
        executionTime
      });

      // Update chain progress
      this.updateChainProgress(chain);

      // Emit progress update
      this.emitProgressUpdate(chain);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error processing job for task ${taskId}:`, error);
      
      // Create failure result
      const result: SubstepResult = {
        id: uuidv4(),
        taskId,
        status: 'failure',
        output: '',
        metadata: {
          modelName: modelType === 'claude' ? 'claude-3-sonnet-20240229' : 'gemini-1.5-pro',
          executionTime: 0,
          promptTokens: 0,
          completionTokens: 0,
          timestamp: new Date()
        },
        error: errorMessage
      };
      
      // Store result
      chain.results[taskId] = result;

      // Persist failure to Redis
      await this.contextAccumulator.storeResult(chainId, result);

      // Log to history
      await this.contextAccumulator.appendToHistory(chainId, taskId, 'fail', {
        error: errorMessage
      });

      // Update chain status if needed
      if (chain.status !== 'failed') {
        chain.status = 'failed';
        chain.error = `Failed to execute task ${taskId}: ${errorMessage}`;
        this.updateChain(chain);
      }

      // Emit progress update
      this.emitProgressUpdate(chain);

      return result;
    }
  }
  
  /**
   * Format a prompt for a task with accumulated context
   */
  private async formatPrompt(taskNode: TaskNode, context: ExecutionContext): Promise<string> {
    // Basic prompt formatting
    let prompt = taskNode.prompt || '';

    // Get accumulated variables from dependencies
    const dependencies = taskNode.dependencies || [];
    const accumulatedVars = await this.contextAccumulator.accumulateVariables(
      context.chainId,
      context.variables,
      dependencies
    );

    // Replace variables in the prompt
    for (const [key, value] of Object.entries(accumulatedVars)) {
      prompt = prompt.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }

    // Add context from previous results if needed
    if (taskNode.requiresPreviousResults) {
      const relevantResults = await this.contextAccumulator.getDependencyResults(
        context.chainId,
        dependencies
      );

      if (relevantResults.length > 0) {
        prompt += '\n\n### Previous Results:\n';

        for (const result of relevantResults) {
          prompt += `\n#### Task: ${result.taskId}\n`;
          prompt += `${result.output}\n`;

          if (result.generatedCode) {
            prompt += `\n\`\`\`\n${result.generatedCode}\n\`\`\`\n`;
          }
        }
      }
    }

    return prompt;
  }
  
  
  /**
   * Find a task by ID in the subtask tree using the tasks map for O(1) lookup
   */
  private findTaskById(taskId: string, chain: PromptChainState): TaskNode | null {
    // Use the tasks map from SubtaskTree for efficient lookup
    return chain.subtaskTree.tasks?.[taskId] || null;
  }
  
  /**
   * Get the depth of a task in the subtask tree
   */
  private getTaskDepth(taskId: string, chain: PromptChainState): number {
    const findDepth = (node: TaskNode, id: string, currentDepth: number): number => {
      if (node.id === id) {
        return currentDepth;
      }

      if (node.children) {
        for (const childId of node.children) {
          const childTask = this.findTaskById(childId, chain);
          if (childTask) {
            const depth = findDepth(childTask, id, currentDepth + 1);
            if (depth !== -1) {
              return depth;
            }
          }
        }
      }

      return -1;
    };

    return findDepth(chain.subtaskTree.root, taskId, 0);
  }
  
  /**
   * Update chain progress based on completed tasks
   */
  private updateChainProgress(chain: PromptChainState): void {
    const totalTasks = this.countTotalTasks(chain.subtaskTree.root, chain);
    const completedTasks = Object.keys(chain.results).length;
    
    chain.progress = Math.round((completedTasks / totalTasks) * 100);
    
    // Check if all tasks are completed
    if (completedTasks === totalTasks) {
      chain.status = 'completed';
      chain.endTime = new Date();
    }
    
    this.updateChain(chain);
  }
  
  /**
   * Count total number of atomic tasks in the subtask tree
   */
  private countTotalTasks(node: TaskNode, chain: PromptChainState): number {
    if (node.children.length === 0) {
      return 1;
    }

    let count = 0;
    if (node.children && node.children.length > 0) {
      for (const childId of node.children) {
        const childTask = this.findTaskById(childId, chain);
        if (childTask) {
          count += this.countTotalTasks(childTask, chain);
        } else {
          // Count as 1 if we can't find the child task
          count += 1;
        }
      }
    }

    return count;
  }
  
  /**
   * Update chain state
   */
  private updateChain(chain: PromptChainState): void {
    this.chains.set(chain.id, chain);
  }
  
  /**
   * Emit progress update via Socket.IO
   */
  private emitProgressUpdate(chain: PromptChainState): void {
    if (!this.io) {
      return;
    }

    const totalTasks = this.countTotalTasks(chain.subtaskTree.root, chain);
    const completedTasks = Object.keys(chain.results).length;

    let currentTask;
    if (chain.currentSubstepId) {
      const taskNode = this.findTaskById(chain.currentSubstepId, chain);
      if (taskNode) {
        currentTask = {
          id: taskNode.id,
          title: taskNode.title,
          type: taskNode.type
        };
      }
    }
    
    const update: ProgressUpdateEvent = {
      chainId: chain.id,
      status: chain.status,
      progress: chain.progress,
      currentTask,
      completedTasks,
      totalTasks,
      timestamp: new Date()
    };
    
    this.io.to(chain.id).emit('progress_update', update);
    
    // Also emit state update
    this.io.to(chain.id).emit('state_update', chain);
  }
  
  /**
   * Get the current state of a chain
   */
  public getChainState(chainId: string): PromptChainState | undefined {
    return this.chains.get(chainId);
  }
  
  /**
   * Pause a chain execution
   */
  public async pauseChain(chainId: string): Promise<void> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain with ID ${chainId} not found`);
    }
    
    await this.queueManager.pause();
  }
  
  /**
   * Resume a paused chain execution
   */
  public async resumeChain(chainId: string): Promise<void> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain with ID ${chainId} not found`);
    }
    
    await this.queueManager.resume();
  }
  
  /**
   * Clean up resources
   */
  public async close(): Promise<void> {
    await this.queueManager.close();
    await this.contextAccumulator.close();

    if (this.io) {
      this.io.close();
    }
  }

  /**
   * Get context accumulator instance (for external access)
   */
  public getContextAccumulator(): ContextAccumulator {
    return this.contextAccumulator;
  }
}