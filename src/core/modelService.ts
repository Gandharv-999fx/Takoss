import { ModelResponse } from '../types/orchestrator';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class ModelService {
  private claudeClient: Anthropic;
  private geminiClient: GoogleGenerativeAI;

  constructor(
    private claudeApiKey: string = process.env.CLAUDE_API_KEY || '',
    private geminiApiKey: string = process.env.GEMINI_API_KEY || ''
  ) {
    this.claudeClient = new Anthropic({ apiKey: this.claudeApiKey });
    this.geminiClient = new GoogleGenerativeAI(this.geminiApiKey);
  }

  /**
   * Execute a prompt using Claude Sonnet 4
   */
  public async executeWithClaude(prompt: string): Promise<ModelResponse> {
    try {
      const startTime = Date.now();
      
      const response = await this.claudeClient.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
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
          modelName: 'claude-3-5-sonnet-20241022',
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
   * Execute a prompt using Gemini 2.5 Pro
   */
  public async executeWithGemini(prompt: string): Promise<ModelResponse> {
    try {
      const model = this.geminiClient.getGenerativeModel({ model: 'gemini-1.5-pro' });
      
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
          modelName: 'gemini-1.5-pro',
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
   * Execute a prompt with the specified model type
   */
  public async executePrompt(prompt: string, modelType: 'claude' | 'gemini'): Promise<ModelResponse> {
    if (modelType === 'claude') {
      return this.executeWithClaude(prompt);
    } else {
      return this.executeWithGemini(prompt);
    }
  }
}