import { PrismaClient, ModelType, ExecutionStatus } from '@prisma/client';
import { ValidationResult } from '../validation/outputValidator';
import { AdaptivePromptRefinement, RefinementResult, RefinementAttempt } from './adaptivePromptRefinement';

/**
 * Self-Correcting Prompt Loop - Automatically fixes failed code generation attempts
 * Tracks correction attempts in database and escalates to human after retry limit
 */

export interface RetryStrategy {
  maxAttempts: number;
  backoffMultiplier: number; // Delay multiplier between retries
  escalationThreshold: number; // Escalate if error rate > this
}

export interface CorrectionAttempt {
  id: string;
  taskId: string;
  chainId: string;
  attemptNumber: number;
  prompt: string;
  output: string;
  validationResult: ValidationResult;
  successful: boolean;
  errorType?: string;
  correctionApplied?: string;
  timestamp: Date;
  executionTime: number;
}

export interface CorrectionHistory {
  taskId: string;
  attempts: CorrectionAttempt[];
  finalStatus: 'success' | 'failed' | 'escalated';
  totalAttempts: number;
  successfulAttempt?: number;
}

export class SelfCorrectingLoop {
  private prisma: PrismaClient;
  private refinement: AdaptivePromptRefinement;
  private strategy: RetryStrategy;

  constructor(
    strategy?: Partial<RetryStrategy>,
    refinementConfig?: any
  ) {
    this.prisma = new PrismaClient();

    this.strategy = {
      maxAttempts: strategy?.maxAttempts || 3,
      backoffMultiplier: strategy?.backoffMultiplier || 1.5,
      escalationThreshold: strategy?.escalationThreshold || 0.7,
    };

    this.refinement = new AdaptivePromptRefinement(refinementConfig);
  }

  /**
   * Execute task with self-correction
   */
  public async executeWithCorrection(
    taskId: string,
    chainId: string,
    initialPrompt: string,
    context?: string
  ): Promise<CorrectionHistory> {
    const attempts: CorrectionAttempt[] = [];
    const startTime = Date.now();

    // Execute with adaptive refinement
    const refinementResult = await this.refinement.executeWithRefinement(
      initialPrompt,
      context
    );

    // Convert refinement attempts to correction attempts
    for (let i = 0; i < refinementResult.attempts.length; i++) {
      const refAttempt = refinementResult.attempts[i];
      const executionTime = Date.now() - startTime;

      const correctionAttempt: CorrectionAttempt = {
        id: `${taskId}-attempt-${i + 1}`,
        taskId,
        chainId,
        attemptNumber: i + 1,
        prompt: refAttempt.refinedPrompt,
        output: refAttempt.output || '',
        validationResult: refAttempt.validationResult,
        successful: refAttempt.successful,
        errorType: refAttempt.validationResult.errors[0]?.type,
        correctionApplied:
          i > 0 ? 'Adaptive prompt refinement with validation feedback' : undefined,
        timestamp: refAttempt.timestamp,
        executionTime,
      };

      attempts.push(correctionAttempt);

      // Store in database
      await this.storeCorrectionAttempt(correctionAttempt);
    }

    const finalStatus: 'success' | 'failed' | 'escalated' = refinementResult.success
      ? 'success'
      : refinementResult.needsHumanReview
      ? 'escalated'
      : 'failed';

    const successfulAttempt = attempts.findIndex((a) => a.successful);

    const history: CorrectionHistory = {
      taskId,
      attempts,
      finalStatus,
      totalAttempts: attempts.length,
      successfulAttempt: successfulAttempt >= 0 ? successfulAttempt + 1 : undefined,
    };

    return history;
  }

  /**
   * Store correction attempt in database for analytics
   */
  private async storeCorrectionAttempt(attempt: CorrectionAttempt): Promise<void> {
    try {
      // Store in template_executions table (reusing existing table)
      await this.prisma.templateExecution.create({
        data: {
          templateId: 'self-correction',
          templateName: 'Self-Correcting Loop',
          chainId: attempt.chainId,
          taskId: attempt.taskId,
          modelType: ModelType.CLAUDE,
          executionTime: attempt.executionTime,
          promptTokens: Math.ceil(attempt.prompt.length / 4), // Rough estimate
          completionTokens: Math.ceil(attempt.output.length / 4),
          status: attempt.successful ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILURE,
          outputLength: attempt.output.length,
          error: attempt.successful
            ? undefined
            : attempt.validationResult.errors.map((e) => e.message).join('; '),
        },
      });
    } catch (error) {
      console.error('Failed to store correction attempt:', error);
      // Don't throw - analytics failure shouldn't block execution
    }
  }

