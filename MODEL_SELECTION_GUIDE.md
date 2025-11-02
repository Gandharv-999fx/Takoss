# Model Selection Guide

## Overview

Takoss now supports **multi-model AI selection**, allowing you to choose from Claude, Gemini, and OpenAI models for different code generation tasks. This provides flexibility in balancing **cost, quality, and speed** based on your needs.

## Supported Models

### Claude Models (Anthropic)
- **Claude Sonnet 4.5** (`claude-sonnet-4-5-20250929`) - Latest, highest quality
- **Claude Sonnet 3.5** (`claude-3-5-sonnet-20241022`) - Excellent quality, fast
- **Claude Opus 3.5** (`claude-3-5-opus-20250514`) - Highest quality, slower, expensive
- **Claude Haiku 3.5** (`claude-3-5-haiku-20241022`) - Fast, cost-effective

### Gemini Models (Google)
- **Gemini 2.5 Pro** (`gemini-2.0-flash-thinking-exp`) - Latest experimental model with advanced reasoning
- **Gemini 2.5 Flash** (`gemini-2.0-flash-exp`) - Ultra-fast, very cost-effective
- **Gemini 1.5 Pro** (`gemini-1.5-pro`) - Stable, high quality, 2M token context
- **Gemini 1.5 Flash** (`gemini-1.5-flash`) - Fast, affordable

### OpenAI Models
- **GPT-4o** (`gpt-4o`) - Multimodal, high quality
- **GPT-4o Mini** (`gpt-4o-mini`) - Fast, cost-effective
- **GPT-4 Turbo** (`gpt-4-turbo`) - High quality, large context
- **GPT-4** (`gpt-4`) - Classic, high quality
- **O1** (`o1`) - Reasoning model, best for complex logic
- **O1 Mini** (`o1-mini`) - Reasoning model, more affordable

---

## Model Selection Strategies

Takoss provides **4 pre-built strategies** for model selection:

### 1. **Default Strategy** (Recommended)
Balanced approach using Claude Sonnet 3.5 for most tasks and Gemini Flash for deployment.

```json
{
  "projectName": "my-app",
  "description": "...",
  "requirements": "...",
  "modelStrategy": "default"
}
```

**Models Used:**
- Requirements Analysis: Claude Sonnet 3.5
- Schema Generation: Claude Sonnet 3.5
- Component Generation: Claude Sonnet 3.5
- API Generation: Claude Sonnet 3.5
- Deployment: Gemini 2.5 Flash

**Estimated Cost:** ~$0.15 per project

---

### 2. **Cost-Optimized Strategy**
Minimizes costs by using the fastest and cheapest models while maintaining good quality.

```json
{
  "projectName": "my-app",
  "description": "...",
  "requirements": "...",
  "modelStrategy": "cost-optimized"
}
```

**Models Used:**
- Requirements Analysis: Gemini 2.5 Flash
- Schema Generation: Gemini 2.5 Flash
- Component Generation: GPT-4o Mini
- API Generation: GPT-4o Mini
- Deployment: Gemini 2.5 Flash

**Estimated Cost:** ~$0.02 per project

---

### 3. **Quality-Optimized Strategy**
Prioritizes code quality using the best available models regardless of cost.

```json
{
  "projectName": "my-app",
  "description": "...",
  "requirements": "...",
  "modelStrategy": "quality-optimized"
}
```

**Models Used:**
- Requirements Analysis: Claude Sonnet 4.5
- Schema Generation: Claude Opus 3.5
- Component Generation: Claude Opus 3.5
- API Generation: Claude Opus 3.5
- Deployment: Claude Sonnet 3.5

**Estimated Cost:** ~$0.80 per project

---

### 4. **Custom Strategy**
Select specific models for each task type for maximum control.

```json
{
  "projectName": "my-app",
  "description": "...",
  "requirements": "...",
  "modelStrategy": "custom",
  "customModels": {
    "requirementsAnalysis": "claude-3-5-sonnet-20241022",
    "schemaGeneration": "gemini-1.5-pro",
    "componentGeneration": "gpt-4o",
    "apiGeneration": "gpt-4o-mini",
    "deploymentGeneration": "gemini-2.0-flash-exp"
  }
}
```

---

## Model Capabilities Comparison

| Model | Max Input Tokens | Max Output Tokens | Speed | Quality | Cost (per 1M tokens) |
|-------|------------------|-------------------|-------|---------|----------------------|
| Claude Sonnet 4.5 | 200K | 8192 | Fast | Excellent | $3/$15 |
| Claude Sonnet 3.5 | 200K | 8192 | Fast | Excellent | $3/$15 |
| Claude Opus 3.5 | 200K | 8192 | Medium | Excellent | $15/$75 |
| Claude Haiku 3.5 | 200K | 8192 | Very Fast | High | $0.8/$4 |
| Gemini 2.5 Pro | 1M | 8192 | Fast | Excellent | $1.25/$5 |
| Gemini 2.5 Flash | 1M | 8192 | Very Fast | High | $0.075/$0.3 |
| Gemini 1.5 Pro | 2M | 8192 | Fast | Excellent | $1.25/$5 |
| Gemini 1.5 Flash | 1M | 8192 | Very Fast | High | $0.075/$0.3 |
| GPT-4o | 128K | 16384 | Fast | Excellent | $2.5/$10 |
| GPT-4o Mini | 128K | 16384 | Very Fast | High | $0.15/$0.6 |
| GPT-4 Turbo | 128K | 4096 | Medium | Excellent | $10/$30 |
| O1 | 200K | 100K | Slow | Excellent | $15/$60 |
| O1 Mini | 128K | 65K | Medium | Excellent | $3/$12 |

