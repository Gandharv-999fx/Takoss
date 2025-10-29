import { PrismaClient, ModelType, ExecutionStatus } from '@prisma/client';

/**
 * Prompt Performance Tracker - Analytics on prompt success rates and optimization
 * Tracks template performance metrics for continuous improvement
 */

export interface PerformanceMetrics {
  templateId: string;
  templateName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  averagePromptTokens: number;
  averageCompletionTokens: number;
  averageRetries: number;
  lastUsed: Date;
  trend: 'improving' | 'stable' | 'declining';
}

export interface PromptOptimizationSuggestion {
  templateId: string;
  currentSuccessRate: number;
  issue: string;
  suggestion: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImprovement: number; // Percentage
}

export class PromptPerformanceTracker {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Track prompt execution
   */
  public async trackExecution(data: {
    templateId: string;
    templateName: string;
    chainId: string;
    taskId: string;
    modelType: ModelType;
    executionTime: number;
    promptTokens: number;
    completionTokens: number;
    status: ExecutionStatus;
    error?: string;
  }): Promise<void> {
    await this.prisma.templateExecution.create({
      data: {
        templateId: data.templateId,
        templateName: data.templateName,
        chainId: data.chainId,
        taskId: data.taskId,
        modelType: data.modelType,
        executionTime: data.executionTime,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        status: data.status,
        error: data.error,
        outputLength: 0, // Optional
      },
    });
  }

  /**
   * Get performance metrics for a template
   */
  public async getTemplateMetrics(
    templateId: string,
    timeRange?: {
      start: Date;
      end: Date;
    }
  ): Promise<PerformanceMetrics | null> {
    const where: any = { templateId };

    if (timeRange) {
      where.executedAt = {
        gte: timeRange.start,
        lte: timeRange.end,
      };
    }

    const executions = await this.prisma.templateExecution.findMany({
      where,
      orderBy: { executedAt: 'desc' },
    });

    if (executions.length === 0) return null;

    const totalExecutions = executions.length;
    const successfulExecutions = executions.filter(
      (e) => e.status === ExecutionStatus.SUCCESS
    ).length;
    const failedExecutions = totalExecutions - successfulExecutions;
    const successRate = successfulExecutions / totalExecutions;

    const averageExecutionTime =
      executions.reduce((sum, e) => sum + e.executionTime, 0) / totalExecutions;

    const averagePromptTokens =
      executions.reduce((sum, e) => sum + e.promptTokens, 0) / totalExecutions;

    const averageCompletionTokens =
      executions.reduce((sum, e) => sum + e.completionTokens, 0) / totalExecutions;

    // Calculate average retries (tasks with same taskId)
    const taskGroups = executions.reduce((acc, e) => {
      if (!acc[e.taskId]) acc[e.taskId] = [];
      acc[e.taskId].push(e);
      return acc;
    }, {} as Record<string, typeof executions>);

    const averageRetries =
      Object.values(taskGroups).reduce((sum, group) => sum + (group.length - 1), 0) /
      Object.keys(taskGroups).length;

    // Determine trend
    const trend = this.calculateTrend(executions);

    return {
      templateId,
      templateName: executions[0].templateName,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      successRate,
      averageExecutionTime: Math.round(averageExecutionTime),
      averagePromptTokens: Math.round(averagePromptTokens),
      averageCompletionTokens: Math.round(averageCompletionTokens),
      averageRetries: Math.round(averageRetries * 10) / 10,
      lastUsed: executions[0].executedAt,
      trend,
    };
  }

  /**
   * Calculate performance trend
   */
  private calculateTrend(
    executions: any[]
  ): 'improving' | 'stable' | 'declining' {
    if (executions.length < 10) return 'stable';

    // Split into recent and older
    const mid = Math.floor(executions.length / 2);
    const recent = executions.slice(0, mid);
    const older = executions.slice(mid);

    const recentSuccessRate =
      recent.filter((e) => e.status === ExecutionStatus.SUCCESS).length / recent.length;
    const olderSuccessRate =
      older.filter((e) => e.status === ExecutionStatus.SUCCESS).length / older.length;

    const diff = recentSuccessRate - olderSuccessRate;

    if (diff > 0.1) return 'improving';
    if (diff < -0.1) return 'declining';
    return 'stable';
  }

