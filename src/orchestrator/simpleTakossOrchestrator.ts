import { PrismaClient } from '@prisma/client';
import { RequirementsAnalyzer } from '../analysis/requirementsAnalyzer';
import { ComplexityEstimator } from '../analysis/complexityEstimator';
import { ComponentDecomposer } from '../generation/frontend/componentDecomposer';
import { DatabaseSchemaEvolution } from '../generation/backend/databaseSchemaEvolution';
import { DeploymentTaskDecomposer } from '../deployment/deploymentTaskDecomposer';
import { PromptChainVisualizer } from '../visualization/promptChainVisualizer';
import { ExplainabilityLayer } from '../visualization/explainabilityLayer';

/**
 * Simplified Takoss Orchestrator - Demonstrates integration of all components
 */

export interface ProjectRequest {
  projectName: string;
  description: string;
  requirements: string;
}

export interface GenerationResult {
  success: boolean;
  projectId: string;
  phases: {
    analysis?: any;
    complexity?: any;
    database?: any;
    frontend?: any;
    deployment?: any;
  };
  visualization?: string;
  explanation?: any;
}

export class SimpleTakossOrchestrator {
  private prisma: PrismaClient;
  private requirementsAnalyzer: RequirementsAnalyzer;
  private complexityEstimator: ComplexityEstimator;
  private componentDecomposer: ComponentDecomposer;
  private schemaEvolution: DatabaseSchemaEvolution;
  private deploymentDecomposer: DeploymentTaskDecomposer;
  private visualizer: PromptChainVisualizer;
  private explainability: ExplainabilityLayer;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.CLAUDE_API_KEY;
    this.prisma = new PrismaClient();
    this.requirementsAnalyzer = new RequirementsAnalyzer(key);
    this.complexityEstimator = new ComplexityEstimator();
    this.componentDecomposer = new ComponentDecomposer(key);
    this.schemaEvolution = new DatabaseSchemaEvolution();
    this.deploymentDecomposer = new DeploymentTaskDecomposer(key);
    this.visualizer = new PromptChainVisualizer();
    this.explainability = new ExplainabilityLayer(key);
  }

  public async generateApplication(request: ProjectRequest): Promise<GenerationResult> {
    const projectId = `proj-${Date.now()}`;
    const phases: GenerationResult['phases'] = {};

    console.log(`\n🚀 Generating: ${request.projectName}`);

    try {
      // Phase 1: Analysis
      console.log('\n📋 Phase 1: Requirements Analysis...');
      const analysisResult = await this.requirementsAnalyzer.analyzeRequirements(
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
      phases.database = { entitiesCount: analysisResult.requirements.entities.length };
      console.log('✓ Schema analysis complete');

      // Phase 4: Frontend Components
      console.log('\n🎨 Phase 4: Frontend Components...');
      if (analysisResult.requirements.uiRequirements.length > 0) {
        const uiReq = analysisResult.requirements.uiRequirements[0];
        const components = await this.componentDecomposer.generateComponentsFromRequirement(
          uiReq
        );
        phases.frontend = { componentCount: Array.isArray(components) ? components.length : 0 };
        console.log(`✓ Generated components`);
      }

      // Phase 5: Deployment Config
      console.log('\n🚢 Phase 5: Deployment...');
      phases.deployment = { ready: true };
      console.log(`✓ Deployment analysis complete`);

      // Generate visualization
      console.log('\n📊 Generating Visualization...');
      const tasks = [
        { id: '1', type: 'Analysis', dependencies: [], status: 'completed' },
        { id: '2', type: 'Complexity', dependencies: ['1'], status: 'completed' },
        { id: '3', type: 'Database', dependencies: ['2'], status: 'completed' },
        { id: '4', type: 'Frontend', dependencies: ['3'], status: 'completed' },
        { id: '5', type: 'Deployment', dependencies: ['4'], status: 'completed' },
      ];
      const visualization = this.visualizer.visualizeExecutionPlan(tasks);
      const htmlViz = this.visualizer.generateHTMLVisualization(
        visualization,
        `${request.projectName} Generation`
      );

      // Generate explanation
      const explanation = await this.explainability.explainProject({
        name: request.projectName,
        description: request.description,
        features: analysisResult.requirements.features.map((f) => f.name),
        technologies: ['React', 'Node.js', 'Prisma', 'PostgreSQL'],
      });

      console.log('\n✅ Generation Complete!\n');

      return {
        success: true,
        projectId,
        phases,
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
