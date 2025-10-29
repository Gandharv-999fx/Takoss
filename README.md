# Takoss - AI-Powered Full-Stack Application Builder

Takoss is an AI-powered full-stack application builder platform that generates complete web applications from natural language descriptions. The platform works by breaking down user requirements into a hierarchical tree of specific, executable substeps that guide AI models through code generation iteratively.

## Core Components

1. **Task Decomposition Engine**: Breaks down high-level app descriptions into a hierarchical tree of specific, executable tasks.
2. **Prompt Template System**: Manages templates for generating prompts for different types of application components.
3. **AI Model Integration**: Interfaces with Claude and Gemini AI models to execute the atomic tasks.

## Project Structure

```
src/
├── core/
│   ├── taskDecomposer.ts       # Core task decomposition algorithm
│   ├── promptTemplateManager.ts # Manages prompt templates
│   └── aiModelService.ts       # Integrates with LangChain and AI models
├── templates/
│   └── promptTemplates.ts      # Collection of prompt templates
├── types/
│   └── interfaces.ts           # TypeScript interfaces
└── index.ts                    # Demo application
```

## Key Features

- **Recursive Task Decomposition**: Breaks down complex tasks until reaching atomic, executable prompts
- **Hierarchical Task Tree**: Organizes tasks in a structured tree for better management
- **Prompt Template System**: Reusable templates for common application components
- **LangChain Integration**: Leverages LangChain for AI model interaction
- **TypeScript Type Safety**: Strong typing throughout the codebase

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```

2. Build the project:
   ```
   npm run build
   ```

3. Run the demo:
   ```
   npm start
   ```

## Usage Example

```typescript
// Initialize components
const promptManager = new PromptTemplateManager(promptTemplates);
const aiService = new AIModelService(promptManager, process.env.CLAUDE_API_KEY);
const taskDecomposer = new TaskDecomposer(config, promptManager);

// Create a subtask tree from app requirements
const appTree = await taskDecomposer.createSubtaskTree(
  'My App',
  'App description',
  requirements
);

// Find atomic tasks that can be executed by AI models
const atomicTasks = taskDecomposer.findAtomicTasks(appTree);

// Execute tasks with AI models
for (const task of atomicTasks) {
  const result = await aiService.executeTask(task);
  taskDecomposer.updateTaskStatus(appTree, task.id, 'completed', result);
}
```

## License

MIT