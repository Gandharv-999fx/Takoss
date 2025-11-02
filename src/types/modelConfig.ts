/**
 * Model Configuration and Selection
 * Supports Claude, Gemini, and OpenAI models
 */

export enum ModelProvider {
  CLAUDE = 'claude',
  GEMINI = 'gemini',
  OPENAI = 'openai',
}

export enum ClaudeModel {
  SONNET_4_5 = 'claude-sonnet-4-5-20250929',
  SONNET_3_5 = 'claude-3-5-sonnet-20241022',
  OPUS_3_5 = 'claude-3-5-opus-20250514',
  HAIKU_3_5 = 'claude-3-5-haiku-20241022',
}

export enum GeminiModel {
  GEMINI_2_5_PRO = 'gemini-2.0-flash-thinking-exp',
  GEMINI_2_5_FLASH = 'gemini-2.0-flash-exp',
  GEMINI_1_5_PRO = 'gemini-1.5-pro',
  GEMINI_1_5_FLASH = 'gemini-1.5-flash',
}

export enum OpenAIModel {
  GPT_4O = 'gpt-4o',
  GPT_4O_MINI = 'gpt-4o-mini',
  GPT_4_TURBO = 'gpt-4-turbo',
  GPT_4 = 'gpt-4',
  O1 = 'o1',
  O1_MINI = 'o1-mini',
}

export type ModelName = ClaudeModel | GeminiModel | OpenAIModel;

export interface ModelCapabilities {
  maxInputTokens: number;
  maxOutputTokens: number;
  supportsFunctionCalling: boolean;
  supportsVision: boolean;
  supportsStreaming: boolean;
  costPer1MInputTokens: number; // in USD
  costPer1MOutputTokens: number; // in USD
  speed: 'very-fast' | 'fast' | 'medium' | 'slow';
  quality: 'excellent' | 'high' | 'good' | 'decent';
}

export interface ModelConfig {
  provider: ModelProvider;
  modelName: ModelName;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  systemPrompt?: string;
}

export interface TaskTypeModelPreference {
  requirementsAnalysis: ModelName;
  schemaGeneration: ModelName;
  componentGeneration: ModelName;
  apiGeneration: ModelName;
  deploymentGeneration: ModelName;
  refinement: ModelName;
}

// Model capabilities database
export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // Claude models
  [ClaudeModel.SONNET_4_5]: {
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1MInputTokens: 3.0,
    costPer1MOutputTokens: 15.0,
    speed: 'fast',
    quality: 'excellent',
  },
  [ClaudeModel.SONNET_3_5]: {
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1MInputTokens: 3.0,
    costPer1MOutputTokens: 15.0,
    speed: 'fast',
    quality: 'excellent',
  },
  [ClaudeModel.OPUS_3_5]: {
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1MInputTokens: 15.0,
    costPer1MOutputTokens: 75.0,
    speed: 'medium',
    quality: 'excellent',
  },
  [ClaudeModel.HAIKU_3_5]: {
    maxInputTokens: 200000,
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsStreaming: true,
    costPer1MInputTokens: 0.8,
    costPer1MOutputTokens: 4.0,
    speed: 'very-fast',
    quality: 'high',
  },

  // Gemini models
  [GeminiModel.GEMINI_2_5_PRO]: {
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1MInputTokens: 1.25,
    costPer1MOutputTokens: 5.0,
    speed: 'fast',
    quality: 'excellent',
  },
  [GeminiModel.GEMINI_2_5_FLASH]: {
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1MInputTokens: 0.075,
    costPer1MOutputTokens: 0.3,
    speed: 'very-fast',
    quality: 'high',
  },
  [GeminiModel.GEMINI_1_5_PRO]: {
    maxInputTokens: 2000000,
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1MInputTokens: 1.25,
    costPer1MOutputTokens: 5.0,
    speed: 'fast',
    quality: 'excellent',
  },
  [GeminiModel.GEMINI_1_5_FLASH]: {
    maxInputTokens: 1000000,
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1MInputTokens: 0.075,
    costPer1MOutputTokens: 0.3,
    speed: 'very-fast',
    quality: 'high',
  },

  // OpenAI models
  [OpenAIModel.GPT_4O]: {
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1MInputTokens: 2.5,
    costPer1MOutputTokens: 10.0,
    speed: 'fast',
    quality: 'excellent',
  },
  [OpenAIModel.GPT_4O_MINI]: {
    maxInputTokens: 128000,
    maxOutputTokens: 16384,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1MInputTokens: 0.15,
    costPer1MOutputTokens: 0.6,
    speed: 'very-fast',
    quality: 'high',
  },
  [OpenAIModel.GPT_4_TURBO]: {
    maxInputTokens: 128000,
    maxOutputTokens: 4096,
    supportsFunctionCalling: true,
    supportsVision: true,
    supportsStreaming: true,
    costPer1MInputTokens: 10.0,
    costPer1MOutputTokens: 30.0,
    speed: 'medium',
    quality: 'excellent',
  },
  [OpenAIModel.GPT_4]: {
    maxInputTokens: 8192,
    maxOutputTokens: 8192,
    supportsFunctionCalling: true,
    supportsVision: false,
    supportsStreaming: true,
    costPer1MInputTokens: 30.0,
    costPer1MOutputTokens: 60.0,
    speed: 'slow',
    quality: 'excellent',
  },
  [OpenAIModel.O1]: {
    maxInputTokens: 200000,
    maxOutputTokens: 100000,
    supportsFunctionCalling: false,
    supportsVision: false,
    supportsStreaming: false,
    costPer1MInputTokens: 15.0,
    costPer1MOutputTokens: 60.0,
    speed: 'slow',
    quality: 'excellent',
  },
  [OpenAIModel.O1_MINI]: {
    maxInputTokens: 128000,
    maxOutputTokens: 65536,
    supportsFunctionCalling: false,
    supportsVision: false,
    supportsStreaming: false,
    costPer1MInputTokens: 3.0,
    costPer1MOutputTokens: 12.0,
    speed: 'medium',
    quality: 'excellent',
  },
};

