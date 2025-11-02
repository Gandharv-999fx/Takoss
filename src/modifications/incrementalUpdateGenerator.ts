import { ChatAnthropic } from '@langchain/anthropic';
import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ModificationTask, ModificationPlan } from './modificationRequestDecomposer';
import { CodeValidator } from '../validation/outputValidator';

/**
 * Incremental Update Generator - Safe git-based modifications
 * Applies modifications incrementally with version control and rollback capability
 */

export interface UpdateResult {
  taskId: string;
  targetFile: string;
  success: boolean;
  changes: {
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
  };
  validationResult?: any;
  commitHash?: string;
  error?: string;
}

export interface RollbackPoint {
  id: string;
  timestamp: Date;
  commitHash: string;
  branch: string;
  description: string;
  filesModified: string[];
}

export class IncrementalUpdateGenerator {
  private model: ChatAnthropic;
  private git: SimpleGit;
  private validator: CodeValidator;
  private workingDirectory: string;

  constructor(workingDirectory: string, apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-5-sonnet-20241022',
      temperature: 0.3,
    });

    this.workingDirectory = workingDirectory;
    this.git = simpleGit(workingDirectory);
    this.validator = new CodeValidator();
  }

  /**
   * Execute modification plan incrementally
   */
  public async executeModificationPlan(
    plan: ModificationPlan,
    options?: {
      createBranch?: boolean;
      branchName?: string;
      validateAfterEach?: boolean;
      commitAfterEach?: boolean;
    }
  ): Promise<{
    results: UpdateResult[];
    rollbackPoint?: RollbackPoint;
    finalCommitHash?: string;
  }> {
    const results: UpdateResult[] = [];

    // Create rollback point before starting
    const rollbackPoint = await this.createRollbackPoint(
      `Before: ${plan.request.description}`
    );

    // Create feature branch if requested
    if (options?.createBranch) {
      const branchName = options.branchName || `modification-${plan.id}`;
      await this.git.checkoutLocalBranch(branchName);
    }

    // Execute tasks in order
    for (const taskId of plan.executionOrder) {
      const task = plan.tasks.find((t) => t.id === taskId);
      if (!task) continue;

      console.log(`Executing: ${task.type} ${task.targetFile}`);

      const result = await this.executeModificationTask(task, {
        validate: options?.validateAfterEach ?? true,
        commit: options?.commitAfterEach ?? false,
      });

      results.push(result);

      // Stop on failure if validation is enabled
      if (!result.success && options?.validateAfterEach) {
        console.error(`Task failed: ${result.error}`);
        break;
      }
    }

    // Create final commit if not committing after each
    let finalCommitHash: string | undefined;
    if (!options?.commitAfterEach && results.some((r) => r.success)) {
      finalCommitHash = await this.commitChanges(
        plan.request.description,
        results.filter((r) => r.success).map((r) => r.targetFile)
      );
    }

    return {
      results,
      rollbackPoint,
      finalCommitHash,
    };
  }

  /**
   * Execute a single modification task
   */
  private async executeModificationTask(
    task: ModificationTask,
    options: {
      validate: boolean;
      commit: boolean;
    }
  ): Promise<UpdateResult> {
    try {
      // Read existing file
      const filePath = path.join(this.workingDirectory, task.targetFile);
      let existingContent = '';

      try {
        existingContent = await fs.readFile(filePath, 'utf-8');
      } catch (error) {
        // File doesn't exist, which is okay for 'add' tasks
        if (task.type !== 'add') {
          throw new Error(`File not found: ${task.targetFile}`);
        }
      }

      // Generate modified code using AI
      const modifiedCode = await this.generateModifiedCode(task, existingContent);

      // Validate if requested
      if (options.validate) {
        const validation = this.validator.validateTypeScript(
          modifiedCode,
          task.targetFile
        );

        if (!validation.isValid) {
          return {
            taskId: task.id,
            targetFile: task.targetFile,
            success: false,
            changes: { linesAdded: 0, linesRemoved: 0, linesModified: 0 },
            validationResult: validation,
            error: `Validation failed: ${validation.errors.length} errors`,
          };
        }
      }

      // Calculate changes
      const changes = this.calculateChanges(existingContent, modifiedCode);

      // Write modified file
      await this.writeFile(filePath, modifiedCode);

      // Commit if requested
      let commitHash: string | undefined;
      if (options.commit) {
        commitHash = await this.commitChanges(
          `${task.type}: ${task.description}`,
          [task.targetFile]
        );
      }

      return {
        taskId: task.id,
        targetFile: task.targetFile,
        success: true,
        changes,
        commitHash,
      };
    } catch (error: any) {
      return {
        taskId: task.id,
        targetFile: task.targetFile,
        success: false,
        changes: { linesAdded: 0, linesRemoved: 0, linesModified: 0 },
        error: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Generate modified code using AI
   */
  private async generateModifiedCode(
    task: ModificationTask,
    existingContent: string
  ): Promise<string> {
    const response = await this.model.invoke(task.prompt);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract code from markdown blocks
    const codeMatch = content.match(/```(?:typescript|tsx|ts)?\n([\s\S]*?)```/);
    if (codeMatch) {
      return codeMatch[1];
    }

    return content;
  }

  /**
   * Calculate changes between old and new code
   */
  private calculateChanges(
    oldCode: string,
    newCode: string
  ): {
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
  } {
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');

    // Simple diff calculation
    const linesAdded = Math.max(0, newLines.length - oldLines.length);
    const linesRemoved = Math.max(0, oldLines.length - newLines.length);

    // Count modified lines (lines that exist in both but are different)
    const minLength = Math.min(oldLines.length, newLines.length);
    let linesModified = 0;
    for (let i = 0; i < minLength; i++) {
      if (oldLines[i] !== newLines[i]) {
        linesModified++;
      }
    }

    return {
      linesAdded,
      linesRemoved,
      linesModified,
    };
  }

  /**
   * Write file to disk
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * Commit changes to git
   */
  private async commitChanges(
    message: string,
    files: string[]
  ): Promise<string> {
    // Stage files
    await this.git.add(files);

    // Commit
    const commit = await this.git.commit(message);

    return commit.commit;
  }

  /**
   * Create a rollback point
   */
  public async createRollbackPoint(
    description: string
  ): Promise<RollbackPoint> {
    // Get current status
    const status = await this.git.status();
    const currentBranch = status.current || 'main';

    // Get current commit hash
    const log = await this.git.log({ maxCount: 1 });
    const commitHash = log.latest?.hash || '';

    return {
      id: `rollback-${Date.now()}`,
      timestamp: new Date(),
      commitHash,
      branch: currentBranch,
      description,
      filesModified: status.modified,
    };
  }

  /**
   * Rollback to a previous point
   */
  public async rollback(
    rollbackPoint: RollbackPoint,
    mode: 'soft' | 'hard' = 'soft'
  ): Promise<void> {
    if (mode === 'hard') {
      // Hard reset - discards all changes
      await this.git.reset(['--hard', rollbackPoint.commitHash]);
    } else {
      // Soft reset - keeps changes staged
      await this.git.reset(['--soft', rollbackPoint.commitHash]);
    }

    // Checkout original branch
    await this.git.checkout(rollbackPoint.branch);
  }

  /**
   * Create a backup branch before modifications
   */
  public async createBackupBranch(
    baseName: string = 'backup'
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const branchName = `${baseName}-${timestamp}`;

    await this.git.checkoutLocalBranch(branchName);

    return branchName;
  }

  /**
   * Get git status
   */
  public async getStatus(): Promise<StatusResult> {
    return await this.git.status();
  }

  /**
   * Get file diff
   */
  public async getFileDiff(filePath: string): Promise<string> {
    try {
      const diff = await this.git.diff([filePath]);
      return diff;
    } catch (error) {
      return '';
    }
  }

  /**
   * Stage files for commit
   */
  public async stageFiles(files: string[]): Promise<void> {
    await this.git.add(files);
  }

  /**
   * Create a pull request (requires gh CLI or API integration)
   */
  public async createPullRequest(
    title: string,
    description: string,
    baseBranch: string = 'main'
  ): Promise<string> {
    // This would integrate with GitHub API or use gh CLI
    // Simplified example:
    const status = await this.git.status();
    const currentBranch = status.current || '';

    // Push current branch
    await this.git.push('origin', currentBranch);

    return `Pull request created: ${currentBranch} -> ${baseBranch}`;
  }

  /**
   * Generate modification report
   */
  public generateModificationReport(results: UpdateResult[]): string {
    const lines: string[] = [];

    lines.push('# Modification Report');
    lines.push('');
    lines.push(`**Timestamp**: ${new Date().toISOString()}`);
    lines.push(`**Total Tasks**: ${results.length}`);
    lines.push(
      `**Successful**: ${results.filter((r) => r.success).length}`
    );
    lines.push(`**Failed**: ${results.filter((r) => !r.success).length}`);
    lines.push('');

    // Summary statistics
    const totalLinesAdded = results.reduce(
      (sum, r) => sum + r.changes.linesAdded,
      0
    );
    const totalLinesRemoved = results.reduce(
      (sum, r) => sum + r.changes.linesRemoved,
      0
    );
    const totalLinesModified = results.reduce(
      (sum, r) => sum + r.changes.linesModified,
      0
    );

    lines.push('## Changes Summary');
    lines.push(`- Lines Added: ${totalLinesAdded}`);
    lines.push(`- Lines Removed: ${totalLinesRemoved}`);
    lines.push(`- Lines Modified: ${totalLinesModified}`);
    lines.push('');

    // Detailed results
    lines.push('## Task Results');
    results.forEach((result, idx) => {
      lines.push(`### ${idx + 1}. ${result.targetFile}`);
      lines.push(`- **Status**: ${result.success ? '✓ Success' : '✗ Failed'}`);

      if (result.success) {
        lines.push(`- Lines Added: ${result.changes.linesAdded}`);
        lines.push(`- Lines Removed: ${result.changes.linesRemoved}`);
        lines.push(`- Lines Modified: ${result.changes.linesModified}`);
        if (result.commitHash) {
          lines.push(`- Commit: ${result.commitHash}`);
        }
      } else {
        lines.push(`- Error: ${result.error}`);
        if (result.validationResult) {
          lines.push(`- Validation Errors: ${result.validationResult.errors.length}`);
        }
      }

      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Verify modifications didn't break tests
   */
  public async verifyModifications(
    testCommand: string = 'npm test'
  ): Promise<{
    passed: boolean;
    output: string;
  }> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(testCommand, {
        cwd: this.workingDirectory,
      });

      return {
        passed: true,
        output: stdout + stderr,
      };
    } catch (error: any) {
      return {
        passed: false,
        output: error.message,
      };
    }
  }

  /**
   * Apply modifications with automatic testing
   */
  public async applyWithTesting(
    plan: ModificationPlan,
    testCommand?: string
  ): Promise<{
    results: UpdateResult[];
    testsPassed: boolean;
    rollbackPoint: RollbackPoint;
  }> {
    // Create rollback point
    const rollbackPoint = await this.createRollbackPoint(
      `Before: ${plan.request.description}`
    );

    // Execute modifications
    const { results } = await this.executeModificationPlan(plan, {
      createBranch: true,
      validateAfterEach: true,
      commitAfterEach: false,
    });

    // Run tests
    let testsPassed = true;
    if (testCommand) {
      const testResult = await this.verifyModifications(testCommand);
      testsPassed = testResult.passed;

      if (!testsPassed) {
        console.error('Tests failed, rolling back...');
        await this.rollback(rollbackPoint, 'hard');
      }
    }

    return {
      results,
      testsPassed,
      rollbackPoint,
    };
  }
}
