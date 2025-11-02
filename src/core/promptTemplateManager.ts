import { PromptTemplate } from '../types/interfaces';

export class PromptTemplateManager {
  private templates: Map<string, PromptTemplate> = new Map();
  private defaultTemplates: Record<string, string> = {};

  constructor(initialTemplates: PromptTemplate[] = []) {
    initialTemplates.forEach(template => {
      this.addTemplate(template);
    });
  }

  /**
   * Adds a new prompt template
   */
  public addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * Gets a template by ID
   */
  public getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Sets a default template for a task type
   */
  public setDefaultTemplateForTaskType(taskType: string, templateId: string): void {
    if (!this.templates.has(templateId)) {
      throw new Error(`Template with ID ${templateId} does not exist`);
    }
    this.defaultTemplates[taskType] = templateId;
  }

  /**
   * Gets the default template ID for a task type
   */
  public getDefaultTemplateForTaskType(taskType: string): string {
    return this.defaultTemplates[taskType] || '';
  }
  
  /**
   * Gets a template by task type
   */
  public getTemplateByTaskType(taskType: string): PromptTemplate | undefined {
    const templateId = this.getDefaultTemplateForTaskType(taskType);
    return templateId ? this.getTemplate(templateId) : undefined;
  }

  /**
   * Fills a template with variables
   */
  public fillTemplate(templateId: string, variables: Record<string, any>): string {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template with ID ${templateId} does not exist`);
    }

    let filledTemplate = template.template;
    
    // Replace variables in the template
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      filledTemplate = filledTemplate.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return filledTemplate;
  }

  /**
   * Gets all templates
   */
  public getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Gets templates by category
   */
  public getTemplatesByCategory(category: string): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.category === category);
  }

  /**
   * Removes a template
   */
  public removeTemplate(id: string): boolean {
    return this.templates.delete(id);
  }
}