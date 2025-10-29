import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate as LangChainPromptTemplate } from '@langchain/core/prompts';
import { TaskNode, PromptTemplate } from '../types/interfaces';
import { PromptTemplateManager } from './promptTemplateManager';

export class AIModelService {
  private claudeModel: ChatAnthropic | null = null;
  private geminiModel: ChatOpenAI | null = null;
  private promptManager: PromptTemplateManager;

  constructor(
    promptManager: PromptTemplateManager,
    claudeApiKey?: string,
    openAIApiKey?: string
  ) {
    this.promptManager = promptManager;

    // Initialize models if API keys are provided
    if (claudeApiKey) {
      this.claudeModel = new ChatAnthropic({
        anthropicApiKey: claudeApiKey,
        modelName: 'claude-3-opus-20240229',
      });
    }

    if (openAIApiKey) {
      this.geminiModel = new ChatOpenAI({
        openAIApiKey: openAIApiKey,
        modelName: 'gpt-4',
      });
    }
  }

  /**
   * Executes a task using the appropriate AI model
   */
  public async executeTask(task: TaskNode): Promise<string> {
    if (!task.promptTemplate) {
      throw new Error(`Task ${task.id} does not have a prompt template`);
    }

    const template = this.promptManager.getTemplate(task.promptTemplate);
    if (!template) {
      throw new Error(`Template ${task.promptTemplate} not found`);
    }

    const promptText = this.promptManager.fillTemplate(
      task.promptTemplate,
      task.promptVariables || {}
    );

    // Choose the appropriate model based on template preference
    const model = this.getModelForTemplate(template);
    
    // Create LangChain prompt
    const prompt = LangChainPromptTemplate.fromTemplate(promptText);
    
    // Format the prompt with variables
    const formattedPrompt = await prompt.format(task.promptVariables || {});
    
    // Execute the prompt with the model
    const response = await model.invoke(formattedPrompt);
    
    // Handle different response formats
    if (typeof response.content === 'string') {
      return response.content;
    } else if (Array.isArray(response.content)) {
      return response.content.map((item: any) => item.text || '').join('');
    } else {
      return String(response.content);
    }
  }

  /**
   * Gets the appropriate model for a template
   */
  private getModelForTemplate(template: PromptTemplate) {
    if (template.modelType === 'claude' && this.claudeModel) {
      return this.claudeModel;
    } else if (template.modelType === 'gemini' && this.geminiModel) {
      return this.geminiModel;
    } else if (this.claudeModel) {
      return this.claudeModel; // Default to Claude if available
    } else if (this.geminiModel) {
      return this.geminiModel; // Fall back to Gemini
    } else {
      throw new Error('No AI models are available. Please provide API keys.');
    }
  }

  /**
   * Decomposes a high-level task description into subtasks
   */
  public async decomposeTaskDescription(
    description: string,
    taskType: string
  ): Promise<string[]> {
    // Select the appropriate model based on availability
    const model = this.claudeModel || this.geminiModel;
    if (!model) {
      throw new Error('No AI models are available. Please provide API keys.');
    }

    const prompt = `
    You are an expert system architect and developer. Your task is to break down the following high-level task into smaller, more specific subtasks that can be implemented individually.

    Task Description: ${description}
    Task Type: ${taskType}

    Please provide a list of 3-7 subtasks that together would accomplish this task. Each subtask should be specific, actionable, and focused on a single aspect of the overall task.

    Format your response as a list of subtasks, one per line, without numbering or bullet points.
    `;

    const response = await model.invoke(prompt);
    const responseText = typeof response.content === 'string' 
      ? response.content 
      : Array.isArray(response.content) 
        ? response.content.map((item: any) => item.text || '').join('') 
        : String(response.content);
        
    const subtasks = responseText
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    return subtasks;
  }

  /**
   * Analyzes app requirements to extract key components and features
   */
  public async analyzeAppRequirements(
    appDescription: string
  ): Promise<{ components: string[], features: string[] }> {
    const model = this.claudeModel || this.geminiModel;
    if (!model) {
      throw new Error('No AI models are available. Please provide API keys.');
    }

    const prompt = `
    You are an expert system architect. Analyze the following application description and extract:
    1. The key components that would be needed (database, authentication, UI components, etc.)
    2. The main features the application should provide

    Application Description: ${appDescription}

    Format your response as JSON with two arrays:
    {
      "components": ["component1", "component2", ...],
      "features": ["feature1", "feature2", ...]
    }
    `;

    const response = await model.invoke(prompt);
    const responseText = typeof response.content === 'string' 
      ? response.content 
      : Array.isArray(response.content) 
        ? response.content.map((item: any) => item.text || '').join('') 
        : String(response.content);
        
    try {
      const result = JSON.parse(responseText);
      return {
        components: result.components || [],
        features: result.features || []
      };
    } catch (error) {
      console.error('Failed to parse AI response as JSON', error);
      return { components: [], features: [] };
    }
  }
}