import Redis from 'ioredis';
import { SubstepResult, ExecutionContext } from '../types/orchestrator';
import { TaskNode } from '../types/interfaces';

/**
 * Context Accumulator - Maintains execution context across prompt chains
 * Uses Redis for persistence, caching, and cross-chain context sharing
 */
export class ContextAccumulator {
  private redis: Redis;
  private defaultTTL: number; // Time-to-live in seconds

  constructor(
    redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379',
    defaultTTL: number = 3600 // 1 hour default
  ) {
    this.redis = new Redis(redisUrl);
    this.defaultTTL = defaultTTL;

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      console.log('Context Accumulator connected to Redis');
    });
  }

  /**
   * Store a substep result with automatic expiration
   */
  public async storeResult(
    chainId: string,
    result: SubstepResult
  ): Promise<void> {
    const key = this.getResultKey(chainId, result.taskId);

    try {
      await this.redis.setex(
        key,
        this.defaultTTL,
        JSON.stringify(result)
      );
    } catch (error) {
      console.error(`Failed to store result for task ${result.taskId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve a specific substep result
   */
  public async getResult(
    chainId: string,
    taskId: string
  ): Promise<SubstepResult | null> {
    const key = this.getResultKey(chainId, taskId);

    try {
      const data = await this.redis.get(key);
      if (!data) return null;

      return JSON.parse(data) as SubstepResult;
    } catch (error) {
      console.error(`Failed to retrieve result for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Store all results for a chain
   */
  public async storeChainResults(
    chainId: string,
    results: Record<string, SubstepResult>
  ): Promise<void> {
    const key = this.getChainResultsKey(chainId);

    try {
      await this.redis.setex(
        key,
        this.defaultTTL,
        JSON.stringify(results)
      );
    } catch (error) {
      console.error(`Failed to store chain results for ${chainId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve all results for a chain
   */
  public async getChainResults(
    chainId: string
  ): Promise<Record<string, SubstepResult>> {
    const key = this.getChainResultsKey(chainId);

    try {
      const data = await this.redis.get(key);
      if (!data) return {};

      return JSON.parse(data) as Record<string, SubstepResult>;
    } catch (error) {
      console.error(`Failed to retrieve chain results for ${chainId}:`, error);
      return {};
    }
  }

  /**
   * Store execution context for a task
   */
  public async storeContext(
    chainId: string,
    taskId: string,
    context: ExecutionContext
  ): Promise<void> {
    const key = this.getContextKey(chainId, taskId);

    try {
      // Store context with serialized TaskNode
      const serializedContext = {
        ...context,
        taskNode: JSON.stringify(context.taskNode)
      };

      await this.redis.setex(
        key,
        this.defaultTTL,
        JSON.stringify(serializedContext)
      );
    } catch (error) {
      console.error(`Failed to store context for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve execution context for a task
   */
  public async getContext(
    chainId: string,
    taskId: string
  ): Promise<ExecutionContext | null> {
    const key = this.getContextKey(chainId, taskId);

    try {
      const data = await this.redis.get(key);
      if (!data) return null;

      const serializedContext = JSON.parse(data);

      // Deserialize TaskNode
      return {
        ...serializedContext,
        taskNode: JSON.parse(serializedContext.taskNode) as TaskNode
      } as ExecutionContext;
    } catch (error) {
      console.error(`Failed to retrieve context for task ${taskId}:`, error);
      return null;
    }
  }

  /**
   * Accumulate context variables from completed tasks
   */
  public async accumulateVariables(
    chainId: string,
    baseVariables: Record<string, any>,
    dependencyTaskIds: string[]
  ): Promise<Record<string, any>> {
    const accumulated = { ...baseVariables };

    for (const taskId of dependencyTaskIds) {
      const result = await this.getResult(chainId, taskId);

      if (result) {
        // Add output as variable
        accumulated[`${taskId}_output`] = result.output;

        // Add generated code if available
        if (result.generatedCode) {
          accumulated[`${taskId}_code`] = result.generatedCode;
        }

        // Try to extract structured data from output
        const extractedVars = this.extractVariablesFromOutput(result.output);
        Object.assign(accumulated, extractedVars);
      }
    }

    return accumulated;
  }

  /**
   * Extract variables from result output (JSON blocks, key-value pairs, etc.)
   */
  private extractVariablesFromOutput(output: string): Record<string, any> {
    const variables: Record<string, any> = {};

    try {
      // Try to extract JSON blocks
      const jsonBlockRegex = /```json\n([\s\S]*?)\n```/g;
      let match;

      while ((match = jsonBlockRegex.exec(output)) !== null) {
        try {
          const extractedData = JSON.parse(match[1]);
          Object.assign(variables, extractedData);
        } catch {
          // Ignore invalid JSON
        }
      }
    } catch (error) {
      // Ignore extraction errors
    }

    return variables;
  }

  /**
   * Get dependency results for a task
   */
  public async getDependencyResults(
    chainId: string,
    dependencyIds: string[]
  ): Promise<SubstepResult[]> {
    const results: SubstepResult[] = [];

    for (const depId of dependencyIds) {
      const result = await this.getResult(chainId, depId);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Store context history for a chain (for debugging/analysis)
   */
  public async appendToHistory(
    chainId: string,
    taskId: string,
    eventType: 'start' | 'complete' | 'fail',
    data: any
  ): Promise<void> {
    const key = this.getHistoryKey(chainId);

    const historyEntry = {
      taskId,
      eventType,
      timestamp: new Date().toISOString(),
      data
    };

    try {
      await this.redis.rpush(key, JSON.stringify(historyEntry));
      await this.redis.expire(key, this.defaultTTL);
    } catch (error) {
      console.error(`Failed to append to history for chain ${chainId}:`, error);
    }
  }

  /**
   * Get execution history for a chain
   */
  public async getHistory(chainId: string): Promise<any[]> {
    const key = this.getHistoryKey(chainId);

    try {
      const entries = await this.redis.lrange(key, 0, -1);
      return entries.map(entry => JSON.parse(entry));
    } catch (error) {
      console.error(`Failed to retrieve history for chain ${chainId}:`, error);
      return [];
    }
  }

  /**
   * Clean up all data for a chain
   */
  public async cleanupChain(chainId: string): Promise<void> {
    try {
      const pattern = `takoss:chain:${chainId}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error(`Failed to cleanup chain ${chainId}:`, error);
    }
  }

  /**
   * Extend TTL for a chain's data
   */
  public async extendChainTTL(chainId: string, additionalSeconds: number): Promise<void> {
    try {
      const pattern = `takoss:chain:${chainId}:*`;
      const keys = await this.redis.keys(pattern);

      for (const key of keys) {
        const currentTTL = await this.redis.ttl(key);
        if (currentTTL > 0) {
          await this.redis.expire(key, currentTTL + additionalSeconds);
        }
      }
    } catch (error) {
      console.error(`Failed to extend TTL for chain ${chainId}:`, error);
    }
  }

  /**
   * Get statistics about stored context
   */
  public async getChainStats(chainId: string): Promise<{
    totalResults: number;
    totalContexts: number;
    historyLength: number;
    oldestTimestamp?: string;
    newestTimestamp?: string;
  }> {
    try {
      const pattern = `takoss:chain:${chainId}:*`;
      const keys = await this.redis.keys(pattern);

      const resultKeys = keys.filter(k => k.includes(':result:'));
      const contextKeys = keys.filter(k => k.includes(':context:'));

      const historyKey = this.getHistoryKey(chainId);
      const historyLength = await this.redis.llen(historyKey);

      // Get timestamps from history
      let oldestTimestamp: string | undefined;
      let newestTimestamp: string | undefined;

      if (historyLength > 0) {
        const firstEntry = await this.redis.lindex(historyKey, 0);
        const lastEntry = await this.redis.lindex(historyKey, -1);

        if (firstEntry) {
          oldestTimestamp = JSON.parse(firstEntry).timestamp;
        }
        if (lastEntry) {
          newestTimestamp = JSON.parse(lastEntry).timestamp;
        }
      }

      return {
        totalResults: resultKeys.length,
        totalContexts: contextKeys.length,
        historyLength,
        oldestTimestamp,
        newestTimestamp
      };
    } catch (error) {
      console.error(`Failed to get stats for chain ${chainId}:`, error);
      return {
        totalResults: 0,
        totalContexts: 0,
        historyLength: 0
      };
    }
  }

  /**
   * Close Redis connection
   */
  public async close(): Promise<void> {
    await this.redis.quit();
  }

  // Helper methods for generating Redis keys
  private getResultKey(chainId: string, taskId: string): string {
    return `takoss:chain:${chainId}:result:${taskId}`;
  }

  private getChainResultsKey(chainId: string): string {
    return `takoss:chain:${chainId}:results:all`;
  }

  private getContextKey(chainId: string, taskId: string): string {
    return `takoss:chain:${chainId}:context:${taskId}`;
  }

  private getHistoryKey(chainId: string): string {
    return `takoss:chain:${chainId}:history`;
  }
}
