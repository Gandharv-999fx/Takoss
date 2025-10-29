import { ChatAnthropic } from '@langchain/anthropic';

/**
 * Few-Shot Learning Database - Stores and retrieves successful examples
 * Uses in-memory storage (can be extended with Pinecone for production)
 */

export interface FewShotExample {
  id: string;
  taskType: string;
  prompt: string;
  output: string;
  quality: number; // 0-1 score
  metadata: {
    successfullyGenerated: boolean;
    validationPassed: boolean;
    executionTime: number;
    createdAt: Date;
  };
}

export class FewShotLearningDatabase {
  private model: ChatAnthropic;
  private examples: Map<string, FewShotExample[]>;

  constructor(apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-sonnet-20240229',
      temperature: 0.3,
    });

    this.examples = new Map();
  }

  /**
   * Store successful example
   */
  public async storeExample(example: Omit<FewShotExample, 'id'>): Promise<string> {
    const id = `example-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const fullExample: FewShotExample = {
      id,
      ...example,
    };

    if (!this.examples.has(example.taskType)) {
      this.examples.set(example.taskType, []);
    }

    this.examples.get(example.taskType)!.push(fullExample);

    return id;
  }

  /**
   * Retrieve similar examples
   */
  public async retrieveSimilarExamples(
    taskType: string,
    query: string,
    limit: number = 3
  ): Promise<FewShotExample[]> {
    const typeExamples = this.examples.get(taskType) || [];

    if (typeExamples.length === 0) {
      return [];
    }

    // Simple similarity scoring (in production, use embeddings)
    const scored = typeExamples.map((example) => ({
      example,
      score: this.calculateSimilarity(query, example.prompt),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.example);
  }

  /**
   * Calculate simple text similarity
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Enhance prompt with few-shot examples
   */
  public async enhancePromptWithExamples(
    prompt: string,
    taskType: string
  ): Promise<string> {
    const examples = await this.retrieveSimilarExamples(taskType, prompt, 2);

    if (examples.length === 0) {
      return prompt;
    }

    const examplesText = examples
      .map(
        (ex, idx) => `
**Example ${idx + 1}:**
Input: ${ex.prompt}
Output:
\`\`\`
${ex.output.substring(0, 500)}
\`\`\`
`
      )
      .join('\n');

    return `${prompt}

**Similar Successful Examples for Reference:**
${examplesText}

Now generate the output following similar patterns.`;
  }

  /**
   * Get best examples by quality
   */
  public getBestExamples(taskType: string, limit: number = 10): FewShotExample[] {
    const typeExamples = this.examples.get(taskType) || [];

    return typeExamples
      .filter((e) => e.metadata.validationPassed)
      .sort((a, b) => b.quality - a.quality)
      .slice(0, limit);
  }

  /**
   * Export examples for backup
   */
  public exportExamples(): string {
    const allExamples: FewShotExample[] = [];

    this.examples.forEach((examples) => {
      allExamples.push(...examples);
    });

    return JSON.stringify(allExamples, null, 2);
  }

  /**
   * Import examples from backup
   */
  public importExamples(jsonData: string): void {
    const examples: FewShotExample[] = JSON.parse(jsonData);

    examples.forEach((example) => {
      if (!this.examples.has(example.taskType)) {
        this.examples.set(example.taskType, []);
      }
      this.examples.get(example.taskType)!.push(example);
    });
  }
}
