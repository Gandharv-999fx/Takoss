import { ExecutionContext, SubstepResult } from '../types/orchestrator';
import { TaskNode } from '../types/interfaces';

/**
 * Utility functions for managing execution context between substeps
 */
export class ContextUtils {
  /**
   * Merge variables from a result into the context
   */
  public static mergeVariables(
    context: ExecutionContext,
    result: SubstepResult
  ): Record<string, any> {
    const newVariables = { ...context.variables };
    
    // Extract variables from result output if in JSON format
    try {
      if (result.output.includes('{') && result.output.includes('}')) {
        const jsonMatch = result.output.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
          const extractedVars = JSON.parse(jsonMatch[1]);
          Object.assign(newVariables, extractedVars);
        }
      }
    } catch (error) {
      console.warn('Failed to extract variables from result output:', error);
    }
    
    // Add result output as a variable
    newVariables[`${result.taskId}_output`] = result.output;
    
    // Add generated code if available
    if (result.generatedCode) {
      newVariables[`${result.taskId}_code`] = result.generatedCode;
    }
    
    return newVariables;
  }
  
  /**
   * Create a new execution context for a subtask
   */
  public static createSubtaskContext(
    parentContext: ExecutionContext,
    subtask: TaskNode
  ): ExecutionContext {
    return {
      chainId: parentContext.chainId,
      previousResults: parentContext.previousResults,
      variables: { ...parentContext.variables },
      taskNode: subtask,
      parentTaskId: parentContext.taskNode.id,
      depth: parentContext.depth + 1
    };
  }
  
  /**
   * Extract code blocks from a result
   */
  public static extractCodeBlocks(result: SubstepResult): string[] {
    const codeBlocks: string[] = [];
    const codeBlockRegex = /```(?:[\w]*)\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(result.output)) !== null) {
      codeBlocks.push(match[1]);
    }
    
    return codeBlocks;
  }
  
  /**
   * Get relevant previous results for a task
   */
  public static getRelevantResults(
    taskNode: TaskNode,
    allResults: Record<string, SubstepResult>
  ): SubstepResult[] {
    const relevantResults: SubstepResult[] = [];
    
    // If task specifies dependencies, use those
    if (taskNode.metadata?.dependencies && taskNode.metadata.dependencies.length > 0) {
      for (const depId of taskNode.metadata.dependencies) {
        if (allResults[depId]) {
          relevantResults.push(allResults[depId]);
        }
      }
    }
    
    return relevantResults;
  }
  
  /**
   * Format a prompt with context variables
   */
  public static formatPromptWithContext(
    promptTemplate: string,
    context: ExecutionContext
  ): string {
    let formattedPrompt = promptTemplate;
    
    // Replace variables in the prompt
    if (context.variables) {
      for (const [key, value] of Object.entries(context.variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        formattedPrompt = formattedPrompt.replace(regex, String(value));
      }
    }
    
    return formattedPrompt;
  }
}