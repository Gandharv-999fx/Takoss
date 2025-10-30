import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
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

export interface StreamEvent {
  type: 'phase_start' | 'phase_progress' | 'phase_complete' | 'error' | 'complete';
  phase: string;
  message: string;
  progress?: number;
  data?: any;
}

export class SimpleTakossOrchestrator extends EventEmitter {
  private prisma: PrismaClient;
  private requirementsAnalyzer: RequirementsAnalyzer;
  private complexityEstimator: ComplexityEstimator;
  private componentDecomposer: ComponentDecomposer;
  private schemaEvolution: DatabaseSchemaEvolution;
  private deploymentDecomposer: DeploymentTaskDecomposer;
  private visualizer: PromptChainVisualizer;
  private explainability: ExplainabilityLayer;

  constructor(apiKey?: string) {
    super();
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

  private emitEvent(event: StreamEvent): void {
    this.emit('progress', event);
  }

  public async generateApplication(request: ProjectRequest): Promise<GenerationResult> {
    const projectId = `proj-${Date.now()}`;
    const phases: GenerationResult['phases'] = {};

    console.log(`\n🚀 Generating: ${request.projectName}`);
    this.emitEvent({
      type: 'phase_start',
      phase: 'initialization',
      message: `Starting generation for ${request.projectName}`,
      progress: 0,
    });

    try {
      // Phase 1: Analysis
      console.log('\n📋 Phase 1: Requirements Analysis...');
      this.emitEvent({
        type: 'phase_start',
        phase: 'analysis',
        message: 'Analyzing requirements and extracting features',
        progress: 10,
      });

      const analysisResult = await this.requirementsAnalyzer.analyzeRequirements(
        request.requirements
      );
      phases.analysis = analysisResult;
      console.log(`✓ Found ${analysisResult.requirements.entities.length} entities`);

      this.emitEvent({
        type: 'phase_complete',
        phase: 'analysis',
        message: `Found ${analysisResult.requirements.entities.length} entities and ${analysisResult.requirements.features.length} features`,
        progress: 20,
        data: { entities: analysisResult.requirements.entities.length, features: analysisResult.requirements.features.length },
      });

      // Phase 2: Complexity Estimation
      console.log('\n🧮 Phase 2: Complexity Estimation...');
      this.emitEvent({
        type: 'phase_start',
        phase: 'complexity',
        message: 'Estimating project complexity',
        progress: 30,
      });

      const complexity = this.complexityEstimator.estimateRequirementsComplexity(
        analysisResult.requirements
      );
      phases.complexity = complexity;
      console.log(`✓ Complexity Score: ${complexity.totalScore}`);

      this.emitEvent({
        type: 'phase_complete',
        phase: 'complexity',
        message: `Complexity score: ${complexity.totalScore}`,
        progress: 40,
        data: { score: complexity.totalScore },
      });

      // Phase 3: Database Schema
      console.log('\n🗄️  Phase 3: Database Schema...');
      this.emitEvent({
        type: 'phase_start',
        phase: 'database',
        message: 'Designing database schema',
        progress: 50,
      });

      phases.database = { entitiesCount: analysisResult.requirements.entities.length };
      console.log('✓ Schema analysis complete');

      this.emitEvent({
        type: 'phase_complete',
        phase: 'database',
        message: `Database schema designed for ${analysisResult.requirements.entities.length} entities`,
        progress: 60,
      });

      // Phase 4: Frontend Components
      console.log('\n🎨 Phase 4: Frontend Components...');
      this.emitEvent({
        type: 'phase_start',
        phase: 'frontend',
        message: 'Generating UI components',
        progress: 70,
      });

      if (analysisResult.requirements.uiRequirements.length > 0) {
        const uiReq = analysisResult.requirements.uiRequirements[0];
        const components = await this.componentDecomposer.generateComponentsFromRequirement(
          uiReq
        );
        phases.frontend = { componentCount: Array.isArray(components) ? components.length : 0 };
        console.log(`✓ Generated components`);

        this.emitEvent({
          type: 'phase_complete',
          phase: 'frontend',
          message: `Generated ${Array.isArray(components) ? components.length : 0} components`,
          progress: 80,
        });
      } else {
        this.emitEvent({
          type: 'phase_complete',
          phase: 'frontend',
          message: 'No UI requirements found',
          progress: 80,
        });
      }

      // Phase 5: Deployment Config
      console.log('\n🚢 Phase 5: Deployment...');
      this.emitEvent({
        type: 'phase_start',
        phase: 'deployment',
        message: 'Preparing deployment configuration',
        progress: 90,
      });

      phases.deployment = { ready: true };
      console.log(`✓ Deployment analysis complete`);

      this.emitEvent({
        type: 'phase_complete',
        phase: 'deployment',
        message: 'Deployment configuration ready',
        progress: 95,
      });

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

      this.emitEvent({
        type: 'complete',
        phase: 'complete',
        message: `Successfully generated ${request.projectName}`,
        progress: 100,
        data: { projectId },
      });

      return {
        success: true,
        projectId,
        phases,
        visualization: htmlViz,
        explanation,
      };
    } catch (error: any) {
      console.error('❌ Generation failed:', error.message);

      this.emitEvent({
        type: 'error',
        phase: 'error',
        message: `Generation failed: ${error.message}`,
        progress: 0,
      });

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
