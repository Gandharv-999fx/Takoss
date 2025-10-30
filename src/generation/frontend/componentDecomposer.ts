import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { UIRequirement } from '../../analysis/requirementsAnalyzer';
import { TaskNode } from '../../types/interfaces';
import { v4 as uuidv4 } from 'uuid';

/**
 * Component Decomposition Agent - Breaks UI requirements into component-level prompts
 * Generates detailed React component prompts with TypeScript, Tailwind, and Shadcn UI
 */

export interface ComponentPrompt {
  id: string;
  componentName: string;
  fileName: string; // e.g., "DashboardLayout.tsx"
  description: string;
  prompt: string;
  dependencies: string[]; // Other components this depends on
  props?: ComponentProps;
  styling: {
    framework: 'tailwind' | 'styled-components' | 'css-modules';
    theme?: string;
  };
  category: 'layout' | 'data-display' | 'input' | 'feedback' | 'navigation' | 'utility';
}

export interface ComponentProps {
  name: string; //  Props interface name
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
}

export interface ComponentPromptChain {
  id: string;
  uiRequirement: UIRequirement;
  components: ComponentPrompt[];
  executionOrder: string[]; // Component IDs in dependency order
  integrationNeeded: boolean;
}

export class ComponentDecomposer {
  private model: ChatAnthropic;

  constructor(apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-5-sonnet-20241022',
      temperature: 0.3,
    });
  }

  /**
   * Decompose UI requirement into component-level prompts
   */
  public async decomposeUIRequirement(
    uiRequirement: UIRequirement
  ): Promise<ComponentPromptChain> {
    const decompositionPrompt = PromptTemplate.fromTemplate(`
You are an expert React architect. Break down this UI requirement into individual React components.

**UI Requirement:**
- Component Type: {componentType}
- Description: {description}
- Features: {features}
- Layout: {layout}

For each component, provide:
1. Component name (PascalCase)
2. File name (e.g., ComponentName.tsx)
3. Description of what it does
4. Category (layout/data-display/input/feedback/navigation/utility)
5. Props interface definition
6. Dependencies on other components

Return as JSON array:
[
  {{
    "componentName": "string",
    "fileName": "string",
    "description": "string",
    "category": "string",
    "props": {{ "name": "string", "fields": [{{ "name": "string", "type": "string", "required": boolean }}] }},
    "dependencies": ["string"]
  }}
]
`);

    const input = await decompositionPrompt.format({
      componentType: uiRequirement.component,
      description: uiRequirement.description,
      features: uiRequirement.features?.join(', ') || 'None',
      layout: uiRequirement.layout || 'Not specified',
    });

    const response = await this.model.invoke(input);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // Extract JSON from response
    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    const componentsData = JSON.parse(jsonContent);

    // Generate component prompts
    const components: ComponentPrompt[] = componentsData.map((comp: any) => {
      const prompt = this.generateComponentPrompt(comp, uiRequirement);

      return {
        id: uuidv4(),
        componentName: comp.componentName,
        fileName: comp.fileName,
        description: comp.description,
        prompt,
        dependencies: comp.dependencies || [],
        props: comp.props,
        styling: {
          framework: 'tailwind',
        },
        category: comp.category,
      };
    });

    // Determine execution order based on dependencies
    const executionOrder = this.determineExecutionOrder(components);

    return {
      id: uuidv4(),
      uiRequirement,
      components,
      executionOrder,
      integrationNeeded: components.length > 1,
    };
  }

  /**
   * Generate detailed component prompt with design specifications
   */
  private generateComponentPrompt(
    componentData: any,
    uiRequirement: UIRequirement
  ): string {
    const { componentName, description, props, category } = componentData;

    // Build props interface string
    let propsInterface = '';
    if (props && props.fields) {
      propsInterface = `
interface ${props.name} {
${props.fields
  .map(
    (field: any) =>
      `  ${field.name}${field.required ? '' : '?'}: ${field.type};${field.description ? ` // ${field.description}` : ''}`
  )
  .join('\n')}
}
`;
    }

    const prompt = `
You are an expert React developer with TypeScript expertise. Create a professional React component.

**Component Specifications:**
- **Name**: ${componentName}
- **Purpose**: ${description}
- **Category**: ${category}
- **File**: ${componentData.fileName}

**Requirements:**

1. **TypeScript**: Use strict typing with interfaces
2. **Styling**: Use Tailwind CSS utility classes (Shadcn UI compatible)
3. **Props Interface**: ${props ? `Define as shown below` : 'Define based on component needs'}
4. **State Management**: Use React hooks (useState, useEffect, etc.)
5. **Accessibility**: Include proper ARIA attributes
6. **Responsive**: Mobile-first responsive design
7. **Best Practices**: Follow React and TypeScript best practices

${props ? `**Props Interface:**\n\`\`\`typescript\n${propsInterface}\n\`\`\`\n` : ''}

