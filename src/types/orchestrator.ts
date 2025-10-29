import { TaskNode, SubtaskTree } from './interfaces';

/**
 * Represents the state of a prompt chain execution
 */
export interface PromptChainState {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  subtaskTree: SubtaskTree;
  currentSubstepId?: string;
  results: Record<string, SubstepResult>;
  error?: string;
}

/**
 * Context passed between substeps during execution
 */
export interface ExecutionContext {
  chainId: string;
  previousResults: Record<string, SubstepResult>;
  variables: Record<string, any>;
  taskNode: TaskNode;
  parentTaskId?: string;
  depth: number;
}

/**
 * Result of executing a single substep
 */
export interface SubstepResult {
  id: string;
  taskId: string;
  status: 'success' | 'failure';
  output: string;
  generatedCode?: string;
  metadata: {
    modelName: string;
    executionTime: number;
    promptTokens: number;
    completionTokens: number;
    timestamp: Date;
  };
  error?: string;
}

/**
 * Response from an AI model
 */
export interface ModelResponse {
  content: string;
  generatedCode?: string;
  metadata: {
    modelName: string;
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * Configuration for the prompt chain orchestrator
 */
export interface OrchestratorConfig {
  redisUrl: string;
  concurrency: number;
  maxRetries: number;
  defaultTimeout: number;
  socketEnabled: boolean;
  socketPort?: number;
}

/**
 * Job data for Bull queue
 */
export interface PromptJobData {
  chainId: string;
  taskId: string;
  context: ExecutionContext;
  prompt: string;
  modelType: 'claude' | 'gemini';
  timeout?: number;
}

/**
 * Progress update event data
 */
export interface ProgressUpdateEvent {
  chainId: string;
  status: PromptChainState['status'];
  progress: number;
  currentTask?: {
    id: string;
    title: string;
    type: string;
  };
  completedTasks: number;
  totalTasks: number;
  timestamp: Date;
}