---

## Environment Setup

### 1. Add API Keys to `.env`

```bash
# Claude API Key (required)
CLAUDE_API_KEY=sk-ant-api03-your-key-here

# Gemini API Key (optional)
GEMINI_API_KEY=your-gemini-key-here

# OpenAI API Key (optional)
OPENAI_API_KEY=sk-your-openai-key-here
```

### 2. Get API Keys

- **Claude**: https://console.anthropic.com/
- **Gemini**: https://makersuite.google.com/app/apikey
- **OpenAI**: https://platform.openai.com/api-keys

---

## API Usage Examples

### Using Model Strategy via REST API

```bash
# Default strategy
curl -X POST http://localhost:3000/api/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "todo-app",
    "description": "A simple todo application",
    "requirements": "Create a todo app with CRUD operations",
    "modelStrategy": "default"
  }'

# Cost-optimized strategy
curl -X POST http://localhost:3000/api/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "budget-app",
    "description": "Budget tracking app",
    "requirements": "Track income and expenses",
    "modelStrategy": "cost-optimized"
  }'

# Custom model selection
curl -X POST http://localhost:3000/api/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectName": "custom-app",
    "description": "Custom application",
    "requirements": "Build a custom solution",
    "modelStrategy": "custom",
    "customModels": {
      "requirementsAnalysis": "claude-3-5-sonnet-20241022",
      "schemaGeneration": "gemini-1.5-pro",
      "componentGeneration": "gpt-4o",
      "apiGeneration": "gpt-4o-mini",
      "deploymentGeneration": "gemini-2.0-flash-exp"
    }
  }'
```

---

## Response Format

The API response includes information about which models were used:

```json
{
  "success": true,
  "projectId": "proj-1730554321000",
  "phases": { ... },
  "modelsUsed": {
    "requirementsAnalysis": "claude-3-5-sonnet-20241022",
    "schemaGeneration": "claude-3-5-sonnet-20241022",
    "componentGeneration": "claude-3-5-sonnet-20241022",
    "apiGeneration": "claude-3-5-sonnet-20241022",
    "deploymentGeneration": "gemini-2.0-flash-exp"
  },
  "estimatedCost": 0.1523,
  "visualization": "...",
  "explanation": { ... }
}
```

---

## Programmatic Model Selection

### Using ModelSelector in Code

```typescript
import { ModelSelector, createModelSelector } from './core/modelSelector';
import { ClaudeModel, GeminiModel, OpenAIModel } from './types/modelConfig';

// Create a cost-optimized selector
const selector = createModelSelector('cost-optimized');

// Get model for specific task
const schemaModel = selector.selectModel('schemaGeneration');
console.log(`Using ${schemaModel} for schema generation`);

// Get all selections for a project
const allSelections = selector.getProjectModelSelections();
console.log('Project models:', allSelections);

// Get selection summary with costs
const summary = selector.getSelectionSummary();
console.log('Model summary:', summary);

// Estimate project cost
const estimatedCost = selector.estimateProjectCost({
  requirementsAnalysis: { input: 2000, output: 1000 },
  schemaGeneration: { input: 3000, output: 1500 },
  componentGeneration: { input: 5000, output: 3000 },
  apiGeneration: { input: 4000, output: 2500 },
  deploymentGeneration: { input: 2000, output: 1000 },
  refinement: { input: 3000, output: 1500 },
});
console.log(`Estimated cost: $${estimatedCost.toFixed(4)}`);
```

---

## Recommendations by Use Case

### For Production Applications
**Strategy:** `quality-optimized` or `default`
- Prioritize code quality and reliability
- Use Claude Opus or Sonnet for critical components
- Worth the higher cost for production-ready code

### For Prototyping / MVPs
**Strategy:** `cost-optimized`
- Fast iteration with low costs
- Gemini Flash and GPT-4o Mini provide excellent value
- Good enough quality for prototypes

### For Learning / Experimentation
**Strategy:** `cost-optimized`
- Minimize costs while learning
- Try different models with custom strategy
- Experiment without breaking the bank

### For Complex Business Logic
**Strategy:** `custom` with O1 models
- Use O1 or O1 Mini for complex API logic
- Claude Opus for schema design
- Balance quality where it matters most

---

## Cost Optimization Tips

1. **Use Gemini Flash for deployment configs** - They're simple and don't need premium models
2. **Reserve Claude Opus for critical components** - Database schemas and core APIs
3. **Use GPT-4o Mini for repetitive tasks** - Component generation with clear patterns
4. **Batch requests** - Generate multiple projects to amortize API overhead
5. **Cache results** - Reuse generated components across similar projects

---

## Troubleshooting

### "Model not available" errors
- Ensure you have the correct API key in `.env`
- Check that your API key has access to the requested model
- Some models are in beta/preview and may have limited availability

### High costs
- Switch to `cost-optimized` strategy
- Use custom strategy to control exactly which models are used
- Check `estimatedCost` in the response to monitor spending

### Quality issues
- Switch to `quality-optimized` or use Claude Opus/Sonnet
- Provide more detailed requirements for better results
- Use `default` strategy for balanced quality/cost

---

## Future Enhancements

- **Streaming support** for real-time code generation
- **Model fallback** if primary model is unavailable
- **Adaptive selection** based on project complexity
- **Cost tracking** and usage analytics
- **Custom model fine-tuning** support

---

## Support

For issues or questions about model selection:
- GitHub Issues: https://github.com/Gandharv-999fx/Takoss/issues
- Documentation: Check CLAUDE.md for general system info

---

**Generated with ❤️ by Takoss AI Application Builder**
