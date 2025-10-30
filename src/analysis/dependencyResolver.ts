import { TaskNode, SubtaskTree } from '../types/interfaces';

/**
 * Dependency Resolver - Builds DAG and determines execution order
 * Uses topological sorting to create ExecutionPlan with parallel batches
 */

export interface SubstepNode {
  id: string;
  task: TaskNode;
  dependencies: string[]; // Task IDs this node depends on
  dependents: string[]; // Task IDs that depend on this node
  depth: number; // Distance from root (for visualization)
}

export interface DependencyGraph {
  nodes: Map<string, SubstepNode>;
  edges: Map<string, string[]>; // from -> [to, to, ...]
  roots: string[]; // Nodes with no dependencies
  leaves: string[]; // Nodes with no dependents
}

export interface ParallelBatch {
  batchNumber: number;
  taskIds: string[];
  tasks: TaskNode[];
  estimatedDuration?: number; // Optional: for scheduling
}

export interface ExecutionPlan {
  batches: ParallelBatch[];
  totalTasks: number;
  maxParallelism: number; // Largest batch size
  criticalPath: string[]; // Longest dependency chain
  estimatedDuration?: number;
}

export class DependencyResolver {
  /**
   * Build dependency graph from subtask tree
   */
  public buildDependencyGraph(tree: SubtaskTree): DependencyGraph {
    const nodes = new Map<string, SubstepNode>();
    const edges = new Map<string, string[]>();

    // First pass: Create all nodes
    Object.values(tree.tasks).forEach((task) => {
      const dependencies = task.dependencies || [];

      nodes.set(task.id, {
        id: task.id,
        task,
        dependencies,
        dependents: [],
        depth: 0,
      });

      if (!edges.has(task.id)) {
        edges.set(task.id, []);
      }
    });

    // Second pass: Build edges and identify dependents
    Object.values(tree.tasks).forEach((task) => {
      const dependencies = task.dependencies || [];

      dependencies.forEach((depId) => {
        // Add edge: dependency -> task
        if (!edges.has(depId)) {
          edges.set(depId, []);
        }
        edges.get(depId)!.push(task.id);

        // Update dependent's list
        const depNode = nodes.get(depId);
        if (depNode && !depNode.dependents.includes(task.id)) {
          depNode.dependents.push(task.id);
        }
      });
    });

    // Calculate depths (distance from roots)
    this.calculateDepths(nodes);

    // Identify roots (no dependencies) and leaves (no dependents)
    const roots: string[] = [];
    const leaves: string[] = [];

    nodes.forEach((node, id) => {
      if (node.dependencies.length === 0) {
        roots.push(id);
      }
      if (node.dependents.length === 0) {
        leaves.push(id);
      }
    });

    return {
      nodes,
      edges,
      roots,
      leaves,
    };
  }

  /**
   * Create execution plan using topological sort
   */
  public createExecutionPlan(graph: DependencyGraph): ExecutionPlan {
    // Check for cycles
    if (this.hasCycle(graph)) {
      throw new Error('Dependency graph contains cycles - cannot create execution plan');
    }

    const batches: ParallelBatch[] = [];
    const visited = new Set<string>();
    const inProgress = new Set<string>();

    // Track in-degree (number of unresolved dependencies)
    const inDegree = new Map<string, number>();
    graph.nodes.forEach((node, id) => {
      inDegree.set(id, node.dependencies.length);
    });

    let batchNumber = 0;

    while (visited.size < graph.nodes.size) {
      // Find all tasks that can be executed in this batch
      // (tasks with no unresolved dependencies)
      const currentBatch: string[] = [];

      graph.nodes.forEach((node, id) => {
        if (!visited.has(id) && inDegree.get(id) === 0) {
          currentBatch.push(id);
        }
      });

      if (currentBatch.length === 0) {
        // No tasks can be executed - this shouldn't happen if cycle check passed
        throw new Error('Cannot progress execution plan - possible cycle or error');
      }

      // Create batch
      const batchTasks = currentBatch.map((id) => graph.nodes.get(id)!.task);
      batches.push({
        batchNumber: batchNumber++,
        taskIds: currentBatch,
        tasks: batchTasks,
      });

      // Mark tasks as visited and update in-degrees
      currentBatch.forEach((id) => {
        visited.add(id);
        const node = graph.nodes.get(id)!;

        // Decrease in-degree for all dependents
        node.dependents.forEach((depId) => {
          const currentDegree = inDegree.get(depId) || 0;
          inDegree.set(depId, currentDegree - 1);
        });
      });
    }

    // Calculate critical path
    const criticalPath = this.findCriticalPath(graph);

    // Find max parallelism
    const maxParallelism = Math.max(...batches.map((b) => b.taskIds.length));

    return {
      batches,
      totalTasks: graph.nodes.size,
      maxParallelism,
      criticalPath,
    };
  }

  /**
   * Check if graph contains cycles using DFS
   */
  public hasCycle(graph: DependencyGraph): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>(); // Recursion stack to detect back edges

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const node = graph.nodes.get(nodeId);
      if (!node) return false;

