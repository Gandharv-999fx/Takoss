/**
 * Model Selector - Intelligent model selection based on task type and preferences
 */

import {
  ModelName,
  ClaudeModel,
  GeminiModel,
  OpenAIModel,
  TaskTypeModelPreference,
  DEFAULT_MODEL_PREFERENCES,
  COST_OPTIMIZED_PREFERENCES,
  QUALITY_OPTIMIZED_PREFERENCES,
  getModelCapabilities,
  estimateCost,
} from '../types/modelConfig';

export type ModelSelectionStrategy = 'default' | 'cost-optimized' | 'quality-optimized' | 'custom';

export type TaskType =
  | 'requirementsAnalysis'
  | 'schemaGeneration'
  | 'componentGeneration'
  | 'apiGeneration'
  | 'deploymentGeneration'
  | 'refinement';

export interface ModelSelectionOptions {
  strategy?: ModelSelectionStrategy;
  customPreferences?: Partial<TaskTypeModelPreference>;
  maxCostPerTask?: number; // Maximum cost in USD
  minQuality?: 'decent' | 'good' | 'high' | 'excellent';
  preferredProviders?: Array<'claude' | 'gemini' | 'openai'>;
}

export class ModelSelector {
  private preferences: TaskTypeModelPreference;

  constructor(private options: ModelSelectionOptions = {}) {
    this.preferences = this.initializePreferences();
  }

  /**
   * Initialize model preferences based on strategy
   */
  private initializePreferences(): TaskTypeModelPreference {
    const { strategy = 'default', customPreferences } = this.options;

    let basePreferences: TaskTypeModelPreference;

    switch (strategy) {
      case 'cost-optimized':
        basePreferences = COST_OPTIMIZED_PREFERENCES;
        break;
      case 'quality-optimized':
        basePreferences = QUALITY_OPTIMIZED_PREFERENCES;
        break;
      case 'custom':
        if (!customPreferences) {
          throw new Error('Custom strategy requires customPreferences');
        }
        basePreferences = { ...DEFAULT_MODEL_PREFERENCES, ...customPreferences };
        break;
      case 'default':
      default:
        basePreferences = DEFAULT_MODEL_PREFERENCES;
    }

    return basePreferences;
  }

  /**
   * Select the best model for a given task type
   */
  public selectModel(taskType: TaskType): ModelName {
    const preferredModel = this.preferences[taskType];

    // Check if model meets constraints
    if (this.meetsConstraints(preferredModel)) {
      return preferredModel;
    }

    // If preferred model doesn't meet constraints, find alternative
    return this.findAlternativeModel(taskType);
  }

