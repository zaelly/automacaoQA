/**
 * IntentDetector — cheap Groq call to classify intent AND extract custom instructions.
 *
 * Uses ~150 tokens to:
 *   1. Classify the user's goal into a known intent
 *   2. Extract any specific user instructions (e.g. "feche o modal antes de ir ao checkout")
 * Planning is done locally by the intent library.
 */

import Groq from 'groq-sdk';
import { ALL_INTENT_IDS, INTENTS } from '../agent/intents';
import type { IntentId } from '../agent/intents';

export interface IntentResult {
  intent: IntentId | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  needsClarification: boolean;
  customSteps: string[];
}

const SYSTEM_PROMPT = `Você é um classificador de intenções de QA. Além de classificar a intenção, extraia instruções específicas que o usuário mencionou (ex: "feche o modal", "clique no X", "espere 2 segundos"). Responda APENAS com JSON válido, sem texto extra.`;

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

Retorne APENAS um JSON com esta estrutura:
{
  "intent": "<id>",
  "confidence": "high|medium|low",
  "needsClarification": false,
  "customSteps": ["instrução específica 1 em português", "instrução específica 2"]
}

Regras:
- "customSteps" deve conter APENAS instruções concretas e específicas mencionadas pelo usuário (clicar em algo, fechar modal, aguardar, preencher campo, etc.)
- Se não há instruções específicas, retorne "customSteps": []
- Se o objetivo for vago demais ("testar tudo", "sistema inteiro"), retorne needsClarification: true e intent: "unknown"
- Cada customStep deve ser uma instrução clara e executável`;

    try {
      const resp = await this.groq.chat.completions.create({
        model: this.model,
        temperature: 0,
        max_tokens: 220,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userPrompt },
        ],
      });

      const raw    = resp.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(raw) as IntentResult;

      if (!ALL_INTENT_IDS.includes(parsed.intent as IntentId)) {
        return { intent: 'exploratorio', confidence: 'low', needsClarification: false, customSteps: [] };
      }

      return {
        intent: parsed.intent,
        confidence: parsed.confidence || 'medium',
        needsClarification: parsed.needsClarification ?? false,
        customSteps: Array.isArray(parsed.customSteps) ? parsed.customSteps : [],
      };
    } catch {
      return { intent: 'exploratorio', confidence: 'low', needsClarification: false, customSteps: [] };
    }
  }
}
