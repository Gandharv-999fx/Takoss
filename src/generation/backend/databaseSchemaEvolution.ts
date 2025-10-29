import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { Entity, Relationship } from '../../analysis/requirementsAnalyzer';
import { v4 as uuidv4 } from 'uuid';

/**
 * Database Schema Evolution - Iterative Prisma schema generation and refinement
 * Generates Prisma schema from entities, handles migrations, and evolves schema over time
 */

export interface PrismaModel {
  name: string;
  fields: PrismaField[];
  relations: PrismaRelation[];
  indexes?: string[];
  unique?: string[][];
  map?: string; // Table name mapping
}

export interface PrismaField {
  name: string;
  type: string;
  optional: boolean;
  isId: boolean;
  isUnique: boolean;
  default?: string;
  attributes: string[]; // @db.Text, @updatedAt, etc.
}

export interface PrismaRelation {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  relatedModel: string;
  foreignKey?: string;
  references?: string;
}

export interface SchemaEvolutionStep {
  id: string;
  version: number;
  description: string;
  models: PrismaModel[];
  enums: PrismaEnum[];
  changes?: SchemaChange[];
  migrationName?: string;
}

export interface PrismaEnum {
  name: string;
  values: string[];
}

export interface SchemaChange {
  type: 'add_model' | 'modify_model' | 'delete_model' | 'add_field' | 'modify_field' | 'delete_field' | 'add_relation';
  modelName: string;
  fieldName?: string;
  details: string;
}

export interface SchemaEvolutionPlan {
  id: string;
  currentVersion: number;
  steps: SchemaEvolutionStep[];
  finalSchema: string;
}

export class DatabaseSchemaEvolution {
  private model: ChatAnthropic;

