import { ChatAnthropic } from '@langchain/anthropic';
import { ComponentPrompt, ComponentPromptChain } from './componentDecomposer';
import { CodeValidator } from '../../validation/outputValidator';
import { AdaptivePromptRefinement } from '../../core/adaptivePromptRefinement';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Sequential Component Builder - Builds React components with context propagation
 * Executes component generation in dependency order, passing generated code as context
 */

export interface ComponentGenerationResult {
  componentId: string;
  componentName: string;
  fileName: string;
  code: string;
  successful: boolean;
  validationResult?: any;
  attempts: number;
  dependencies: string[];
}

export interface ComponentTree {
  id: string;
  rootComponent: string;
  components: Map<string, ComponentGenerationResult>;
  generationOrder: string[];
  integrationNeeded: boolean;
  outputDirectory?: string;
}

export interface BuildConfig {
  outputDirectory: string;
  validateOutput: boolean;
  useRefinement: boolean;
  maxAttemptsPerComponent: number;
  writeToFileSystem: boolean;
}

export class SequentialComponentBuilder {
  private model: ChatAnthropic;
  private validator: CodeValidator;
  private refinement: AdaptivePromptRefinement;

  constructor(apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-sonnet-20240229',
      temperature: 0.3,
    });

    this.validator = new CodeValidator();
    this.refinement = new AdaptivePromptRefinement({
      validationType: 'react',
      maxRetries: 3,
    });
  }

  /**
   * Build all components from a prompt chain with context propagation
   */
  public async buildComponentChain(
    chain: ComponentPromptChain,
    config?: Partial<BuildConfig>
  ): Promise<ComponentTree> {
    const buildConfig: BuildConfig = {
      outputDirectory: config?.outputDirectory || './generated/components',
      validateOutput: config?.validateOutput ?? true,
      useRefinement: config?.useRefinement ?? true,
      maxAttemptsPerComponent: config?.maxAttemptsPerComponent || 3,
      writeToFileSystem: config?.writeToFileSystem ?? false,
    };

    const componentResults = new Map<string, ComponentGenerationResult>();

    // Build components in dependency order
    for (const componentId of chain.executionOrder) {
      const componentPrompt = chain.components.find((c) => c.id === componentId);
      if (!componentPrompt) {
        console.warn(`Component ${componentId} not found in chain`);
        continue;
      }

      console.log(`Building component: ${componentPrompt.componentName}`);

      // Gather dependency code for context
      const dependencyContext = this.gatherDependencyContext(
        componentPrompt,
        componentResults,
        chain.components
      );

      // Build the component with context
      const result = await this.buildComponent(
        componentPrompt,
        dependencyContext,
        buildConfig
      );

      componentResults.set(componentId, result);

      // Write to file system if enabled
      if (buildConfig.writeToFileSystem && result.successful) {
        await this.writeComponentToFile(result, buildConfig.outputDirectory);
      }
    }

    const tree: ComponentTree = {
      id: chain.id,
      rootComponent: chain.components[0]?.componentName || 'Unknown',
      components: componentResults,
      generationOrder: chain.executionOrder,
      integrationNeeded: chain.integrationNeeded,
      outputDirectory: buildConfig.writeToFileSystem
        ? buildConfig.outputDirectory
        : undefined,
    };

    return tree;
  }

  /**
   * Build a single component with context from dependencies
   */
  public async buildComponent(
    componentPrompt: ComponentPrompt,
    dependencyContext: string,
    config: BuildConfig
  ): Promise<ComponentGenerationResult> {
    let attempts = 0;
    let successful = false;
    let code = '';
    let validationResult: any;

    // Enhance prompt with dependency context
    const enhancedPrompt = this.enhancePromptWithContext(
      componentPrompt.prompt,
      dependencyContext
    );

    if (config.useRefinement) {
      // Use adaptive refinement for automatic error correction
      const refinementResult = await this.refinement.executeWithRefinement(
        enhancedPrompt,
        dependencyContext
      );

      successful = refinementResult.success;
      code = refinementResult.finalOutput || '';
      attempts = refinementResult.totalAttempts;
      validationResult =
        refinementResult.attempts[refinementResult.attempts.length - 1]
          ?.validationResult;
    } else {
      // Manual generation with retry
      for (attempts = 1; attempts <= config.maxAttemptsPerComponent; attempts++) {
        const response = await this.model.invoke(enhancedPrompt);
        const output =
          typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);

        code = this.extractCode(output);

        // Validate if enabled
        if (config.validateOutput) {
          const validation = this.validator.validateReactComponent(
            code,
            componentPrompt.componentName
          );

          validationResult = validation;

          if (validation.isValid) {
            successful = true;
            break;
          }

          console.warn(
            `Validation failed for ${componentPrompt.componentName} (attempt ${attempts})`
          );
        } else {
          successful = true;
          break;
        }
      }
    }

    return {
      componentId: componentPrompt.id,
      componentName: componentPrompt.componentName,
      fileName: componentPrompt.fileName,
      code,
      successful,
      validationResult,
      attempts,
      dependencies: componentPrompt.dependencies,
    };
  }

  /**
   * Gather code from dependency components for context
   */
  private gatherDependencyContext(
    componentPrompt: ComponentPrompt,
    generatedComponents: Map<string, ComponentGenerationResult>,
    allComponents: ComponentPrompt[]
  ): string {
    if (componentPrompt.dependencies.length === 0) {
      return '';
    }

    const contextParts: string[] = [];
    contextParts.push('// Dependency components (already generated):');
    contextParts.push('');

    for (const depName of componentPrompt.dependencies) {
      // Find the dependency component
      const depComp = allComponents.find((c) => c.componentName === depName);
      if (!depComp) continue;

      const depResult = generatedComponents.get(depComp.id);
      if (!depResult || !depResult.successful) {
        contextParts.push(`// WARNING: ${depName} failed to generate`);
        continue;
      }

      contextParts.push(`// ${depName} (${depComp.fileName})`);
      contextParts.push('```typescript');
      contextParts.push(depResult.code);
      contextParts.push('```');
      contextParts.push('');
    }

    return contextParts.join('\n');
  }

  /**
   * Enhance prompt with dependency context
   */
  private enhancePromptWithContext(
    originalPrompt: string,
    dependencyContext: string
  ): string {
    if (!dependencyContext || dependencyContext.trim().length === 0) {
      return originalPrompt;
    }

    return `${originalPrompt}

**Context - Previously Generated Dependencies:**

${dependencyContext}

Use these components and their interfaces appropriately. Import them correctly and ensure type compatibility.
`;
  }

  /**
   * Extract code from markdown code blocks
   */
  private extractCode(output: string): string {
    const codeBlockRegex = /```(?:typescript|tsx|ts|jsx|js)?\\n([\\s\\S]*?)```/g;
    const matches = [...output.matchAll(codeBlockRegex)];

    if (matches.length > 0) {
      // Return the largest code block
      const codeBlocks = matches.map((m) => m[1]);
      return codeBlocks.reduce((longest, current) =>
        current.length > longest.length ? current : longest
      );
    }

    return output;
  }

  /**
   * Write component to file system
   */
  private async writeComponentToFile(
    result: ComponentGenerationResult,
    outputDirectory: string
  ): Promise<void> {
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(outputDirectory, { recursive: true });

      const filePath = path.join(outputDirectory, result.fileName);
      await fs.writeFile(filePath, result.code, 'utf-8');

      console.log(`✓ Written ${result.fileName} to ${outputDirectory}`);
    } catch (error) {
      console.error(`Failed to write ${result.fileName}:`, error);
    }
  }

  /**
   * Build component tree summary for reporting
   */
  public generateTreeSummary(tree: ComponentTree): string {
    const lines: string[] = [];

    lines.push('# Component Generation Summary');
    lines.push('');
    lines.push(`**Root Component**: ${tree.rootComponent}`);
    lines.push(`**Total Components**: ${tree.components.size}`);
    lines.push(
      `**Successful**: ${Array.from(tree.components.values()).filter((c) => c.successful).length}`
    );
    lines.push(
      `**Failed**: ${Array.from(tree.components.values()).filter((c) => !c.successful).length}`
    );
    lines.push('');

    lines.push('## Generation Order');
    tree.generationOrder.forEach((compId, idx) => {
      const result = tree.components.get(compId);
      if (result) {
        const status = result.successful ? '✓' : '✗';
        lines.push(
          `${idx + 1}. ${status} **${result.componentName}** (${result.attempts} attempts)`
        );
      }
    });

    lines.push('');
    lines.push('## Component Details');

    tree.components.forEach((result, compId) => {
      lines.push(`### ${result.componentName}`);
      lines.push(`- **File**: ${result.fileName}`);
      lines.push(`- **Status**: ${result.successful ? 'Success' : 'Failed'}`);
      lines.push(`- **Attempts**: ${result.attempts}`);
      lines.push(`- **Dependencies**: ${result.dependencies.join(', ') || 'None'}`);
      lines.push(`- **Code Length**: ${result.code.length} characters`);

      if (!result.successful && result.validationResult) {
        lines.push(`- **Errors**: ${result.validationResult.errors.length}`);
        result.validationResult.errors.slice(0, 3).forEach((err: any) => {
          lines.push(`  - [${err.type}] ${err.message}`);
        });
      }

      lines.push('');
    });

    if (tree.outputDirectory) {
      lines.push(`**Output Directory**: ${tree.outputDirectory}`);
    }

    return lines.join('\n');
  }

  /**
   * Export component tree as files
   */
  public async exportComponentTree(
    tree: ComponentTree,
    outputDirectory: string
  ): Promise<void> {
    await fs.mkdir(outputDirectory, { recursive: true });

    // Write each component
    for (const [compId, result] of tree.components.entries()) {
      if (result.successful) {
        await this.writeComponentToFile(result, outputDirectory);
      }
    }

    // Write index file for exports
    const indexContent = this.generateIndexFile(tree);
    await fs.writeFile(
      path.join(outputDirectory, 'index.ts'),
      indexContent,
      'utf-8'
    );

    // Write summary
    const summary = this.generateTreeSummary(tree);
    await fs.writeFile(
      path.join(outputDirectory, 'GENERATION_SUMMARY.md'),
      summary,
      'utf-8'
    );

    console.log(`✓ Exported component tree to ${outputDirectory}`);
  }

  /**
   * Generate index.ts file with all exports
   */
  private generateIndexFile(tree: ComponentTree): string {
    const lines: string[] = [];

    lines.push('// Auto-generated component exports');
    lines.push('');

    tree.components.forEach((result) => {
      if (result.successful) {
        const fileNameWithoutExt = result.fileName.replace(/\.tsx?$/, '');
        lines.push(
          `export { default as ${result.componentName} } from './${fileNameWithoutExt}';`
        );
      }
    });

    return lines.join('\n');
  }

  /**
   * Rebuild failed components with additional context
   */
  public async rebuildFailedComponents(
    tree: ComponentTree,
    additionalContext?: string
  ): Promise<ComponentTree> {
    const failedComponents = Array.from(tree.components.entries()).filter(
      ([_, result]) => !result.successful
    );

    if (failedComponents.length === 0) {
      console.log('No failed components to rebuild');
      return tree;
    }

    console.log(`Rebuilding ${failedComponents.length} failed components...`);

    for (const [compId, failedResult] of failedComponents) {
      // Find the original prompt (would need to pass chain or store it)
      // For now, we'll create a new prompt based on the failed result
      const enhancedPrompt = `
Generate a React TypeScript component named ${failedResult.componentName}.

**Previous Attempt Failed With Errors:**
${failedResult.validationResult?.errors.map((e: any) => `- ${e.message}`).join('\n') || 'Unknown errors'}

**Requirements:**
1. Component name: ${failedResult.componentName}
2. File: ${failedResult.fileName}
3. Fix all validation errors
4. Use TypeScript with proper types
5. Use Tailwind CSS for styling
6. Follow React best practices

${additionalContext ? `**Additional Context:**\n${additionalContext}\n` : ''}

Generate the complete, corrected component code now.
`;

      const componentPrompt: ComponentPrompt = {
        id: compId,
        componentName: failedResult.componentName,
        fileName: failedResult.fileName,
        description: `Rebuild of ${failedResult.componentName}`,
        prompt: enhancedPrompt,
        dependencies: failedResult.dependencies,
        styling: { framework: 'tailwind' },
        category: 'utility',
      };

      const dependencyContext = this.gatherDependencyContext(
        componentPrompt,
        tree.components,
        []
      );

      const newResult = await this.buildComponent(
        componentPrompt,
        dependencyContext,
        {
          outputDirectory: tree.outputDirectory || './generated',
          validateOutput: true,
          useRefinement: true,
          maxAttemptsPerComponent: 3,
          writeToFileSystem: false,
        }
      );

      tree.components.set(compId, newResult);
    }

    return tree;
  }
}
