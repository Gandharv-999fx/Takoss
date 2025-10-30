import { ChatAnthropic } from '@langchain/anthropic';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';

/**
 * Requirements Analyzer - Converts natural language app descriptions into structured RequirementsDocument
 * Uses LangChain with structured output parsing
 */

// Zod schemas for structured output
export const EntitySchema = z.object({
  name: z.string().describe('Entity name (e.g., User, Task, Project)'),
  description: z.string().describe('What this entity represents'),
  attributes: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object', 'enum']),
        required: z.boolean(),
        description: z.string().optional(),
      })
    )
    .describe('Entity attributes/fields'),
});

export const RelationshipSchema = z.object({
  from: z.string().describe('Source entity name'),
  to: z.string().describe('Target entity name'),
  type: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
  description: z.string().describe('Description of relationship'),
});

export const FeatureSchema = z.object({
  name: z.string().describe('Feature name'),
  category: z.enum([
    'authentication',
    'authorization',
    'crud',
    'search',
    'filtering',
    'sorting',
    'pagination',
    'notifications',
    'realtime',
    'file-upload',
    'reporting',
    'analytics',
    'other',
  ]),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  entities: z.array(z.string()).describe('Related entities'),
});

export const UIRequirementSchema = z.object({
  component: z.string().describe('UI component type (e.g., dashboard, form, table, modal)'),
  description: z.string(),
  features: z.array(z.string()).describe('Related features'),
  layout: z.string().optional().describe('Layout description'),
});

export const TechnicalConstraintSchema = z.object({
  category: z.enum([
    'authentication',
    'database',
    'api',
    'performance',
    'security',
    'scalability',
    'deployment',
  ]),
  constraint: z.string().describe('The constraint or requirement'),
  priority: z.enum(['required', 'preferred', 'optional']),
});

export const RequirementsDocumentSchema = z.object({
  appName: z.string().describe('Application name'),
  description: z.string().describe('Overall app description'),
  entities: z.array(EntitySchema),
  relationships: z.array(RelationshipSchema),
  features: z.array(FeatureSchema),
  uiRequirements: z.array(UIRequirementSchema),
  technicalConstraints: z.array(TechnicalConstraintSchema),
  estimatedComplexity: z.enum(['simple', 'moderate', 'complex', 'very-complex']),
});

export type Entity = z.infer<typeof EntitySchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type UIRequirement = z.infer<typeof UIRequirementSchema>;
export type TechnicalConstraint = z.infer<typeof TechnicalConstraintSchema>;
export type RequirementsDocument = z.infer<typeof RequirementsDocumentSchema>;

export interface AnalysisResult {
  requirements: RequirementsDocument;
  metadata: {
    analyzedAt: Date;
    tokensUsed: number;
    confidence: number; // 0-1 score
  };
  warnings: string[];
}

export class RequirementsAnalyzer {
  private model: ChatAnthropic;
  private parser: StructuredOutputParser<any>;