  /**
   * Get all template metrics
   */
  public async getAllTemplateMetrics(
    limit: number = 50
  ): Promise<PerformanceMetrics[]> {
    // Get unique template IDs
    const templates = await this.prisma.templateExecution.groupBy({
      by: ['templateId'],
      _count: true,
      orderBy: {
        _count: {
          templateId: 'desc',
        },
      },
      take: limit,
    });

    const metrics: PerformanceMetrics[] = [];

    for (const template of templates) {
      const metric = await this.getTemplateMetrics(template.templateId);
      if (metric) {
        metrics.push(metric);
      }
    }

    return metrics;
  }

  /**
   * Get poorly performing templates
   */
  public async getPoorlyPerformingTemplates(
    threshold: number = 0.7
  ): Promise<PerformanceMetrics[]> {
    const allMetrics = await this.getAllTemplateMetrics();

    return allMetrics.filter(
      (m) => m.successRate < threshold && m.totalExecutions >= 5
    );
  }

  /**
   * Generate optimization suggestions
   */
  public async generateOptimizationSuggestions(
    templateId: string
  ): Promise<PromptOptimizationSuggestion[]> {
    const metrics = await this.getTemplateMetrics(templateId);
    if (!metrics) return [];

    const suggestions: PromptOptimizationSuggestion[] = [];

    // Low success rate
    if (metrics.successRate < 0.7) {
      suggestions.push({
        templateId,
        currentSuccessRate: metrics.successRate,
        issue: 'Low success rate',
        suggestion:
          'Add more specific instructions, examples, or constraints to the prompt. Consider breaking complex tasks into smaller sub-prompts.',
        priority: 'high',
        estimatedImprovement: 20,
      });
    }

    // High token usage
    if (metrics.averagePromptTokens > 3000) {
      suggestions.push({
        templateId,
        currentSuccessRate: metrics.successRate,
        issue: 'High prompt token usage',
        suggestion:
          'Simplify prompt wording, remove redundant information, or use more concise examples.',
        priority: 'medium',
        estimatedImprovement: 10,
      });
    }

    // High retry rate
    if (metrics.averageRetries > 2) {
      suggestions.push({
        templateId,
        currentSuccessRate: metrics.successRate,
        issue: 'High retry rate',
        suggestion:
          'Improve validation criteria, add output format specifications, or enhance error messages in the prompt.',
        priority: 'high',
        estimatedImprovement: 25,
      });
    }

    // Slow execution
    if (metrics.averageExecutionTime > 30000) {
      suggestions.push({
        templateId,
        currentSuccessRate: metrics.successRate,
        issue: 'Slow execution time',
        suggestion:
          'Reduce prompt complexity, use shorter examples, or split into parallel sub-tasks.',
        priority: 'low',
        estimatedImprovement: 15,
      });
    }

    // Declining trend
    if (metrics.trend === 'declining') {
      suggestions.push({
        templateId,
        currentSuccessRate: metrics.successRate,
        issue: 'Declining performance',
        suggestion:
          'Review recent failures to identify new error patterns. The prompt may need updates for changed requirements.',
        priority: 'high',
        estimatedImprovement: 30,
      });
    }

    return suggestions.sort((a, b) => {
      const priorityMap = { high: 3, medium: 2, low: 1 };
      return priorityMap[b.priority] - priorityMap[a.priority];
    });
  }

