import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { ComponentTree } from './sequentialComponentBuilder';
import { v4 as uuidv4 } from 'uuid';

/**
 * Integration Prompt Generator - Wires up React components with routing, state, and data fetching
 * Generates prompts for React Router, TanStack Query, and Zustand integration
 */

export interface IntegrationConfig {
  useRouter: boolean;
  useStateManagement: boolean; // Zustand
  useDataFetching: boolean; // TanStack Query
  apiBaseUrl?: string;
  routes?: RouteDefinition[];
  stores?: StoreDefinition[];
  queries?: QueryDefinition[];
}

export interface RouteDefinition {
  path: string;
  componentName: string;
  protected?: boolean;
  layout?: string;
}

export interface StoreDefinition {
  name: string;
  description: string;
  state: Record<string, string>; // field -> type
  actions: string[]; // action names
}

export interface QueryDefinition {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: string[];
  usedBy: string[]; // Component names
}

export interface IntegrationPrompt {
  id: string;
  type: 'router' | 'store' | 'query' | 'provider' | 'hook';
  fileName: string;
  description: string;
  prompt: string;
  dependencies: string[];
  context: any;
}

export interface IntegrationPlan {
  id: string;
  componentTree: ComponentTree;
  integrations: IntegrationPrompt[];
  executionOrder: string[];
  config: IntegrationConfig;
}

export class IntegrationPromptGenerator {
  private model: ChatAnthropic;