// Default model preferences by task type
export const DEFAULT_MODEL_PREFERENCES: TaskTypeModelPreference = {
  requirementsAnalysis: ClaudeModel.SONNET_3_5,
  schemaGeneration: ClaudeModel.SONNET_3_5,
  componentGeneration: ClaudeModel.SONNET_3_5,
  apiGeneration: ClaudeModel.SONNET_3_5,
  deploymentGeneration: GeminiModel.GEMINI_2_5_FLASH, // Fast and cheap for config generation
  refinement: ClaudeModel.SONNET_4_5,
};

// Cost-optimized preferences (uses fastest/cheapest models)
export const COST_OPTIMIZED_PREFERENCES: TaskTypeModelPreference = {
  requirementsAnalysis: GeminiModel.GEMINI_2_5_FLASH,
  schemaGeneration: GeminiModel.GEMINI_2_5_FLASH,
  componentGeneration: OpenAIModel.GPT_4O_MINI,
  apiGeneration: OpenAIModel.GPT_4O_MINI,
  deploymentGeneration: GeminiModel.GEMINI_2_5_FLASH,
  refinement: ClaudeModel.HAIKU_3_5,
};

// Quality-optimized preferences (uses best models regardless of cost)
export const QUALITY_OPTIMIZED_PREFERENCES: TaskTypeModelPreference = {
  requirementsAnalysis: ClaudeModel.SONNET_4_5,
  schemaGeneration: ClaudeModel.OPUS_3_5,
  componentGeneration: ClaudeModel.OPUS_3_5,
  apiGeneration: ClaudeModel.OPUS_3_5,
  deploymentGeneration: ClaudeModel.SONNET_3_5,
  refinement: ClaudeModel.OPUS_3_5,
};

/**
 * Get model provider from model name
 */
export function getModelProvider(modelName: ModelName): ModelProvider {
  if (Object.values(ClaudeModel).includes(modelName as ClaudeModel)) {
    return ModelProvider.CLAUDE;
  }
  if (Object.values(GeminiModel).includes(modelName as GeminiModel)) {
    return ModelProvider.GEMINI;
  }
  if (Object.values(OpenAIModel).includes(modelName as OpenAIModel)) {
    return ModelProvider.OPENAI;
  }
  throw new Error(`Unknown model: ${modelName}`);
}

/**
 * Get model capabilities
 */
export function getModelCapabilities(modelName: ModelName): ModelCapabilities {
  const capabilities = MODEL_CAPABILITIES[modelName];
  if (!capabilities) {
    throw new Error(`No capabilities defined for model: ${modelName}`);
  }
  return capabilities;
}

/**
 * Calculate estimated cost for a generation task
 */
export function estimateCost(
  modelName: ModelName,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): number {
  const capabilities = getModelCapabilities(modelName);
  const inputCost = (estimatedInputTokens / 1000000) * capabilities.costPer1MInputTokens;
  const outputCost = (estimatedOutputTokens / 1000000) * capabilities.costPer1MOutputTokens;
  return inputCost + outputCost;
}
