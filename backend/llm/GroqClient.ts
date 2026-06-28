/**
 * GroqClient — calls Groq's LLM API once, after all Playwright tests are done.
 *
 * Replaces the Gemini step-by-step approach. The AI is now a one-shot analyst,
 * not a real-time controller. Playwright collects all evidence, Groq interprets it.
 */

import Groq from 'groq-sdk';
import type { TestSummary, AnalysisReport, AnalysisFinding } from '../agent/types';
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisPrompt } from './analysisPrompts';

export class GroqClient {
  private groq: Groq;

  constructor(
    apiKey: string,
    private model = 'llama-3.3-70b-versatile',
  ) {
    this.groq = new Groq({ apiKey });
  }

  async analyzeTestResults(summary: TestSummary): Promise<AnalysisReport> {
    const prompt = buildAnalysisPrompt(summary);

    const completion = await this.groq.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 4096,
    });

    const content = completion.choices[0]?.message?.content ?? '{}';
    return this.parse(content);
  }

  private parse(json: string): AnalysisReport {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(json);
    } catch {
      parsed = {};
    }

    const findings: AnalysisFinding[] = ((parsed.findings as unknown[]) || []).map((f: unknown) => {
      const finding = f as Record<string, unknown>;
      return {
        title:          String(finding.title || 'Problema detectado'),
        severity:       (['critical','high','medium','low','info'].includes(String(finding.severity))
                          ? finding.severity : 'info') as AnalysisFinding['severity'],
        description:    String(finding.description || ''),
        possibleCause:  String(finding.possibleCause || ''),
        howToReproduce: String(finding.howToReproduce || ''),
        suggestion:     String(finding.suggestion || ''),
        affectedUrl:    finding.affectedUrl ? String(finding.affectedUrl) : undefined,
      };
    });

    return {
      summary:      String(parsed.summary || 'Análise concluída.'),
      overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : 50,
      findings,
      recommendations: Array.isArray(parsed.recommendations)
        ? (parsed.recommendations as unknown[]).map(r => String(r))
        : [],
      generatedAt: new Date().toISOString(),
      model: this.model,
    };
  }
}
