import { Server, Socket } from 'socket.io';
import { EventEmitter } from 'events';
import { CorrectionHistory } from './selfCorrectingLoop';
import { ValidationResult } from '../validation/outputValidator';

/**
 * Human-in-the-Loop Integration - Requests user clarification when automatic error recovery fails
 * Uses Socket.IO for real-time communication with frontend
 */

// Socket.IO Event Types
export interface PromptPausedEvent {
  chainId: string;
  taskId: string;
  taskDescription: string;
  reason: 'validation_failed' | 'clarification_needed' | 'manual_review';
  correctionHistory: CorrectionHistory;
  pausedAt: Date;
}

export interface ClarificationNeededEvent {
  chainId: string;
  taskId: string;
  question: string;
  suggestedAnswers?: string[];
  context: {
    attemptedCode?: string;
    validationErrors: string[];
    previousAttempts: number;
  };
}

export interface UserInputReceivedEvent {
  chainId: string;
  taskId: string;
  userInput: string;
  inputType: 'clarification' | 'manual_fix' | 'skip' | 'retry';
  receivedAt: Date;
}

export interface ExecutionResumedEvent {
  chainId: string;
  taskId: string;
  resumedWith: 'user_input' | 'manual_fix' | 'skip';
  resumedAt: Date;
}

export interface HumanFeedback {
  taskId: string;
  feedbackType: 'clarification' | 'manual_code' | 'constraint' | 'skip';
  content: string;
  metadata?: Record<string, any>;
}

export interface PausedTask {
  chainId: string;
  taskId: string;
  pausedAt: Date;
  reason: string;
  correctionHistory: CorrectionHistory;
  awaitingInput: boolean;
  resolved: boolean;
  userFeedback?: HumanFeedback;
}

export class HumanInTheLoop extends EventEmitter {
  private io: Server | null = null;
  private pausedTasks: Map<string, PausedTask> = new Map();
  private feedbackTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(io?: Server) {
    super();
    if (io) {
      this.attachToSocketServer(io);
    }
  }

  /**
   * Attach to Socket.IO server
   */
  public attachToSocketServer(io: Server): void {
    this.io = io;

    this.io.on('connection', (socket: Socket) => {
      console.log(`Human-in-the-Loop: Client connected ${socket.id}`);

      // Handle user input
      socket.on('provide_clarification', (data: UserInputReceivedEvent) => {
        this.handleUserInput(data);
      });

      // Handle manual code fixes
      socket.on('provide_manual_fix', (data: { taskId: string; code: string }) => {
        this.handleManualFix(data.taskId, data.code);
      });

      // Handle skip task
      socket.on('skip_task', (data: { taskId: string }) => {
        this.handleSkipTask(data.taskId);
      });

      // Request current paused tasks
      socket.on('get_paused_tasks', (data: { chainId: string }) => {
        const paused = this.getPausedTasksForChain(data.chainId);
        socket.emit('paused_tasks_list', paused);
      });

      socket.on('disconnect', () => {
        console.log(`Human-in-the-Loop: Client disconnected ${socket.id}`);
      });
    });
  }

