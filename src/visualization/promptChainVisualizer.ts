/**
 * Prompt Chain Visualizer - React Flow visualization for execution chains
 * Generates interactive visual representations of prompt chain execution
 */

export interface VisualizationNode {
  id: string;
  type: 'task' | 'decision' | 'parallel' | 'output';
  label: string;
  data: {
    taskId: string;
    taskType: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    executionTime?: number;
    retries?: number;
    error?: string;
    metadata?: Record<string, any>;
  };
  position: { x: number; y: number };
  style?: Record<string, any>;
}

export interface VisualizationEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: 'default' | 'animated' | 'straight' | 'step';
  style?: Record<string, any>;
  markerEnd?: {
    type: string;
    width?: number;
    height?: number;
  };
}

export interface ChainVisualization {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  metadata: {
    totalTasks: number;
    completed: number;
    failed: number;
    totalTime: number;
    startTime: Date;
    endTime?: Date;
  };
}

export interface ExecutionTreeNode {
  id: string;
  type: string;
  status: string;
  children: ExecutionTreeNode[];
  dependencies: string[];
  result?: any;
  error?: string;
  startTime?: Date;
  endTime?: Date;
}

export class PromptChainVisualizer {
  /**
   * Convert execution plan to React Flow format
   */
  public visualizeExecutionPlan(
    tasks: Array<{
      id: string;
      type: string;
      dependencies: string[];
      status?: string;
      executionTime?: number;
      retries?: number;
      error?: string;
    }>,
    executionOrder?: string[]
  ): ChainVisualization {
    const nodes: VisualizationNode[] = [];
    const edges: VisualizationEdge[] = [];

    // Create nodes
    tasks.forEach((task, index) => {
      const node = this.createNode(task, index);
      nodes.push(node);
    });

    // Create edges based on dependencies
    tasks.forEach((task) => {
      task.dependencies.forEach((depId) => {
        const edge = this.createEdge(depId, task.id, task.status || 'pending');
        edges.push(edge);
      });
    });

    // Calculate layout
    this.applyAutoLayout(nodes, edges);

    // Calculate metadata
    const metadata = {
      totalTasks: tasks.length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      totalTime: tasks.reduce((sum, t) => sum + (t.executionTime || 0), 0),
      startTime: new Date(),
    };

    return { nodes, edges, metadata };
  }

  /**
   * Create a visualization node
   */
  private createNode(
    task: {
      id: string;
      type: string;
      status?: string;
      executionTime?: number;
      retries?: number;
      error?: string;
    },
    index: number
  ): VisualizationNode {
    const status = (task.status || 'pending') as
      | 'pending'
      | 'running'
      | 'completed'
      | 'failed';

    // Determine node type
    let nodeType: 'task' | 'decision' | 'parallel' | 'output' = 'task';
    if (task.type.includes('decision') || task.type.includes('validation')) {
      nodeType = 'decision';
    } else if (task.type.includes('parallel')) {
      nodeType = 'parallel';
    } else if (task.type.includes('output') || task.type.includes('final')) {
      nodeType = 'output';
    }

    // Status-based styling
    const style = this.getNodeStyle(status);

    return {
      id: task.id,
      type: nodeType,
      label: this.formatTaskLabel(task),
      data: {
        taskId: task.id,
        taskType: task.type,
        status,
        executionTime: task.executionTime,
        retries: task.retries,
        error: task.error,
      },
      position: { x: 0, y: 0 }, // Will be calculated by layout
      style,
    };
  }

  /**
   * Create a visualization edge
   */
  private createEdge(
    sourceId: string,
    targetId: string,
    status: string
  ): VisualizationEdge {
    const edgeId = `${sourceId}-${targetId}`;

    // Animated if currently active
    const type = status === 'running' ? 'animated' : 'default';

    // Status-based styling
    const style = this.getEdgeStyle(status);

    return {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type,
      style,
      markerEnd: {
        type: 'arrowclosed',
        width: 20,
        height: 20,
      },
    };
  }

  /**
   * Get node styling based on status
   */
  private getNodeStyle(
    status: 'pending' | 'running' | 'completed' | 'failed'
  ): Record<string, any> {
    const baseStyle = {
      padding: 10,
      borderRadius: 5,
      border: '2px solid',
      fontSize: 12,
      fontWeight: 500,
    };

    const statusStyles = {
      pending: {
        ...baseStyle,
        background: '#f3f4f6',
        borderColor: '#d1d5db',
        color: '#6b7280',
      },
      running: {
        ...baseStyle,
        background: '#dbeafe',
        borderColor: '#3b82f6',
        color: '#1e40af',
        boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)',
      },
      completed: {
        ...baseStyle,
        background: '#d1fae5',
        borderColor: '#10b981',
        color: '#065f46',
      },
      failed: {
        ...baseStyle,
        background: '#fee2e2',
        borderColor: '#ef4444',
        color: '#991b1b',
      },
    };

