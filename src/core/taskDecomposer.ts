import { v4 as uuidv4 } from 'uuid';
import { 
  TaskNode, 
  SubtaskTree, 
  AppRequirement, 
  TaskDecompositionConfig,
  PromptTemplate
} from '../types/interfaces';
import { PromptTemplateManager } from './promptTemplateManager.js';

export class TaskDecomposer {
  private config: TaskDecompositionConfig;
  private promptManager: PromptTemplateManager;

  constructor(
    config: TaskDecompositionConfig,
    promptManager: PromptTemplateManager
  ) {
    this.config = config;
    this.promptManager = promptManager;
  }

  /**
   * Creates a new subtask tree from app requirements
   */
  public async createSubtaskTree(
    name: string,
    description: string,
    requirements: AppRequirement[]
  ): Promise<SubtaskTree> {
    // Create root task
    const rootTask: TaskNode = {
      id: uuidv4(),
      title: name,
      description: `Root task for ${name}`,
      status: 'pending',
      type: 'feature',
      children: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Initialize subtask tree
    const tree: SubtaskTree = {
      id: uuidv4(),
      name,
      description,
      rootTaskId: rootTask.id,
      tasks: { [rootTask.id]: rootTask },
      appRequirements: requirements,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Decompose the root task based on requirements
    await this.decomposeTask(tree, rootTask.id, requirements, 0);

    return tree;
  }

  /**
   * Recursively decomposes a task into subtasks
   */
  private async decomposeTask(
    tree: SubtaskTree,
    taskId: string,
    requirements: AppRequirement[],
    depth: number
  ): Promise<void> {
    const task = tree.tasks[taskId];
    
    // Stop recursion if we've reached max depth or task is too small
    if (depth >= this.config.maxDepth || requirements.length <= this.config.minTaskSize) {
      // This is an atomic task, assign a prompt template
      if (this.config.defaultPromptTemplates && this.config.defaultPromptTemplates[task.type]) {
        task.promptTemplate = this.config.defaultPromptTemplates[task.type];
      } else {
        // Fallback to a default template if none is specified for this task type
        const templates = this.promptManager.getAllTemplates();
        if (templates.length > 0) {
          task.promptTemplate = templates[0].id;
        }
      }
      
      task.promptVariables = this.generatePromptVariables(task, requirements);
      return;
    }

    // Group requirements by type for better decomposition
    const groupedReqs = this.groupRequirementsByType(requirements);
    
    // Create subtasks for each group
    for (const [type, reqs] of Object.entries(groupedReqs)) {
      if (reqs.length === 0) continue;

      const subtaskId = uuidv4();
      const subtask: TaskNode = {
        id: subtaskId,
        title: `${type} tasks for ${task.title}`,
        description: `Handle ${reqs.length} ${type} requirements`,
        status: 'pending',
        type: type as TaskNode['type'],
        parentId: taskId,
        children: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add subtask to tree
      tree.tasks[subtaskId] = subtask;
      task.children.push(subtaskId);

      // Recursively decompose this subtask
      await this.decomposeTask(tree, subtaskId, reqs, depth + 1);
    }

    // Update task
    task.updatedAt = new Date();
  }

  /**
   * Groups requirements by their type
   */
  private groupRequirementsByType(
    requirements: AppRequirement[]
  ): Record<string, AppRequirement[]> {
    const result: Record<string, AppRequirement[]> = {};
    
    for (const req of requirements) {
      if (!result[req.type]) {
        result[req.type] = [];
      }
      result[req.type].push(req);
    }
    
    return result;
  }

  /**
   * Generates variables to fill in prompt templates
   */
  private generatePromptVariables(
    task: TaskNode,
    requirements: AppRequirement[]
  ): Record<string, any> {
    return {
      taskTitle: task.title,
      taskDescription: task.description,
      taskType: task.type,
      requirements: requirements.map(r => r.description).join('\n'),
      requirementCount: requirements.length
    };
  }

  /**
   * Finds atomic tasks (leaf nodes) in the tree
   */
  public findAtomicTasks(tree: SubtaskTree): TaskNode[] {
    const atomicTasks: TaskNode[] = [];
    
    for (const taskId in tree.tasks) {
      const task = tree.tasks[taskId];
      if (task.children.length === 0 && task.promptTemplate) {
        atomicTasks.push(task);
      }
    }
    
    return atomicTasks;
  }

  /**
   * Updates a task's status and propagates changes up the tree
   */
  public updateTaskStatus(
    tree: SubtaskTree,
    taskId: string,
    status: TaskNode['status'],
    result?: string
  ): void {
    const task = tree.tasks[taskId];
    if (!task) return;
    
    task.status = status;
    if (result) task.result = result;
    task.updatedAt = new Date();
    
    // Update parent task status if all children are completed
    if (task.parentId) {
      const parent = tree.tasks[task.parentId];
      if (parent) {
        const allChildrenCompleted = parent.children.every(
          childId => tree.tasks[childId].status === 'completed'
        );
        
        if (allChildrenCompleted) {
          this.updateTaskStatus(tree, parent.id, 'completed');
        }
      }
    }
  }
}