  /**
   * Check if a model meets the selection constraints
   */
  private meetsConstraints(modelName: ModelName): boolean {
    const capabilities = getModelCapabilities(modelName);

    // Check quality constraint
    if (this.options.minQuality) {
      const qualityLevels = ['decent', 'good', 'high', 'excellent'];
      const requiredLevel = qualityLevels.indexOf(this.options.minQuality);
      const modelLevel = qualityLevels.indexOf(capabilities.quality);
      if (modelLevel < requiredLevel) {
        return false;
      }
    }

    // Check cost constraint
    if (this.options.maxCostPerTask) {
      const estimatedCost = estimateCost(modelName, 4000, 2000); // Rough estimate
      if (estimatedCost > this.options.maxCostPerTask) {
        return false;
      }
    }

    // Check provider preference
    if (this.options.preferredProviders && this.options.preferredProviders.length > 0) {
      const provider = this.getProvider(modelName);
      if (!this.options.preferredProviders.includes(provider)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find an alternative model that meets constraints
   */
  private findAlternativeModel(taskType: TaskType): ModelName {
    // Try all available models, sorted by quality and cost
    const allModels = [
      ...Object.values(ClaudeModel),
      ...Object.values(GeminiModel),
      ...Object.values(OpenAIModel),
    ];

    // Sort by quality (descending) and cost (ascending)
    const sortedModels = allModels.sort((a, b) => {
      const capsA = getModelCapabilities(a);
      const capsB = getModelCapabilities(b);

      // Quality comparison
      const qualityLevels = ['decent', 'good', 'high', 'excellent'];
      const qualityDiff = qualityLevels.indexOf(capsB.quality) - qualityLevels.indexOf(capsA.quality);
      if (qualityDiff !== 0) return qualityDiff;

      // Cost comparison (for same quality, prefer cheaper)
      const costA = capsA.costPer1MInputTokens + capsA.costPer1MOutputTokens;
      const costB = capsB.costPer1MInputTokens + capsB.costPer1MOutputTokens;
      return costA - costB;
    });

    // Find first model that meets constraints
    for (const model of sortedModels) {
      if (this.meetsConstraints(model)) {
        console.warn(`Using alternative model ${model} for task ${taskType}`);
        return model;
      }
    }

    // If no model meets constraints, use the most cost-effective decent model
    console.warn(`No model meets all constraints for task ${taskType}, using fallback`);
    return GeminiModel.GEMINI_2_5_FLASH;
  }

  /**
   * Get provider from model name
   */
  private getProvider(modelName: ModelName): 'claude' | 'gemini' | 'openai' {
    if (Object.values(ClaudeModel).includes(modelName as ClaudeModel)) {
      return 'claude';
    }
    if (Object.values(GeminiModel).includes(modelName as GeminiModel)) {
      return 'gemini';
    }
    if (Object.values(OpenAIModel).includes(modelName as OpenAIModel)) {
      return 'openai';
    }
    throw new Error(`Unknown model: ${modelName}`);
  }

  /**
   * Get all model selections for a complete project generation
   */
  public getProjectModelSelections(): Record<TaskType, ModelName> {
    return {
      requirementsAnalysis: this.selectModel('requirementsAnalysis'),
      schemaGeneration: this.selectModel('schemaGeneration'),
      componentGeneration: this.selectModel('componentGeneration'),
      apiGeneration: this.selectModel('apiGeneration'),
      deploymentGeneration: this.selectModel('deploymentGeneration'),
      refinement: this.selectModel('refinement'),
    };
  }

  /**
   * Estimate total cost for a project generation
   */
  public estimateProjectCost(estimatedTokens: {
    requirementsAnalysis: { input: number; output: number };
    schemaGeneration: { input: number; output: number };
    componentGeneration: { input: number; output: number };
    apiGeneration: { input: number; output: number };
    deploymentGeneration: { input: number; output: number };
    refinement: { input: number; output: number };
  }): number {
    const selections = this.getProjectModelSelections();
    let totalCost = 0;

    for (const [taskType, modelName] of Object.entries(selections)) {
      const tokens = estimatedTokens[taskType as TaskType];
      if (tokens) {
        totalCost += estimateCost(modelName, tokens.input, tokens.output);
      }
    }

    return totalCost;
  }

  /**
   * Get a summary of model selections with capabilities
   */
  public getSelectionSummary(): Array<{
    taskType: TaskType;
    model: ModelName;
    provider: string;
    quality: string;
    speed: string;
    estimatedCost: string;
  }> {
    const selections = this.getProjectModelSelections();
    const summary: Array<{
      taskType: TaskType;
      model: ModelName;
      provider: string;
      quality: string;
      speed: string;
      estimatedCost: string;
    }> = [];

    for (const [taskType, modelName] of Object.entries(selections)) {
      const capabilities = getModelCapabilities(modelName);
      const cost = estimateCost(modelName, 4000, 2000); // Rough estimate
      summary.push({
        taskType: taskType as TaskType,
        model: modelName,
        provider: this.getProvider(modelName),
        quality: capabilities.quality,
        speed: capabilities.speed,
        estimatedCost: `$${cost.toFixed(4)}`,
      });
    }

    return summary;
  }
}

/**
 * Factory function to create a model selector with common presets
 */
export function createModelSelector(preset: 'default' | 'cost-optimized' | 'quality-optimized' | 'balanced'): ModelSelector {
  switch (preset) {
    case 'default':
      return new ModelSelector({ strategy: 'default' });

    case 'cost-optimized':
      return new ModelSelector({ strategy: 'cost-optimized' });

    case 'quality-optimized':
      return new ModelSelector({ strategy: 'quality-optimized' });

    case 'balanced':
      // Balanced: Good quality with reasonable cost
      return new ModelSelector({
        strategy: 'custom',
        customPreferences: {
          requirementsAnalysis: ClaudeModel.SONNET_3_5,
          schemaGeneration: GeminiModel.GEMINI_1_5_PRO,
          componentGeneration: ClaudeModel.SONNET_3_5,
          apiGeneration: OpenAIModel.GPT_4O_MINI,
          deploymentGeneration: GeminiModel.GEMINI_2_5_FLASH,
          refinement: ClaudeModel.SONNET_4_5,
        },
      });

    default:
      return new ModelSelector();
  }
}