  /**
   * Pause execution and request human input
   */
  public async pauseForClarification(
    chainId: string,
    taskId: string,
    taskDescription: string,
    correctionHistory: CorrectionHistory,
    timeoutMs: number = 300000 // 5 minutes default
  ): Promise<HumanFeedback> {
    if (!this.io) {
      throw new Error('Socket.IO server not attached - cannot request human input');
    }

    // Create paused task
    const pausedTask: PausedTask = {
      chainId,
      taskId,
      pausedAt: new Date(),
      reason: 'Validation failures exceeded retry threshold',
      correctionHistory,
      awaitingInput: true,
      resolved: false,
    };

    this.pausedTasks.set(taskId, pausedTask);

    // Generate clarification question
    const clarificationEvent = this.generateClarificationEvent(
      chainId,
      taskId,
      correctionHistory
    );

    // Emit pause event
    const pauseEvent: PromptPausedEvent = {
      chainId,
      taskId,
      taskDescription,
      reason: 'validation_failed',
      correctionHistory,
      pausedAt: new Date(),
    };

    this.io.to(chainId).emit('prompt_paused', pauseEvent);
    this.io.to(chainId).emit('clarification_needed', clarificationEvent);

    // Wait for user input with timeout
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pausedTasks.delete(taskId);
        reject(new Error(`Timeout waiting for human input on task ${taskId}`));
      }, timeoutMs);

      this.feedbackTimeouts.set(taskId, timeout);

      // Listen for feedback
      this.once(`feedback:${taskId}`, (feedback: HumanFeedback) => {
        clearTimeout(timeout);
        this.feedbackTimeouts.delete(taskId);

        pausedTask.resolved = true;
        pausedTask.userFeedback = feedback;
        pausedTask.awaitingInput = false;

        // Emit resume event
        const resumeEvent: ExecutionResumedEvent = {
          chainId,
          taskId,
          resumedWith: 'user_input',
          resumedAt: new Date(),
        };

        this.io?.to(chainId).emit('execution_resumed', resumeEvent);

        resolve(feedback);
      });
    });
  }

  /**
   * Request specific clarification from user
   */
  public async requestClarification(
    chainId: string,
    taskId: string,
    question: string,
    context: any
  ): Promise<string> {
    if (!this.io) {
      throw new Error('Socket.IO server not attached');
    }

    const event: ClarificationNeededEvent = {
      chainId,
      taskId,
      question,
      context,
    };

    this.io.to(chainId).emit('clarification_needed', event);

    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for clarification'));
      }, 300000);

      this.once(`clarification:${taskId}`, (answer: string) => {
        clearTimeout(timeout);
        resolve(answer);
      });
    });
  }

  /**
   * Handle user input received
   */
  private handleUserInput(data: UserInputReceivedEvent): void {
    const pausedTask = this.pausedTasks.get(data.taskId);
    if (!pausedTask) {
      console.warn(`Received input for non-paused task: ${data.taskId}`);
      return;
    }

    const feedback: HumanFeedback = {
      taskId: data.taskId,
      feedbackType: 'clarification',
      content: data.userInput,
      metadata: {
        inputType: data.inputType,
        receivedAt: data.receivedAt,
      },
    };

    this.emit(`feedback:${data.taskId}`, feedback);
    this.emit('user_input_received', data);
  }

  /**
   * Handle manual code fix from user
   */
  private handleManualFix(taskId: string, code: string): void {
    const pausedTask = this.pausedTasks.get(taskId);
    if (!pausedTask) {
      console.warn(`Received manual fix for non-paused task: ${taskId}`);
      return;
    }

    const feedback: HumanFeedback = {
      taskId,
      feedbackType: 'manual_code',
      content: code,
    };

    this.emit(`feedback:${taskId}`, feedback);
  }

  /**
   * Handle task skip request
   */
  private handleSkipTask(taskId: string): void {
    const pausedTask = this.pausedTasks.get(taskId);
    if (!pausedTask) {
      console.warn(`Received skip request for non-paused task: ${taskId}`);
      return;
    }

    const feedback: HumanFeedback = {
      taskId,
      feedbackType: 'skip',
      content: 'Task skipped by user',
    };

    this.emit(`feedback:${taskId}`, feedback);
  }

  /**
   * Generate clarification event from correction history
   */
  private generateClarificationEvent(
    chainId: string,
    taskId: string,
    history: CorrectionHistory
  ): ClarificationNeededEvent {
    const lastAttempt = history.attempts[history.attempts.length - 1];

    // Summarize validation errors
    const validationErrors = lastAttempt.validationResult.errors.map(
      (err) => `[${err.type}] ${err.message}`
    );

    // Generate helpful question
    const errorTypes = new Set(
      lastAttempt.validationResult.errors.map((e) => e.type)
    );

    let question = 'The AI model is having trouble generating valid code. ';

    if (errorTypes.has('type')) {
      question +=
        'There are TypeScript type errors. Can you provide more specific type requirements or examples?';
    } else if (errorTypes.has('import')) {
      question +=
        'There are import/dependency issues. Which specific libraries should be used?';
    } else if (errorTypes.has('schema')) {
      question +=
        'The data model structure has errors. Can you clarify the schema requirements?';
    } else {
      question +=
        'Can you provide additional context, constraints, or requirements to help resolve these issues?';
    }

    return {
      chainId,
      taskId,
      question,
      context: {
        attemptedCode: lastAttempt.output,
        validationErrors,
        previousAttempts: history.totalAttempts,
      },
    };
  }

  /**
   * Get all paused tasks for a chain
   */
  public getPausedTasksForChain(chainId: string): PausedTask[] {
    return Array.from(this.pausedTasks.values()).filter(
      (task) => task.chainId === chainId && task.awaitingInput
    );
  }

  /**
   * Get paused task by ID
   */
  public getPausedTask(taskId: string): PausedTask | undefined {
    return this.pausedTasks.get(taskId);
  }

  /**
   * Resume task with user feedback
   */
  public async resumeTask(taskId: string, feedback: HumanFeedback): Promise<void> {
    const pausedTask = this.pausedTasks.get(taskId);
    if (!pausedTask) {
      throw new Error(`No paused task found: ${taskId}`);
    }

    pausedTask.resolved = true;
    pausedTask.userFeedback = feedback;
    pausedTask.awaitingInput = false;

    this.emit(`feedback:${taskId}`, feedback);
  }

  /**
   * Cancel waiting for a specific task
   */
  public cancelWait(taskId: string): void {
    const timeout = this.feedbackTimeouts.get(taskId);
    if (timeout) {
      clearTimeout(timeout);
      this.feedbackTimeouts.delete(taskId);
    }

    this.pausedTasks.delete(taskId);
  }

  /**
   * Get statistics on human interventions
   */
  public getInterventionStats(): {
    totalPaused: number;
    awaitingInput: number;
    resolved: number;
    averageWaitTime: number;
  } {
    const tasks = Array.from(this.pausedTasks.values());

    const awaitingInput = tasks.filter((t) => t.awaitingInput).length;
    const resolved = tasks.filter((t) => t.resolved).length;

    // Calculate average wait time for resolved tasks
    const resolvedTasks = tasks.filter((t) => t.resolved);
    const totalWaitTime = resolvedTasks.reduce((sum, task) => {
      if (task.userFeedback?.metadata?.receivedAt) {
        const waitTime =
          new Date(task.userFeedback.metadata.receivedAt).getTime() -
          task.pausedAt.getTime();
        return sum + waitTime;
      }
      return sum;
    }, 0);

    const averageWaitTime =
      resolvedTasks.length > 0 ? totalWaitTime / resolvedTasks.length : 0;

    return {
      totalPaused: tasks.length,
      awaitingInput,
      resolved,
      averageWaitTime: Math.round(averageWaitTime / 1000), // Convert to seconds
    };
  }

  /**
   * Clear resolved tasks older than specified time
   */
  public clearResolvedTasks(olderThanMs: number = 3600000): void {
    const now = Date.now();

    this.pausedTasks.forEach((task, taskId) => {
      if (task.resolved && now - task.pausedAt.getTime() > olderThanMs) {
        this.pausedTasks.delete(taskId);
      }
    });
  }
}
