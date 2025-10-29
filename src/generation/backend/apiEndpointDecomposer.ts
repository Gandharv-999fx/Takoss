import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { Entity, Relationship, Feature } from '../../analysis/requirementsAnalyzer';
import { v4 as uuidv4 } from 'uuid';

/**
 * API Endpoint Decomposition - Generates Express.js REST API endpoints with Prisma
 * Creates CRUD operations, custom endpoints, and request/response types
 */

export interface EndpointDefinition {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  description: string;
  entity?: string;
  operationType: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LIST' | 'CUSTOM';
  authentication: boolean;
  authorization?: {
    roles?: string[];
    permissions?: string[];
  };
  requestBody?: RequestBodySchema;
  queryParams?: QueryParamSchema[];
  pathParams?: PathParamSchema[];
  responseSchema?: ResponseSchema;
  prismaQuery?: string; // Suggested Prisma query
}

export interface RequestBodySchema {
  description: string;
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    validation?: string;
  }>;
}

export interface QueryParamSchema {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: string;
}

export interface PathParamSchema {
  name: string;
  type: string;
  description: string;
}

export interface ResponseSchema {
  successCode: number;
  errorCodes: number[];
  dataStructure: string;
}

export interface EndpointPrompt {
  id: string;
  endpointDef: EndpointDefinition;
  prompt: string;
  fileName: string;
  dependencies: string[];
}

export interface APIDecompositionPlan {
  id: string;
  apiName: string;
  baseUrl: string;
  endpoints: EndpointDefinition[];
  prompts: EndpointPrompt[];
  entities: Entity[];
  relationships: Relationship[];
}

export class APIEndpointDecomposer {
  private model: ChatAnthropic;