      // Visit all dependents (outgoing edges)
      for (const depId of node.dependents) {
        if (!visited.has(depId)) {
          if (dfs(depId)) return true;
        } else if (recStack.has(depId)) {
          // Back edge found - cycle detected
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    // Check from all roots
    for (const rootId of graph.roots) {
      if (!visited.has(rootId)) {
        if (dfs(rootId)) return true;
      }
    }

    // Check for disconnected components
    graph.nodes.forEach((node, id) => {
      if (!visited.has(id)) {
        if (dfs(id)) return true;
      }
    });

    return false;
  }

  /**
   * Find critical path (longest dependency chain)
   */
  public findCriticalPath(graph: DependencyGraph): string[] {
    const memo = new Map<string, string[]>();

    const findLongestPath = (nodeId: string): string[] => {
      if (memo.has(nodeId)) {
        return memo.get(nodeId)!;
      }

      const node = graph.nodes.get(nodeId);
      if (!node || node.dependents.length === 0) {
        // Leaf node
        memo.set(nodeId, [nodeId]);
        return [nodeId];
      }

      // Find longest path among dependents
      let longestPath: string[] = [];
      node.dependents.forEach((depId) => {
        const depPath = findLongestPath(depId);
        if (depPath.length > longestPath.length) {
          longestPath = depPath;
        }
      });

      const path = [nodeId, ...longestPath];
      memo.set(nodeId, path);
      return path;
    };

    // Find longest path from all roots
    let criticalPath: string[] = [];
    graph.roots.forEach((rootId) => {
      const path = findLongestPath(rootId);
      if (path.length > criticalPath.length) {
        criticalPath = path;
      }
    });

    return criticalPath;
  }

  /**
   * Get tasks that can be executed immediately (no pending dependencies)
   */
  public getReadyTasks(
    graph: DependencyGraph,
    completedTaskIds: string[]
  ): TaskNode[] {
    const completed = new Set(completedTaskIds);
    const ready: TaskNode[] = [];

    graph.nodes.forEach((node) => {
      if (completed.has(node.id)) return;

      // Check if all dependencies are completed
      const allDepsCompleted = node.dependencies.every((depId) =>
        completed.has(depId)
      );

      if (allDepsCompleted) {
        ready.push(node.task);
      }
    });

    return ready;
  }

  /**
   * Validate dependencies exist and are not circular
   */
  public validateDependencies(tree: SubtaskTree): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const taskIds = new Set(Object.keys(tree.tasks));

    // Check for invalid dependency references
    Object.values(tree.tasks).forEach((task) => {
      task.dependencies?.forEach((depId) => {
        if (!taskIds.has(depId)) {
          errors.push(
            `Task "${task.id}" references non-existent dependency: ${depId}`
          );
        }
      });
    });

    // Check for cycles
    try {
      const graph = this.buildDependencyGraph(tree);
      if (this.hasCycle(graph)) {
        errors.push('Dependency graph contains cycles');
      }
    } catch (error) {
      errors.push(`Error building dependency graph: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Add dependency to a task
   */
  public addDependency(
    tree: SubtaskTree,
    taskId: string,
    dependencyId: string
  ): SubtaskTree {
    const task = tree.tasks[taskId];
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (!tree.tasks[dependencyId]) {
      throw new Error(`Dependency task ${dependencyId} not found`);
    }

    if (!task.dependencies) {
      task.dependencies = [];
    }

    if (!task.dependencies.includes(dependencyId)) {
      task.dependencies.push(dependencyId);
    }

    // Validate no cycles created
    const graph = this.buildDependencyGraph(tree);
    if (this.hasCycle(graph)) {
      // Rollback
      task.dependencies = task.dependencies.filter((id) => id !== dependencyId);
      throw new Error('Cannot add dependency: would create a cycle');
    }

    return tree;
  }

  /**
   * Visualize dependency graph as ASCII
   */
  public visualizeGraph(graph: DependencyGraph): string {
    const lines: string[] = [];
    lines.push('Dependency Graph:');
    lines.push('================');
    lines.push('');

    // Group by depth
    const byDepth = new Map<number, SubstepNode[]>();
    graph.nodes.forEach((node) => {
      if (!byDepth.has(node.depth)) {
        byDepth.set(node.depth, []);
      }
      byDepth.get(node.depth)!.push(node);
    });

    // Print by depth
    const maxDepth = Math.max(...Array.from(byDepth.keys()));
    for (let depth = 0; depth <= maxDepth; depth++) {
      const nodes = byDepth.get(depth) || [];
      if (nodes.length === 0) continue;

      lines.push(`Level ${depth}:`);
      nodes.forEach((node) => {
        const indent = '  '.repeat(depth);
        const deps =
          node.dependencies.length > 0
            ? ` (depends on: ${node.dependencies.join(', ')})`
            : '';
        lines.push(`${indent}- ${node.task.title}${deps}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  // Private helper methods

  private calculateDepths(nodes: Map<string, SubstepNode>): void {
    const visited = new Set<string>();

    const calculateDepth = (nodeId: string, currentDepth: number): void => {
      if (visited.has(nodeId)) return;

      const node = nodes.get(nodeId);
      if (!node) return;

      node.depth = Math.max(node.depth, currentDepth);
      visited.add(nodeId);

      // Calculate depth for all dependents
      node.dependents.forEach((depId) => {
        calculateDepth(depId, currentDepth + 1);
      });
    };

    // Start from all roots
    nodes.forEach((node, id) => {
      if (node.dependencies.length === 0) {
        calculateDepth(id, 0);
      }
    });

    // Handle disconnected nodes
    nodes.forEach((node, id) => {
      if (!visited.has(id)) {
        calculateDepth(id, 0);
      }
    });
  }
}
