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
import { SubtaskTree, TaskNode } from '../types/interfaces';

export class PromptChainOrchestrator extends EventEmitter {
  private chains: Map<string, PromptChainState> = new Map();
  private queueManager: QueueManager;
  private modelService: ModelService;
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
      
      // Create and format the prompt
      const prompt = this.formatPrompt(taskNode, context);
      
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
        const childTask = this.findTaskById(childId, chain.subtaskTree.root);
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
      
      // Store result
      chain.results[taskId] = result;
      
      // Update chain progress
      this.updateChainProgress(chain);
      
      // Emit progress update
      this.emitProgressUpdate(chain);
      
      return result;
    } catch (error) {
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
        error: error.message
      };
      
      // Store result
      chain.results[taskId] = result;
      
      // Update chain status if needed
      if (chain.status !== 'failed') {
        chain.status = 'failed';
        chain.error = `Failed to execute task ${taskId}: ${error.message}`;
        this.updateChain(chain);
      }
      
      // Emit progress update
      this.emitProgressUpdate(chain);
      
      return result;
    }
  }
  
  /**
   * Format a prompt for a task
   */
  private formatPrompt(taskNode: TaskNode, context: ExecutionContext): string {
    // Basic prompt formatting
    let prompt = taskNode.prompt || '';
    
    // Replace variables in the prompt
    if (context.variables) {
      for (const [key, value] of Object.entries(context.variables)) {
        prompt = prompt.replace(`{{${key}}}`, String(value));
      }
    }
    
    // Add context from previous results if needed
    if (taskNode.requiresPreviousResults && context.previousResults) {
      const relevantResults = this.getRelevantPreviousResults(taskNode, context);
      
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
   * Get relevant previous results for a task
   */
  private getRelevantPreviousResults(taskNode: TaskNode, context: ExecutionContext): SubstepResult[] {
    const relevantResults: SubstepResult[] = [];
    
    if (!context.previousResults) {
      return relevantResults;
    }
    
    // If task specifies dependencies, use those
    if (taskNode.metadata && taskNode.metadata.dependencies && taskNode.metadata.dependencies.length > 0) {
      for (const depId of taskNode.metadata.dependencies) {
        if (context.previousResults[depId]) {
          relevantResults.push(context.previousResults[depId]);
        }
      }
    }
    // Otherwise, use parent task result if available
    else if (context.parentTaskId && context.previousResults[context.parentTaskId]) {
      relevantResults.push(context.previousResults[context.parentTaskId]);
    }
    
    return relevantResults;
  }
  
  /**
   * Get dependencies for a task
   */
  private getDependencies(taskNode: TaskNode): string[] {
    if (!taskNode.metadata || !taskNode.metadata.dependencies) {
      return [];
    }
    return taskNode.metadata.dependencies;
  }
  
  /**
   * Find a task by ID in the subtask tree
   */
  private findTaskById(taskId: string, rootTask: TaskNode): TaskNode | null {
    if (rootTask.id === taskId) {
      return rootTask;
    }
    
    if (rootTask.children && rootTask.children.length > 0) {
      for (const childId of rootTask.children) {
        // This is a simplified approach - in a real implementation, 
        // you would need to recursively search the tree
        if (childId === taskId) {
          // In a real implementation, you would return the actual child task
          // For now, we'll create a placeholder task
          return {
            id: taskId,
            title: "Child Task",
            description: "Child task description",
            status: "pending",
            type: "component",
            children: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
        }
      }
    }
    
    return null;
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
          const childTask = this.findTaskById(childId, chain.subtaskTree.root);
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
    const totalTasks = this.countTotalTasks(chain.subtaskTree.root);
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
  private countTotalTasks(node: TaskNode): number {
    if (node.children.length === 0) {
      return 1;
    }
    
    let count = 0;
    if (node.children && node.children.length > 0) {
      for (const childId of node.children) {
        const childTask = this.findTaskById(childId, node);
        if (childTask) {
          count += this.countTotalTasks(childTask);
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
    
    const totalTasks = this.countTotalTasks(chain.subtaskTree.root);
    const completedTasks = Object.keys(chain.results).length;
    
    let currentTask;
    if (chain.currentSubstepId) {
      const findTask = (node: TaskNode, id: string): TaskNode | null => {
        if (node.id === id) {
          return node;
        }
        
        if (node.subtasks) {
          for (const subtask of node.subtasks) {
            const found = findTask(subtask, id);
            if (found) {
              return found;
            }
          }
        }
        
        return null;
      };
      
      const taskNode = findTask(chain.subtaskTree.root, chain.currentSubstepId);
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
    
    if (this.io) {
      this.io.close();
    }
  }
}