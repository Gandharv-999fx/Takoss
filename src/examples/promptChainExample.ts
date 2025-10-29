import { PromptChainOrchestrator } from '../core/promptChainOrchestrator';
import { SubtaskTree, TaskNode } from '../types/interfaces';
import { v4 as uuidv4 } from 'uuid';

// Example of creating a subtask tree for a simple web app
async function createExampleSubtaskTree(): Promise<{ root: TaskNode }> {
  // Create root task
  const rootTask: TaskNode = {
    id: uuidv4(),
    title: 'Build a simple Todo App',
    description: 'Create a full-stack Todo application with React frontend and Node.js backend',
    type: 'other',
    status: 'pending',
    children: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Frontend tasks
  const frontendTask: TaskNode = {
    id: uuidv4(),
    title: 'Create React Frontend',
    description: 'Build a React frontend for the Todo app',
    type: 'feature',
    status: 'pending',
    children: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Component tasks
  const componentTasks: TaskNode[] = [
    {
      id: uuidv4(),
      title: 'Create TodoList Component',
      description: 'Create a component to display the list of todos',
      type: 'component',
      status: 'pending',
      children: [],
      promptTemplate: 'component_template',
      promptVariables: {
        componentDescription: `Create a React component for displaying a list of todos. 
        The component should:
        1. Accept an array of todo items as props
        2. Display each todo with its title and completion status
        3. Allow marking todos as complete
        4. Allow deleting todos
        
        Use TypeScript and functional components with hooks.`
      },
      metadata: { preferredModel: 'claude' },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: uuidv4(),
      title: 'Create TodoForm Component',
      description: 'Create a form component for adding new todos',
      type: 'component',
      status: 'pending',
      children: [],
      promptTemplate: 'component_template',
      promptVariables: {
        componentDescription: `Create a React form component for adding new todos.
        The component should:
        1. Have an input field for the todo title
        2. Have a submit button
        3. Call a function passed via props to add the new todo
        4. Clear the input field after submission
        
        Use TypeScript and functional components with hooks.`
      },
      metadata: { preferredModel: 'gemini' },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // Backend tasks
  const backendTask: TaskNode = {
    id: uuidv4(),
    title: 'Create Node.js Backend',
    description: 'Build a Node.js backend for the Todo app',
    type: 'feature',
    status: 'pending',
    children: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // API endpoint tasks
  const apiTasks: TaskNode[] = [
    {
      id: uuidv4(),
      title: 'Create Todo Model',
      description: 'Create a data model for todos',
      type: 'schema',
      status: 'pending',
      children: [],
      promptTemplate: 'model_template',
      promptVariables: {
        modelDescription: `Create a Todo model using TypeScript.
        The model should have:
        1. An id field (string)
        2. A title field (string)
        3. A completed field (boolean)
        4. A createdAt field (Date)
        
        Export the interface and any helper functions needed.`
      },
      metadata: { preferredModel: 'claude' },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: uuidv4(),
      title: 'Create Todo API Routes',
      description: 'Create API routes for CRUD operations on todos',
      type: 'function',
      status: 'pending',
      children: [],
      promptTemplate: 'api_template',
      promptVariables: {
        apiDescription: `Create Express.js routes for a Todo API with the following endpoints:
        1. GET /api/todos - Get all todos
        2. GET /api/todos/:id - Get a specific todo
        3. POST /api/todos - Create a new todo
        4. PUT /api/todos/:id - Update a todo
        5. DELETE /api/todos/:id - Delete a todo
        
        Use TypeScript and implement proper error handling.`
      },
      metadata: { 
        preferredModel: 'gemini',
        dependencies: [] // Will be filled with the Todo model task ID
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // Integration task
  const integrationTask: TaskNode = {
    id: uuidv4(),
    title: 'Integrate Frontend and Backend',
    description: 'Connect the React frontend with the Node.js backend',
    type: 'integration',
    status: 'pending',
    children: [],
    promptTemplate: 'integration_template',
    promptVariables: {
      integrationDescription: `Create integration code to connect the React frontend with the Node.js backend.
      Include:
      1. API client setup with Axios
      2. Error handling
      3. Loading states
      
      Ensure the Todo components can perform CRUD operations via the API.`
    },
    metadata: { 
      preferredModel: 'claude',
      dependencies: [] // Will be filled with component and API task IDs
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Set up dependencies
  apiTasks[1].dependencies = [apiTasks[0].id]; // API routes depend on Todo model
  integrationTask.dependencies = [
    componentTasks[0].id,
    componentTasks[1].id,
    apiTasks[1].id
  ];

  // Build the tree
  frontendTask.children = componentTasks.map(task => task.id);
  backendTask.children = apiTasks.map(task => task.id);
  rootTask.children = [frontendTask.id, backendTask.id, integrationTask.id];

  // Set up dependencies
  if (apiTasks[1].metadata && apiTasks[1].metadata.dependencies) {
    apiTasks[1].metadata.dependencies = [apiTasks[0].id]; // API routes depend on Todo model
  }
  
  if (integrationTask.metadata && integrationTask.metadata.dependencies) {
    integrationTask.metadata.dependencies = [
      componentTasks[0].id,
      componentTasks[1].id,
      apiTasks[1].id
    ];
  }

  // Create a map of all tasks for easy lookup
  const allTasks: Record<string, TaskNode> = {
    [rootTask.id]: rootTask,
    [frontendTask.id]: frontendTask,
    [backendTask.id]: backendTask,
    [integrationTask.id]: integrationTask,
    ...componentTasks.reduce((acc, task) => ({ ...acc, [task.id]: task }), {}),
    ...apiTasks.reduce((acc, task) => ({ ...acc, [task.id]: task }), {})
  };

  return {
    root: rootTask,
    allTasks
  };
}

// Example of using the orchestrator
async function runExample() {
  try {
    console.log('Starting prompt chain example...');

    // Create the orchestrator
    const orchestrator = new PromptChainOrchestrator({
      redisUrl: 'redis://localhost:6379',
      concurrency: 2,
      maxRetries: 2,
      defaultTimeout: 60000,
      socketEnabled: true,
      socketPort: 3001,
      modelConfig: {
        claude: {
          apiKey: process.env.ANTHROPIC_API_KEY || 'your-anthropic-api-key'
        },
        gemini: {
          apiKey: process.env.GOOGLE_API_KEY || 'your-google-api-key'
        }
      }
    });

    // Create a subtask tree
    const subtaskTree = await createExampleSubtaskTree();
    console.log('Created subtask tree with root task:', subtaskTree.root.title);

    // Create a new chain
    const chainId = await orchestrator.createChain('Todo App Builder', subtaskTree);
    console.log('Created chain with ID:', chainId);
    
    // Monitor progress
    orchestrator.on('progress', (update) => {
      console.log(`Task ${update.taskId} progress: ${update.progress}%`);
    });

    orchestrator.on('stateUpdate', (state) => {
      console.log(`Chain state updated: ${state.status}`);
      console.log(`Completed tasks: ${state.completedTasks}/${state.totalTasks}`);
    });

    // Execute the chain
    console.log('Executing chain...');
    await orchestrator.executeChain(chainId);
    
    // Wait for completion
    await new Promise<void>((resolve) => {
      orchestrator.on('chainComplete', (chainId) => {
        console.log(`Chain ${chainId} completed!`);
        resolve();
      });
    });

    // Cleanup
    await orchestrator.shutdown();

  } catch (error) {
    console.error('Error running example:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}

export { runExample, createExampleSubtaskTree };