  /**
   * Get correction history for a task
   */
  public async getCorrectionHistory(taskId: string): Promise<CorrectionHistory | null> {
    try {
      const executions = await this.prisma.templateExecution.findMany({
        where: {
          taskId,
          templateName: 'Self-Correcting Loop',
        },
        orderBy: { executedAt: 'asc' },
      });

      if (executions.length === 0) return null;

      const attempts: CorrectionAttempt[] = executions.map((exec: any, idx: number) => ({
        id: exec.id,
        taskId: exec.taskId,
        chainId: exec.chainId,
        attemptNumber: idx + 1,
        prompt: '', // Not stored in DB
        output: '', // Not stored in DB
        validationResult: {
          isValid: exec.status === ExecutionStatus.SUCCESS,
          errors: exec.error ? [{ type: 'unknown' as any, message: exec.error, severity: 'error' as any }] : [],
          warnings: [],
          metadata: {
            validatedAt: exec.executedAt,
            validationType: 'typescript' as any,
          },
        },
        successful: exec.status === ExecutionStatus.SUCCESS,
        errorType: exec.error ? 'unknown' : undefined,
        timestamp: exec.executedAt,
        executionTime: exec.executionTime,
      }));

      const successfulAttempt = attempts.findIndex((a) => a.successful);
      const finalStatus =
        successfulAttempt >= 0
          ? 'success'
          : attempts.length >= 3
          ? 'escalated'
          : 'failed';

      return {
        taskId,
        attempts,
        finalStatus: finalStatus as any,
        totalAttempts: attempts.length,
        successfulAttempt: successfulAttempt >= 0 ? successfulAttempt + 1 : undefined,
      };
    } catch (error) {
      console.error('Failed to get correction history:', error);
      return null;
    }
  }

  /**
   * Get analytics on self-correction performance
   */
  public async getCorrectionAnalytics(chainId?: string): Promise<{
    totalTasks: number;
    successfulTasks: number;
    escalatedTasks: number;
    averageAttempts: number;
    successRate: number;
    commonErrorTypes: Record<string, number>;
  }> {
    try {
      const where = chainId
        ? { chainId, templateName: 'Self-Correcting Loop' }
        : { templateName: 'Self-Correcting Loop' };

      const executions = await this.prisma.templateExecution.findMany({
        where,
      });

      // Group by taskId
      const byTask = executions.reduce((acc: any, exec: any) => {
        if (!acc[exec.taskId]) acc[exec.taskId] = [];
        acc[exec.taskId].push(exec);
        return acc;
      }, {} as Record<string, typeof executions>);

      const totalTasks = Object.keys(byTask).length;
      let successfulTasks = 0;
      let escalatedTasks = 0;
      let totalAttempts = 0;
      const errorTypes: Record<string, number> = {};

      Object.values(byTask).forEach((attempts: any) => {
        totalAttempts += attempts.length;

        const hasSuccess = attempts.some((a: any) => a.status === ExecutionStatus.SUCCESS);
        if (hasSuccess) {
          successfulTasks++;
        } else if (attempts.length >= 3) {
          escalatedTasks++;
        }

        // Track error types
        attempts.forEach((attempt: any) => {
          if (attempt.error) {
            const errorType = attempt.error.split(':')[0] || 'unknown';
            errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
          }
        });
      });

      return {
        totalTasks,
        successfulTasks,
        escalatedTasks,
        averageAttempts: totalTasks > 0 ? totalAttempts / totalTasks : 0,
        successRate: totalTasks > 0 ? successfulTasks / totalTasks : 0,
        commonErrorTypes: errorTypes,
      };
    } catch (error) {
      console.error('Failed to get correction analytics:', error);
      return {
        totalTasks: 0,
        successfulTasks: 0,
        escalatedTasks: 0,
        averageAttempts: 0,
        successRate: 0,
        commonErrorTypes: {},
      };
    }
  }

  /**
   * Determine if task should be escalated based on error rate
   */
  public shouldEscalate(history: CorrectionHistory): boolean {
    if (history.finalStatus === 'success') return false;

    const errorRate = history.attempts.filter((a) => !a.successful).length / history.totalAttempts;

    return (
      errorRate >= this.strategy.escalationThreshold ||
      history.totalAttempts >= this.strategy.maxAttempts
    );
  }

  /**
   * Generate escalation report
   */
  public generateEscalationReport(history: CorrectionHistory): string {
    const lines: string[] = [];

    lines.push('# Task Escalation Report');
    lines.push('');
    lines.push(`**Task ID**: ${history.taskId}`);
    lines.push(`**Total Attempts**: ${history.totalAttempts}`);
    lines.push(`**Status**: ${history.finalStatus}`);
    lines.push('');

    lines.push('## Attempt History');
    history.attempts.forEach((attempt) => {
      lines.push(`### Attempt ${attempt.attemptNumber}`);
      lines.push(`- **Successful**: ${attempt.successful ? 'Yes' : 'No'}`);
      lines.push(`- **Execution Time**: ${attempt.executionTime}ms`);

      if (!attempt.successful) {
        lines.push(`- **Errors**:`);
        attempt.validationResult.errors.forEach((err) => {
          lines.push(`  - [${err.type}] ${err.message}`);
        });
      }

      if (attempt.correctionApplied) {
        lines.push(`- **Correction Applied**: ${attempt.correctionApplied}`);
      }

      lines.push('');
    });

    lines.push('## Recommendation');
    lines.push('Manual intervention required. Please review the errors above and:');
    lines.push('1. Clarify requirements if ambiguous');
    lines.push('2. Provide additional constraints or context');
    lines.push('3. Fix errors that the AI cannot resolve automatically');

    return lines.join('\n');
  }

  /**
   * Update retry strategy
   */
  public updateStrategy(newStrategy: Partial<RetryStrategy>): void {
    this.strategy = { ...this.strategy, ...newStrategy };
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
