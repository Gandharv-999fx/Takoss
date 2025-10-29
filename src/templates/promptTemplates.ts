import { PromptTemplate } from '../types/interfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * Collection of prompt templates for common application components
 */
export const promptTemplates: PromptTemplate[] = [
  // Frontend component templates
  {
    id: uuidv4(),
    name: 'React Component',
    description: 'Generate a React component with TypeScript',
    template: `
    You are an expert React developer. Create a React component with TypeScript for the following requirement:
    
    Component Name: {{componentName}}
    Description: {{description}}
    
    Requirements:
    {{requirements}}
    
    Please provide a complete, well-structured React component with TypeScript typing. Include:
    1. Proper imports
    2. Interface for props
    3. Proper state management (useState if needed)
    4. Clean, semantic JSX
    5. Appropriate styling approach
    6. Any necessary utility functions
    
    The component should follow best practices and be ready to use in a production application.
    `,
    variables: ['componentName', 'description', 'requirements'],
    category: 'frontend',
    modelType: 'claude'
  },
  {
    id: uuidv4(),
    name: 'React Form',
    description: 'Generate a React form component with validation',
    template: `
    You are an expert React developer. Create a React form component with validation for the following requirement:
    
    Form Name: {{formName}}
    Description: {{description}}
    
    Form Fields:
    {{formFields}}
    
    Validation Rules:
    {{validationRules}}
    
    Please provide a complete, well-structured React form component with:
    1. Proper form state management
    2. Field validation using a library like Formik, React Hook Form, or Zod
    3. Error handling and display
    4. Submission handling
    5. TypeScript interfaces for form data
    
    The component should follow best practices and be ready to use in a production application.
    `,
    variables: ['formName', 'description', 'formFields', 'validationRules'],
    category: 'frontend',
    modelType: 'claude'
  },
  
  // Backend templates
  {
    id: uuidv4(),
    name: 'Express API Route',
    description: 'Generate an Express API route with TypeScript',
    template: `
    You are an expert backend developer. Create an Express API route with TypeScript for the following requirement:
    
    Route: {{routePath}}
    Method: {{httpMethod}}
    Description: {{description}}
    
    Requirements:
    {{requirements}}
    
    Please provide a complete, well-structured Express route handler with:
    1. Proper request validation
    2. Error handling
    3. TypeScript interfaces for request/response
    4. Middleware integration if needed
    5. Database interaction if needed
    
    The code should follow best practices and be ready to use in a production application.
    `,
    variables: ['routePath', 'httpMethod', 'description', 'requirements'],
    category: 'backend',
    modelType: 'claude'
  },
  
  // Database templates
  {
    id: uuidv4(),
    name: 'Prisma Schema',
    description: 'Generate a Prisma schema for a database model',
    template: `
    You are an expert database architect. Create a Prisma schema for the following entity:
    
    Model Name: {{modelName}}
    Description: {{description}}
    
    Fields and Requirements:
    {{requirements}}
    
    Please provide a complete, well-structured Prisma schema with:
    1. Appropriate field types
    2. Relationships to other models if needed
    3. Indexes for performance
    4. Proper constraints (unique, required, etc.)
    
    The schema should follow best practices and be ready to use in a production application.
    `,
    variables: ['modelName', 'description', 'requirements'],
    category: 'database',
    modelType: 'claude'
  },
  
  // Authentication templates
  {
    id: uuidv4(),
    name: 'Authentication System',
    description: 'Generate authentication system code',
    template: `
    You are an expert in authentication systems. Create authentication code for the following requirement:
    
    Auth Type: {{authType}}
    Description: {{description}}
    
    Requirements:
    {{requirements}}
    
    Please provide complete, well-structured authentication code with:
    1. User registration/login flows
    2. Password hashing and security
    3. JWT or session management
    4. Middleware for protected routes
    5. TypeScript interfaces for auth data
    
    The code should follow best practices and be ready to use in a production application.
    `,
    variables: ['authType', 'description', 'requirements'],
    category: 'auth',
    modelType: 'claude'
  },
  
  // Testing templates
  {
    id: uuidv4(),
    name: 'Unit Tests',
    description: 'Generate unit tests for a component or function',
    template: `
    You are an expert in testing. Create unit tests for the following code:
    
    Code Type: {{codeType}}
    Description: {{description}}
    
    Code to Test:
    {{codeToTest}}
    
    Please provide complete, well-structured unit tests with:
    1. Proper test setup
    2. Comprehensive test cases
    3. Mocking of dependencies
    4. Edge case handling
    
    The tests should follow best practices and provide good coverage of the functionality.
    `,
    variables: ['codeType', 'description', 'codeToTest'],
    category: 'testing',
    modelType: 'claude'
  },
  
  // Deployment templates
  {
    id: uuidv4(),
    name: 'Docker Configuration',
    description: 'Generate Docker configuration for an application',
    template: `
    You are an expert in containerization. Create Docker configuration for the following application:
    
    App Type: {{appType}}
    Description: {{description}}
    
    Requirements:
    {{requirements}}
    
    Please provide complete Docker configuration with:
    1. Dockerfile
    2. docker-compose.yml if needed
    3. Environment variable handling
    4. Volume configuration if needed
    
    The configuration should follow best practices and be ready to use in a production environment.
    `,
    variables: ['appType', 'description', 'requirements'],
    category: 'deployment',
    modelType: 'claude'
  },
  
  // General templates
  {
    id: uuidv4(),
    name: 'Task Decomposition',
    description: 'Decompose a complex task into smaller subtasks',
    template: `
    You are an expert system architect. Break down the following complex task into smaller, more manageable subtasks:
    
    Task: {{taskTitle}}
    Description: {{taskDescription}}
    
    Please provide a list of 3-7 subtasks that together would accomplish this task. Each subtask should be specific, actionable, and focused on a single aspect of the overall task.
    
    For each subtask, provide:
    1. A clear, concise title
    2. A brief description of what needs to be done
    3. Any dependencies on other subtasks
    
    Format your response as a structured list of subtasks.
    `,
    variables: ['taskTitle', 'taskDescription'],
    category: 'other',
    modelType: 'claude'
  }
];