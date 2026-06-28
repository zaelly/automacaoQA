/**
 * IntentDetector — cheap Groq call that returns ONLY the intent name.
 *
 * Instead of spending 15k tokens generating a plan every time,
 * this uses ~80 tokens total to classify the user's goal.
 * The planning is done locally by the intent library.
 */

import Groq from 'groq-sdk';
import { ALL_INTENT_IDS, INTENTS } from '../agent/intents';
import type { IntentId } from '../agent/intents';

export interface IntentResult {
  intent: IntentId | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  needsClarification: boolean;
}

const SYSTEM_PROMPT = `Você é um classificador de intenções de QA. Responda APENAS com JSON válido, sem texto extra.`;

export class IntentDetector {
  private groq: Groq;

  constructor(apiKey: string, private model = 'llama-3.3-70b-versatile') {
    this.groq = new Groq({ apiKey });
  }

  async detect(goal: string): Promise<IntentResult> {
    const intentList = ALL_INTENT_IDS
      .map(id => `- ${id}: ${INTENTS[id].emoji} ${INTENTS[id].description}`)
      .join('\n');

    const userPrompt = `Objetivo do teste: "${goal}"

Intenções disponíveis:
${intentList}

Retorne APENAS um JSON:
{"intent": "<id>", "confidence": "high|medium|low", "needsClarification": false}

Se o objetivo for muito vago, genérico ou mencionar "tudo" / "sistema inteiro", retorne:
{"intent": "unknown", "confidence": "low", "needsClarification": true}`;

    try {
      const resp = await this.groq.chat.completions.create({
        model: this.model,
        temperature: 0,
        max_tokens: 60,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
      });

      const raw    = resp.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw) as IntentResult;

      if (!ALL_INTENT_IDS.includes(parsed.intent as IntentId)) {
        return { intent: 'exploratorio', confidence: 'low', needsClarification: false };
      }

      return parsed;
    } catch {
      return { intent: 'exploratorio', confidence: 'low', needsClarification: false };
    }
  }
}
