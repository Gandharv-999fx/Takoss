import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { v4 as uuidv4 } from 'uuid';

/**
 * Modification Request Decomposer - Converts user change requests into update prompts
 * Analyzes existing code and generates safe modification prompts
 */

export interface ModificationRequest {
  id: string;
  description: string;
  affectedFiles?: string[];
  priority: 'high' | 'medium' | 'low';
  category: 'feature' | 'bug-fix' | 'refactor' | 'enhancement' | 'deletion';
  context?: string;
}

export interface ModificationTask {
  id: string;
  type: 'add' | 'modify' | 'delete' | 'refactor';
  targetFile: string;
  description: string;
  prompt: string;
  dependencies: string[];
  riskLevel: 'low' | 'medium' | 'high';
  estimatedImpact: {
    linesChanged: number;
    filesAffected: number;
    testingRequired: boolean;
  };
}

export interface ModificationPlan {
  id: string;
  request: ModificationRequest;
  tasks: ModificationTask[];
  executionOrder: string[];
  warnings: string[];
  backupRecommended: boolean;
}

export class ModificationRequestDecomposer {
  private model: ChatAnthropic;

  constructor(apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-5-sonnet-20241022',
      temperature: 0.3,
    });
  }

  /**
   * Analyze modification request and create execution plan
   */
  public async analyzeModificationRequest(
    request: ModificationRequest,
    codebaseContext: Map<string, string>
  ): Promise<ModificationPlan> {
    // Use AI to understand the modification request
    const analysis = await this.analyzeIntent(request, codebaseContext);

    // Generate modification tasks
    const tasks = await this.generateModificationTasks(
      request,
      analysis,
      codebaseContext
    );

    // Determine execution order based on dependencies
    const executionOrder = this.determineExecutionOrder(tasks);

    // Generate warnings
    const warnings = this.generateWarnings(tasks, request);

    return {
      id: uuidv4(),
      request,
      tasks,
      executionOrder,
      warnings,
      backupRecommended: this.shouldBackup(tasks),
    };
  }

  /**
   * Analyze user's intent using AI
   */
  private async analyzeIntent(
    request: ModificationRequest,
    codebaseContext: Map<string, string>
  ): Promise<{
    intent: string;
    scope: string;
    affectedComponents: string[];
    suggestedApproach: string;
  }> {
    const contextSummary = Array.from(codebaseContext.entries())
      .map(([file, content]) => `${file}: ${content.substring(0, 500)}...`)
      .join('\n\n');

    const prompt = PromptTemplate.fromTemplate(`
You are analyzing a code modification request.

**Modification Request:**
- Category: {category}
- Priority: {priority}
- Description: {description}
${request.context ? `- Additional Context: {context}` : ''}

**Existing Codebase Context:**
{codebaseContext}

Analyze this request and provide:
1. **Intent**: What is the user trying to achieve?
2. **Scope**: How extensive is this change (isolated, moderate, widespread)?
3. **Affected Components**: Which files/modules will be impacted?
4. **Suggested Approach**: Best way to implement this change safely

Return as JSON:
{{
  "intent": "string",
  "scope": "isolated|moderate|widespread",
  "affectedComponents": ["file1", "file2"],
  "suggestedApproach": "detailed approach"
}}
`);

    const input = await prompt.format({
      category: request.category,
      priority: request.priority,
      description: request.description,
      context: request.context || 'None',
      codebaseContext: contextSummary,
    });

    const response = await this.model.invoke(input);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract JSON
    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      // Fallback if parsing fails
      return {
        intent: request.description,
        scope: 'moderate',
        affectedComponents: request.affectedFiles || [],
        suggestedApproach: 'Carefully implement the requested changes',
      };
    }
  }

  /**
   * Generate specific modification tasks
   */
  private async generateModificationTasks(
    request: ModificationRequest,
    analysis: any,
    codebaseContext: Map<string, string>
  ): Promise<ModificationTask[]> {
    const tasks: ModificationTask[] = [];

    for (const component of analysis.affectedComponents) {
      const existingCode = codebaseContext.get(component) || '';

      const task = await this.createModificationTask(
        component,
        request,
        analysis,
        existingCode
      );

      if (task) {
        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * Create a single modification task
   */
  private async createModificationTask(
    targetFile: string,
    request: ModificationRequest,
    analysis: any,
    existingCode: string
  ): Promise<ModificationTask | null> {
    const taskId = uuidv4();

    // Determine task type
    const taskType = this.determineTaskType(request.category, request.description);

    // Generate modification prompt
    const prompt = this.generateModificationPrompt(
      targetFile,
      taskType,
      request,
      analysis,
      existingCode
    );

    // Estimate impact
    const impact = this.estimateImpact(existingCode, request);

    // Assess risk
    const riskLevel = this.assessRisk(taskType, impact, targetFile);

    return {
      id: taskId,
      type: taskType,
      targetFile,
      description: `${taskType} ${targetFile}: ${request.description}`,
      prompt,
      dependencies: this.identifyDependencies(targetFile, analysis.affectedComponents),
      riskLevel,
      estimatedImpact: impact,
    };
  }

  /**
   * Determine task type from request
   */
  private determineTaskType(
    category: string,
    description: string
  ): 'add' | 'modify' | 'delete' | 'refactor' {
    const lowerDesc = description.toLowerCase();

    if (category === 'deletion' || lowerDesc.includes('remove') || lowerDesc.includes('delete')) {
      return 'delete';
    }

    if (category === 'refactor' || lowerDesc.includes('refactor') || lowerDesc.includes('restructure')) {
      return 'refactor';
    }

    if (
      lowerDesc.includes('add') ||
      lowerDesc.includes('create') ||
      lowerDesc.includes('new')
    ) {
      return 'add';
    }

    return 'modify';
  }

  /**
   * Generate modification prompt for AI
   */
  private generateModificationPrompt(
    targetFile: string,
    taskType: string,
    request: ModificationRequest,
    analysis: any,
    existingCode: string
  ): string {
    const prompts: Record<string, string> = {
      add: `
Add new functionality to the existing code in ${targetFile}.

**Modification Request:**
${request.description}

**Intent:** ${analysis.intent}
**Approach:** ${analysis.suggestedApproach}

**Existing Code:**
\`\`\`typescript
${existingCode.substring(0, 2000)}
\`\`\`

**Requirements:**
1. Integrate seamlessly with existing code
2. Follow existing code style and patterns
3. Maintain backward compatibility
4. Add appropriate TypeScript types
5. Include JSDoc comments
6. Handle edge cases and errors

Generate the modified code with the new functionality added.
`,
      modify: `
Modify existing functionality in ${targetFile}.

**Modification Request:**
${request.description}

**Intent:** ${analysis.intent}
**Approach:** ${analysis.suggestedApproach}

**Current Code:**
\`\`\`typescript
${existingCode.substring(0, 2000)}
\`\`\`

**Requirements:**
1. Make minimal necessary changes
2. Preserve existing functionality where possible
3. Maintain code style consistency
4. Update types and interfaces as needed
5. Update related comments
6. Ensure no breaking changes

Generate the modified code.
`,
      delete: `
Remove functionality from ${targetFile}.

**Modification Request:**
${request.description}

**Current Code:**
\`\`\`typescript
${existingCode.substring(0, 2000)}
\`\`\`

**Requirements:**
1. Safely remove requested functionality
2. Clean up unused imports and dependencies
3. Update related code that depends on removed functionality
4. Ensure no orphaned code remains
5. Maintain file structure integrity

Generate the code with the functionality removed.
`,
      refactor: `
Refactor the code in ${targetFile}.

**Modification Request:**
${request.description}

**Intent:** ${analysis.intent}
**Approach:** ${analysis.suggestedApproach}

**Current Code:**
\`\`\`typescript
${existingCode.substring(0, 2000)}
\`\`\`

**Requirements:**
1. Improve code quality and maintainability
2. Preserve all existing functionality
3. Update tests if needed
4. Follow best practices
5. Improve performance if possible
6. Add better error handling

Generate the refactored code.
`,
    };

    return prompts[taskType] || prompts.modify;
  }

  /**
   * Estimate impact of modification
   */
  private estimateImpact(
    existingCode: string,
    request: ModificationRequest
  ): {
    linesChanged: number;
    filesAffected: number;
    testingRequired: boolean;
  } {
    const currentLines = existingCode.split('\n').length;

    // Simple heuristic for estimation
    let estimatedLines = 0;
    const desc = request.description.toLowerCase();

    if (desc.includes('add') || desc.includes('new')) {
      estimatedLines = Math.min(currentLines * 0.3, 200);
    } else if (desc.includes('refactor') || desc.includes('restructure')) {
      estimatedLines = Math.min(currentLines * 0.5, 500);
    } else if (desc.includes('delete') || desc.includes('remove')) {
      estimatedLines = Math.min(currentLines * 0.2, 100);
    } else {
      estimatedLines = Math.min(currentLines * 0.1, 50);
    }

    return {
      linesChanged: Math.round(estimatedLines),
      filesAffected: request.affectedFiles?.length || 1,
      testingRequired: request.category !== 'deletion' && request.priority !== 'low',
    };
  }

  /**
   * Assess risk level of modification
   */
  private assessRisk(
    taskType: string,
    impact: any,
    targetFile: string
  ): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Task type risk
    if (taskType === 'delete') riskScore += 2;
    if (taskType === 'refactor') riskScore += 1;
    if (taskType === 'modify') riskScore += 1;

    // Impact risk
    if (impact.linesChanged > 100) riskScore += 2;
    else if (impact.linesChanged > 50) riskScore += 1;

    if (impact.filesAffected > 3) riskScore += 2;
    else if (impact.filesAffected > 1) riskScore += 1;

    // Critical file risk
    const criticalPatterns = [
      /auth/i,
      /security/i,
      /payment/i,
      /database/i,
      /migration/i,
    ];
    if (criticalPatterns.some((pattern) => pattern.test(targetFile))) {
      riskScore += 2;
    }

    // Determine risk level
    if (riskScore >= 5) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Identify dependencies between files
   */
  private identifyDependencies(
    targetFile: string,
    affectedComponents: string[]
  ): string[] {
    // Simple heuristic: files in the same directory might be dependencies
    const targetDir = targetFile.split('/').slice(0, -1).join('/');

    return affectedComponents.filter(
      (comp) =>
        comp !== targetFile &&
        comp.startsWith(targetDir)
    );
  }

  /**
   * Determine execution order based on dependencies
   */
  private determineExecutionOrder(tasks: ModificationTask[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();

    const visit = (task: ModificationTask) => {
      if (visited.has(task.id)) return;

      // Visit dependencies first
      task.dependencies.forEach((depFile) => {
        const depTask = tasks.find((t) => t.targetFile === depFile);
        if (depTask && !visited.has(depTask.id)) {
          visit(depTask);
        }
      });

      visited.add(task.id);
      order.push(task.id);
    };

    // Visit all tasks
    tasks.forEach((task) => visit(task));

    return order;
  }

  /**
   * Generate warnings for the modification plan
   */
  private generateWarnings(
    tasks: ModificationTask[],
    request: ModificationRequest
  ): string[] {
    const warnings: string[] = [];

    // Check for high-risk tasks
    const highRiskTasks = tasks.filter((t) => t.riskLevel === 'high');
    if (highRiskTasks.length > 0) {
      warnings.push(
        `⚠️ ${highRiskTasks.length} high-risk task(s) detected. Review carefully before executing.`
      );
    }

    // Check for large modifications
    const totalLinesChanged = tasks.reduce(
      (sum, t) => sum + t.estimatedImpact.linesChanged,
      0
    );
    if (totalLinesChanged > 500) {
      warnings.push(
        `⚠️ Large modification (~${totalLinesChanged} lines). Consider breaking into smaller changes.`
      );
    }

    // Check for deletion tasks
    const deletionTasks = tasks.filter((t) => t.type === 'delete');
    if (deletionTasks.length > 0) {
      warnings.push(
        `⚠️ ${deletionTasks.length} deletion task(s). Ensure no code depends on removed functionality.`
      );
    }

    // Check if testing is required
    if (tasks.some((t) => t.estimatedImpact.testingRequired)) {
      warnings.push('ℹ️ Testing required after modifications.');
    }

    return warnings;
  }

  /**
   * Determine if backup is recommended
   */
  private shouldBackup(tasks: ModificationTask[]): boolean {
    // Recommend backup if any high-risk tasks or many files affected
    return (
      tasks.some((t) => t.riskLevel === 'high') ||
      tasks.length > 5 ||
      tasks.some((t) => t.estimatedImpact.filesAffected > 3)
    );
  }

  /**
   * Generate modification summary
   */
  public generateSummary(plan: ModificationPlan): string {
    const lines: string[] = [];

    lines.push('# Modification Plan Summary');
    lines.push('');
    lines.push(`**Request ID**: ${plan.request.id}`);
    lines.push(`**Category**: ${plan.request.category}`);
    lines.push(`**Priority**: ${plan.request.priority}`);
    lines.push(`**Description**: ${plan.request.description}`);
    lines.push('');

    lines.push('## Tasks');
    plan.tasks.forEach((task, idx) => {
      lines.push(`### ${idx + 1}. ${task.type.toUpperCase()} - ${task.targetFile}`);
      lines.push(`- **Risk Level**: ${task.riskLevel}`);
      lines.push(`- **Estimated Lines Changed**: ~${task.estimatedImpact.linesChanged}`);
      lines.push(`- **Testing Required**: ${task.estimatedImpact.testingRequired ? 'Yes' : 'No'}`);
      lines.push('');
    });

    if (plan.warnings.length > 0) {
      lines.push('## Warnings');
      plan.warnings.forEach((warning) => {
        lines.push(`- ${warning}`);
      });
      lines.push('');
    }

    lines.push('## Execution Order');
    plan.executionOrder.forEach((taskId, idx) => {
      const task = plan.tasks.find((t) => t.id === taskId);
      if (task) {
        lines.push(`${idx + 1}. ${task.type} ${task.targetFile}`);
      }
    });

    if (plan.backupRecommended) {
      lines.push('');
      lines.push('⚠️ **Backup Recommended**: Create a git commit or backup before proceeding.');
    }

    return lines.join('\n');
  }
}