    return statusStyles[status];
  }

  /**
   * Get edge styling based on status
   */
  private getEdgeStyle(status: string): Record<string, any> {
    const statusColors = {
      pending: '#d1d5db',
      running: '#3b82f6',
      completed: '#10b981',
      failed: '#ef4444',
    };

    const color = statusColors[status as keyof typeof statusColors] || '#d1d5db';

    return {
      stroke: color,
      strokeWidth: 2,
    };
  }

  /**
   * Format task label
   */
  private formatTaskLabel(task: {
    type: string;
    status?: string;
    executionTime?: number;
    retries?: number;
  }): string {
    let label = task.type.replace(/([A-Z])/g, ' $1').trim();

    if (task.executionTime) {
      label += `\n⏱ ${task.executionTime}ms`;
    }

    if (task.retries && task.retries > 0) {
      label += `\n🔄 ${task.retries} retries`;
    }

    return label;
  }

  /**
   * Apply automatic layout (hierarchical)
   */
  private applyAutoLayout(
    nodes: VisualizationNode[],
    edges: VisualizationEdge[]
  ): void {
    // Build adjacency map
    const adjacency = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    nodes.forEach((node) => {
      adjacency.set(node.id, []);
      inDegree.set(node.id, 0);
    });

    edges.forEach((edge) => {
      adjacency.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    });

    // Topological sort to determine levels
    const levels = new Map<string, number>();
    const queue: string[] = [];

    // Start with nodes that have no dependencies
    nodes.forEach((node) => {
      if (inDegree.get(node.id) === 0) {
        queue.push(node.id);
        levels.set(node.id, 0);
      }
    });

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const currentLevel = levels.get(nodeId) || 0;

      adjacency.get(nodeId)?.forEach((childId) => {
        const newInDegree = (inDegree.get(childId) || 0) - 1;
        inDegree.set(childId, newInDegree);

        if (newInDegree === 0) {
          queue.push(childId);
          levels.set(childId, currentLevel + 1);
        }
      });
    }

    // Group nodes by level
    const levelGroups = new Map<number, string[]>();
    levels.forEach((level, nodeId) => {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(nodeId);
    });

    // Position nodes
    const VERTICAL_SPACING = 150;
    const HORIZONTAL_SPACING = 200;

    levelGroups.forEach((nodeIds, level) => {
      const y = level * VERTICAL_SPACING;
      const totalWidth = (nodeIds.length - 1) * HORIZONTAL_SPACING;
      const startX = -totalWidth / 2;

      nodeIds.forEach((nodeId, index) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          node.position.x = startX + index * HORIZONTAL_SPACING;
          node.position.y = y;
        }
      });
    });
  }

  /**
   * Generate execution tree visualization
   */
  public visualizeExecutionTree(
    rootNode: ExecutionTreeNode
  ): ChainVisualization {
    const nodes: VisualizationNode[] = [];
    const edges: VisualizationEdge[] = [];

    // Traverse tree
    const traverse = (node: ExecutionTreeNode, depth: number, index: number) => {
      // Create node
      const visualNode: VisualizationNode = {
        id: node.id,
        type: 'task',
        label: node.type,
        data: {
          taskId: node.id,
          taskType: node.type,
          status: node.status as any,
          error: node.error,
          executionTime: node.endTime && node.startTime
            ? node.endTime.getTime() - node.startTime.getTime()
            : undefined,
        },
        position: { x: index * 200, y: depth * 150 },
        style: this.getNodeStyle(node.status as any),
      };

      nodes.push(visualNode);

      // Create edges to children
      node.children.forEach((child, childIndex) => {
        const edge: VisualizationEdge = {
          id: `${node.id}-${child.id}`,
          source: node.id,
          target: child.id,
          type: node.status === 'running' ? 'animated' : 'default',
          style: this.getEdgeStyle(node.status),
          markerEnd: { type: 'arrowclosed' },
        };

        edges.push(edge);

        // Recursively traverse children
        traverse(child, depth + 1, childIndex);
      });
    };

    traverse(rootNode, 0, 0);

    // Calculate metadata
    const allNodes = this.flattenTree(rootNode);
    const metadata = {
      totalTasks: allNodes.length,
      completed: allNodes.filter((n) => n.status === 'completed').length,
      failed: allNodes.filter((n) => n.status === 'failed').length,
      totalTime: 0,
      startTime: rootNode.startTime || new Date(),
      endTime: rootNode.endTime,
    };

    return { nodes, edges, metadata };
  }

  /**
   * Flatten tree to array
   */
  private flattenTree(node: ExecutionTreeNode): ExecutionTreeNode[] {
    const result = [node];
    node.children.forEach((child) => {
      result.push(...this.flattenTree(child));
    });
    return result;
  }

  /**
   * Generate real-time progress visualization
   */
  public visualizeProgress(
    currentVisualization: ChainVisualization,
    updates: Array<{
      taskId: string;
      status: string;
      executionTime?: number;
      error?: string;
    }>
  ): ChainVisualization {
    const updatedNodes = currentVisualization.nodes.map((node) => {
      const update = updates.find((u) => u.taskId === node.id);
      if (update) {
        return {
          ...node,
          data: {
            ...node.data,
            status: update.status as any,
            executionTime: update.executionTime,
            error: update.error,
          },
          style: this.getNodeStyle(update.status as any),
        };
      }
      return node;
    });

    const updatedEdges = currentVisualization.edges.map((edge) => {
      const targetNode = updatedNodes.find((n) => n.id === edge.target);
      if (targetNode) {
        const edgeType: 'animated' | 'default' = targetNode.data.status === 'running' ? 'animated' : 'default';
        return {
          ...edge,
          type: edgeType,
          style: this.getEdgeStyle(targetNode.data.status),
        };
      }
      return edge;
    });

    const metadata = {
      ...currentVisualization.metadata,
      completed: updatedNodes.filter((n) => n.data.status === 'completed').length,
      failed: updatedNodes.filter((n) => n.data.status === 'failed').length,
      totalTime: updatedNodes.reduce(
        (sum, n) => sum + (n.data.executionTime || 0),
        0
      ),
    };

    return {
      nodes: updatedNodes,
      edges: updatedEdges,
      metadata,
    };
  }

  /**
   * Export visualization to JSON
   */
  public exportVisualization(visualization: ChainVisualization): string {
    return JSON.stringify(visualization, null, 2);
  }

  /**
   * Generate React Flow component code
   */
  public generateReactFlowComponent(
    visualization: ChainVisualization,
    componentName: string = 'PromptChainFlow'
  ): string {
    return `
import React, { useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';

const initialNodes: Node[] = ${JSON.stringify(visualization.nodes, null, 2)};
const initialEdges: Edge[] = ${JSON.stringify(visualization.edges, null, 2)};

export const ${componentName}: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>

      <div style={{ marginTop: '20px', padding: '10px', background: '#f9fafb', borderRadius: '5px' }}>
        <h3>Execution Statistics</h3>
        <ul>
          <li>Total Tasks: ${visualization.metadata.totalTasks}</li>
          <li>Completed: ${visualization.metadata.completed}</li>
          <li>Failed: ${visualization.metadata.failed}</li>
          <li>Total Time: ${visualization.metadata.totalTime}ms</li>
        </ul>
      </div>
    </div>
  );
};
`;
  }

  /**
   * Generate Mermaid diagram (alternative format)
   */
  public generateMermaidDiagram(visualization: ChainVisualization): string {
    const lines: string[] = ['graph TD'];

    // Add nodes with styling
    visualization.nodes.forEach((node) => {
      const statusSymbol = {
        pending: '[ ]',
        running: '[⏳]',
        completed: '[✓]',
        failed: '[✗]',
      }[node.data.status];

      lines.push(`  ${node.id}["${statusSymbol} ${node.label}"]`);

      // Add styling class
      const styleClass = {
        pending: 'pending',
        running: 'running',
        completed: 'completed',
        failed: 'failed',
      }[node.data.status];

      lines.push(`  class ${node.id} ${styleClass}`);
    });

    lines.push('');

    // Add edges
    visualization.edges.forEach((edge) => {
      lines.push(`  ${edge.source} --> ${edge.target}`);
    });

    lines.push('');

    // Add style definitions
    lines.push('  classDef pending fill:#f3f4f6,stroke:#d1d5db,stroke-width:2px');
    lines.push('  classDef running fill:#dbeafe,stroke:#3b82f6,stroke-width:2px');
    lines.push('  classDef completed fill:#d1fae5,stroke:#10b981,stroke-width:2px');
    lines.push('  classDef failed fill:#fee2e2,stroke:#ef4444,stroke-width:2px');

    return lines.join('\n');
  }

  /**
   * Generate HTML visualization page
   */
  public generateHTMLVisualization(
    visualization: ChainVisualization,
    title: string = 'Prompt Chain Execution'
  ): string {
    const mermaidDiagram = this.generateMermaidDiagram(visualization);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f9fafb;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    h1 {
      margin-top: 0;
      color: #111827;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .stat-card {
      padding: 15px;
      background: #f3f4f6;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
    }
    .stat-label {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 5px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: #111827;
    }
    .mermaid {
      margin: 30px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">Total Tasks</div>
        <div class="stat-value">${visualization.metadata.totalTasks}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Completed</div>
        <div class="stat-value">${visualization.metadata.completed}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Failed</div>
        <div class="stat-value">${visualization.metadata.failed}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Time</div>
        <div class="stat-value">${visualization.metadata.totalTime}ms</div>
      </div>
    </div>

    <div class="mermaid">
${mermaidDiagram}
    </div>
  </div>

  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
  </script>
</body>
</html>
`;
  }
}
