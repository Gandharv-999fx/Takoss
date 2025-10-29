/**
 * Core interfaces for the Takoss task decomposition engine
 */

// Represents a requirement for the application to be built
export interface AppRequirement {
  id: string;
  description: string;
  type: 'feature' | 'component' | 'integration' | 'styling' | 'other';
  priority: 'high' | 'medium' | 'low';
  dependencies?: string[]; // IDs of other requirements this depends on
  metadata?: Record<string, any>;
}

// Represents a template for generating prompts
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'frontend' | 'backend' | 'database' | 'auth' | 'testing' | 'deployment' | 'other';
  modelType?: 'claude' | 'gemini' | 'any';
  examples?: Array<{
    input: Record<string, any>;
    output: string;
  }>;
}

// Represents a node in the task decomposition tree
export interface TaskNode {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  type: 'feature' | 'component' | 'function' | 'schema' | 'style' | 'test' | 'other';
  promptTemplate?: string; // ID of the prompt template to use
  promptVariables?: Record<string, any>; // Variables to fill in the prompt template
  prompt?: string; // The actual prompt text for this task
  parentId?: string; // ID of the parent task
  children: string[]; // IDs of child tasks
  subtasks?: TaskNode[]; // Direct child task objects (alternative to children IDs)
  dependencies?: string[]; // IDs of tasks this task depends on
  requiresPreviousResults?: boolean; // Whether this task needs results from previous tasks
  metadata?: Record<string, any>;
  result?: string; // Result of executing this task (e.g., generated code)
  createdAt: Date;
  updatedAt: Date;
}

// Represents the entire subtask tree
export interface SubtaskTree {
  id: string;
  name: string;
  description: string;
  rootTaskId: string;
  root: TaskNode; // Root task node
  tasks: Record<string, TaskNode>; // Map of task ID to task
  appRequirements: AppRequirement[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// Represents the configuration for the task decomposition engine
export interface TaskDecompositionConfig {
  maxDepth: number; // Maximum depth of the task tree
  minTaskSize: number; // Minimum size of a task before it's considered atomic
  defaultPromptTemplates: Record<string, string>; // Map of task type to default prompt template ID
  modelConfig: {
    type: 'claude' | 'gemini';
    temperature: number;
    maxTokens: number;
  };
}