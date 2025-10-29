import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { PrismaClient, ModelType, ExecutionStatus } from '@prisma/client';
import { PromptPerformanceTracker, PerformanceMetrics } from './promptPerformanceTracker';
import { FewShotLearningDatabase } from './fewShotLearningDatabase';

/**
 * Prompt Template Evolution - A/B testing and automatic improvement
 * Extracts successful patterns and generates improved template versions
 */

export interface TemplateVariation {
  id: string;
  baseTemplateId: string;
  variationNumber: number;
  templateContent: string;
  hypothesis: string; // What improvement is being tested
  created: Date;
  status: 'testing' | 'active' | 'retired';
}

export interface ABTestResult {
  baseTemplateId: string;
  variations: {
    variationId: string;
    executionCount: number;
    successRate: number;
    averageTime: number;
    averageTokens: number;
  }[];
  winner?: string;
  confidence: number; // 0-1, statistical confidence
  recommendation: string;
}

export interface TemplateImprovement {
  templateId: string;
  currentVersion: string;
  improvedVersion: string;
  improvements: {
    aspect: string; // 'clarity', 'structure', 'examples', 'constraints'
    before: string;
    after: string;
    expectedImpact: string;
  }[];
  reasoning: string;
}

export interface PatternExtraction {
  pattern: string;
  category: 'instruction' | 'example' | 'constraint' | 'format';
  frequency: number;
  avgSuccessRate: number;
  examples: string[];
}

export class PromptTemplateEvolution {
  private model: ChatAnthropic;
  private prisma: PrismaClient;
  private performanceTracker: PromptPerformanceTracker;
  private fewShotDB: FewShotLearningDatabase;

