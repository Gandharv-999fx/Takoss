import { PrismaClient } from '@prisma/client';
import { RequirementsAnalyzer } from '../analysis/requirementsAnalyzer';
import { ComplexityEstimator } from '../analysis/complexityEstimator';
import { ComponentDecomposer } from '../generation/frontend/componentDecomposer';
import { DatabaseSchemaEvolution } from '../generation/backend/databaseSchemaEvolution';
import { APIEndpointDecomposer } from '../generation/backend/apiEndpointDecomposer';
import { DeploymentTaskDecomposer } from '../deployment/deploymentTaskDecomposer';
import { PromptChainVisualizer } from '../visualization/promptChainVisualizer';
import { ExplainabilityLayer } from '../visualization/explainabilityLayer';
import { ModelSelector, ModelSelectionStrategy, createModelSelector } from '../core/modelSelector';
import { ModelName } from '../types/modelConfig';

/**
 * Simplified Takoss Orchestrator - Demonstrates integration of all components
 */

export interface ProjectRequest {
  projectName: string;
  description: string;
  requirements: string;
  modelStrategy?: ModelSelectionStrategy; // 'default', 'cost-optimized', 'quality-optimized', 'custom'
  customModels?: {
    requirementsAnalysis?: ModelName;
    schemaGeneration?: ModelName;
    componentGeneration?: ModelName;
    apiGeneration?: ModelName;
    deploymentGeneration?: ModelName;
  };
}

export interface GenerationResult {
  success: boolean;
  projectId: string;
  phases: {
    analysis?: any;
    complexity?: any;
    database?: {
      schema?: string;
      entitiesCount: number;
    };
    frontend?: {
      componentCount: number;
      components?: Array<{ id: string; name: string; code: string; fileName: string }>;
    };
    backend?: {
      routes?: Array<{ path: string; code: string }>;
    };
    deployment?: {
      ready: boolean;
      dockerFile?: string;
      dockerCompose?: string;
      dockerIgnore?: string;
    };
  };
  modelsUsed?: {
    requirementsAnalysis?: ModelName;
    schemaGeneration?: ModelName;
    componentGeneration?: ModelName;
    apiGeneration?: ModelName;
    deploymentGeneration?: ModelName;
  };
  estimatedCost?: number;
  visualization?: string;
  explanation?: any;
}

export class SimpleTakossOrchestrator {
  private prisma: PrismaClient;
  private claudeApiKey: string;
  private geminiApiKey: string;
  private complexityEstimator: ComplexityEstimator;
  private visualizer: PromptChainVisualizer;

  constructor(apiKey?: string) {
    this.claudeApiKey = apiKey || process.env.CLAUDE_API_KEY || '';
    this.geminiApiKey = process.env.GEMINI_API_KEY || '';
    this.prisma = new PrismaClient();
    this.complexityEstimator = new ComplexityEstimator();
    this.visualizer = new PromptChainVisualizer();
  }

