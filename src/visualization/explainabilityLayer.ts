import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';

/**
 * Explainability Layer - Plain-language explanations for non-technical users
 * Translates technical decisions and processes into understandable narratives
 */

export interface Explanation {
  summary: string;
  details: string[];
  reasoning: string;
  technicalNotes?: string;
  recommendations?: string[];
}

export interface DecisionExplanation {
  decision: string;
  rationale: string;
  alternatives: Array<{
    option: string;
    pros: string[];
    cons: string[];
    notChosen: string;
  }>;
  impact: string;
  confidence: number; // 0-1
}

export interface ProcessExplanation {
  processName: string;
  whatItDoes: string;
  whyItsNeeded: string;
  steps: Array<{
    stepNumber: number;
    action: string;
    explanation: string;
    duration?: string;
  }>;
  outcome: string;
}

export interface CodeExplanation {
  codeSnippet: string;
  language: string;
  purpose: string;
  breakdown: Array<{
    lineNumbers: string;
    code: string;
    explanation: string;
  }>;
  keyPoints: string[];
}

export class ExplainabilityLayer {
  private model: ChatAnthropic;

  constructor(apiKey?: string) {
    this.model = new ChatAnthropic({
      anthropicApiKey: apiKey || process.env.CLAUDE_API_KEY,
      modelName: 'claude-3-5-sonnet-20241022',
      temperature: 0.4, // Slightly higher for more natural language
    });
  }