  constructor(apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-sonnet-20240229',
      temperature: 0.3,
    });
  }

  /**
   * Generate initial Prisma schema from entities and relationships
   */
  public generateInitialSchema(
    entities: Entity[],
    relationships: Relationship[],
    enums?: PrismaEnum[]
  ): SchemaEvolutionStep {
    const models: PrismaModel[] = [];

    // Generate models from entities
    for (const entity of entities) {
      const model = this.entityToModel(entity, relationships);
      models.push(model);
    }

    // Handle many-to-many relationships (create junction tables)
    const junctionTables = this.generateJunctionTables(relationships);
    models.push(...junctionTables);

    const step: SchemaEvolutionStep = {
      id: uuidv4(),
      version: 1,
      description: 'Initial schema generation from entities',
      models,
      enums: enums || [],
      migrationName: 'initial_schema',
    };

    return step;
  }

  /**
   * Convert Entity to Prisma Model
   */
  private entityToModel(
    entity: Entity,
    relationships: Relationship[]
  ): PrismaModel {
    const fields: PrismaField[] = [];
    const relations: PrismaRelation[] = [];

    // Add ID field
    fields.push({
      name: 'id',
      type: 'String',
      optional: false,
      isId: true,
      isUnique: false,
      default: 'uuid()',
      attributes: ['@id', '@default(uuid())'],
    });

    // Add entity attributes
    for (const attr of entity.attributes) {
      if (attr.name === 'id') continue; // Skip if already added

      fields.push({
        name: attr.name,
        type: this.mapTypeToPrisma(attr.type),
        optional: !attr.required,
        isId: false,
        isUnique: false,
        default: this.getDefaultValue(attr.type, attr.required),
        attributes: this.getFieldAttributes(attr.type),
      });
    }

    // Add timestamp fields
    fields.push(
      {
        name: 'createdAt',
        type: 'DateTime',
        optional: false,
        isId: false,
        isUnique: false,
        default: 'now()',
        attributes: ['@default(now())'],
      },
      {
        name: 'updatedAt',
        type: 'DateTime',
        optional: false,
        isId: false,
        isUnique: false,
        attributes: ['@updatedAt'],
      }
    );

    // Add relations
    const entityRelations = relationships.filter(
      (r) => r.from === entity.name || r.to === entity.name
    );

    for (const rel of entityRelations) {
      const relation = this.createRelation(entity.name, rel);
      if (relation) {
        relations.push(relation);
      }
    }

    return {
      name: entity.name,
      fields,
      relations,
      indexes: this.generateIndexes(entity),
      map: this.toSnakeCase(entity.name),
    };
  }

  /**
   * Map TypeScript type to Prisma type
   */
  private mapTypeToPrisma(type: string): string {
    const typeMap: Record<string, string> = {
      string: 'String',
      number: 'Int',
      boolean: 'Boolean',
      date: 'DateTime',
      array: 'Json', // Default to Json for arrays
      object: 'Json',
      enum: 'String', // Will be overridden by actual enum
    };

    return typeMap[type] || 'String';
  }

  /**
   * Get default value for field
   */
  private getDefaultValue(type: string, required: boolean): string | undefined {
    if (required) return undefined;

    const defaults: Record<string, string> = {
      boolean: 'false',
      number: '0',
      array: '[]',
    };

    return defaults[type];
  }

  /**
   * Get Prisma field attributes
   */
  private getFieldAttributes(type: string): string[] {
    if (type === 'string') {
      // Use @db.Text for large strings
      return [];
    }
    return [];
  }

  /**
   * Create Prisma relation from relationship definition
   */
  private createRelation(
    modelName: string,
    rel: Relationship
  ): PrismaRelation | null {
    const isFrom = rel.from === modelName;
    const relatedModel = isFrom ? rel.to : rel.from;

    if (rel.type === 'many-to-many') {
      // Many-to-many requires junction table, skip direct relation
      return null;
    }

    const relationType: 'one-to-one' | 'one-to-many' =
      rel.type === 'one-to-one' ? 'one-to-one' : 'one-to-many';

    return {
      name: this.pluralize(relatedModel.toLowerCase()),
      type: relationType,
      relatedModel,
      foreignKey: isFrom ? `${relatedModel.toLowerCase()}Id` : undefined,
      references: isFrom ? 'id' : undefined,
    };
  }

  /**
   * Generate junction tables for many-to-many relationships
   */
  private generateJunctionTables(relationships: Relationship[]): PrismaModel[] {
    const junctionTables: PrismaModel[] = [];

    const manyToManyRels = relationships.filter((r) => r.type === 'many-to-many');

    for (const rel of manyToManyRels) {
      const tableName = `${rel.from}${rel.to}`;

      junctionTables.push({
        name: tableName,
        fields: [
          {
            name: 'id',
            type: 'String',
            optional: false,
            isId: true,
            isUnique: false,
            default: 'uuid()',
            attributes: ['@id', '@default(uuid())'],
          },
          {
            name: `${rel.from.toLowerCase()}Id`,
            type: 'String',
            optional: false,
            isId: false,
            isUnique: false,
            attributes: [],
          },
          {
            name: `${rel.to.toLowerCase()}Id`,
            type: 'String',
            optional: false,
            isId: false,
            isUnique: false,
            attributes: [],
          },
          {
            name: 'createdAt',
            type: 'DateTime',
            optional: false,
            isId: false,
            isUnique: false,
            default: 'now()',
            attributes: ['@default(now())'],
          },
        ],
        relations: [
          {
            name: rel.from.toLowerCase(),
            type: 'one-to-many',
            relatedModel: rel.from,
            foreignKey: `${rel.from.toLowerCase()}Id`,
            references: 'id',
          },
          {
            name: rel.to.toLowerCase(),
            type: 'one-to-many',
            relatedModel: rel.to,
            foreignKey: `${rel.to.toLowerCase()}Id`,
            references: 'id',
          },
        ],
        unique: [[`${rel.from.toLowerCase()}Id`, `${rel.to.toLowerCase()}Id`]],
        map: this.toSnakeCase(tableName),
      });
    }

    return junctionTables;
  }

  /**
   * Generate indexes for model
   */
  private generateIndexes(entity: Entity): string[] {
    const indexes: string[] = [];

    // Index common search fields
    const searchFields = entity.attributes
      .filter((a) => a.type === 'string' && a.name !== 'id')
      .slice(0, 2); // Index first 2 string fields

    for (const field of searchFields) {
      indexes.push(field.name);
    }

    return indexes;
  }

  /**
   * Generate complete Prisma schema file
   */
  public generateSchemaFile(step: SchemaEvolutionStep): string {
    const lines: string[] = [];

    // Header
    lines.push('// Prisma schema generated by Takoss');
    lines.push('// Do not edit manually - use migrations instead');
    lines.push('');
    lines.push('generator client {');
    lines.push('  provider = "prisma-client-js"');
    lines.push('}');
    lines.push('');
    lines.push('datasource db {');
    lines.push('  provider = "postgresql"');
    lines.push('  url      = env("DATABASE_URL")');
    lines.push('}');
    lines.push('');

    // Enums
    if (step.enums.length > 0) {
      for (const enumDef of step.enums) {
        lines.push(`enum ${enumDef.name} {`);
        for (const value of enumDef.values) {
          lines.push(`  ${value}`);
        }
        lines.push('}');
        lines.push('');
      }
    }

    // Models
    for (const model of step.models) {
      lines.push(`model ${model.name} {`);

      // Fields
      for (const field of model.fields) {
        const optional = field.optional ? '?' : '';
        const attributes = field.attributes.length > 0 ? ` ${field.attributes.join(' ')}` : '';
        lines.push(`  ${field.name}  ${field.type}${optional}${attributes}`);
      }

      // Relations
      for (const relation of model.relations) {
        const optional = relation.type === 'one-to-one' ? '?' : '[]';
        lines.push(`  ${relation.name}  ${relation.relatedModel}${optional}`);
      }

      // Indexes
      if (model.indexes && model.indexes.length > 0) {
        lines.push('');
        for (const index of model.indexes) {
          lines.push(`  @@index([${index}])`);
        }
      }

      // Unique constraints
      if (model.unique && model.unique.length > 0) {
        for (const unique of model.unique) {
          lines.push(`  @@unique([${unique.join(', ')}])`);
        }
      }

      // Table mapping
      if (model.map) {
        lines.push(`  @@map("${model.map}")`);
      }

      lines.push('}');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Refine schema with AI suggestions
   */
  public async refineSchema(
    currentSchema: string,
    feedback?: string
  ): Promise<string> {
    const prompt = PromptTemplate.fromTemplate(`
You are a database schema expert. Review this Prisma schema and suggest improvements.

**Current Schema:**
\`\`\`prisma
{currentSchema}
\`\`\`

${feedback ? `**Feedback/Requirements:**\n${feedback}\n` : ''}

**Review Criteria:**
1. **Normalization**: Is the schema properly normalized (3NF)?
2. **Indexes**: Are appropriate indexes defined for common queries?
3. **Constraints**: Are unique constraints and foreign keys properly defined?
4. **Data Types**: Are data types optimal (e.g., @db.Text for long strings)?
5. **Naming**: Follow conventions (camelCase for fields, PascalCase for models)?
6. **Relationships**: Are relations properly bidirectional?
7. **Performance**: Any performance optimizations needed?
8. **Best Practices**: Follow Prisma and PostgreSQL best practices?

Provide the improved schema as complete Prisma schema code.

Return ONLY the improved Prisma schema, no explanations.
`);

    const input = await prompt.format({ currentSchema, feedback: feedback || '' });
    const response = await this.model.invoke(input);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract schema
    const schemaMatch = content.match(/```prisma\n([\s\S]*?)```/);
    if (schemaMatch) {
      return schemaMatch[1];
    }

    return content;
  }

  /**
   * Generate migration plan for schema changes
   */
  public async generateMigrationPlan(
    oldSchema: string,
    newSchema: string
  ): Promise<SchemaChange[]> {
    const prompt = PromptTemplate.fromTemplate(`
Compare these two Prisma schemas and identify the changes.

**Old Schema:**
\`\`\`prisma
{oldSchema}
\`\`\`

**New Schema:**
\`\`\`prisma
{newSchema}
\`\`\`

Identify all changes and return as JSON array:
[
  {{
    "type": "add_model|modify_model|delete_model|add_field|modify_field|delete_field|add_relation",
    "modelName": "ModelName",
    "fieldName": "fieldName (if applicable)",
    "details": "Description of the change"
  }}
]
`);

    const input = await prompt.format({ oldSchema, newSchema });
    const response = await this.model.invoke(input);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract JSON
    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonContent) as SchemaChange[];
    } catch (error) {
      console.warn('Failed to parse migration plan');
      return [];
    }
  }

  /**
   * Validate Prisma schema syntax
   */
  public async validateSchema(schema: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    // Basic syntax validation
    const errors: string[] = [];

    // Check for required sections
    if (!schema.includes('generator client')) {
      errors.push('Missing generator client configuration');
    }

    if (!schema.includes('datasource db')) {
      errors.push('Missing datasource configuration');
    }

    // Check for model definitions
    const modelMatches = schema.match(/model\s+\w+\s*{/g);
    if (!modelMatches || modelMatches.length === 0) {
      errors.push('No models defined in schema');
    }

    // Check for syntax errors (basic)
    const lines = schema.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('model ') && !line.endsWith('{')) {
        errors.push(`Line ${i + 1}: Model definition syntax error`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Helper: Convert to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }

  /**
   * Helper: Simple pluralization
   */
  private pluralize(str: string): string {
    if (str.endsWith('y')) {
      return str.slice(0, -1) + 'ies';
    }
    if (str.endsWith('s')) {
      return str + 'es';
    }
    return str + 's';
  }

  /**
   * Generate seed data script
   */
  public generateSeedScript(models: PrismaModel[]): string {
    const lines: string[] = [];

    lines.push("import { PrismaClient } from '@prisma/client';");
    lines.push('');
    lines.push('const prisma = new PrismaClient();');
    lines.push('');
    lines.push('async function main() {');
    lines.push('  console.log(\'Start seeding...\');');
    lines.push('');

    for (const model of models) {
      lines.push(`  // Seed ${model.name}`);
      lines.push(`  const ${model.name.toLowerCase()}1 = await prisma.${model.name.toLowerCase()}.create({`);
      lines.push('    data: {');

      for (const field of model.fields) {
        if (field.isId || field.attributes.includes('@updatedAt') || field.attributes.includes('@default(now())')) {
          continue; // Skip auto-generated fields
        }

        const value = this.generateSampleValue(field.type, field.name);
        lines.push(`      ${field.name}: ${value},`);
      }

      lines.push('    },');
      lines.push('  });');
      lines.push('');
    }

    lines.push('  console.log(\'Seeding finished.\');');
    lines.push('}');
    lines.push('');
    lines.push('main()');
    lines.push('  .catch((e) => {');
    lines.push('    console.error(e);');
    lines.push('    process.exit(1);');
    lines.push('  })');
    lines.push('  .finally(async () => {');
    lines.push('    await prisma.$disconnect();');
    lines.push('  });');

    return lines.join('\n');
  }

  /**
   * Generate sample value for seeding
   */
  private generateSampleValue(type: string, fieldName: string): string {
    const typeMap: Record<string, string> = {
      String: `'Sample ${fieldName}'`,
      Int: '1',
      Boolean: 'true',
      DateTime: 'new Date()',
      Json: '{}',
    };

    return typeMap[type] || "''";
  }
}
