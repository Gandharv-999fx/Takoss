import { TaskDecomposer } from './core/taskDecomposer';
import { PromptTemplateManager } from './core/promptTemplateManager';
import { ModelService } from './core/modelService';
import { promptTemplates } from './templates/promptTemplates';
import { AppRequirement, TaskDecompositionConfig } from './types/interfaces';
import { v4 as uuidv4 } from 'uuid';

// Demo function to showcase the task decomposition engine
async function runDemo() {
  console.log('🚀 Starting Takoss Task Decomposition Engine Demo');

  // Initialize the prompt template manager with our templates
  const promptManager = new PromptTemplateManager(promptTemplates);
  console.log(`📝 Loaded ${promptTemplates.length} prompt templates`);

  // Initialize the AI model service
  const modelService = new ModelService();
  
  // Configure the task decomposer
  const config: TaskDecompositionConfig = {
    maxDepth: 3,
    minTaskSize: 1,
    defaultPromptTemplates: {
      'feature': promptTemplates[6].id, // Task Decomposition template
      'component': promptTemplates[0].id, // React Component template
      'function': promptTemplates[2].id, // Express API Route template
      'schema': promptTemplates[3].id, // Prisma Schema template
      'test': promptTemplates[5].id, // Unit Tests template
      'style': promptTemplates[0].id, // React Component template (for styling)
      'other': promptTemplates[6].id // Task Decomposition template
    },
    modelConfig: {
      type: 'claude',
      temperature: 0.7,
      maxTokens: 2000
    }
  };
  
  // Initialize the task decomposer
  const taskDecomposer = new TaskDecomposer(config, promptManager);
  
  // Sample app requirements for a CRM system
  const crmRequirements: AppRequirement[] = [
    {
      id: uuidv4(),
      description: 'User authentication with email and password',
      type: 'feature',
      priority: 'high'
    },
    {
      id: uuidv4(),
      description: 'User profile management with avatar upload',
      type: 'feature',
      priority: 'medium'
    },
    {
      id: uuidv4(),
      description: 'Customer database with search and filtering',
      type: 'feature',
      priority: 'high'
    },
    {
      id: uuidv4(),
      description: 'Contact management for each customer',
      type: 'feature',
      priority: 'high'
    },
    {
      id: uuidv4(),
      description: 'Sales pipeline tracking with drag-and-drop interface',
      type: 'feature',
      priority: 'medium'
    },
    {
      id: uuidv4(),
      description: 'Dashboard with key metrics and charts',
      type: 'feature',
      priority: 'medium'
    },
    {
      id: uuidv4(),
      description: 'Email integration for customer communication',
      type: 'feature',
      priority: 'low'
    },
    {
      id: uuidv4(),
      description: 'Task and reminder system',
      type: 'feature',
      priority: 'medium'
    },
    {
      id: uuidv4(),
      description: 'Reporting and analytics',
      type: 'feature',
      priority: 'low'
    }
  ];
  
  // Create a subtask tree for the CRM system
  console.log('🔍 Decomposing CRM application requirements...');
  const crmTree = await taskDecomposer.createSubtaskTree(
    'CRM System',
    'A customer relationship management system with user authentication',
    crmRequirements
  );
  
  // Print the tree structure
  console.log('\n📊 Task Decomposition Tree:');
  printTaskTree(crmTree.tasks, crmTree.rootTaskId, 0);
  
  // Find atomic tasks
  const atomicTasks = taskDecomposer.findAtomicTasks(crmTree);
  console.log(`\n⚛️ Found ${atomicTasks.length} atomic tasks that can be executed by AI models`);
  
  // Print some example atomic tasks
  console.log('\n📋 Example Atomic Tasks:');
  atomicTasks.slice(0, 3).forEach((task, index) => {
    console.log(`\nTask ${index + 1}: ${task.title}`);
    console.log(`Description: ${task.description}`);
    console.log(`Type: ${task.type}`);
    console.log(`Prompt Template: ${task.promptTemplate}`);
    
    if (task.promptTemplate) {
      const template = promptManager.getTemplate(task.promptTemplate);
      if (template) {
        console.log(`Template Name: ${template.name}`);
        console.log(`Template Category: ${template.category}`);
      }
    }
  });
  
  console.log('\n✅ Demo completed successfully!');
  console.log('In a real application, these atomic tasks would be sent to AI models for code generation.');
}

// Helper function to print the task tree
function printTaskTree(tasks: Record<string, any>, taskId: string, depth: number) {
  const task = tasks[taskId];
  const indent = '  '.repeat(depth);
  console.log(`${indent}📌 ${task.title} (${task.type})`);
  
  for (const childId of task.children) {
    printTaskTree(tasks, childId, depth + 1);
  }
}

// Run the demo
runDemo().catch(error => {
  console.error('❌ Error running demo:', error);
});