**Design Tokens (Tailwind):**
- Primary colors: blue-600, blue-700
- Secondary: gray-100, gray-200, gray-600
- Text: gray-900 (headings), gray-700 (body)
- Spacing: p-4, p-6, gap-4
- Borders: border, rounded-lg
- Shadows: shadow-sm, shadow-md

**Component Structure:**
1. Import statements (React, types, dependencies)
2. Props interface definition
3. Component function with proper typing
4. State hooks if needed
5. Effect hooks if needed
6. Helper functions
7. Return JSX with Tailwind classes
8. Export statement

**Additional Context:**
- This is part of: ${uiRequirement.component}
- Related features: ${uiRequirement.features?.join(', ') || 'None'}

Generate the complete, production-ready component code now.
`;

    return prompt;
  }

  /**
   * Determine execution order based on component dependencies
   */
  private determineExecutionOrder(components: ComponentPrompt[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();

    const visit = (comp: ComponentPrompt) => {
      if (visited.has(comp.id)) return;

      // Visit dependencies first
      comp.dependencies.forEach((depName) => {
        const depComp = components.find((c) => c.componentName === depName);
        if (depComp && !visited.has(depComp.id)) {
          visit(depComp);
        }
      });

      visited.add(comp.id);
      order.push(comp.id);
    };

    // Visit all components
    components.forEach((comp) => visit(comp));

    return order;
  }

  /**
   * Generate component from prompt
   */
  public async generateComponent(componentPrompt: ComponentPrompt): Promise<string> {
    const response = await this.model.invoke(componentPrompt.prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // Extract code from markdown code blocks
    const codeMatch = content.match(/```(?:typescript|tsx|ts)?\n([\s\S]*?)```/);
    if (codeMatch) {
      return codeMatch[1];
    }

    return content;
  }

  /**
   * Generate multiple components from UI requirement
   */
  public async generateComponentsFromRequirement(
    uiRequirement: UIRequirement
  ): Promise<Map<string, string>> {
    // Decompose into component prompts
    const chain = await this.decomposeUIRequirement(uiRequirement);

    const generatedComponents = new Map<string, string>();

    // Generate components in dependency order
    for (const compId of chain.executionOrder) {
      const compPrompt = chain.components.find((c) => c.id === compId);
      if (!compPrompt) continue;

      // Add dependency code as context
      let contextCode = '';
      for (const depName of compPrompt.dependencies) {
        const depComp = chain.components.find((c) => c.componentName === depName);
        if (depComp && generatedComponents.has(depComp.id)) {
          contextCode += `\n// ${depName} component (dependency):\n`;
          contextCode += generatedComponents.get(depComp.id);
          contextCode += '\n\n';
        }
      }

      // Add context to prompt if dependencies exist
      let enhancedPrompt = compPrompt.prompt;
      if (contextCode) {
        enhancedPrompt += `\n\n**Dependency Components (for reference):**\n\`\`\`typescript\n${contextCode}\n\`\`\`\n`;
        enhancedPrompt += '\nUse these components and their interfaces appropriately.';
      }

      const code = await this.generateComponent({
        ...compPrompt,
        prompt: enhancedPrompt,
      });

      generatedComponents.set(compPrompt.id, code);
    }

    return generatedComponents;
  }

  /**
   * Create component as TaskNode for integration with task decomposer
   */
  public createComponentTask(componentPrompt: ComponentPrompt): TaskNode {
    return {
      id: componentPrompt.id,
      title: `Generate ${componentPrompt.componentName}`,
      description: componentPrompt.description,
      status: 'pending',
      type: 'component',
      children: [],
      prompt: componentPrompt.prompt,
      promptTemplate: 'react-component',
      dependencies: componentPrompt.dependencies,
      metadata: {
        componentName: componentPrompt.componentName,
        fileName: componentPrompt.fileName,
        category: componentPrompt.category,
        props: componentPrompt.props,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