  constructor(apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-sonnet-20240229',
      temperature: 0.3,
    });
  }

  /**
   * Decompose entities and features into RESTful API endpoints
   */
  public async decomposeToEndpoints(
    entities: Entity[],
    features: Feature[],
    relationships: Relationship[]
  ): Promise<APIDecompositionPlan> {
    const endpoints: EndpointDefinition[] = [];

    // Generate CRUD endpoints for each entity
    for (const entity of entities) {
      const crudEndpoints = this.generateCRUDEndpoints(entity);
      endpoints.push(...crudEndpoints);
    }

    // Generate custom endpoints from features
    for (const feature of features) {
      const customEndpoints = await this.generateCustomEndpoints(feature, entities);
      endpoints.push(...customEndpoints);
    }

    // Generate prompts for each endpoint
    const prompts: EndpointPrompt[] = [];
    for (const endpoint of endpoints) {
      const prompt = this.generateEndpointPrompt(endpoint, entities, relationships);
      prompts.push(prompt);
    }

    return {
      id: uuidv4(),
      apiName: 'Generated API',
      baseUrl: '/api/v1',
      endpoints,
      prompts,
      entities,
      relationships,
    };
  }

  /**
   * Generate CRUD endpoints for an entity
   */
  private generateCRUDEndpoints(entity: Entity): EndpointDefinition[] {
    const entityName = entity.name.toLowerCase();
    const entityNamePlural = `${entityName}s`; // Simple pluralization
    const endpoints: EndpointDefinition[] = [];

    // CREATE - POST /entities
    endpoints.push({
      id: uuidv4(),
      path: `/${entityNamePlural}`,
      method: 'POST',
      description: `Create a new ${entity.name}`,
      entity: entity.name,
      operationType: 'CREATE',
      authentication: true,
      requestBody: {
        description: `${entity.name} data`,
        fields: entity.attributes.map((attr) => ({
          name: attr.name,
          type: attr.type,
          required: attr.required,
          validation: this.getValidationRule(attr.type),
        })),
      },
      responseSchema: {
        successCode: 201,
        errorCodes: [400, 401, 409],
        dataStructure: entity.name,
      },
      prismaQuery: `await prisma.${entityName}.create({ data })`,
    });

    // READ - GET /entities/:id
    endpoints.push({
      id: uuidv4(),
      path: `/${entityNamePlural}/:id`,
      method: 'GET',
      description: `Get a ${entity.name} by ID`,
      entity: entity.name,
      operationType: 'READ',
      authentication: true,
      pathParams: [
        {
          name: 'id',
          type: 'string',
          description: `${entity.name} ID`,
        },
      ],
      responseSchema: {
        successCode: 200,
        errorCodes: [401, 404],
        dataStructure: entity.name,
      },
      prismaQuery: `await prisma.${entityName}.findUnique({ where: { id } })`,
    });

    // LIST - GET /entities
    endpoints.push({
      id: uuidv4(),
      path: `/${entityNamePlural}`,
      method: 'GET',
      description: `List all ${entity.name} with pagination`,
      entity: entity.name,
      operationType: 'LIST',
      authentication: true,
      queryParams: [
        {
          name: 'page',
          type: 'number',
          required: false,
          description: 'Page number',
          default: '1',
        },
        {
          name: 'limit',
          type: 'number',
          required: false,
          description: 'Items per page',
          default: '20',
        },
        {
          name: 'sort',
          type: 'string',
          required: false,
          description: 'Sort field',
          default: 'createdAt',
        },
        {
          name: 'order',
          type: 'string',
          required: false,
          description: 'Sort order (asc/desc)',
          default: 'desc',
        },
      ],
      responseSchema: {
        successCode: 200,
        errorCodes: [401],
        dataStructure: `{ data: ${entity.name}[], total: number, page: number, limit: number }`,
      },
      prismaQuery: `await prisma.${entityName}.findMany({ skip, take, orderBy })`,
    });

    // UPDATE - PUT /entities/:id
    endpoints.push({
      id: uuidv4(),
      path: `/${entityNamePlural}/:id`,
      method: 'PUT',
      description: `Update a ${entity.name}`,
      entity: entity.name,
      operationType: 'UPDATE',
      authentication: true,
      pathParams: [
        {
          name: 'id',
          type: 'string',
          description: `${entity.name} ID`,
        },
      ],
      requestBody: {
        description: `${entity.name} update data`,
        fields: entity.attributes
          .filter((attr) => attr.name !== 'id')
          .map((attr) => ({
            name: attr.name,
            type: attr.type,
            required: false, // All fields optional for update
            validation: this.getValidationRule(attr.type),
          })),
      },
      responseSchema: {
        successCode: 200,
        errorCodes: [400, 401, 404],
        dataStructure: entity.name,
      },
      prismaQuery: `await prisma.${entityName}.update({ where: { id }, data })`,
    });

    // DELETE - DELETE /entities/:id
    endpoints.push({
      id: uuidv4(),
      path: `/${entityNamePlural}/:id`,
      method: 'DELETE',
      description: `Delete a ${entity.name}`,
      entity: entity.name,
      operationType: 'DELETE',
      authentication: true,
      pathParams: [
        {
          name: 'id',
          type: 'string',
          description: `${entity.name} ID`,
        },
      ],
      responseSchema: {
        successCode: 204,
        errorCodes: [401, 404],
        dataStructure: 'void',
      },
      prismaQuery: `await prisma.${entityName}.delete({ where: { id } })`,
    });

    return endpoints;
  }

  /**
   * Generate custom endpoints from features
   */
  private async generateCustomEndpoints(
    feature: Feature,
    entities: Entity[]
  ): Promise<EndpointDefinition[]> {
    // Use AI to infer custom endpoints from feature description
    const prompt = PromptTemplate.fromTemplate(`
Analyze this feature and determine if it requires custom API endpoints beyond standard CRUD operations.

**Feature**: {featureName}
**Description**: {description}
**Type**: {type}
**Entities**: {entities}

If custom endpoints are needed, return them as JSON array:
[
  {{
    "path": "/custom-path",
    "method": "GET/POST/PUT/DELETE",
    "description": "What this endpoint does",
    "entity": "related entity or null",
    "operationType": "CUSTOM",
    "authentication": true/false,
    "requestBody": {{ ... }} or null,
    "queryParams": [...] or null,
    "responseSchema": {{ ... }}
  }}
]

If no custom endpoints needed (standard CRUD is sufficient), return: []
`);

    const input = await prompt.format({
      featureName: feature.name,
      description: feature.description,
      type: feature.category,
      entities: feature.entities.join(', '),
    });

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
      const customEndpoints = JSON.parse(jsonContent);
      return customEndpoints.map((ep: any) => ({
        ...ep,
        id: uuidv4(),
        authentication: ep.authentication ?? true,
      }));
    } catch (error) {
      console.warn(`Failed to parse custom endpoints for feature ${feature.name}`);
      return [];
    }
  }

  /**
   * Generate prompt for implementing an endpoint
   */
  private generateEndpointPrompt(
    endpoint: EndpointDefinition,
    entities: Entity[],
    relationships: Relationship[]
  ): EndpointPrompt {
    const entityInfo = endpoint.entity
      ? entities.find((e) => e.name === endpoint.entity)
      : null;

    const relatedRelationships = relationships.filter(
      (r) => r.from === endpoint.entity || r.to === endpoint.entity
    );

    const prompt = `
Generate an Express.js TypeScript route handler for this API endpoint.

**Endpoint Details:**
- **Path**: ${endpoint.path}
- **Method**: ${endpoint.method}
- **Description**: ${endpoint.description}
- **Operation Type**: ${endpoint.operationType}
- **Authentication Required**: ${endpoint.authentication}
${endpoint.authorization ? `- **Authorization**: Roles: ${endpoint.authorization.roles?.join(', ')}, Permissions: ${endpoint.authorization.permissions?.join(', ')}` : ''}

${endpoint.entity ? `**Entity**: ${endpoint.entity}\n` : ''}
${entityInfo ? `**Entity Attributes**:\n${entityInfo.attributes.map((a) => `- ${a.name}: ${a.type} ${a.required ? '(required)' : '(optional)'}`).join('\n')}\n` : ''}

${endpoint.requestBody ? `**Request Body**:\n${endpoint.requestBody.fields.map((f) => `- ${f.name}: ${f.type} ${f.required ? '(required)' : '(optional)'} ${f.validation ? `[${f.validation}]` : ''}`).join('\n')}\n` : ''}

${endpoint.queryParams ? `**Query Parameters**:\n${endpoint.queryParams.map((p) => `- ${p.name}: ${p.type} ${p.required ? '(required)' : '(optional)'} - ${p.description}`).join('\n')}\n` : ''}

${endpoint.pathParams ? `**Path Parameters**:\n${endpoint.pathParams.map((p) => `- ${p.name}: ${p.type} - ${p.description}`).join('\n')}\n` : ''}

**Response**:
- Success Code: ${endpoint.responseSchema?.successCode}
- Error Codes: ${endpoint.responseSchema?.errorCodes.join(', ')}
- Data Structure: ${endpoint.responseSchema?.dataStructure}

${endpoint.prismaQuery ? `**Suggested Prisma Query**:\n\`\`\`typescript\n${endpoint.prismaQuery}\n\`\`\`\n` : ''}

