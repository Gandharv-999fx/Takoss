import { PrismaClient, TemplateCategory, ModelType, ExecutionStatus, Prisma, PromptTemplate as PrismaPromptTemplate } from '@prisma/client';
import { PromptTemplate } from '../types/interfaces';

/**
 * Template Library Service - Manages prompt templates in PostgreSQL
 * Provides CRUD operations, versioning, search, and analytics
 */
export class TemplateLibraryService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Create a new template
   */
  public async createTemplate(data: {
    name: string;
    description: string;
    template: string;
    variables: string[];
    category: string;
    modelType?: string;
    tags?: string[];
    metadata?: any;
    examples?: Array<{ input: any; output: string }>;
  }): Promise<PromptTemplate> {
    const templateData: Prisma.PromptTemplateCreateInput = {
      name: data.name,
      description: data.description,
      template: data.template,
      variables: data.variables,
      category: this.mapCategory(data.category),
      modelType: data.modelType ? this.mapModelType(data.modelType) : null,
      tags: data.tags || [],
      metadata: data.metadata || {},
      examples: data.examples
        ? {
            create: data.examples.map((ex) => ({
              input: ex.input,
              output: ex.output,
            })),
          }
        : undefined,
    };

    const created = await this.prisma.promptTemplate.create({
      data: templateData,
      include: { examples: true },
    });

    return this.toDomainModel(created);
  }

  /**
   * Get template by ID
   */
  public async getTemplate(id: string): Promise<PromptTemplate | null> {
    const template = await this.prisma.promptTemplate.findUnique({
      where: { id },
      include: { examples: true },
    });

    return template ? this.toDomainModel(template) : null;
  }

  /**
   * Get all active templates
   */
  public async getAllTemplates(
    options: {
      category?: string;
      modelType?: string;
      tags?: string[];
      isActive?: boolean;
    } = {}
  ): Promise<PromptTemplate[]> {
    const where: Prisma.PromptTemplateWhereInput = {
      isActive: options.isActive !== undefined ? options.isActive : true,
    };

    if (options.category) {
      where.category = this.mapCategory(options.category);
    }

    if (options.modelType) {
      where.modelType = this.mapModelType(options.modelType);
    }

    if (options.tags && options.tags.length > 0) {
      where.tags = {
        hasSome: options.tags,
      };
    }

    const templates = await this.prisma.promptTemplate.findMany({
      where,
      include: { examples: true },
      orderBy: { createdAt: 'desc' },
    });

    return templates.map((t: any) => this.toDomainModel(t));
  }

  /**
   * Search templates by text
   */
  public async searchTemplates(query: string): Promise<PromptTemplate[]> {
    const templates = await this.prisma.promptTemplate.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              { tags: { hasSome: [query.toLowerCase()] } },
            ],
          },
        ],
      },
      include: { examples: true },
      orderBy: { usageCount: 'desc' },
    });

    return templates.map((t: any) => this.toDomainModel(t));
  }

  /**
   * Update template
   */
  public async updateTemplate(
    id: string,
    data: {
      name?: string;
      description?: string;
      template?: string;
      variables?: string[];
      category?: string;
      modelType?: string;
      tags?: string[];
      metadata?: any;
      isActive?: boolean;
    }
  ): Promise<PromptTemplate> {
    const updateData: Prisma.PromptTemplateUpdateInput = {};

    if (data.name) updateData.name = data.name;
    if (data.description) updateData.description = data.description;
    if (data.template) updateData.template = data.template;
    if (data.variables) updateData.variables = data.variables;
    if (data.category) updateData.category = this.mapCategory(data.category);
    if (data.modelType) updateData.modelType = this.mapModelType(data.modelType);
    if (data.tags) updateData.tags = data.tags;
    if (data.metadata) updateData.metadata = data.metadata;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await this.prisma.promptTemplate.update({
      where: { id },
      data: updateData,
      include: { examples: true },
    });

    return this.toDomainModel(updated);
  }

  /**
   * Create a new version of a template
   */
  public async createTemplateVersion(
    parentId: string,
    changes: {
      template?: string;
      description?: string;
      variables?: string[];
    }
  ): Promise<PromptTemplate> {
    const parent = await this.prisma.promptTemplate.findUnique({
      where: { id: parentId },
    });

    if (!parent) {
      throw new Error(`Template ${parentId} not found`);
    }

    // Deactivate old version
    await this.prisma.promptTemplate.update({
      where: { id: parentId },
      data: { isActive: false },
    });

    // Create new version
    const newVersion = await this.prisma.promptTemplate.create({
      data: {
        name: parent.name,
        description: changes.description || parent.description,
        template: changes.template || parent.template,
        variables: changes.variables || parent.variables,
        category: parent.category,
        modelType: parent.modelType,
        tags: parent.tags,
        metadata: parent.metadata || undefined,
        version: parent.version + 1,
        parentId: parentId,
      },
      include: { examples: true },
    });

    return this.toDomainModel(newVersion);
  }

  /**
   * Soft delete template (mark as inactive)
   */
  public async deleteTemplate(id: string): Promise<void> {
    await this.prisma.promptTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Hard delete template
   */
  public async hardDeleteTemplate(id: string): Promise<void> {
    await this.prisma.promptTemplate.delete({
      where: { id },
    });
  }

  /**
   * Track template usage
   */
  public async recordTemplateUsage(
    templateId: string,
    executionData: {
      chainId: string;
      taskId: string;
      modelType: 'claude' | 'gemini';
      executionTime: number;
      promptTokens: number;
      completionTokens: number;
      status: 'success' | 'failure' | 'timeout';
      outputLength?: number;
      error?: string;
    }
  ): Promise<void> {
    // Get template name
    const template = await this.prisma.promptTemplate.findUnique({
      where: { id: templateId },
      select: { name: true },
    });

    if (!template) {
      console.warn(`Template ${templateId} not found for usage tracking`);
      return;
    }

    // Record execution
    await this.prisma.templateExecution.create({
      data: {
        templateId,
        templateName: template.name,
        chainId: executionData.chainId,
        taskId: executionData.taskId,
        modelType: executionData.modelType.toUpperCase() as ModelType,
        executionTime: executionData.executionTime,
        promptTokens: executionData.promptTokens,
        completionTokens: executionData.completionTokens,
        status: executionData.status.toUpperCase() as any,
        outputLength: executionData.outputLength,
        error: executionData.error,
      },
    });

    // Increment usage count and update last used
    await this.prisma.promptTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  /**
   * Get template analytics
   */
  public async getTemplateAnalytics(templateId: string): Promise<{
    totalExecutions: number;
    successRate: number;
    averageExecutionTime: number;
    averageTokens: number;
    recentExecutions: any[];
  }> {
    const executions = await this.prisma.templateExecution.findMany({
      where: { templateId },
      orderBy: { executedAt: 'desc' },
      take: 100, // Last 100 executions
    });

    const total = executions.length;
    const successful = executions.filter((e: any) => e.status === ExecutionStatus.SUCCESS).length;

    const avgExecutionTime =
      executions.reduce((sum: number, e: any) => sum + e.executionTime, 0) / total || 0;

    const avgTokens =
      executions.reduce((sum: number, e: any) => sum + e.promptTokens + e.completionTokens, 0) /
        total || 0;

    return {
      totalExecutions: total,
      successRate: total > 0 ? successful / total : 0,
      averageExecutionTime: Math.round(avgExecutionTime),
      averageTokens: Math.round(avgTokens),
      recentExecutions: executions.slice(0, 10),
    };
  }

  /**
   * Get popular templates (by usage count)
   */
  public async getPopularTemplates(limit: number = 10): Promise<PromptTemplate[]> {
    const templates = await this.prisma.promptTemplate.findMany({
      where: { isActive: true },
      orderBy: { usageCount: 'desc' },
      take: limit,
      include: { examples: true },
    });

    return templates.map((t: any) => this.toDomainModel(t));
  }

  /**
   * Get templates by category
   */
  public async getTemplatesByCategory(category: string): Promise<PromptTemplate[]> {
    return this.getAllTemplates({ category });
  }

  /**
   * Close Prisma connection
   */
  public async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // Helper methods

  private mapCategory(category: string): TemplateCategory {
    return category.toUpperCase() as TemplateCategory;
  }

  private mapModelType(modelType: string): ModelType {
    return modelType.toUpperCase() as ModelType;
  }

  private toDomainModel(dbTemplate: any): PromptTemplate {
    return {
      id: dbTemplate.id,
      name: dbTemplate.name,
      description: dbTemplate.description,
      template: dbTemplate.template,
      variables: dbTemplate.variables,
      category: dbTemplate.category.toLowerCase() as any,
      modelType: dbTemplate.modelType?.toLowerCase() as any,
      examples: dbTemplate.examples?.map((ex: any) => ({
        input: ex.input,
        output: ex.output,
      })),
    };
  }
}
