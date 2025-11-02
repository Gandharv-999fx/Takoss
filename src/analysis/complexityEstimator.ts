import { RequirementsDocument, Entity, Feature } from './requirementsAnalyzer';
import { TaskNode } from '../types/interfaces';

/**
 * Complexity Estimator - Determines when to recursively decompose tasks
 * Scores based on entities, relationships, business logic, integrations, UI complexity
 */

export interface ComplexityMetrics {
  totalScore: number;
  breakdown: {
    entityComplexity: number;
    relationshipComplexity: number;
    businessLogicComplexity: number;
    integrationComplexity: number;
    uiComplexity: number;
  };
  recommendation: 'atomic' | 'needs-decomposition';
  reasoning: string[];
  suggestedSubtasks?: string[];
}

export interface ComplexityConfig {
  decompositionThreshold: number; // Default: 7
  weights: {
    entities: number; // Default: 2
    relationships: number; // Default: 1.5
    businessLogic: number; // Default: 2.5
    integrations: number; // Default: 3
    uiComponents: number; // Default: 1
  };
}

export class ComplexityEstimator {
  private config: ComplexityConfig;

  constructor(config?: Partial<ComplexityConfig>) {
    this.config = {
      decompositionThreshold: config?.decompositionThreshold || 7,
      weights: {
        entities: config?.weights?.entities || 2,
        relationships: config?.weights?.relationships || 1.5,
        businessLogic: config?.weights?.businessLogic || 2.5,
        integrations: config?.weights?.integrations || 3,
        uiComponents: config?.weights?.uiComponents || 1,
      },
    };
  }

  /**
   * Estimate complexity of an entire requirements document
   */
  public estimateRequirementsComplexity(
    requirements: RequirementsDocument
  ): ComplexityMetrics {
    const breakdown = {
      entityComplexity: this.calculateEntityComplexity(requirements.entities),
      relationshipComplexity: this.calculateRelationshipComplexity(
        requirements.relationships
      ),
      businessLogicComplexity: this.calculateBusinessLogicComplexity(
        requirements.features
      ),
      integrationComplexity: this.calculateIntegrationComplexity(
        requirements.features,
        requirements.technicalConstraints
      ),
      uiComplexity: this.calculateUIComplexity(requirements.uiRequirements),
    };

    const totalScore =
      breakdown.entityComplexity +
      breakdown.relationshipComplexity +
      breakdown.businessLogicComplexity +
      breakdown.integrationComplexity +
      breakdown.uiComplexity;

    const reasoning: string[] = [];
    const suggestedSubtasks: string[] = [];

    // Generate reasoning
    if (breakdown.entityComplexity > 3) {
      reasoning.push(`High entity complexity (${breakdown.entityComplexity}): Multiple entities with many attributes`);
      suggestedSubtasks.push('Break down into entity-specific modules');
    }

    if (breakdown.relationshipComplexity > 2) {
      reasoning.push(`Complex relationships (${breakdown.relationshipComplexity}): Many inter-entity connections`);
      suggestedSubtasks.push('Design database schema separately');
    }

    if (breakdown.businessLogicComplexity > 4) {
      reasoning.push(`Complex business logic (${breakdown.businessLogicComplexity}): Advanced features requiring custom logic`);
      suggestedSubtasks.push('Implement business logic layer separately');
    }

    if (breakdown.integrationComplexity > 3) {
      reasoning.push(`High integration needs (${breakdown.integrationComplexity}): External services required`);
      suggestedSubtasks.push('Set up integrations as separate tasks');
    }

    if (breakdown.uiComplexity > 3) {
      reasoning.push(`Complex UI (${breakdown.uiComplexity}): Multiple interactive components`);
      suggestedSubtasks.push('Build UI components incrementally');
    }

    return {
      totalScore,
      breakdown,
      recommendation:
        totalScore > this.config.decompositionThreshold
          ? 'needs-decomposition'
          : 'atomic',
      reasoning,
      suggestedSubtasks: suggestedSubtasks.length > 0 ? suggestedSubtasks : undefined,
    };
  }

