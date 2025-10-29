import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { v4 as uuidv4 } from 'uuid';

/**
 * Middleware Chain Builder - Generates Express.js middleware for various purposes
 * Creates authentication, validation, logging, error handling, and rate limiting middleware
 */

export interface MiddlewareDefinition {
  id: string;
  name: string;
  type: 'auth' | 'validation' | 'logging' | 'error' | 'rate-limit' | 'cors' | 'custom';
  description: string;
  order: number; // Execution order (lower = earlier)
  config?: Record<string, any>;
  dependencies: string[];
}

export interface AuthMiddlewareConfig {
  strategy: 'jwt' | 'session' | 'api-key' | 'oauth';
  tokenLocation: 'header' | 'cookie' | 'query';
  optional?: boolean;
  roles?: string[];
  permissions?: string[];
}

export interface ValidationMiddlewareConfig {
  schema: string; // Zod schema
  validateBody?: boolean;
  validateQuery?: boolean;
  validateParams?: boolean;
}

export interface LoggingMiddlewareConfig {
  logLevel: 'info' | 'debug' | 'warn' | 'error';
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
  maskSensitiveFields?: string[];
}

export interface RateLimitMiddlewareConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: string; // Function to generate rate limit key
  skipSuccessfulRequests?: boolean;
}

export interface MiddlewarePrompt {
  id: string;
  middleware: MiddlewareDefinition;
  prompt: string;
  fileName: string;
}

export interface MiddlewareChain {
  id: string;
  name: string;
  middlewares: MiddlewareDefinition[];
  prompts: MiddlewarePrompt[];
  executionOrder: string[];
}

export class MiddlewareChainBuilder {
  private model: ChatAnthropic;

