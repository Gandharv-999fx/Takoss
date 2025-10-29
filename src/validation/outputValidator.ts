import { Project, SyntaxKind, ts } from 'ts-morph';
import { z } from 'zod';

/**
 * Output Validator - Validates AI-generated code using ts-morph, TypeScript compiler, and Zod
 * Used by self-correction loops to detect issues before deployment
 */

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: {
    validatedAt: Date;
    validationType: ValidationType;
    fileType?: string;
  };
}

export interface ValidationError {
  type: 'syntax' | 'type' | 'import' | 'export' | 'lint' | 'schema';
  message: string;
  line?: number;
  column?: number;
  code?: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  type: 'style' | 'performance' | 'best-practice';
  message: string;
  line?: number;
  suggestion?: string;
}

export type ValidationType = 'typescript' | 'javascript' | 'react' | 'prisma' | 'json' | 'generic';

export interface CorrectionPrompt {
  originalCode: string;
  errors: ValidationError[];
  correctionInstructions: string;
  context?: string;
}

export class CodeValidator {
  private project: Project;

  constructor() {
    this.project = new Project({
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        jsx: ts.JsxEmit.React,
      },
      useInMemoryFileSystem: true,
    });
  }

  /**
   * Validate TypeScript code
   */
  public validateTypeScript(code: string, fileName: string = 'temp.ts'): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Create source file in memory
      const sourceFile = this.project.createSourceFile(fileName, code, { overwrite: true });

      // 1. Syntax validation
      const syntaxErrors = this.validateSyntax(sourceFile);
      errors.push(...syntaxErrors);

      // 2. Type checking (if syntax is valid)
      if (syntaxErrors.length === 0) {
        const typeErrors = this.validateTypes(sourceFile);
        errors.push(...typeErrors);
      }

      // 3. Import/Export validation
      const importErrors = this.validateImportsExports(sourceFile);
      errors.push(...importErrors);

      // 4. Basic linting
      const lintWarnings = this.basicLintChecks(sourceFile);
      warnings.push(...lintWarnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          validatedAt: new Date(),
          validationType: 'typescript',
          fileType: fileName.endsWith('.tsx') ? 'react' : 'typescript',
        },
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            type: 'syntax',
            message: `Critical parsing error: ${error instanceof Error ? error.message : String(error)}`,
            severity: 'critical',
          },
        ],
        warnings: [],
        metadata: {
          validatedAt: new Date(),
          validationType: 'typescript',
        },
      };
    }
  }

  /**
   * Validate React component
   */
  public validateReactComponent(code: string, componentName: string): ValidationResult {
    const result = this.validateTypeScript(code, `${componentName}.tsx`);

    // Additional React-specific checks
    const sourceFile = this.project.getSourceFile(`${componentName}.tsx`);
    if (sourceFile) {
      const reactWarnings = this.validateReactSpecific(sourceFile);
      result.warnings.push(...reactWarnings);
    }

    return result;
  }

  /**
   * Validate JSON structure against Zod schema
   */
  public validateJSON<T>(json: string, schema: z.ZodSchema<T>): ValidationResult {
    const errors: ValidationError[] = [];

    try {
      const parsed = JSON.parse(json);
      const result = schema.safeParse(parsed);

      if (!result.success) {
        result.error.errors.forEach((err) => {
          errors.push({
            type: 'schema',
            message: `${err.path.join('.')}: ${err.message}`,
            severity: 'error',
          });
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings: [],
        metadata: {
          validatedAt: new Date(),
          validationType: 'json',
        },
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [
          {
            type: 'syntax',
            message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
            severity: 'critical',
          },
        ],
        warnings: [],
        metadata: {
          validatedAt: new Date(),
          validationType: 'json',
        },
      };
    }
  }

  /**
   * Validate Prisma schema
   */
  public validatePrismaSchema(schema: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic Prisma schema validation
    const requiredSections = ['datasource', 'generator'];
    requiredSections.forEach((section) => {
      if (!schema.includes(section)) {
        errors.push({
          type: 'schema',
          message: `Missing required section: ${section}`,
          severity: 'error',
        });
      }
    });

    // Check for model definitions
    if (!schema.includes('model ')) {
      warnings.push({
        type: 'best-practice',
        message: 'No models defined in schema',
        suggestion: 'Add at least one model definition',
      });
    }

    // Check for proper field types
    const invalidFieldTypes = schema.match(/\s+(\w+)\s+(\w+)/g);
    // Basic validation - in production, use Prisma's own validator

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        validatedAt: new Date(),
        validationType: 'prisma',
      },
    };
  }

  /**
   * Generate correction prompt from validation errors
   */
  public generateCorrectionPrompt(
    originalCode: string,
    validationResult: ValidationResult,
    context?: string
  ): CorrectionPrompt {
    const { errors } = validationResult;

    let instructions = 'Fix the following issues in the code:\n\n';

    // Group errors by type
    const errorsByType = errors.reduce((acc, error) => {
      if (!acc[error.type]) acc[error.type] = [];
      acc[error.type].push(error);
      return acc;
    }, {} as Record<string, ValidationError[]>);

    // Generate instructions for each error type
    Object.entries(errorsByType).forEach(([type, errs]) => {
      instructions += `**${type.toUpperCase()} ERRORS:**\n`;
      errs.forEach((err, idx) => {
        instructions += `${idx + 1}. ${err.message}`;
        if (err.line) instructions += ` (line ${err.line})`;
        instructions += '\n';
      });
      instructions += '\n';
    });

    instructions += 'Requirements:\n';
    instructions += '- Maintain the same functionality\n';
    instructions += '- Ensure all types are properly defined\n';
    instructions += '- Use proper imports from correct packages\n';
    instructions += '- Follow TypeScript best practices\n';

    if (context) {
      instructions += `\nContext:\n${context}\n`;
    }

    return {
      originalCode,
      errors,
      correctionInstructions: instructions,
      context,
    };
  }

  // Private validation methods

  private validateSyntax(sourceFile: any): ValidationError[] {
    const errors: ValidationError[] = [];
    const diagnostics = sourceFile.getPreEmitDiagnostics();

    diagnostics.forEach((diagnostic: any) => {
      const message = diagnostic.getMessageText();
      const lineNumber = diagnostic.getLineNumber();

      errors.push({
        type: 'syntax',
        message: typeof message === 'string' ? message : message.getMessageText(),
        line: lineNumber,
        severity: 'error',
        code: diagnostic.getCode()?.toString(),
      });
    });

    return errors;
  }

  private validateTypes(sourceFile: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Get type checker diagnostics
    const program = this.project.getProgram();
    const typeChecker = program?.getTypeChecker();

    if (!typeChecker) return errors;

    const diagnostics = program
      ?.getSemanticDiagnostics(sourceFile.compilerNode)
      .filter((d: any) => d.category === ts.DiagnosticCategory.Error);

    diagnostics?.forEach((diagnostic: any) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      const { line } = diagnostic.file
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start || 0)
        : { line: undefined };

      errors.push({
        type: 'type',
        message,
        line: line ? line + 1 : undefined,
        severity: 'error',
        code: diagnostic.code.toString(),
      });
    });

    return errors;
  }

  private validateImportsExports(sourceFile: any): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for unused imports
    const importDeclarations = sourceFile.getImportDeclarations();
    importDeclarations.forEach((importDecl: any) => {
      const namedImports = importDecl.getNamedImports();
      namedImports.forEach((namedImport: any) => {
        const references = namedImport.findReferences();
        if (references.length === 0) {
          // Unused import - warning rather than error
          // errors.push({ ... });
        }
      });
    });

    // Check for missing exports (if it's a module)
    const hasExport =
      sourceFile.getExportDeclarations().length > 0 ||
      sourceFile.getExportAssignments().length > 0 ||
      sourceFile.getFunctions().some((f: any) => f.isExported()) ||
      sourceFile.getClasses().some((c: any) => c.isExported());

    // Many files don't need exports, so don't enforce

    return errors;
  }

  private basicLintChecks(sourceFile: any): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for console.log statements (common in generated code)
    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    callExpressions.forEach((call: any) => {
      const expression = call.getExpression();
      if (expression.getText() === 'console.log') {
        warnings.push({
          type: 'best-practice',
          message: 'Avoid using console.log in production code',
          line: call.getStartLineNumber(),
          suggestion: 'Use a proper logging library like winston',
        });
      }
    });

    // Check for any type usage
    const typeReferences = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword);
    if (typeReferences.length > 0) {
      warnings.push({
        type: 'style',
        message: 'Avoid using "any" type - use proper TypeScript types',
        suggestion: 'Define specific interfaces or use unknown',
      });
    }

    return warnings;
  }

  private validateReactSpecific(sourceFile: any): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for proper React import
    const imports = sourceFile.getImportDeclarations();
    const hasReactImport = imports.some((imp: any) =>
      imp.getModuleSpecifierValue() === 'react'
    );

    if (!hasReactImport) {
      warnings.push({
        type: 'best-practice',
        message: 'React component should import React',
        suggestion: "Add: import React from 'react';",
      });
    }

    // Check for component export
    const exportedFunctions = sourceFile.getFunctions().filter((f: any) => f.isExported());
    const exportedClasses = sourceFile.getClasses().filter((c: any) => c.isExported());

    if (exportedFunctions.length === 0 && exportedClasses.length === 0) {
      warnings.push({
        type: 'best-practice',
        message: 'React component should export a component',
        suggestion: 'Add export to your component function or class',
      });
    }

    return warnings;
  }

  /**
   * Validate code and return correction prompt if invalid
   */
  public validateAndCorrect(
    code: string,
    validationType: ValidationType = 'typescript',
    context?: string
  ): { result: ValidationResult; correctionPrompt?: CorrectionPrompt } {
    let result: ValidationResult;

    switch (validationType) {
      case 'react':
        result = this.validateReactComponent(code, 'Component');
        break;
      case 'prisma':
        result = this.validatePrismaSchema(code);
        break;
      case 'typescript':
      case 'javascript':
      default:
        result = this.validateTypeScript(code);
        break;
    }

    if (!result.isValid) {
      const correctionPrompt = this.generateCorrectionPrompt(code, result, context);
      return { result, correctionPrompt };
    }

    return { result };
  }
}