  /**
   * Estimate complexity of a single task
   */
  public estimateTaskComplexity(
    task: TaskNode,
    context?: {
      relatedEntities?: Entity[];
      relatedFeatures?: Feature[];
    }
  ): ComplexityMetrics {
    let breakdown = {
      entityComplexity: 0,
      relationshipComplexity: 0,
      businessLogicComplexity: 0,
      integrationComplexity: 0,
      uiComplexity: 0,
    };

    // Analyze task description for complexity indicators
    const description = task.description.toLowerCase();

    // Entity complexity
    if (context?.relatedEntities) {
      breakdown.entityComplexity = this.calculateEntityComplexity(
        context.relatedEntities
      );
    } else {
      // Estimate from description
      const entityIndicators = ['model', 'entity', 'schema', 'database', 'table'];
      const matches = entityIndicators.filter((indicator) =>
        description.includes(indicator)
      );
      breakdown.entityComplexity = matches.length * this.config.weights.entities;
    }

    // Business logic complexity
    const logicIndicators = [
      'validation',
      'calculation',
      'algorithm',
      'workflow',
      'process',
      'rule',
      'condition',
      'custom logic',
    ];
    const logicMatches = logicIndicators.filter((indicator) =>
      description.includes(indicator)
    );
    breakdown.businessLogicComplexity =
      logicMatches.length * this.config.weights.businessLogic;

    // Integration complexity
    const integrationIndicators = [
      'api',
      'authentication',
      'payment',
      'email',
      'notification',
      'third-party',
      'external',
      'integration',
      'webhook',
    ];
    const integrationMatches = integrationIndicators.filter((indicator) =>
      description.includes(indicator)
    );
    breakdown.integrationComplexity =
      integrationMatches.length * this.config.weights.integrations;

    // UI complexity
    const uiIndicators = [
      'dashboard',
      'form',
      'table',
      'chart',
      'graph',
      'modal',
      'component',
      'interactive',
      'drag-drop',
      'animation',
    ];
    const uiMatches = uiIndicators.filter((indicator) => description.includes(indicator));
    breakdown.uiComplexity = uiMatches.length * this.config.weights.uiComponents;

    const totalScore =
      breakdown.entityComplexity +
      breakdown.relationshipComplexity +
      breakdown.businessLogicComplexity +
      breakdown.integrationComplexity +
      breakdown.uiComplexity;

    const reasoning: string[] = [];
    const suggestedSubtasks: string[] = [];

    if (totalScore > this.config.decompositionThreshold) {
      reasoning.push(`Total complexity score ${totalScore} exceeds threshold ${this.config.decompositionThreshold}`);

      // Suggest decomposition based on task type
      switch (task.type) {
        case 'feature':
          suggestedSubtasks.push('Break into component-level tasks');
          suggestedSubtasks.push('Separate frontend and backend logic');
          break;
        case 'component':
          suggestedSubtasks.push('Create sub-components');
          suggestedSubtasks.push('Separate layout from business logic');
          break;
        case 'function':
          suggestedSubtasks.push('Extract helper functions');
          suggestedSubtasks.push('Separate validation logic');
          break;
        default:
          suggestedSubtasks.push('Decompose into smaller, focused tasks');
      }
    }

    return {
      totalScore,
      breakdown,
      recommendation:
        totalScore > this.config.decompositionThreshold
          ? 'needs-decomposition'
          : 'atomic',
      reasoning,
      suggestedSubtasks: suggestedSubtasks.length > 0 ? suggestedSubtasks : undefined,
    };
  }

  /**
   * Determine if a task needs further decomposition
   */
  public shouldDecompose(task: TaskNode, context?: any): boolean {
    const metrics = this.estimateTaskComplexity(task, context);
    return metrics.recommendation === 'needs-decomposition';
  }