  /**
   * Compare template performance
   */
  public async compareTemplates(
    templateIds: string[]
  ): Promise<{
    comparison: PerformanceMetrics[];
    bestTemplate: string;
    insights: string[];
  }> {
    const comparison: PerformanceMetrics[] = [];

    for (const id of templateIds) {
      const metrics = await this.getTemplateMetrics(id);
      if (metrics) {
        comparison.push(metrics);
      }
    }

    // Find best template
    const bestTemplate =
      comparison.sort((a, b) => b.successRate - a.successRate)[0]?.templateId || '';

    // Generate insights
    const insights: string[] = [];

    if (comparison.length > 0) {
      const avgSuccessRate =
        comparison.reduce((sum, m) => sum + m.successRate, 0) / comparison.length;
      insights.push(
        `Average success rate across templates: ${(avgSuccessRate * 100).toFixed(1)}%`
      );

      const bestPerformer = comparison[0];
      insights.push(
        `Best performer: ${bestPerformer.templateName} (${(bestPerformer.successRate * 100).toFixed(1)}% success)`
      );

      const slowest = comparison.sort(
        (a, b) => b.averageExecutionTime - a.averageExecutionTime
      )[0];
      insights.push(
        `Slowest template: ${slowest.templateName} (${slowest.averageExecutionTime}ms average)`
      );
    }

    return {
      comparison,
      bestTemplate,
      insights,
    };
  }

  /**
   * Get performance dashboard data
   */
  public async getDashboardData(): Promise<{
    totalExecutions: number;
    overallSuccessRate: number;
    topPerformers: PerformanceMetrics[];
    needsImprovement: PerformanceMetrics[];
    recentTrends: {
      date: string;
      successRate: number;
      executions: number;
    }[];
  }> {
    // Get all executions
    const allExecutions = await this.prisma.templateExecution.findMany({
      orderBy: { executedAt: 'desc' },
      take: 1000,
    });

    const totalExecutions = allExecutions.length;
    const successfulExecutions = allExecutions.filter(
      (e) => e.status === ExecutionStatus.SUCCESS
    ).length;
    const overallSuccessRate = successfulExecutions / totalExecutions;

    // Get top performers
    const allMetrics = await this.getAllTemplateMetrics(10);
    const topPerformers = allMetrics
      .filter((m) => m.totalExecutions >= 5)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    // Get templates needing improvement
    const needsImprovement = await this.getPoorlyPerformingTemplates(0.7);

    // Calculate recent trends (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentExecutions = allExecutions.filter(
      (e) => e.executedAt >= sevenDaysAgo
    );

    const trendsByDay = recentExecutions.reduce((acc, e) => {
      const date = e.executedAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { total: 0, successful: 0 };
      }
      acc[date].total++;
      if (e.status === ExecutionStatus.SUCCESS) {
        acc[date].successful++;
      }
      return acc;
    }, {} as Record<string, { total: number; successful: number }>);

    const recentTrends = Object.entries(trendsByDay).map(
      ([date, stats]) => ({
        date,
        successRate: stats.successful / stats.total,
        executions: stats.total,
      })
    );

    return {
      totalExecutions,
      overallSuccessRate,
      topPerformers,
      needsImprovement,
      recentTrends: recentTrends.sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  /**
   * Export performance data
   */
  public async exportPerformanceData(
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const metrics = await this.getAllTemplateMetrics(100);

    if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    }

    // CSV format
    const headers = [
      'Template ID',
      'Template Name',
      'Total Executions',
      'Success Rate',
      'Avg Execution Time (ms)',
      'Avg Prompt Tokens',
      'Avg Completion Tokens',
      'Avg Retries',
      'Trend',
    ].join(',');

    const rows = metrics.map((m) =>
      [
        m.templateId,
        m.templateName,
        m.totalExecutions,
        (m.successRate * 100).toFixed(2) + '%',
        m.averageExecutionTime,
        m.averagePromptTokens,
        m.averageCompletionTokens,
        m.averageRetries,
        m.trend,
      ].join(',')
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Clean up old performance data
   */
  public async cleanupOldData(olderThanDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.prisma.templateExecution.deleteMany({
      where: {
        executedAt: {
          lt: cutoffDate,
        },
      },
    });

    return result.count;
  }

  /**
   * Close database connection
   */
  public async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