  constructor(apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-sonnet-20240229',
      temperature: 0.3,
    });
  }

  /**
   * Create a standard middleware chain for REST API
   */
  public createStandardChain(config?: {
    useAuth?: boolean;
    useRateLimit?: boolean;
    useLogging?: boolean;
    customMiddleware?: MiddlewareDefinition[];
  }): MiddlewareChain {
    const middlewares: MiddlewareDefinition[] = [];

    // 1. CORS (always first)
    middlewares.push({
      id: uuidv4(),
      name: 'cors',
      type: 'cors',
      description: 'Handle Cross-Origin Resource Sharing',
      order: 1,
      dependencies: ['cors'],
    });

    // 2. Request Logging
    if (config?.useLogging !== false) {
      middlewares.push({
        id: uuidv4(),
        name: 'requestLogger',
        type: 'logging',
        description: 'Log incoming requests',
        order: 2,
        config: {
          logLevel: 'info',
          includeRequestBody: true,
          maskSensitiveFields: ['password', 'token', 'apiKey'],
        },
        dependencies: ['winston'],
      });
    }

    // 3. Rate Limiting
    if (config?.useRateLimit !== false) {
      middlewares.push({
        id: uuidv4(),
        name: 'rateLimiter',
        type: 'rate-limit',
        description: 'Rate limit requests to prevent abuse',
        order: 3,
        config: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: 100,
        },
        dependencies: ['express-rate-limit'],
      });
    }

    // 4. Authentication
    if (config?.useAuth !== false) {
      middlewares.push({
        id: uuidv4(),
        name: 'authenticate',
        type: 'auth',
        description: 'Verify user authentication',
        order: 4,
        config: {
          strategy: 'jwt',
          tokenLocation: 'header',
        },
        dependencies: ['jsonwebtoken'],
      });
    }

    // 5. Custom middleware
    if (config?.customMiddleware) {
      middlewares.push(...config.customMiddleware);
    }

    // 6. Error Handler (always last)
    middlewares.push({
      id: uuidv4(),
      name: 'errorHandler',
      type: 'error',
      description: 'Global error handling middleware',
      order: 999,
      dependencies: [],
    });

    // Sort by order
    middlewares.sort((a, b) => a.order - b.order);

    // Generate prompts
    const prompts = middlewares.map((mw) => this.generateMiddlewarePrompt(mw));

    return {
      id: uuidv4(),
      name: 'Standard API Middleware Chain',
      middlewares,
      prompts,
      executionOrder: middlewares.map((m) => m.id),
    };
  }

  /**
   * Generate prompt for middleware implementation
   */
  private generateMiddlewarePrompt(
    middleware: MiddlewareDefinition
  ): MiddlewarePrompt {
    const prompts: Record<string, string> = {
      cors: this.generateCORSPrompt(),
      logging: this.generateLoggingPrompt(middleware),
      'rate-limit': this.generateRateLimitPrompt(middleware),
      auth: this.generateAuthPrompt(middleware),
      validation: this.generateValidationPrompt(middleware),
      error: this.generateErrorHandlerPrompt(),
      custom: this.generateCustomPrompt(middleware),
    };

    const prompt = prompts[middleware.type] || prompts.custom;

    return {
      id: middleware.id,
      middleware,
      prompt,
      fileName: `${middleware.name}Middleware.ts`,
    };
  }

  /**
   * CORS Middleware Prompt
   */
  private generateCORSPrompt(): string {
    return `
Generate a CORS (Cross-Origin Resource Sharing) middleware for an Express.js TypeScript application.

**Requirements**:
1. Use the 'cors' package
2. Allow credentials
3. Configure allowed origins from environment variable (ALLOWED_ORIGINS)
4. Allow common HTTP methods: GET, POST, PUT, DELETE, PATCH
5. Allow common headers: Content-Type, Authorization
6. Handle preflight requests
7. TypeScript types

**Structure**:
\`\`\`typescript
import cors from 'cors';
import { CorsOptions } from 'cors';

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Implementation
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export const corsMiddleware = cors(corsOptions);
\`\`\`

Generate the complete middleware code now.
`;
  }

  /**
   * Logging Middleware Prompt
   */
  private generateLoggingPrompt(middleware: MiddlewareDefinition): string {
    const config = middleware.config as LoggingMiddlewareConfig;

    return `
Generate a request logging middleware for Express.js TypeScript application.

**Configuration**:
- Log Level: ${config?.logLevel || 'info'}
- Include Request Body: ${config?.includeRequestBody || false}
- Include Response Body: ${config?.includeResponseBody || false}
- Mask Sensitive Fields: ${config?.maskSensitiveFields?.join(', ') || 'password, token'}

**Requirements**:
1. Use Winston for logging
2. Log request method, URL, IP address, user agent
3. Log response status code and duration
4. Mask sensitive fields in logs (passwords, tokens, etc.)
5. Use correlation IDs for request tracking
6. Different log levels for different status codes
7. TypeScript types

**Structure**:
\`\`\`typescript
import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

const logger = winston.createLogger({
  // Winston configuration
});

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();
  const correlationId = req.headers['x-correlation-id'] || generateId();

  // Log request
  logger.info('Incoming request', {
    correlationId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Capture response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      correlationId,
      statusCode: res.statusCode,
      duration,
    });
  });

  next();
};
\`\`\`

Generate the complete middleware code now.
`;
  }

  /**
   * Rate Limit Middleware Prompt
   */
  private generateRateLimitPrompt(middleware: MiddlewareDefinition): string {
    const config = middleware.config as RateLimitMiddlewareConfig;

    return `
Generate a rate limiting middleware for Express.js TypeScript application.

**Configuration**:
- Window: ${config?.windowMs || 15 * 60 * 1000}ms (${(config?.windowMs || 15 * 60 * 1000) / 60000} minutes)
- Max Requests: ${config?.maxRequests || 100} per window
- Key Generator: ${config?.keyGenerator || 'IP address'}

**Requirements**:
1. Use express-rate-limit package
2. Generate key by IP address (or custom logic)
3. Return 429 Too Many Requests when limit exceeded
4. Include rate limit headers (X-RateLimit-*)
5. Custom error message
6. TypeScript types

**Structure**:
\`\`\`typescript
import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: ${config?.windowMs || 15 * 60 * 1000},
  max: ${config?.maxRequests || 100},
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Custom key generation logic
    return req.ip;
  },
});
\`\`\`

Generate the complete middleware code now.
`;
  }

  /**
   * Authentication Middleware Prompt
   */
  private generateAuthPrompt(middleware: MiddlewareDefinition): string {
    const config = middleware.config as AuthMiddlewareConfig;

    return `
Generate an authentication middleware for Express.js TypeScript application.

**Configuration**:
- Strategy: ${config?.strategy || 'jwt'}
- Token Location: ${config?.tokenLocation || 'header'}
- Optional: ${config?.optional || false}
- Required Roles: ${config?.roles?.join(', ') || 'None'}
- Required Permissions: ${config?.permissions?.join(', ') || 'None'}

**Requirements**:
1. Use jsonwebtoken for JWT verification
2. Extract token from ${config?.tokenLocation || 'Authorization header'}
3. Verify token signature with JWT_SECRET from env
4. Attach user to req.user
5. Return 401 Unauthorized if token invalid
6. ${config?.optional ? 'Allow requests without token' : 'Require token for all requests'}
7. ${config?.roles ? 'Check user roles' : 'No role checking'}
8. TypeScript types with extended Request interface

**Structure**:
\`\`\`typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        roles: string[];
        permissions: string[];
      };
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token
    const token = extractToken(req);

    if (!token) {
      ${config?.optional ? 'return next();' : 'return res.status(401).json({ success: false, error: \'Authentication required\' });'}
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Attach user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      roles: decoded.roles || [],
      permissions: decoded.permissions || [],
    };

    ${config?.roles ? `// Check roles\nif (!hasRequiredRole(req.user.roles, ${JSON.stringify(config.roles)})) {\n  return res.status(403).json({ success: false, error: 'Insufficient permissions' });\n}` : ''}

    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

function extractToken(req: Request): string | null {
  ${config?.tokenLocation === 'header' ? 'const authHeader = req.headers.authorization;\nreturn authHeader?.startsWith(\'Bearer \') ? authHeader.substring(7) : null;' : ''}
  ${config?.tokenLocation === 'cookie' ? 'return req.cookies?.token || null;' : ''}
  ${config?.tokenLocation === 'query' ? 'return req.query.token as string || null;' : ''}
}
\`\`\`

Generate the complete middleware code now.
`;
  }

  /**
   * Validation Middleware Prompt
   */
  private generateValidationPrompt(middleware: MiddlewareDefinition): string {
    const config = middleware.config as ValidationMiddlewareConfig;

    return `
Generate a request validation middleware for Express.js TypeScript application.

**Configuration**:
- Validate Body: ${config?.validateBody !== false}
- Validate Query: ${config?.validateQuery || false}
- Validate Params: ${config?.validateParams || false}

**Requirements**:
1. Use Zod for schema validation
2. Create factory function that accepts Zod schema
3. Validate request body/query/params based on config
4. Return 400 Bad Request with validation errors
5. Attach validated data to req.validatedData
6. TypeScript types

**Structure**:
\`\`\`typescript
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      validatedData?: any;
    }
  }
}

export const validate = (schema: ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dataToValidate = {
        ${config?.validateBody !== false ? 'body: req.body,' : ''}
        ${config?.validateQuery ? 'query: req.query,' : ''}
        ${config?.validateParams ? 'params: req.params,' : ''}
      };

      const validated = await schema.parseAsync(dataToValidate);
      req.validatedData = validated;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
};
\`\`\`

Generate the complete middleware code now.
`;
  }

  /**
   * Error Handler Middleware Prompt
   */
  private generateErrorHandlerPrompt(): string {
    return `
Generate a global error handling middleware for Express.js TypeScript application.

**Requirements**:
1. Handle all types of errors (Express errors, Prisma errors, custom errors)
2. Different responses for different error types
3. Include error logging
4. Hide sensitive error details in production
5. Return consistent JSON error format
6. Handle Prisma-specific errors (NotFound, UniqueConstraint, etc.)
7. TypeScript types with custom error classes

**Structure**:
\`\`\`typescript
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import winston from 'winston';

// Custom error class
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
  });

  // Handle different error types
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
    return;
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const { statusCode, message } = handlePrismaError(error);
    res.status(statusCode).json({ success: false, error: message });
    return;
  }

  // Default error
  const statusCode = 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : error.message;

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  });
};

function handlePrismaError(error: Prisma.PrismaClientKnownRequestError): {
  statusCode: number;
  message: string;
} {
  switch (error.code) {
    case 'P2002':
      return { statusCode: 409, message: 'Unique constraint violation' };
    case 'P2025':
      return { statusCode: 404, message: 'Record not found' };
    default:
      return { statusCode: 500, message: 'Database error' };
  }
}
\`\`\`

Generate the complete middleware code now.
`;
  }

  /**
   * Custom Middleware Prompt
   */
  private generateCustomPrompt(middleware: MiddlewareDefinition): string {
    return `
Generate a custom Express.js middleware for: ${middleware.description}

**Name**: ${middleware.name}
**Type**: ${middleware.type}
**Configuration**: ${JSON.stringify(middleware.config, null, 2)}

**Requirements**:
1. Use Express.js with TypeScript
2. Follow Express middleware signature: (req, res, next) => void
3. Include proper error handling
4. Add TypeScript types
5. Call next() to continue middleware chain
6. Include JSDoc comments

Generate the complete middleware code now.
`;
  }

  /**
   * Generate middleware implementation code
   */
  public async generateMiddlewareCode(
    prompt: MiddlewarePrompt
  ): Promise<string> {
    const response = await this.model.invoke(prompt.prompt);
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
   * Generate middleware index file
   */
  public generateMiddlewareIndex(chain: MiddlewareChain): string {
    const imports = chain.prompts.map(
      (p) =>
        `import { ${p.middleware.name} } from './${p.fileName.replace('.ts', '')}';`
    );

    const exports = chain.middlewares.map((m) => m.name).join(', ');

    return `
// Middleware exports
${imports.join('\n')}

export {
  ${exports}
};

// Middleware chain factory
export const createMiddlewareChain = () => [
  ${chain.middlewares.map((m) => m.name).join(',\n  ')}
];
`;
  }
}