  constructor(apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-5-sonnet-20241022',
      temperature: 0.3, // Lower temp for more structured output
    });

    this.parser = StructuredOutputParser.fromZodSchema(RequirementsDocumentSchema);
  }

  /**
   * Analyze natural language description and extract structured requirements
   */
  public async analyzeRequirements(
    description: string,
    additionalContext?: string
  ): Promise<AnalysisResult> {
    const formatInstructions = this.parser.getFormatInstructions();

    const prompt = PromptTemplate.fromTemplate(`
You are an expert software architect analyzing application requirements.

Analyze the following application description and extract structured requirements:

**Application Description:**
{description}

{additionalContext}

Extract the following information:

1. **Entities**: Identify all data models/entities (e.g., User, Task, Project)
   - For each entity, list its attributes with types
   - Identify required vs optional fields

2. **Relationships**: Define how entities relate to each other
   - Use proper cardinality (one-to-one, one-to-many, many-to-many)

3. **Features**: List all functional requirements
   - Categorize by type (authentication, CRUD, search, etc.)
   - Prioritize by importance

4. **UI Requirements**: Identify UI components needed
   - Dashboards, forms, tables, modals, etc.
   - Describe layouts and interactions

5. **Technical Constraints**: Extract technical requirements
   - Authentication methods, database preferences, API requirements
   - Performance and security needs

6. **Complexity Estimation**: Rate the overall project complexity

Be thorough and specific. If the description lacks detail, make reasonable assumptions based on best practices.

{format_instructions}

Provide the analysis in valid JSON format.
`);

    const input = await prompt.format({
      description,
      additionalContext: additionalContext ? `\n**Additional Context:**\n${additionalContext}` : '',
      format_instructions: formatInstructions,
    });

    const response = await this.model.invoke(input);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    // Extract JSON from response (handle markdown code blocks)
    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    const parsed = await this.parser.parse(jsonContent) as RequirementsDocument;

    // Validate and add metadata
    const warnings: string[] = [];

    // Check for missing entities
    if (parsed.entities.length === 0) {
      warnings.push('No entities identified - may need more specific description');
    }

    // Check for features without entities
    parsed.features.forEach((feature: Feature) => {
      if (feature.entities.length === 0) {
        warnings.push(`Feature "${feature.name}" has no associated entities`);
      }
    });

    // Calculate confidence score
    let confidence = 1.0;
    if (parsed.entities.length === 0) confidence -= 0.3;
    if (parsed.features.length === 0) confidence -= 0.2;
    if (parsed.relationships.length === 0 && parsed.entities.length > 1) confidence -= 0.2;

    return {
      requirements: parsed,
      metadata: {
        analyzedAt: new Date(),
        tokensUsed: this.estimateTokens(content),
        confidence: Math.max(0, confidence),
      },
      warnings,
    };
  }

  /**
   * Refine requirements with follow-up questions
   */
  public async refineRequirements(
    initialRequirements: RequirementsDocument,
    clarifications: Record<string, string>
  ): Promise<RequirementsDocument> {
    const prompt = PromptTemplate.fromTemplate(`
You are refining an application's requirements based on user clarifications.

**Initial Requirements:**
{initialRequirements}

**User Clarifications:**
{clarifications}

Update the requirements document to incorporate the clarifications. Maintain the same JSON structure.

{format_instructions}
`);

    const formatInstructions = this.parser.getFormatInstructions();

    const input = await prompt.format({
      initialRequirements: JSON.stringify(initialRequirements, null, 2),
      clarifications: JSON.stringify(clarifications, null, 2),
      format_instructions: formatInstructions,
    });

    const response = await this.model.invoke(input);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    return (await this.parser.parse(jsonContent)) as RequirementsDocument;
  }

  /**
   * Extract entities from an existing codebase (for modifications)
   */
  public async extractEntitiesFromCode(
    codeSnippets: { fileName: string; content: string }[]
  ): Promise<Entity[]> {
    const prompt = PromptTemplate.fromTemplate(`
Analyze the following code files and extract entity definitions:

{codeSnippets}

For each entity/model found, extract:
- Name
- Description of what it represents
- All attributes with their types

Return as a JSON array of entities matching this structure:
{format_instructions}
`);

    const entityArraySchema = z.array(EntitySchema);
    const parser = StructuredOutputParser.fromZodSchema(entityArraySchema);

    const codeSnippetsText = codeSnippets
      .map((snippet) => `**${snippet.fileName}:**\n\`\`\`\n${snippet.content}\n\`\`\`\n`)
      .join('\n');

    const input = await prompt.format({
      codeSnippets: codeSnippetsText,
      format_instructions: parser.getFormatInstructions(),
    });

    const response = await this.model.invoke(input);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    return await parser.parse(jsonContent);
  }

  /**
   * Validate requirements document
   */
  public validateRequirements(requirements: RequirementsDocument): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for orphaned relationships
    const entityNames = new Set(requirements.entities.map((e) => e.name));
    requirements.relationships.forEach((rel) => {
      if (!entityNames.has(rel.from)) {
        errors.push(`Relationship references unknown entity: ${rel.from}`);
      }
      if (!entityNames.has(rel.to)) {
        errors.push(`Relationship references unknown entity: ${rel.to}`);
      }
    });

    // Check for features referencing non-existent entities
    requirements.features.forEach((feature) => {
      feature.entities.forEach((entityName) => {
        if (!entityNames.has(entityName)) {
          errors.push(`Feature "${feature.name}" references unknown entity: ${entityName}`);
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate summary of requirements
   */
  public generateSummary(requirements: RequirementsDocument): string {
    const lines = [
      `# ${requirements.appName}`,
      '',
      requirements.description,
      '',
      `**Complexity**: ${requirements.estimatedComplexity}`,
      '',
      `## Entities (${requirements.entities.length})`,
      ...requirements.entities.map((e) => `- ${e.name}: ${e.description}`),
      '',
      `## Features (${requirements.features.length})`,
      ...requirements.features.map(
        (f) => `- ${f.name} (${f.priority}): ${f.description}`
      ),
      '',
      `## UI Components (${requirements.uiRequirements.length})`,
      ...requirements.uiRequirements.map((ui) => `- ${ui.component}: ${ui.description}`),
      '',
      `## Technical Constraints (${requirements.technicalConstraints.length})`,
      ...requirements.technicalConstraints.map(
        (tc) => `- [${tc.priority}] ${tc.category}: ${tc.constraint}`
      ),
    ];

    return lines.join('\n');
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