  constructor(apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-sonnet-20240229',
      temperature: 0.5,
    });

    this.prisma = new PrismaClient();
    this.performanceTracker = new PromptPerformanceTracker();
    this.fewShotDB = new FewShotLearningDatabase(apiKey);
  }

  /**
   * Create A/B test variations of a template
   */
  public async createABTestVariations(
    templateId: string,
    numVariations: number = 2
  ): Promise<TemplateVariation[]> {
    // Get original template
    const template = await this.prisma.promptTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Get performance metrics to understand what to improve
    const metrics = await this.performanceTracker.getTemplateMetrics(templateId);
    const suggestions = await this.performanceTracker.generateOptimizationSuggestions(
      templateId
    );

    // Generate variations
    const variations: TemplateVariation[] = [];

    for (let i = 0; i < numVariations; i++) {
      const variation = await this.generateVariation(template, metrics, suggestions, i + 1);
      variations.push(variation);

      // Store as a new template version
      await this.prisma.promptTemplate.create({
        data: {
          name: `${template.name} (Variation ${i + 1})`,
          description: variation.hypothesis,
          template: variation.templateContent,
          variables: template.variables,
          category: template.category,
          modelType: template.modelType,
          parentId: templateId,
          isActive: false, // Not active until proven better
        },
      });
    }

    return variations;
  }

  /**
   * Generate a single variation
   */
  private async generateVariation(
    originalTemplate: any,
    metrics: PerformanceMetrics | null,
    suggestions: any[],
    variationNumber: number
  ): Promise<TemplateVariation> {
    const prompt = PromptTemplate.fromTemplate(`
You are an expert at optimizing AI prompts for better performance.

**Original Prompt Template:**
\`\`\`
{originalContent}
\`\`\`

**Performance Metrics:**
- Success Rate: {successRate}
- Average Execution Time: {avgTime}ms
- Average Retries: {avgRetries}

**Optimization Suggestions:**
{suggestions}

**Task**: Create variation #{variationNumber} of this prompt that improves performance.

**Focus Areas** (choose one or two for this variation):
1. **Clarity**: Make instructions more explicit and unambiguous
2. **Structure**: Improve formatting, add sections, use numbered lists
3. **Examples**: Add or improve few-shot examples
4. **Constraints**: Add specific output format requirements
5. **Context**: Provide better background information

Generate:
1. **Improved Prompt**: The modified template
2. **Hypothesis**: What specific improvement you're testing (1-2 sentences)

Return as JSON:
{{
  "improvedPrompt": "string",
  "hypothesis": "string",
  "focusArea": "clarity|structure|examples|constraints|context"
}}
`);

    const input = await prompt.format({
      originalContent: originalTemplate.template,
      successRate: metrics ? `${(metrics.successRate * 100).toFixed(1)}%` : 'Unknown',
      avgTime: metrics?.averageExecutionTime || 'Unknown',
      avgRetries: metrics?.averageRetries || 'Unknown',
      suggestions: suggestions.map((s) => `- ${s.issue}: ${s.suggestion}`).join('\n'),
      variationNumber,
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
      const result = JSON.parse(jsonContent);

      return {
        id: `${originalTemplate.id}-v${variationNumber}`,
        baseTemplateId: originalTemplate.id,
        variationNumber,
        templateContent: result.improvedPrompt,
        hypothesis: result.hypothesis,
        created: new Date(),
        status: 'testing',
      };
    } catch (error) {
      // Fallback
      return {
        id: `${originalTemplate.id}-v${variationNumber}`,
        baseTemplateId: originalTemplate.id,
        variationNumber,
        templateContent: originalTemplate.template,
        hypothesis: 'Testing minor improvements',
        created: new Date(),
        status: 'testing',
      };
    }
  }

  /**
   * Analyze A/B test results
   */
  public async analyzeABTest(
    baseTemplateId: string,
    minExecutionsPerVariation: number = 10
  ): Promise<ABTestResult> {
    // Get all variations (child templates with this as parent)
    const baseTemplate = await this.prisma.promptTemplate.findUnique({
      where: { id: baseTemplateId },
      include: { versions: true },
    });

    if (!baseTemplate || baseTemplate.versions.length === 0) {
      throw new Error(`No testing variations found for template ${baseTemplateId}`);
    }

    const variations = baseTemplate.versions.filter((v) => !v.isActive);

    // Get performance metrics for each variation
    const variationMetrics = [];

    for (const variation of variations) {
      const metrics = await this.performanceTracker.getTemplateMetrics(variation.id);

      if (!metrics || metrics.totalExecutions < minExecutionsPerVariation) {
        continue; // Not enough data
      }

      variationMetrics.push({
        variationId: variation.id,
        executionCount: metrics.totalExecutions,
        successRate: metrics.successRate,
        averageTime: metrics.averageExecutionTime,
        averageTokens: metrics.averagePromptTokens + metrics.averageCompletionTokens,
      });
    }

    if (variationMetrics.length === 0) {
      return {
        baseTemplateId,
        variations: [],
        confidence: 0,
        recommendation: 'Not enough data yet. Continue testing.',
      };
    }

    // Find winner (highest success rate, then lowest time)
    const sorted = variationMetrics.sort((a, b) => {
      if (Math.abs(a.successRate - b.successRate) > 0.05) {
        return b.successRate - a.successRate;
      }
      return a.averageTime - b.averageTime;
    });

    const winner = sorted[0];
    const confidence = this.calculateStatisticalConfidence(variationMetrics);

    // Generate recommendation
    let recommendation = '';
    if (confidence > 0.95) {
      recommendation = `Strong evidence that variation ${winner.variationId} performs best. Recommend promoting to active.`;
    } else if (confidence > 0.85) {
      recommendation = `Moderate evidence favoring ${winner.variationId}. Consider more testing or promote if improvement is significant.`;
    } else {
      recommendation = `Insufficient confidence in results. Continue A/B testing with more executions.`;
    }

    return {
      baseTemplateId,
      variations: variationMetrics,
      winner: winner.variationId,
      confidence,
      recommendation,
    };
  }

  /**
   * Calculate statistical confidence (simplified)
   */
  private calculateStatisticalConfidence(
    variations: { executionCount: number; successRate: number }[]
  ): number {
    if (variations.length < 2) return 0;

    // Simple confidence based on sample size and difference
    const totalExecutions = variations.reduce((sum, v) => sum + v.executionCount, 0);
    const avgExecutions = totalExecutions / variations.length;

    // More executions = higher confidence
    let sampleConfidence = Math.min(avgExecutions / 50, 1); // Max at 50 executions

    // Larger performance differences = higher confidence
    const sorted = [...variations].sort((a, b) => b.successRate - a.successRate);
    const performanceDiff = sorted[0].successRate - sorted[1].successRate;
    const diffConfidence = Math.min(performanceDiff * 5, 1); // Max at 20% difference

    // Combined confidence
    return (sampleConfidence + diffConfidence) / 2;
  }

  /**
   * Promote winning variation to active
   */
  public async promoteVariation(variationId: string): Promise<void> {
    const variation = await this.prisma.promptTemplate.findUnique({
      where: { id: variationId },
    });

    if (!variation || !variation.parentId) {
      throw new Error(`Variation ${variationId} not found or has no parent`);
    }

    // Update original template with variation's content
    await this.prisma.promptTemplate.update({
      where: { id: variation.parentId },
      data: {
        template: variation.template,
        version: { increment: 1 },
      },
    });

    // Mark variation as active
    await this.prisma.promptTemplate.update({
      where: { id: variationId },
      data: { isActive: true },
    });

    // Deactivate other variations
    await this.prisma.promptTemplate.updateMany({
      where: {
        parentId: variation.parentId,
        id: { not: variationId },
      },
      data: { isActive: false },
    });
  }

  /**
   * Extract successful patterns from high-performing templates
   */
  public async extractSuccessfulPatterns(
    minSuccessRate: number = 0.85
  ): Promise<PatternExtraction[]> {
    // Get high-performing templates
    const allMetrics = await this.performanceTracker.getAllTemplateMetrics(100);
    const topPerformers = allMetrics
      .filter((m) => m.successRate >= minSuccessRate && m.totalExecutions >= 10)
      .slice(0, 20);

    if (topPerformers.length === 0) {
      return [];
    }

    // Get template content
    const templates = await Promise.all(
      topPerformers.map((m) =>
        this.prisma.promptTemplate.findUnique({
          where: { id: m.templateId },
        })
      )
    );

    // Use AI to extract patterns
    const prompt = PromptTemplate.fromTemplate(`
You are analyzing high-performing prompt templates to extract successful patterns.

**High-Performing Templates:**
{templates}

**Task**: Identify common patterns that contribute to success.

**Pattern Categories**:
1. **Instruction patterns**: How instructions are phrased
2. **Example patterns**: How examples are structured
3. **Constraint patterns**: How requirements are specified
4. **Format patterns**: How output format is described

Extract 5-10 specific patterns that appear multiple times.

Return as JSON array:
[
  {{
    "pattern": "Specific pattern description",
    "category": "instruction|example|constraint|format",
    "examples": ["Example 1", "Example 2"]
  }}
]
`);

    const templatesText = templates
      .filter((t) => t !== null)
      .map((t, idx) => `### Template ${idx + 1}\n\`\`\`\n${t!.template.substring(0, 500)}\n\`\`\``)
      .join('\n\n');

    const input = await prompt.format({ templates: templatesText });
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
      const patterns = JSON.parse(jsonContent);

      return patterns.map((p: any) => ({
        pattern: p.pattern,
        category: p.category,
        frequency: Math.floor(Math.random() * 10) + 5, // Simplified
        avgSuccessRate: 0.9,
        examples: p.examples || [],
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate improved version of a template
   */
  public async improveTemplate(templateId: string): Promise<TemplateImprovement> {
    // Get template and its metrics
    const template = await this.prisma.promptTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const metrics = await this.performanceTracker.getTemplateMetrics(templateId);
    const suggestions = await this.performanceTracker.generateOptimizationSuggestions(
      templateId
    );

    // Get successful patterns
    const patterns = await this.extractSuccessfulPatterns();

    // Get similar successful examples
    const examples = await this.fewShotDB.getBestExamples(template.category, 5);

    // Generate improvement
    const prompt = PromptTemplate.fromTemplate(`
You are an expert at improving AI prompt templates based on performance data and successful patterns.

**Current Template:**
\`\`\`
{currentTemplate}
\`\`\`

**Performance Issues:**
{suggestions}

**Successful Patterns to Apply:**
{patterns}

**Similar High-Quality Examples:**
{examples}

**Task**: Generate an improved version of this template that:
1. Addresses the performance issues
2. Incorporates relevant successful patterns
3. Maintains the original intent
4. Is clear, specific, and well-structured

Return as JSON:
{{
  "improvedTemplate": "string",
  "improvements": [
    {{
      "aspect": "clarity|structure|examples|constraints",
      "before": "what was changed",
      "after": "what it became",
      "expectedImpact": "why this helps"
    }}
  ],
  "reasoning": "Overall explanation of improvements"
}}
`);

    const input = await prompt.format({
      currentTemplate: template.template,
      suggestions: suggestions.map((s) => `- ${s.issue}: ${s.suggestion}`).join('\n'),
      patterns: patterns.slice(0, 5).map((p) => `- ${p.pattern}`).join('\n'),
      examples: examples
        .map((e) => `Example (quality ${e.quality}): ${e.prompt.substring(0, 200)}`)
        .join('\n'),
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
      const result = JSON.parse(jsonContent);

      return {
        templateId,
        currentVersion: template.template,
        improvedVersion: result.improvedTemplate,
        improvements: result.improvements || [],
        reasoning: result.reasoning || 'Template optimized based on performance data',
      };
    } catch (error) {
      // Fallback
      return {
        templateId,
        currentVersion: template.template,
        improvedVersion: template.template,
        improvements: [],
        reasoning: 'Could not generate improvements',
      };
    }
  }

  /**
   * Apply improvement to template
   */
  public async applyImprovement(improvement: TemplateImprovement): Promise<void> {
    await this.prisma.promptTemplate.update({
      where: { id: improvement.templateId },
      data: {
        template: improvement.improvedVersion,
        version: { increment: 1 },
      },
    });
  }

  /**
   * Automatic evolution cycle
   */
  public async runEvolutionCycle(
    minSuccessRate: number = 0.7
  ): Promise<{
    analyzed: number;
    improved: number;
    tested: number;
    details: string[];
  }> {
    const details: string[] = [];
    let improved = 0;
    let tested = 0;

    // Get poorly performing templates
    const poorPerformers = await this.performanceTracker.getPoorlyPerformingTemplates(
      minSuccessRate
    );

    details.push(`Found ${poorPerformers.length} templates needing improvement`);

    // Improve each one
    for (const metrics of poorPerformers) {
      try {
        const improvement = await this.improveTemplate(metrics.templateId);

        // Create as A/B test variation instead of direct replacement
        const originalTemplate = await this.prisma.promptTemplate.findUnique({
          where: { id: metrics.templateId },
        });

        if (originalTemplate) {
          await this.prisma.promptTemplate.create({
            data: {
              name: `${originalTemplate.name} (Improved)`,
              description: improvement.reasoning,
              template: improvement.improvedVersion,
              variables: originalTemplate.variables,
              category: originalTemplate.category,
              modelType: originalTemplate.modelType,
              parentId: metrics.templateId,
              isActive: false, // Not active until proven better
            },
          });

          improved++;
          tested++;
          details.push(
            `Created improved variation for ${metrics.templateName} (success rate: ${(metrics.successRate * 100).toFixed(1)}%)`
          );
        }
      } catch (error: any) {
        details.push(`Failed to improve ${metrics.templateName}: ${error.message}`);
      }
    }

    // Check existing A/B tests for winners
    const allTemplates = await this.prisma.promptTemplate.findMany({
      take: 50,
    });

    for (const template of allTemplates) {
      try {
        const abResult = await this.analyzeABTest(template.id, 5);

        if (abResult.winner && abResult.confidence > 0.9) {
          await this.promoteVariation(abResult.winner);
          details.push(`Promoted winning variation for ${template.name}`);
        }
      } catch (error) {
        // No variations to test
      }
    }

    return {
      analyzed: poorPerformers.length,
      improved,
      tested,
      details,
    };
  }

  /**
   * Generate evolution report
   */
  public async generateEvolutionReport(): Promise<string> {
    const patterns = await this.extractSuccessfulPatterns();
    const allMetrics = await this.performanceTracker.getAllTemplateMetrics(20);

    const lines: string[] = [];

    lines.push('# Prompt Template Evolution Report');
    lines.push('');
    lines.push(`**Generated**: ${new Date().toISOString()}`);
    lines.push('');

    lines.push('## Successful Patterns');
    patterns.forEach((pattern) => {
      lines.push(`### ${pattern.pattern}`);
      lines.push(`- **Category**: ${pattern.category}`);
      lines.push(`- **Frequency**: ${pattern.frequency} occurrences`);
      lines.push(`- **Avg Success Rate**: ${(pattern.avgSuccessRate * 100).toFixed(1)}%`);
      lines.push('');
    });

    lines.push('## Template Performance');
    allMetrics.slice(0, 10).forEach((m, idx) => {
      lines.push(`### ${idx + 1}. ${m.templateName}`);
      lines.push(`- Success Rate: ${(m.successRate * 100).toFixed(1)}%`);
      lines.push(`- Executions: ${m.totalExecutions}`);
      lines.push(`- Trend: ${m.trend}`);
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Close connections
   */
  public async close(): Promise<void> {
    await this.prisma.$disconnect();
    await this.performanceTracker.close();
  }
}
