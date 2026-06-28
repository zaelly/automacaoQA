/**
 * Prompts for the Groq analysis step.
 * Playwright collects ALL evidence first, then ONE call to Groq generates the report.
 */

import type { TestSummary } from '../agent/types';

export const ANALYSIS_SYSTEM_PROMPT = `Você é um especialista sênior em QA e testes de software. Você recebe resultados de testes automatizados feitos com Playwright e gera um relatório técnico detalhado.

IMPORTANTE: Responda APENAS com JSON válido. Sem texto fora do JSON.

Formato esperado:
{
  "summary": "Resumo executivo do estado geral da aplicação em 2-3 frases",
  "overallScore": 85,
  "findings": [
    {
      "title": "Título curto e descritivo do problema",
      "severity": "critical|high|medium|low|info",
      "description": "Descrição técnica detalhada do problema encontrado",
      "possibleCause": "Possível causa raiz do problema",
      "howToReproduce": "Passos para reproduzir: 1. Acesse... 2. Preencha... 3. Clique...",
      "suggestion": "Sugestão técnica de correção com exemplo se possível",
      "affectedUrl": "URL onde o problema foi encontrado (opcional)",
      "affectedFlow": "Nome do fluxo afetado (Login, Links, Formulários, etc.)"
    }
  ],
  "recommendations": [
    "Recomendação geral 1",
    "Recomendação geral 2"
  ]
}

Critérios de severidade:
- critical: Login impossível, sistema inacessível, perda de dados, erro 5xx em operações principais
- high: Funcionalidade principal quebrada, erro 4xx inesperado, formulários não funcionam, links quebrados
- medium: Performance ruim (TTFB>1s, LCP>3s), erros de console JavaScript, validação ausente
- low: Problemas de acessibilidade, SEO fraco (sem alt text, sem título), avisos
- info: Boas práticas, sugestões de melhoria sem impacto funcional

Para o overallScore: 100=perfeito, 0=totalmente quebrado. Seja rigoroso mas justo.
Se login falhou: score máximo deve ser 40 (sistema inutilizável sem acesso).
Se não encontrar problemas críticos, o score deve ser alto (80+).`;