  /**
   * Explain a technical decision in plain language
   */
  public async explainDecision(
    decision: string,
    context: {
      problemStatement?: string;
      constraints?: string[];
      requirements?: string[];
      alternatives?: string[];
    }
  ): Promise<DecisionExplanation> {
    const prompt = PromptTemplate.fromTemplate(`
You are explaining a technical decision to someone without a technical background.

**Decision Made**: {decision}

**Context**:
- Problem: {problemStatement}
- Requirements: {requirements}
- Constraints: {constraints}
- Alternatives Considered: {alternatives}

**Task**: Explain this decision in clear, simple language that anyone can understand.

Return as JSON:
{{
  "decision": "Brief restatement in simple terms",
  "rationale": "Why we chose this (avoid jargon)",
  "alternatives": [
    {{
      "option": "Alternative name",
      "pros": ["Advantage 1", "Advantage 2"],
      "cons": ["Disadvantage 1", "Disadvantage 2"],
      "notChosen": "Why we didn't pick this"
    }}
  ],
  "impact": "What this means for the project (benefits, trade-offs)",
  "confidence": 0.9
}}

**Rules**:
- Use everyday analogies when possible
- Avoid technical jargon or explain it clearly
- Focus on benefits and outcomes, not implementation details
- Be honest about trade-offs
`);

    const input = await prompt.format({
      decision,
      problemStatement: context.problemStatement || 'Not specified',
      requirements: context.requirements?.join(', ') || 'Not specified',
      constraints: context.constraints?.join(', ') || 'None',
      alternatives: context.alternatives?.join(', ') || 'Not specified',
    });

    const response = await this.model.invoke(input);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract JSON
    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      // Fallback
      return {
        decision,
        rationale: 'Technical decision based on project requirements',
        alternatives: [],
        impact: 'Will improve the system',
        confidence: 0.5,
      };
    }
  }

  /**
   * Explain a process or workflow
   */
  public async explainProcess(
    processName: string,
    steps: Array<{
      action: string;
      technical?: boolean;
      duration?: string;
    }>
  ): Promise<ProcessExplanation> {
    const prompt = PromptTemplate.fromTemplate(`
Explain this process in a way that anyone can understand, like you're explaining it to a friend.

**Process**: {processName}

**Steps**:
{stepsText}

Return as JSON:
{{
  "processName": "Simplified process name",
  "whatItDoes": "One-sentence explanation",
  "whyItsNeeded": "Why this process exists",
  "steps": [
    {{
      "stepNumber": 1,
      "action": "What happens in this step",
      "explanation": "Why this step matters (plain language)",
      "duration": "How long it takes (if known)"
    }}
  ],
  "outcome": "What we get at the end"
}}

**Rules**:
- Use simple, conversational language
- Focus on "what" and "why", not "how"
- Use analogies to familiar concepts
- Emphasize the value and benefits
`);

    const stepsText = steps
      .map((s, i) => `${i + 1}. ${s.action}${s.duration ? ` (${s.duration})` : ''}`)
      .join('\n');

    const input = await prompt.format({ processName, stepsText });
    const response = await this.model.invoke(input);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract JSON
    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      // Fallback
      return {
        processName,
        whatItDoes: 'Automated process',
        whyItsNeeded: 'To improve efficiency',
        steps: steps.map((s, i) => ({
          stepNumber: i + 1,
          action: s.action,
          explanation: 'This step is important',
          duration: s.duration,
        })),
        outcome: 'Completed process',
      };
    }
  }

  /**
   * Explain generated code
   */
  public async explainCode(
    code: string,
    language: string,
    context?: string
  ): Promise<CodeExplanation> {
    const prompt = PromptTemplate.fromTemplate(`
Explain this code to someone who doesn't program. Think of yourself as a friendly teacher.

**Language**: {language}
**Context**: {context}

**Code**:
\`\`\`{language}
{code}
\`\`\`

Return as JSON:
{{
  "codeSnippet": "The code",
  "language": "{language}",
  "purpose": "What this code accomplishes (plain English)",
  "breakdown": [
    {{
      "lineNumbers": "1-3",
      "code": "specific code lines",
      "explanation": "What these lines do (simple terms)"
    }}
  ],
  "keyPoints": [
    "Important concept 1",
    "Important concept 2"
  ]
}}

**Rules**:
- Explain the purpose and results, not syntax
- Use real-world analogies
- Group related lines together
- Highlight what the code achieves, not how
- Be encouraging and clear
`);

    const input = await prompt.format({
      language,
      code,
      context: context || 'Part of the application',
    });

    const response = await this.model.invoke(input);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract JSON
    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      // Fallback
      return {
        codeSnippet: code,
        language,
        purpose: 'Code implementation',
        breakdown: [
          {
            lineNumbers: '1-n',
            code: code.substring(0, 100),
            explanation: 'This code performs the required functionality',
          },
        ],
        keyPoints: ['Implements required features', 'Follows best practices'],
      };
    }
  }

  /**
   * Explain technical errors in user-friendly language
   */
  public async explainError(
    errorMessage: string,
    context?: {
      userAction?: string;
      expectedBehavior?: string;
      technicalDetails?: string;
    }
  ): Promise<Explanation> {
    const prompt = PromptTemplate.fromTemplate(`
Translate this technical error into a friendly, helpful explanation.

**Error**: {errorMessage}

**Context**:
- User Action: {userAction}
- Expected Result: {expectedBehavior}
- Technical Details: {technicalDetails}

**Task**: Explain what went wrong and what can be done about it in plain, empathetic language.

Return as JSON:
{{
  "summary": "One-sentence explanation of what happened",
  "details": [
    "More detail point 1",
    "More detail point 2"
  ],
  "reasoning": "Why this error occurred (avoid blame)",
  "technicalNotes": "Technical details (optional, for advanced users)",
  "recommendations": [
    "Action step 1",
    "Action step 2"
  ]
}}

**Rules**:
- Be empathetic and non-judgmental
- Focus on solutions, not problems
- Use simple, clear language
- Provide actionable next steps
- Reassure the user if appropriate
`);

    const input = await prompt.format({
      errorMessage,
      userAction: context?.userAction || 'Unknown action',
      expectedBehavior: context?.expectedBehavior || 'Successful operation',
      technicalDetails: context?.technicalDetails || 'No additional details',
    });

    const response = await this.model.invoke(input);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract JSON
    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      // Fallback
      return {
        summary: 'An error occurred',
        details: ['Something unexpected happened'],
        reasoning: 'Technical issue',
        recommendations: ['Please try again', 'Contact support if the issue persists'],
      };
    }
  }

  /**
   * Explain AI-generated output
   */
  public async explainAIOutput(
    outputType: string,
    output: string,
    prompt: string
  ): Promise<Explanation> {
    const explainPrompt = PromptTemplate.fromTemplate(`
Explain what the AI generated and why, in plain language.

**Type of Output**: {outputType}
**Original Request**: {prompt}
**AI Generated**:
\`\`\`
{output}
\`\`\`

Return as JSON:
{{
  "summary": "What the AI created (one sentence)",
  "details": [
    "Key aspect 1",
    "Key aspect 2"
  ],
  "reasoning": "Why the AI made these choices",
  "recommendations": [
    "How to use this output",
    "Next steps"
  ]
}}

**Rules**:
- Explain in terms anyone can understand
- Highlight the value and benefits
- Be transparent about AI limitations if relevant
- Suggest practical next steps
`);

    const input = await explainPrompt.format({
      outputType,
      prompt,
      output: output.substring(0, 1000),
    });

    const response = await this.model.invoke(input);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract JSON
    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      // Fallback
      return {
        summary: 'AI generated output based on your request',
        details: ['Content was generated using advanced AI'],
        reasoning: 'Based on the provided requirements and context',
        recommendations: ['Review the output', 'Make adjustments as needed'],
      };
    }
  }

  /**
   * Generate comprehensive project explanation
   */
  public async explainProject(project: {
    name: string;
    description: string;
    features: string[];
    technologies: string[];
    architecture?: string;
  }): Promise<{
    elevatorPitch: string;
    overview: string;
    features: Array<{ name: string; explanation: string }>;
    technologies: Array<{ name: string; purpose: string; benefit: string }>;
    targetAudience: string;
  }> {
    const prompt = PromptTemplate.fromTemplate(`
Create a comprehensive, non-technical explanation of this project.

**Project**: {name}
**Description**: {description}
**Features**: {features}
**Technologies**: {technologies}

Return as JSON:
{{
  "elevatorPitch": "30-second pitch (2-3 sentences)",
  "overview": "2-3 paragraph overview for non-technical stakeholders",
  "features": [
    {{
      "name": "Feature name",
      "explanation": "What it does and why it matters"
    }}
  ],
  "technologies": [
    {{
      "name": "Technology name",
      "purpose": "What it's used for",
      "benefit": "Why we chose it"
    }}
  ],
  "targetAudience": "Who will benefit from this project"
}}

**Rules**:
- Use business value language, not technical jargon
- Focus on benefits and outcomes
- Make it exciting and engaging
- Use analogies to familiar concepts
`);

    const input = await prompt.format({
      name: project.name,
      description: project.description,
      features: project.features.join(', '),
      technologies: project.technologies.join(', '),
    });

    const response = await this.model.invoke(input);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract JSON
    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      // Fallback
      return {
        elevatorPitch: `${project.name}: ${project.description}`,
        overview: project.description,
        features: project.features.map((f) => ({
          name: f,
          explanation: 'Important feature',
        })),
        technologies: project.technologies.map((t) => ({
          name: t,
          purpose: 'Technology component',
          benefit: 'Improves the system',
        })),
        targetAudience: 'Users who need this solution',
      };
    }
  }

  /**
   * Generate explanation report
   */
  public generateExplanationReport(
    explanations: Array<{
      type: string;
      title: string;
      content: Explanation | DecisionExplanation | ProcessExplanation | CodeExplanation;
    }>
  ): string {
    const lines: string[] = [];

    lines.push('# Project Explanation Report');
    lines.push('');
    lines.push(`Generated: ${new Date().toLocaleString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    explanations.forEach((exp, index) => {
      lines.push(`## ${index + 1}. ${exp.title}`);
      lines.push('');

      if ('summary' in exp.content) {
        const content = exp.content as Explanation;
        lines.push(`**Summary**: ${content.summary}`);
        lines.push('');

        if (content.details.length > 0) {
          lines.push('**Details**:');
          content.details.forEach((detail) => {
            lines.push(`- ${detail}`);
          });
          lines.push('');
        }

        lines.push(`**Reasoning**: ${content.reasoning}`);
        lines.push('');

        if (content.recommendations && content.recommendations.length > 0) {
          lines.push('**Recommendations**:');
          content.recommendations.forEach((rec) => {
            lines.push(`- ${rec}`);
          });
          lines.push('');
        }
      } else if ('decision' in exp.content) {
        const content = exp.content as DecisionExplanation;
        lines.push(`**Decision**: ${content.decision}`);
        lines.push('');
        lines.push(`**Rationale**: ${content.rationale}`);
        lines.push('');
        lines.push(`**Impact**: ${content.impact}`);
        lines.push('');
        lines.push(`**Confidence**: ${(content.confidence * 100).toFixed(0)}%`);
        lines.push('');
      } else if ('processName' in exp.content) {
        const content = exp.content as ProcessExplanation;
        lines.push(`**What It Does**: ${content.whatItDoes}`);
        lines.push('');
        lines.push(`**Why It's Needed**: ${content.whyItsNeeded}`);
        lines.push('');
        lines.push('**Steps**:');
        content.steps.forEach((step) => {
          lines.push(
            `${step.stepNumber}. **${step.action}**${step.duration ? ` (${step.duration})` : ''}`
          );
          lines.push(`   ${step.explanation}`);
        });
        lines.push('');
        lines.push(`**Outcome**: ${content.outcome}`);
        lines.push('');
      } else if ('purpose' in exp.content) {
        const content = exp.content as CodeExplanation;
        lines.push(`**Purpose**: ${content.purpose}`);
        lines.push('');
        lines.push('**Key Points**:');
        content.keyPoints.forEach((point) => {
          lines.push(`- ${point}`);
        });
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Interactive Q&A about the system
   */
  public async answerQuestion(
    question: string,
    systemContext: string
  ): Promise<{
    answer: string;
    relatedTopics: string[];
    furtherReading?: string;
  }> {
    const prompt = PromptTemplate.fromTemplate(`
Answer this question about the system in a friendly, helpful way.

**Question**: {question}

**System Context**:
{systemContext}

Provide a clear, concise answer that:
1. Directly addresses the question
2. Uses plain language
3. Provides relevant context
4. Suggests related topics to explore

Return as JSON:
{{
  "answer": "Clear, friendly answer (2-4 sentences)",
  "relatedTopics": ["Related topic 1", "Related topic 2"],
  "furtherReading": "Optional: where to learn more"
}}
`);

    const input = await prompt.format({ question, systemContext });
    const response = await this.model.invoke(input);
    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

    // Extract JSON
    let jsonContent = content;
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    try {
      return JSON.parse(jsonContent);
    } catch (error) {
      return {
        answer: 'Let me help with that.',
        relatedTopics: [],
      };
    }
  }
}
