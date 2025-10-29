import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { CodeValidator, ValidationResult, CorrectionPrompt } from '../validation/outputValidator';

/**
 * Adaptive Prompt Refinement - Automatically improves prompts when AI output quality is insufficient
 * Implements feedback loop with retry limit and escalation to human review
 */

export interface RefinementAttempt {
  attemptNumber: number;
  originalPrompt: string;
  refinedPrompt: string;
  validationResult: ValidationResult;
  output?: string;
  timestamp: Date;
  successful: boolean;
}

export interface RefinementResult {
  success: boolean;
  finalOutput?: string;
  attempts: RefinementAttempt[];
  totalAttempts: number;
  needsHumanReview: boolean;
  escalationReason?: string;
}

export interface RefinementConfig {
  maxRetries: number; // Default: 3
  modelName: string;
  temperature: number;
  validationType: 'typescript' | 'react' | 'prisma' | 'json';
}

export class AdaptivePromptRefinement {
  private model: ChatAnthropic;
  private validator: CodeValidator;
  private config: RefinementConfig;

  constructor(config?: Partial<RefinementConfig>, apiKey?: string) {
    this.config = {
      maxRetries: config?.maxRetries || 3,
      modelName: config?.modelName || 'claude-3-sonnet-20240229',
      temperature: config?.temperature || 0.3,
      validationType: config?.validationType || 'typescript',
    };

    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: this.config.modelName,
      temperature: this.config.temperature,
    });

    this.validator = new CodeValidator();
  }

  /**
   * Execute prompt with automatic refinement on validation failures
   */
  public async executeWithRefinement(
    initialPrompt: string,
    context?: string
  ): Promise<RefinementResult> {
    const attempts: RefinementAttempt[] = [];
    let currentPrompt = initialPrompt;
    let validationResult: ValidationResult | null = null;
    let output: string | null = null;

    for (let attemptNum = 1; attemptNum <= this.config.maxRetries; attemptNum++) {
      // Execute prompt
      const response = await this.model.invoke(currentPrompt);
      output = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Extract code from response (handle markdown code blocks)
      const extractedCode = this.extractCode(output);

      // Validate output
      validationResult = this.validator.validateAndCorrect(
        extractedCode,
        this.config.validationType,
        context
      ).result;

      const attempt: RefinementAttempt = {
        attemptNumber: attemptNum,
        originalPrompt: attemptNum === 1 ? initialPrompt : attempts[attemptNum - 2].refinedPrompt,
        refinedPrompt: currentPrompt,
        validationResult,
        output: extractedCode,
        timestamp: new Date(),
        successful: validationResult.isValid,
      };

      attempts.push(attempt);

      // If valid, we're done!
      if (validationResult.isValid) {
        return {
          success: true,
          finalOutput: extractedCode,
          attempts,
          totalAttempts: attemptNum,
          needsHumanReview: false,
        };
      }

      // If not valid and we have retries left, refine the prompt
      if (attemptNum < this.config.maxRetries) {
        const correctionPrompt = this.validator.generateCorrectionPrompt(
          extractedCode,
          validationResult,
          context
        );

        currentPrompt = await this.generateRefinedPrompt(
          initialPrompt,
          correctionPrompt,
          attempts
        );
      }
    }

    // All retries exhausted - escalate to human
    return {
      success: false,
      finalOutput: output || undefined,
      attempts,
      totalAttempts: this.config.maxRetries,
      needsHumanReview: true,
      escalationReason: this.generateEscalationReason(attempts),
    };
  }

  /**
   * Generate a refined prompt based on validation errors
   */
  public async generateRefinedPrompt(
    originalPrompt: string,
    correctionPrompt: CorrectionPrompt,
    previousAttempts: RefinementAttempt[]
  ): Promise<string> {
    // Summarize previous failures
    const failureSummary = previousAttempts
      .map(
        (attempt) =>
          `Attempt ${attempt.attemptNumber}: ${attempt.validationResult.errors.length} errors`
      )
      .join('\n');

    const refinementTemplate = PromptTemplate.fromTemplate(`
You previously attempted to complete this task but the output had validation errors.

**Original Request:**
{originalPrompt}

**Previous Attempts:**
{failureSummary}

**Issues Found in Latest Attempt:**
{errorSummary}

**Specific Corrections Needed:**
{correctionInstructions}

Now, generate corrected code that addresses ALL the issues above. Requirements:

1. Fix all validation errors
2. Ensure proper TypeScript typing
3. Include all necessary imports
4. Follow best practices
5. Maintain the same functionality

{additionalGuidance}

Generate the complete, corrected code now.
`);

    // Create error summary
    const errorSummary = correctionPrompt.errors
      .map((err, idx) => `${idx + 1}. [${err.type}] ${err.message}`)
      .join('\n');

    // Add guidance based on error types
    const errorTypes = new Set(correctionPrompt.errors.map((e) => e.type));
    let additionalGuidance = '';

    if (errorTypes.has('type')) {
      additionalGuidance += '- Pay special attention to TypeScript types\n';
      additionalGuidance += '- Define all interfaces explicitly\n';
    }

    if (errorTypes.has('import')) {
      additionalGuidance += '- Ensure all imports are from correct packages\n';
      additionalGuidance += '- Use proper import syntax for the module system\n';
    }

    if (errorTypes.has('syntax')) {
      additionalGuidance += '- Check for syntax errors carefully\n';
      additionalGuidance += '- Ensure proper bracket/parenthesis matching\n';
    }

    const refinedPrompt = await refinementTemplate.format({
      originalPrompt,
      failureSummary,
      errorSummary,
      correctionInstructions: correctionPrompt.correctionInstructions,
      additionalGuidance: additionalGuidance || 'Follow TypeScript best practices.',
    });

    return refinedPrompt;
  }

  /**
   * Extract code from AI response (handle markdown code blocks)
   */
  private extractCode(output: string): string {
    // Try to extract from code blocks
    const codeBlockRegex = /```(?:typescript|tsx|ts|javascript|jsx|js|prisma|json)?\n([\s\S]*?)```/g;
    const matches = [...output.matchAll(codeBlockRegex)];

    if (matches.length > 0) {
      // Return the largest code block
      const codeBlocks = matches.map((m) => m[1]);
      return codeBlocks.reduce((longest, current) =>
        current.length > longest.length ? current : longest
      );
    }

    // If no code blocks, return as-is
    return output;
  }

  /**
   * Generate human-readable escalation reason
   */
  private generateEscalationReason(attempts: RefinementAttempt[]): string {
    const lastAttempt = attempts[attempts.length - 1];
    const errorsByType = lastAttempt.validationResult.errors.reduce((acc, err) => {
      acc[err.type] = (acc[err.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const reasons: string[] = [];
    reasons.push(`Failed after ${attempts.length} automatic refinement attempts.`);
    reasons.push('');
    reasons.push('Persistent issues:');

    Object.entries(errorsByType).forEach(([type, count]) => {
      reasons.push(`- ${count} ${type} error(s)`);
    });

    reasons.push('');
    reasons.push('The AI model is unable to automatically resolve these issues.');
    reasons.push('Human review is required to:');
    reasons.push('1. Clarify requirements if ambiguous');
    reasons.push('2. Provide additional context or constraints');
    reasons.push('3. Manually fix complex errors');

    return reasons.join('\n');
  }

  /**
   * Analyze refinement attempts to identify patterns
   */
  public analyzeAttempts(attempts: RefinementAttempt[]): {
    mostCommonErrorType: string;
    improvementRate: number;
    stagnant: boolean;
  } {
    if (attempts.length === 0) {
      return {
        mostCommonErrorType: 'unknown',
        improvementRate: 0,
        stagnant: true,
      };
    }

    // Find most common error type across all attempts
    const allErrors = attempts.flatMap((a) => a.validationResult.errors);
    const errorCounts = allErrors.reduce((acc, err) => {
      acc[err.type] = (acc[err.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostCommonErrorType = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';

    // Calculate improvement rate (error reduction over attempts)
    const firstErrorCount = attempts[0].validationResult.errors.length;
    const lastErrorCount = attempts[attempts.length - 1].validationResult.errors.length;

    const improvementRate =
      firstErrorCount > 0 ? (firstErrorCount - lastErrorCount) / firstErrorCount : 0;

    // Check if stagnant (no improvement in last 2 attempts)
    const stagnant =
      attempts.length >= 2 &&
      attempts[attempts.length - 1].validationResult.errors.length ===
        attempts[attempts.length - 2].validationResult.errors.length;

    return {
      mostCommonErrorType,
      improvementRate,
      stagnant,
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<RefinementConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update model if needed
    if (newConfig.modelName || newConfig.temperature) {
      this.model = new ChatAnthropic({
        anthropicApiKey: process.env.CLAUDE_API_KEY,
        modelName: this.config.modelName,
        temperature: this.config.temperature,
      });
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): RefinementConfig {
    return { ...this.config };
  }
}
