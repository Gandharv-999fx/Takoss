import { ModelResponse } from '../types/orchestrator';
import {
  ModelProvider,
  ModelName,
  ClaudeModel,
  GeminiModel,
  OpenAIModel,
  getModelProvider,
  getModelCapabilities,
} from '../types/modelConfig';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

export class ModelService {
  private claudeClient: Anthropic;
  private geminiClient: GoogleGenerativeAI;
  private openaiClient: OpenAI;

  constructor(
    private claudeApiKey: string = process.env.CLAUDE_API_KEY || '',
    private geminiApiKey: string = process.env.GEMINI_API_KEY || '',
    private openaiApiKey: string = process.env.OPENAI_API_KEY || ''
  ) {
    this.claudeClient = new Anthropic({ apiKey: this.claudeApiKey });
    this.geminiClient = new GoogleGenerativeAI(this.geminiApiKey);
    this.openaiClient = new OpenAI({ apiKey: this.openaiApiKey });
  }

  /**
   * Get default system prompt for code generation
   */
  private getDefaultSystemPrompt(): string {
    return `You are an expert full-stack developer and software architect specializing in generating production-ready code.

**Your Expertise:**
- TypeScript and JavaScript (React, Node.js, Express)
- Database design (Prisma, PostgreSQL)
- API design (RESTful, GraphQL)
- Modern web development best practices
- Clean code principles and design patterns

**Code Generation Guidelines:**
1. **Quality**: Write clean, maintainable, production-ready code
2. **TypeScript**: Use strict typing with proper interfaces and types
3. **Best Practices**: Follow modern React patterns (functional components, hooks), Express.js conventions, and Prisma best practices
4. **Error Handling**: Include proper error handling and validation
5. **Documentation**: Add JSDoc comments for complex functions
6. **Security**: Follow security best practices (input validation, SQL injection prevention, XSS protection)
7. **Performance**: Write performant code with appropriate optimizations
8. **Completeness**: Generate complete, runnable code with all necessary imports and exports
9. **Consistency**: Follow consistent naming conventions (camelCase for variables, PascalCase for components/classes)
10. **Modern Standards**: Use modern ES6+ syntax and latest framework features

**Output Format:**
- Return code in properly formatted code blocks with language identifiers
- Include all necessary imports at the top
- Add comments for complex logic
- Ensure proper indentation and formatting`;
  }

  /**
   * Execute a prompt using Claude models
   */
  public async executeWithClaude(
    prompt: string,
    options?: {
      modelName?: ClaudeModel;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<ModelResponse> {
    try {
      const startTime = Date.now();

      // Default to code generation optimized settings
      const modelName = options?.modelName || ClaudeModel.SONNET_3_5;
      const temperature = options?.temperature ?? 0.2; // Lower for consistent code generation
      const maxTokens = options?.maxTokens ?? 8192; // Increased from 4000 to 8192
      const systemPrompt = options?.systemPrompt ?? this.getDefaultSystemPrompt();

      const response = await this.claudeClient.messages.create({
        model: modelName,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const contentBlock = response.content[0];
      const content = contentBlock.type === 'text' ? contentBlock.text : '';
      
      // Extract code blocks if present
      const codeBlockRegex = /```(?:[\w]*)\n([\s\S]*?)```/g;
      const codeBlocks: string[] = [];
      let match;
      
      while ((match = codeBlockRegex.exec(content)) !== null) {
        codeBlocks.push(match[1]);
      }
      
      const generatedCode = codeBlocks.length > 0 ? codeBlocks.join('\n\n') : undefined;
      
      return {
        content,
        generatedCode,
        metadata: {
          modelName,
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error executing Claude prompt:', error);
      throw new Error(`Claude execution failed: ${errorMessage}`);
    }
  }

  /**
   * Execute a prompt using Gemini models
   */
  public async executeWithGemini(
    prompt: string,
    options?: {
      modelName?: GeminiModel;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<ModelResponse> {
    try {
      // Default to latest Gemini 2.0 Flash model
      const modelName = options?.modelName || GeminiModel.GEMINI_2_5_FLASH;
      const temperature = options?.temperature ?? 0.7;
      const maxTokens = options?.maxTokens ?? 8192;

      const model = this.geminiClient.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      });
      
      const result = await model.generateContent(prompt);
      const response = result.response;
      const content = response.text();
      
      // Extract code blocks if present
      const codeBlockRegex = /```(?:[\w]*)\n([\s\S]*?)```/g;
      const codeBlocks: string[] = [];
      let match;
      
      while ((match = codeBlockRegex.exec(content)) !== null) {
        codeBlocks.push(match[1]);
      }
      
      const generatedCode = codeBlocks.length > 0 ? codeBlocks.join('\n\n') : undefined;
      
      // Gemini doesn't provide token counts directly in the same way
      // We'll estimate based on characters (rough approximation)
      const promptTokens = Math.ceil(prompt.length / 4);
      const completionTokens = Math.ceil(content.length / 4);
      
      return {
        content,
        generatedCode,
        metadata: {
          modelName,
          promptTokens,
          completionTokens
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error executing Gemini prompt:', error);
      throw new Error(`Gemini execution failed: ${errorMessage}`);
    }
  }

  /**
   * Execute a prompt using OpenAI models
   */
  public async executeWithOpenAI(
    prompt: string,
    options?: {
      modelName?: OpenAIModel;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<ModelResponse> {
    try {
      const modelName = options?.modelName || OpenAIModel.GPT_4O;
      const temperature = options?.temperature ?? 0.2;
      const maxTokens = options?.maxTokens ?? 8192;
      const systemPrompt = options?.systemPrompt ?? this.getDefaultSystemPrompt();

      const response = await this.openaiClient.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content || '';

      // Extract code blocks if present
      const codeBlockRegex = /```(?:[\w]*)\n([\s\S]*?)```/g;
      const codeBlocks: string[] = [];
      let match;

      while ((match = codeBlockRegex.exec(content)) !== null) {
        codeBlocks.push(match[1]);
      }

      const generatedCode = codeBlocks.length > 0 ? codeBlocks.join('\n\n') : undefined;

      return {
        content,
        generatedCode,
        metadata: {
          modelName,
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error executing OpenAI prompt:', error);
      throw new Error(`OpenAI execution failed: ${errorMessage}`);
    }
  }

  /**
   * Execute a prompt with any supported model
   */
  public async execute(
    prompt: string,
    modelName: ModelName,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<ModelResponse> {
    const provider = getModelProvider(modelName);

    switch (provider) {
      case ModelProvider.CLAUDE:
        return this.executeWithClaude(prompt, {
          ...options,
          modelName: modelName as ClaudeModel,
        });

      case ModelProvider.GEMINI:
        return this.executeWithGemini(prompt, {
          ...options,
          modelName: modelName as GeminiModel,
        });

      case ModelProvider.OPENAI:
        return this.executeWithOpenAI(prompt, {
          ...options,
          modelName: modelName as OpenAIModel,
        });

      default:
        throw new Error(`Unsupported model provider: ${provider}`);
    }
  }

  /**
   * Execute a prompt with the specified model type (legacy method)
   * @deprecated Use execute() instead
   */
  public async executePrompt(
    prompt: string,
    modelType: 'claude' | 'gemini' | 'openai',
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): Promise<ModelResponse> {
    if (modelType === 'claude') {
      return this.executeWithClaude(prompt, options);
    } else if (modelType === 'gemini') {
      return this.executeWithGemini(prompt, options);
    } else {
      return this.executeWithOpenAI(prompt, options);
    }
  }
}