  constructor(apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-5-sonnet-20241022',
      temperature: 0.3,
    });
  }

  /**
   * Generate integration plan from component tree
   */
  public async generateIntegrationPlan(
    componentTree: ComponentTree,
    config: IntegrationConfig
  ): Promise<IntegrationPlan> {
    const integrations: IntegrationPrompt[] = [];

    // 1. Generate Zustand stores if needed
    if (config.useStateManagement && config.stores) {
      for (const store of config.stores) {
        integrations.push(this.generateStorePrompt(store));
      }
    }

    // 2. Generate TanStack Query hooks if needed
    if (config.useDataFetching && config.queries) {
      for (const query of config.queries) {
        integrations.push(
          this.generateQueryPrompt(query, config.apiBaseUrl || '')
        );
      }
    }

    // 3. Generate React Router configuration
    if (config.useRouter && config.routes) {
      integrations.push(
        this.generateRouterPrompt(config.routes, componentTree)
      );
    }

    // 4. Generate root App.tsx with providers
    integrations.push(
      this.generateAppPrompt(config, componentTree, integrations)
    );

    // 5. Generate custom hooks for integration
    if (config.useDataFetching || config.useStateManagement) {
      integrations.push(this.generateHooksPrompt(config, integrations));
    }

    // Determine execution order (stores -> queries -> router -> app)
    const executionOrder = this.determineExecutionOrder(integrations);

    return {
      id: uuidv4(),
      componentTree,
      integrations,
      executionOrder,
      config,
    };
  }

  /**
   * Generate Zustand store prompt
   */
  private generateStorePrompt(store: StoreDefinition): IntegrationPrompt {
    const stateFields = Object.entries(store.state)
      .map(([field, type]) => `  ${field}: ${type};`)
      .join('\n');

    const prompt = `
Generate a Zustand store for state management in a React TypeScript application.

**Store Name**: ${store.name}
**Description**: ${store.description}

**State Interface**:
\`\`\`typescript
interface ${store.name}State {
${stateFields}
}
\`\`\`

**Actions**: ${store.actions.join(', ')}

**Requirements**:
1. Use Zustand \`create\` function with TypeScript
2. Include proper typing for the store
3. Implement all actions with proper state updates
4. Use immer middleware for immutable updates if complex state
5. Add selectors for commonly used state slices
6. Export the hook as \`use${store.name}\`

**Example Structure**:
\`\`\`typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface ${store.name}State {
  // state fields
  // actions
}

export const use${store.name} = create<${store.name}State>()(
  immer((set) => ({
    // initial state
    // action implementations
  }))
);
\`\`\`

Generate the complete Zustand store now.
`;

    return {
      id: uuidv4(),
      type: 'store',
      fileName: `use${store.name}.ts`,
      description: `Zustand store: ${store.name}`,
      prompt,
      dependencies: [],
      context: store,
    };
  }

  /**
   * Generate TanStack Query hook prompt
   */
  private generateQueryPrompt(
    query: QueryDefinition,
    apiBaseUrl: string
  ): IntegrationPrompt {
    const prompt = `
Generate a TanStack Query (React Query) custom hook for data fetching.

**Hook Name**: use${query.name}
**Endpoint**: ${apiBaseUrl}${query.endpoint}
**HTTP Method**: ${query.method}
**Parameters**: ${query.params?.join(', ') || 'None'}
**Used By**: ${query.usedBy.join(', ')}

**Requirements**:
1. Use TanStack Query v5 with TypeScript
2. Define proper TypeScript interfaces for request/response
3. Include error handling with proper error types
4. Add query keys for cache management
5. Include loading and error states
6. Use \`useQuery\` for GET requests
7. Use \`useMutation\` for POST/PUT/DELETE requests
8. Export the hook and related types

**Example Structure for GET**:
\`\`\`typescript
import { useQuery } from '@tanstack/react-query';

interface ${query.name}Response {
  // Define based on API response
}

export const use${query.name} = (params?: any) => {
  return useQuery({
    queryKey: ['${query.name.toLowerCase()}', params],
    queryFn: async () => {
      const response = await fetch(\`${apiBaseUrl}${query.endpoint}\`);
      if (!response.ok) throw new Error('Failed to fetch');
      return response.json() as Promise<${query.name}Response>;
    },
  });
};
\`\`\`

**Example Structure for Mutations**:
\`\`\`typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

export const use${query.name} = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('${apiBaseUrl}${query.endpoint}', {
        method: '${query.method}',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['...'] });
    },
  });
};
\`\`\`

Generate the complete TanStack Query hook now.
`;

    return {
      id: uuidv4(),
      type: 'query',
      fileName: `use${query.name}.ts`,
      description: `TanStack Query hook: ${query.name}`,
      prompt,
      dependencies: [],
      context: query,
    };
  }

  /**
   * Generate React Router configuration prompt
   */
  private generateRouterPrompt(
    routes: RouteDefinition[],
    componentTree: ComponentTree
  ): IntegrationPrompt {
    const routesList = routes
      .map(
        (r) =>
          `- Path: ${r.path}, Component: ${r.componentName}${r.protected ? ' (Protected)' : ''}`
      )
      .join('\n');

    const componentsList = Array.from(componentTree.components.values())
      .map((c) => `- ${c.componentName} (${c.fileName})`)
      .join('\n');

    const prompt = `
Generate React Router v6 configuration for a TypeScript React application.

**Routes**:
${routesList}

**Available Components**:
${componentsList}

**Requirements**:
1. Use React Router v6 with TypeScript
2. Create a router configuration using \`createBrowserRouter\`
3. Include proper route definitions with components
4. Add protected route wrapper if needed (for routes marked as protected)
5. Include error boundary and 404 page
6. Use proper types from \`react-router-dom\`
7. Export the router and RouterProvider wrapper

**Structure**:
\`\`\`typescript
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
// Import components

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <HomePage /> },
      // More routes...
    ],
  },
]);

export const AppRouter = () => <RouterProvider router={router} />;
\`\`\`

Include:
- Root layout with \`<Outlet />\`
- Protected route wrapper if needed
- Error boundary component
- 404 not found page

Generate the complete router configuration now.
`;

    return {
      id: uuidv4(),
      type: 'router',
      fileName: 'AppRouter.tsx',
      description: 'React Router configuration',
      prompt,
      dependencies: Array.from(componentTree.components.values()).map(
        (c) => c.componentName
      ),
      context: { routes, componentTree },
    };
  }

  /**
   * Generate root App.tsx with all providers
   */
  private generateAppPrompt(
    config: IntegrationConfig,
    componentTree: ComponentTree,
    integrations: IntegrationPrompt[]
  ): IntegrationPrompt {
    const hasRouter = config.useRouter;
    const hasQuery = config.useDataFetching;
    const hasStore = config.useStateManagement;

    const prompt = `
Generate the root App.tsx component that wires up all providers and routing.

**Configuration**:
- React Router: ${hasRouter ? 'Yes' : 'No'}
- TanStack Query: ${hasQuery ? 'Yes' : 'No'}
- Zustand Store: ${hasStore ? 'Yes' : 'No'}

**Requirements**:
1. Use TypeScript with proper typing
2. Set up provider hierarchy correctly
3. ${hasQuery ? 'Include QueryClientProvider with QueryClient configuration' : ''}
4. ${hasRouter ? 'Include RouterProvider with router configuration' : ''}
5. Add error boundaries
6. Include any global styles or theme providers
7. Export as default

**Provider Hierarchy** (outer to inner):
${hasQuery ? '1. QueryClientProvider' : ''}
${hasRouter ? '2. RouterProvider (or BrowserRouter)' : ''}
${hasStore ? '3. Zustand stores are hooks, no provider needed' : ''}

**Example Structure**:
\`\`\`typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './AppRouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}

export default App;
\`\`\`

Generate the complete App.tsx component now.
`;

    return {
      id: uuidv4(),
      type: 'provider',
      fileName: 'App.tsx',
      description: 'Root App component with providers',
      prompt,
      dependencies: hasRouter ? ['AppRouter'] : [],
      context: { config, integrations },
    };
  }

  /**
   * Generate custom integration hooks
   */
  private generateHooksPrompt(
    config: IntegrationConfig,
    integrations: IntegrationPrompt[]
  ): IntegrationPrompt {
    const queryHooks = integrations
      .filter((i) => i.type === 'query')
      .map((i) => i.fileName.replace('.ts', ''));
    const storeHooks = integrations
      .filter((i) => i.type === 'store')
      .map((i) => i.fileName.replace('.ts', ''));

    const prompt = `
Generate a custom hooks file that exports all data fetching and state management hooks.

**Query Hooks**: ${queryHooks.join(', ') || 'None'}
**Store Hooks**: ${storeHooks.join(', ') || 'None'}

**Requirements**:
1. Re-export all query hooks from a single location
2. Re-export all store hooks from a single location
3. Create any composite hooks that combine multiple hooks
4. Add TypeScript types for hook return values
5. Include JSDoc comments for each export

**Structure**:
\`\`\`typescript
// Data fetching hooks
${queryHooks.map((h) => `export { ${h} } from './hooks/${h}';`).join('\n')}

// State management hooks
${storeHooks.map((h) => `export { ${h} } from './stores/${h}';`).join('\n')}

// Composite hooks (examples)
export const useAppData = () => {
  // Combine multiple hooks for common use case
};
\`\`\`

Generate the complete hooks index file now.
`;

    return {
      id: uuidv4(),
      type: 'hook',
      fileName: 'hooks/index.ts',
      description: 'Custom hooks index',
      prompt,
      dependencies: [...queryHooks, ...storeHooks],
      context: { queryHooks, storeHooks },
    };
  }

  /**
   * Determine execution order for integrations
   */
  private determineExecutionOrder(
    integrations: IntegrationPrompt[]
  ): string[] {
    // Order: stores -> queries -> hooks -> router -> provider
    const order: string[] = [];

    const stores = integrations.filter((i) => i.type === 'store');
    const queries = integrations.filter((i) => i.type === 'query');
    const hooks = integrations.filter((i) => i.type === 'hook');
    const routers = integrations.filter((i) => i.type === 'router');
    const providers = integrations.filter((i) => i.type === 'provider');

    // Add in dependency order
    order.push(...stores.map((i) => i.id));
    order.push(...queries.map((i) => i.id));
    order.push(...hooks.map((i) => i.id));
    order.push(...routers.map((i) => i.id));
    order.push(...providers.map((i) => i.id));

    return order;
  }

  /**
   * Generate integration code from prompts
   */
  public async generateIntegrationCode(
    plan: IntegrationPlan
  ): Promise<Map<string, string>> {
    const generatedCode = new Map<string, string>();

    for (const integrationId of plan.executionOrder) {
      const integration = plan.integrations.find((i) => i.id === integrationId);
      if (!integration) continue;

      console.log(`Generating integration: ${integration.fileName}`);

      const response = await this.model.invoke(integration.prompt);
      const output =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      const code = this.extractCode(output);
      generatedCode.set(integration.fileName, code);
    }

    return generatedCode;
  }

  /**
   * Extract code from markdown blocks
   */
  private extractCode(output: string): string {
    const codeBlockRegex = /```(?:typescript|tsx|ts)?\\n([\\s\\S]*?)```/g;
    const matches = [...output.matchAll(codeBlockRegex)];

    if (matches.length > 0) {
      const codeBlocks = matches.map((m) => m[1]);
      return codeBlocks.reduce((longest, current) =>
        current.length > longest.length ? current : longest
      );
    }

    return output;
  }

  /**
   * Analyze component tree to infer integration needs
   */
  public async inferIntegrationConfig(
    componentTree: ComponentTree
  ): Promise<IntegrationConfig> {
    const componentNames = Array.from(componentTree.components.values())
      .map((c) => c.componentName)
      .join(', ');

    const analysisPrompt = PromptTemplate.fromTemplate(`
You are analyzing a React component tree to determine what integrations are needed.

**Components**: {components}

Analyze the components and determine:
1. Does this app need routing? (multiple pages/views)
2. Does it need state management? (complex shared state)
3. Does it need data fetching? (API calls, external data)
4. What routes might be needed?
5. What state stores might be needed?
6. What API queries might be needed?

Return as JSON:
{{
  "useRouter": boolean,
  "useStateManagement": boolean,
  "useDataFetching": boolean,
  "routes": [{{ "path": "string", "componentName": "string" }}],
  "stores": [{{ "name": "string", "description": "string", "state": {{}}, "actions": [] }}],
  "queries": [{{ "name": "string", "endpoint": "string", "method": "string", "usedBy": [] }}]
}}
`);

    const input = await analysisPrompt.format({ components: componentNames });
    const response = await this.model.invoke(input);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract JSON
    let jsonContent = content;
    const jsonMatch = content.match(/```json\\n([\\s\\S]*?)\\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    const config = JSON.parse(jsonContent);
    return config as IntegrationConfig;
  }
}