  /**
   * Get decomposition suggestions for a complex task
   */
  public getDecompositionSuggestions(task: TaskNode): string[] {
    const metrics = this.estimateTaskComplexity(task);
    return metrics.suggestedSubtasks || [];
  }

  // Private calculation methods

  private calculateEntityComplexity(entities: Entity[]): number {
    if (entities.length === 0) return 0;

    let score = 0;

    // Base score: number of entities
    score += entities.length * this.config.weights.entities;

    // Add complexity for attributes
    entities.forEach((entity) => {
      const attributeCount = entity.attributes.length;
      if (attributeCount > 5) score += 1;
      if (attributeCount > 10) score += 1;

      // Complex attribute types
      const complexTypes = entity.attributes.filter(
        (attr) => attr.type === 'array' || attr.type === 'object' || attr.type === 'enum'
      );
      score += complexTypes.length * 0.5;
    });

    return Math.round(score * 10) / 10;
  }

  private calculateRelationshipComplexity(relationships: any[]): number {
    if (relationships.length === 0) return 0;

    let score = 0;

    // Base score: number of relationships
    score += relationships.length * this.config.weights.relationships;

    // Many-to-many relationships are more complex
    const manyToMany = relationships.filter((rel) => rel.type === 'many-to-many');
    score += manyToMany.length * 1;

    return Math.round(score * 10) / 10;
  }

  private calculateBusinessLogicComplexity(features: Feature[]): number {
    if (features.length === 0) return 0;

    let score = 0;

    // Complex feature categories
    const complexCategories = [
      'authentication',
      'authorization',
      'realtime',
      'analytics',
      'reporting',
      'notifications',
    ];

    features.forEach((feature) => {
      if (complexCategories.includes(feature.category)) {
        score += this.config.weights.businessLogic;
      } else if (feature.category === 'crud') {
        score += 0.5;
      } else {
        score += 1;
      }

      // High priority features add complexity
      if (feature.priority === 'high') {
        score += 0.5;
      }
    });

    return Math.round(score * 10) / 10;
  }

  private calculateIntegrationComplexity(
    features: Feature[],
    constraints: any[]
  ): number {
    let score = 0;

    // Check for integration-heavy features
    const integrationFeatures = features.filter(
      (f) =>
        f.category === 'authentication' ||
        f.category === 'notifications' ||
        f.category === 'file-upload' ||
        f.description.toLowerCase().includes('integration') ||
        f.description.toLowerCase().includes('third-party') ||
        f.description.toLowerCase().includes('api')
    );

    score += integrationFeatures.length * this.config.weights.integrations;

    // Check technical constraints for integrations
    const integrationConstraints = constraints.filter(
      (c) =>
        c.category === 'authentication' ||
        c.constraint.toLowerCase().includes('integration') ||
        c.constraint.toLowerCase().includes('api')
    );

    score += integrationConstraints.length * 1;

    return Math.round(score * 10) / 10;
  }

  private calculateUIComplexity(uiRequirements: any[]): number {
    if (uiRequirements.length === 0) return 0;

    let score = 0;

    // Complex UI components
    const complexComponents = ['dashboard', 'chart', 'graph', 'editor', 'kanban', 'calendar'];

    uiRequirements.forEach((ui) => {
      const component = ui.component.toLowerCase();

      if (complexComponents.some((c) => component.includes(c))) {
        score += this.config.weights.uiComponents * 2;
      } else {
        score += this.config.weights.uiComponents;
      }

      // Multiple features in one UI component adds complexity
      if (ui.features && ui.features.length > 2) {
        score += 1;
      }
    });

    return Math.round(score * 10) / 10;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<ComplexityConfig>): void {
    if (newConfig.decompositionThreshold) {
      this.config.decompositionThreshold = newConfig.decompositionThreshold;
    }
    if (newConfig.weights) {
      this.config.weights = { ...this.config.weights, ...newConfig.weights };
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): ComplexityConfig {
    return { ...this.config };
  }
}