export function buildAnalysisPrompt(summary: TestSummary): string {
  const lines: string[] = [];

  lines.push('## Contexto do Teste');
  lines.push(`Objetivo: ${summary.goal}`);
  lines.push(`URL testada: ${summary.baseUrl}`);
  lines.push(`Data: ${new Date(summary.startedAt).toLocaleString('pt-BR')}`);
  lines.push(`Duração total: ${Math.round(summary.durationMs / 1000)}s`);
  if (summary.intentName) {
    lines.push(`Intenção testada: ${summary.intentName}`);
  }
  if (summary.customSteps && summary.customSteps.length > 0) {
    lines.push('');
    lines.push('## Instruções Personalizadas do Usuário');
    lines.push('O usuário especificou estas ações adicionais (que foram executadas automaticamente):');
    summary.customSteps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    lines.push('Avalie se essas instruções foram cumpridas com base nos fluxos e erros reportados.');
  }
  lines.push('');

  // ── Login status ──────────────────────────────────────────────────────────
  lines.push('## Status do Login');
  if (summary.loginStatus === 'not_detected') {
    lines.push('Nenhum formulário de login detectado na página.');
  } else if (summary.loginStatus === 'pass') {
    lines.push('✅ Login realizado com sucesso.');
  } else {
    lines.push(`❌ LOGIN FALHOU — ${summary.loginError || 'Motivo desconhecido'}`);
    lines.push('IMPACTO: Todos os fluxos dependentes foram cancelados. O sistema está inacessível para usuários com essas credenciais.');
  }
  lines.push('');

  // ── Flows ─────────────────────────────────────────────────────────────────
  if (summary.flows && summary.flows.length > 0) {
    lines.push('## Fluxos Executados');
    for (const flow of summary.flows) {
      const icon = flow.status === 'pass' ? '✅' : flow.status === 'fail' ? '❌' : '⏭️';
      lines.push(`### ${icon} ${flow.name} (${flow.status})`);
      if (flow.status === 'skipped') {
        lines.push(`Motivo: ${flow.reason || 'Dependência não atendida'}`);
        lines.push(`Bloqueado por: ${flow.blockedBy || 'desconhecido'}`);
      } else if (flow.errorMessage) {
        lines.push(`Erro: ${flow.errorMessage}`);
      }
      const errors = flow.events.filter(e => e.type === 'error');
      const warns  = flow.events.filter(e => e.type === 'warning');
      if (errors.length > 0) {
        lines.push(`Erros no fluxo:`);
        errors.slice(0, 5).forEach(e => lines.push(`  - ❌ ${e.description}${e.detail ? ': ' + e.detail : ''}`));
      }
      if (warns.length > 0) {
        lines.push(`Avisos:`);
        warns.slice(0, 3).forEach(e => lines.push(`  - ⚠️ ${e.description}`));
      }
      lines.push('');
    }
  }

  // ── Broken links (detailed) ────────────────────────────────────────────────
  if (summary.brokenLinks && summary.brokenLinks.length > 0) {
    lines.push(`## Links Quebrados (${summary.brokenLinks.length})`);
    for (const link of summary.brokenLinks.slice(0, 10)) {
      lines.push(`- Texto: "${link.text || '(sem texto)'}"`);
      lines.push(`  URL: ${link.href}`);
      lines.push(`  Status: HTTP ${link.status || 'Timeout'}`);
      if (link.elementHtml) lines.push(`  Elemento: ${link.elementHtml.slice(0, 100)}`);
    }
    lines.push('');
  }

  // ── Network errors (detailed) ─────────────────────────────────────────────
  if (summary.networkErrors && summary.networkErrors.length > 0) {
    lines.push(`## Erros de Rede (${summary.networkErrors.length})`);
    for (const err of summary.networkErrors.slice(0, 10)) {
      lines.push(`- ${err.method} ${err.url}`);
      lines.push(`  Status: ${err.status ?? 'Erro de conexão'} | Tempo: ${err.duration ? err.duration + 'ms' : 'N/A'}`);
      if (err.responseBody) lines.push(`  Resposta: ${err.responseBody.slice(0, 120)}`);
      if (err.error)        lines.push(`  Erro: ${err.error}`);
    }
    lines.push('');
  }

  // ── Console errors ─────────────────────────────────────────────────────────
  if (summary.consoleErrors && summary.consoleErrors.length > 0) {
    lines.push(`## Erros de Console (${summary.consoleErrors.length})`);
    summary.consoleErrors.slice(0, 8).forEach(e => lines.push(`- ${e}`));
    if (summary.consoleErrors.length > 8) lines.push(`  ...e mais ${summary.consoleErrors.length - 8} erros`);
    lines.push('');
  }

  // ── Performance ───────────────────────────────────────────────────────────
  const p = summary.performance;
  if (p && (p.ttfb !== undefined || p.fcp !== undefined)) {
    lines.push('## Métricas de Performance');
    if (p.ttfb !== undefined) lines.push(`- TTFB: ${p.ttfb}ms ${p.ttfb > 800 ? '⚠️ lento' : '✅'}`);
    if (p.fcp  !== undefined) lines.push(`- FCP:  ${p.fcp}ms ${p.fcp > 2500 ? '⚠️ lento' : '✅'}`);
    if (p.lcp  !== undefined) lines.push(`- LCP:  ${p.lcp}ms ${p.lcp > 4000 ? '❌ muito lento' : p.lcp > 2500 ? '⚠️' : '✅'}`);
    if (p.loadEvent  !== undefined) lines.push(`- Load total: ${p.loadEvent}ms`);
    if (p.resourceCount !== undefined) lines.push(`- Recursos carregados: ${p.resourceCount}`);
    lines.push('');
  }

  // ── Timeline (key events only) ────────────────────────────────────────────
  const keyEvents = summary.timeline.filter(e => ['navigate', 'error', 'success', 'skipped'].includes(e.type));
  if (keyEvents.length > 0) {
    lines.push(`## Linha do Tempo (eventos chave)`);
    for (const ev of keyEvents.slice(0, 15)) {
      const time = new Date(ev.timestamp).toLocaleTimeString('pt-BR');
      const icon = ev.type === 'error' ? '❌' : ev.type === 'success' ? '✅' : ev.type === 'skipped' ? '⏭️' : '→';
      lines.push(`${time} ${icon} [${ev.flowName}] ${ev.description}${ev.detail ? ' — ' + ev.detail : ''}`);
    }
    lines.push('');
  }

  // ── Summary stats ─────────────────────────────────────────────────────────
  lines.push('---');
  lines.push('## Resumo Quantitativo');
  lines.push(`Total de verificações: ${summary.totalChecks}`);
  lines.push(`Passou: ${summary.passed} ✅`);
  lines.push(`Falhou: ${summary.failed} ❌`);
  lines.push(`Avisos: ${summary.warnings} ⚠️`);
  lines.push('');
  lines.push('Gere agora o relatório técnico completo em JSON conforme o formato especificado.');

  return lines.join('\n');
}
