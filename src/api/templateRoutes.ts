import { Router, Request, Response } from 'express';
import { TemplateLibraryService } from '../core/templateLibraryService';

const router = Router();
const templateService = new TemplateLibraryService();

/**
 * GET /api/templates
 * Get all templates with optional filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { category, modelType, tags, isActive } = req.query;

    const options: any = {};
    if (category) options.category = category as string;
    if (modelType) options.modelType = modelType as string;
    if (tags) options.tags = (tags as string).split(',');
    if (isActive !== undefined) options.isActive = isActive === 'true';

    const templates = await templateService.getAllTemplates(options);

    res.json({
      success: true,
      count: templates.length,
      data: templates,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates',
    });
  }
});

/**
 * GET /api/templates/search?q=query
 * Search templates by text
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
    }

    const templates = await templateService.searchTemplates(q);

    res.json({
      success: true,
      count: templates.length,
      data: templates,
    });
  } catch (error) {
    console.error('Error searching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search templates',
    });
  }
});

/**
 * GET /api/templates/popular
 * Get popular templates by usage
 */
router.get('/popular', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const templates = await templateService.getPopularTemplates(limit);

    res.json({
      success: true,
      count: templates.length,
      data: templates,
    });
  } catch (error) {
    console.error('Error fetching popular templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch popular templates',
    });
  }
});

/**
 * GET /api/templates/:id
 * Get a specific template by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await templateService.getTemplate(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template',
    });
  }
});

/**
 * GET /api/templates/:id/analytics
 * Get analytics for a template
 */
router.get('/:id/analytics', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const analytics = await templateService.getTemplateAnalytics(id);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error fetching template analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template analytics',
    });
  }
});

/**
 * POST /api/templates
 * Create a new template
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, template, variables, category, modelType, tags, metadata, examples } =
      req.body;

    // Validation
    if (!name || !description || !template || !variables || !category) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, description, template, variables, category',
      });
    }

    const newTemplate = await templateService.createTemplate({
      name,
      description,
      template,
      variables,
      category,
      modelType,
      tags,
      metadata,
      examples,
    });

    res.status(201).json({
      success: true,
      data: newTemplate,
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template',
    });
  }
});

/**
 * PUT /api/templates/:id
 * Update a template
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const updated = await templateService.updateTemplate(id, updateData);

    res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update template',
    });
  }
});

/**
 * POST /api/templates/:id/version
 * Create a new version of a template
 */
router.post('/:id/version', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { template, description, variables } = req.body;

    const newVersion = await templateService.createTemplateVersion(id, {
      template,
      description,
      variables,
    });

    res.status(201).json({
      success: true,
      data: newVersion,
    });
  } catch (error) {
    console.error('Error creating template version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create template version',
    });
  }
});

/**
 * DELETE /api/templates/:id
 * Soft delete (deactivate) a template
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await templateService.deleteTemplate(id);

    res.json({
      success: true,
      message: 'Template deactivated successfully',
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete template',
    });
  }
});

/**
 * DELETE /api/templates/:id/hard
 * Permanently delete a template
 */
router.delete('/:id/hard', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await templateService.hardDeleteTemplate(id);

    res.json({
      success: true,
      message: 'Template permanently deleted',
    });
  } catch (error) {
    console.error('Error permanently deleting template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to permanently delete template',
    });
  }
});

/**
 * POST /api/templates/:id/usage
 * Record template usage
 */
router.post('/:id/usage', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const executionData = req.body;

    await templateService.recordTemplateUsage(id, executionData);

    res.json({
      success: true,
      message: 'Usage recorded successfully',
    });
  } catch (error) {
    console.error('Error recording template usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record template usage',
    });
  }
});

export default router;