${relatedRelationships.length > 0 ? `**Relationships to Consider**:\n${relatedRelationships.map((r) => `- ${r.from} ${r.type} ${r.to}`).join('\n')}\n` : ''}

**Requirements**:
1. Use Express.js with TypeScript
2. Use Prisma Client for database operations
3. Include proper error handling (try-catch)
4. Use HTTP status codes correctly
5. Validate request data using Zod or similar
6. Include TypeScript interfaces for request/response
7. ${endpoint.authentication ? 'Add authentication middleware check' : 'No authentication needed'}
8. Return consistent JSON response format: \`{ success: boolean, data?: any, error?: string }\`
9. Handle Prisma errors (NotFound, UniqueConstraint, etc.)
10. Add JSDoc comments

**Code Structure**:
\`\`\`typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Request/Response interfaces
interface ${endpoint.method}${endpoint.entity || 'Custom'}Request { ... }
interface ${endpoint.method}${endpoint.entity || 'Custom'}Response { ... }

// Validation schema (if needed)
const ${endpoint.entity?.toLowerCase() || 'request'}Schema = z.object({ ... });

/**
 * ${endpoint.description}
 * @route ${endpoint.method} ${endpoint.path}
 */
export const ${this.generateHandlerName(endpoint)} = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Implementation here
  } catch (error) {
    // Error handling
  }
};
\`\`\`

Generate the complete, production-ready route handler code now.
`;

    const fileName = `${this.generateHandlerName(endpoint)}.ts`;

    return {
      id: endpoint.id,
      endpointDef: endpoint,
      prompt,
      fileName,
      dependencies: ['express', '@prisma/client', 'zod'],
    };
  }

  /**
   * Generate handler function name from endpoint
   */
  private generateHandlerName(endpoint: EndpointDefinition): string {
    const method = endpoint.method.toLowerCase();
    const entity = endpoint.entity?.toLowerCase() || 'custom';
    const operation = endpoint.operationType.toLowerCase();

    return `${method}${this.capitalize(entity)}${this.capitalize(operation)}`;
  }

  /**
   * Get validation rule for attribute type
   */
  private getValidationRule(type: string): string {
    const rules: Record<string, string> = {
      string: 'z.string()',
      number: 'z.number()',
      boolean: 'z.boolean()',
      date: 'z.date() or z.string().datetime()',
      array: 'z.array()',
      object: 'z.object()',
      enum: 'z.enum([])',
    };

    return rules[type] || 'z.unknown()';
  }

  /**
   * Capitalize string
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Generate endpoint implementation code
   */
  public async generateEndpointCode(
    endpointPrompt: EndpointPrompt
  ): Promise<string> {
    const response = await this.model.invoke(endpointPrompt.prompt);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract code
    const codeMatch = content.match(/```typescript\n([\s\S]*?)```/);
    if (codeMatch) {
      return codeMatch[1];
    }

    return content;
  }

  /**
   * Generate API router that combines all endpoints
   */
  public generateAPIRouter(plan: APIDecompositionPlan): string {
    const imports: string[] = [];
    const routes: string[] = [];

    plan.prompts.forEach((prompt) => {
      const handlerName = this.generateHandlerName(prompt.endpointDef);
      imports.push(`import { ${handlerName} } from './handlers/${prompt.fileName.replace('.ts', '')}';`);

      const path = prompt.endpointDef.path.replace(plan.baseUrl, '');
      const method = prompt.endpointDef.method.toLowerCase();

      routes.push(`router.${method}('${path}', ${handlerName});`);
    });

    return `
import { Router } from 'express';
${imports.join('\n')}

const router = Router();

// API Routes
${routes.join('\n')}

export default router;
`;
  }
}