  public async generateApplication(request: ProjectRequest): Promise<GenerationResult> {
    const projectId = `proj-${Date.now()}`;
    const phases: GenerationResult['phases'] = {};

    // Initialize model selector
    const modelSelector = request.customModels
      ? new ModelSelector({
          strategy: 'custom',
          customPreferences: request.customModels,
        })
      : request.modelStrategy && ['default', 'cost-optimized', 'quality-optimized'].includes(request.modelStrategy)
      ? createModelSelector(request.modelStrategy as 'default' | 'cost-optimized' | 'quality-optimized')
      : createModelSelector('default');

    const modelSelections = modelSelector.getProjectModelSelections();
    const selectionSummary = modelSelector.getSelectionSummary();

    console.log(`\n🚀 Generating: ${request.projectName}`);
    console.log(`\n🤖 Model Selection Strategy: ${request.modelStrategy || 'default'}`);
    console.log(`\n📊 Models Selected:`);
    selectionSummary.forEach((selection) => {
      console.log(`   ${selection.taskType}: ${selection.model} (${selection.provider}, ${selection.quality})`);
    });

    try {
      // Create instances with the selected model
      const requirementsModel = modelSelections.requirementsAnalysis;
      const apiKey = requirementsModel.includes('gemini') ? this.geminiApiKey : this.claudeApiKey;
      const requirementsAnalyzer = new RequirementsAnalyzer(apiKey, requirementsModel);

      // Phase 1: Analysis
      console.log('\n📋 Phase 1: Requirements Analysis...');
      const analysisResult = await requirementsAnalyzer.analyzeRequirements(
        request.requirements
      );
      phases.analysis = analysisResult;
      console.log(`✓ Found ${analysisResult.requirements.entities.length} entities`);

      // Phase 2: Complexity Estimation
      console.log('\n🧮 Phase 2: Complexity Estimation...');
      const complexity = this.complexityEstimator.estimateRequirementsComplexity(
        analysisResult.requirements
      );
      phases.complexity = complexity;
      console.log(`✓ Complexity Score: ${complexity.totalScore}`);

      // Phase 3: Database Schema
      console.log('\n🗄️  Phase 3: Database Schema...');

      const schemaModel = modelSelections.schemaGeneration;
      const schemaApiKey = schemaModel.includes('gemini') ? this.geminiApiKey : this.claudeApiKey;
      const schemaEvolution = new DatabaseSchemaEvolution(schemaApiKey, schemaModel);

      // Generate Prisma schema from entities and relationships
      const schemaStep = schemaEvolution.generateInitialSchema(
        analysisResult.requirements.entities,
        analysisResult.requirements.relationships
      );

      // Generate complete Prisma schema file
      let schemaFile = schemaEvolution.generateSchemaFile(schemaStep);

      // Optionally refine schema with AI suggestions
      try {
        console.log('  Refining schema with AI...');
        schemaFile = await schemaEvolution.refineSchema(schemaFile);
      } catch (error) {
        console.log('  Using base schema (refinement skipped)');
      }

      phases.database = {
        schema: schemaFile,
        entitiesCount: analysisResult.requirements.entities.length,
      };

      console.log(`✓ Generated schema for ${schemaStep.models.length} models`);

      // Phase 4: Frontend Components
      console.log('\n🎨 Phase 4: Frontend Components...');
      const allComponents: Array<{ id: string; name: string; code: string; fileName: string }> = [];

      const componentModel = modelSelections.componentGeneration;
      const componentApiKey = componentModel.includes('gemini') ? this.geminiApiKey : this.claudeApiKey;
      const componentDecomposer = new ComponentDecomposer(componentApiKey, componentModel);

      // Generate components for ALL UI requirements (not just the first one)
      for (const uiReq of analysisResult.requirements.uiRequirements) {
        console.log(`  Generating components for: ${uiReq.component}`);
        const componentMap = await componentDecomposer.generateComponentsFromRequirement(uiReq);

        // Get component chain to map IDs to names and file names
        const chain = await componentDecomposer['decomposeUIRequirement'](uiReq);

        // Store the actual generated code
        componentMap.forEach((code, id) => {
          const compPrompt = chain.components.find((c) => c.id === id);
          if (compPrompt) {
            allComponents.push({
              id,
              name: compPrompt.componentName,
              code,
              fileName: compPrompt.fileName,
            });
          }
        });
      }

      phases.frontend = {
        componentCount: allComponents.length,
        components: allComponents
      };
      console.log(`✓ Generated ${allComponents.length} component(s)`);

      // Phase 5: Backend API
      console.log('\n⚙️  Phase 5: Backend API...');

      const apiModel = modelSelections.apiGeneration;
      const apiApiKey = apiModel.includes('gemini') ? this.geminiApiKey : this.claudeApiKey;
      const apiDecomposer = new APIEndpointDecomposer(apiApiKey, apiModel);

      // Decompose entities and features into API endpoints
      const apiPlan = await apiDecomposer.decomposeToEndpoints(
        analysisResult.requirements.entities,
        analysisResult.requirements.features,
        analysisResult.requirements.relationships
      );

      // Generate code for each endpoint
      const routes: Array<{ path: string; code: string }> = [];
      for (const endpointPrompt of apiPlan.prompts) {
        console.log(`  Generating endpoint: ${endpointPrompt.endpointDef.method} ${endpointPrompt.endpointDef.path}`);
        const code = await apiDecomposer.generateEndpointCode(endpointPrompt);
        routes.push({
          path: `/handlers/${endpointPrompt.fileName}`,
          code,
        });
      }

      // Generate main router file
      const routerCode = apiDecomposer.generateAPIRouter(apiPlan);
      routes.push({
        path: '/router.ts',
        code: routerCode,
      });

      phases.backend = {
        routes,
      };

      console.log(`✓ Generated ${routes.length} route file(s)`);

      // Phase 6: Deployment Config
      console.log('\n🚢 Phase 6: Deployment...');

      const deploymentModel = modelSelections.deploymentGeneration;
      const deploymentApiKey = deploymentModel.includes('gemini') ? this.geminiApiKey : this.claudeApiKey;
      const deploymentDecomposer = new DeploymentTaskDecomposer(deploymentApiKey, deploymentModel);

      // Generate deployment configurations
      const deploymentPlan = await deploymentDecomposer.generateDeploymentPlan({
        appName: request.projectName,
        hasBackend: true,
        hasFrontend: phases.frontend?.componentCount ? phases.frontend.componentCount > 0 : false,
        hasDatabase: phases.database?.entitiesCount ? phases.database.entitiesCount > 0 : false,
        databaseType: 'postgresql',
        hasRedis: false,
        platform: 'docker',
        nodeVersion: '18',
      });

      // Extract deployment artifacts
      const dockerFile = deploymentPlan.artifacts.find((a) => a.type === 'dockerfile')?.content;
      const dockerCompose = deploymentPlan.artifacts.find((a) => a.type === 'compose')?.content;
      const dockerIgnore = deploymentPlan.artifacts.find((a) => a.fileName === '.dockerignore')?.content;

      phases.deployment = {
        ready: true,
        dockerFile,
        dockerCompose,
        dockerIgnore,
      };

      console.log(`✓ Generated ${deploymentPlan.artifacts.length} deployment file(s)`);

      // Generate visualization
      console.log('\n📊 Generating Visualization...');
      const tasks = [
        { id: '1', type: 'Analysis', dependencies: [], status: 'completed' },
        { id: '2', type: 'Complexity', dependencies: ['1'], status: 'completed' },
        { id: '3', type: 'Database', dependencies: ['2'], status: 'completed' },
        { id: '4', type: 'Frontend', dependencies: ['3'], status: 'completed' },
        { id: '5', type: 'Backend', dependencies: ['3'], status: 'completed' },
        { id: '6', type: 'Deployment', dependencies: ['4', '5'], status: 'completed' },
      ];
      const visualization = this.visualizer.visualizeExecutionPlan(tasks);
      const htmlViz = this.visualizer.generateHTMLVisualization(
        visualization,
        `${request.projectName} Generation`
      );

      // Generate explanation (temporarily disabled after refactoring)
      // const explanation = await explainabilityService.explainProject({
      //   name: request.projectName,
      //   description: request.description,
      //   features: analysisResult.requirements.features.map((f) => f.name),
      //   technologies: ['React', 'Node.js', 'Prisma', 'PostgreSQL'],
      // });
      const explanation = null;

      // Calculate estimated cost
      const estimatedCost = modelSelector.estimateProjectCost({
        requirementsAnalysis: { input: 2000, output: 1000 },
        schemaGeneration: { input: 3000, output: 1500 },
        componentGeneration: { input: 5000, output: 3000 },
        apiGeneration: { input: 4000, output: 2500 },
        deploymentGeneration: { input: 2000, output: 1000 },
        refinement: { input: 3000, output: 1500 },
      });

      console.log(`\n💰 Estimated Cost: $${estimatedCost.toFixed(4)}`);
      console.log('\n✅ Generation Complete!\n');

      return {
        success: true,
        projectId,
        phases,
        modelsUsed: {
          requirementsAnalysis: modelSelections.requirementsAnalysis,
          schemaGeneration: modelSelections.schemaGeneration,
          componentGeneration: modelSelections.componentGeneration,
          apiGeneration: modelSelections.apiGeneration,
          deploymentGeneration: modelSelections.deploymentGeneration,
        },
        estimatedCost,
        visualization: htmlViz,
        explanation,
      };
    } catch (error: any) {
      console.error('❌ Generation failed:', error.message);
      return {
        success: false,
        projectId,
        phases,
      };
    }
  }

  public async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
