/**
 * contracts.ts — Execution contract system.
 *
 * An ExecutionContract defines exactly:
 *   - allowedTests: what will run (shown as ✔ in the UI)
 *   - forbiddenItems: what is explicitly skipped (shown as ✖)
 *   - forbiddenCategories: used by TestRunner to gate active checks
 *
 * Three audit modes:
 *   global  — everything runs (SEO + all functional + links + accessibility)
 *   module  — one module's functional tests + monitoring; no SEO/links/a11y
 *   flow    — only functional steps; nothing infrastructure-related
 */

import type { AuditMode, ExecutionContract, TestGroup } from './types';
import { INTENTS, getIntent } from './intents';

// ─── Test group registry ─────────────────────────────────────────────────────

export const TEST_GROUPS: TestGroup[] = [
  // ── Cross-cutting ──────────────────────────────────────────────────────────
  { id: 'login',            name: 'Login / Autenticação',     emoji: '🔐', category: 'functional' },
  { id: 'performance',      name: 'Performance (TTFB/LCP)',   emoji: '⚡', category: 'performance' },
  { id: 'network_errors',   name: 'Erros de rede (4xx/5xx)',  emoji: '🌐', category: 'network' },
  { id: 'console_errors',   name: 'Erros de console JS',      emoji: '🖥️', category: 'network' },

  // ── SEO ────────────────────────────────────────────────────────────────────
  { id: 'seo_title',        name: 'Title da página',          emoji: '📝', category: 'seo' },
  { id: 'seo_meta',         name: 'Meta description',         emoji: '📋', category: 'seo' },
  { id: 'seo_h1',           name: 'Estrutura H1',             emoji: '📰', category: 'seo' },
  { id: 'seo_images',       name: 'Imagens sem alt',          emoji: '🖼️', category: 'seo' },

  // ── Links ──────────────────────────────────────────────────────────────────
  { id: 'broken_links',     name: 'Links quebrados',          emoji: '🔗', category: 'links' },

  // ── Accessibility ─────────────────────────────────────────────────────────
  { id: 'accessibility',    name: 'Acessibilidade',           emoji: '♿', category: 'accessibility' },

  // ── PDV ───────────────────────────────────────────────────────────────────
  { id: 'pdv_open',         name: 'Abrir PDV/Caixa',          emoji: '🏪', category: 'functional', module: 'pdv' },
  { id: 'pdv_add_product',  name: 'Adicionar produto',        emoji: '➕', category: 'functional', module: 'pdv' },
  { id: 'pdv_change_qty',   name: 'Alterar quantidade',       emoji: '🔢', category: 'functional', module: 'pdv' },
  { id: 'pdv_discount',     name: 'Aplicar desconto',         emoji: '💸', category: 'functional', module: 'pdv' },
  { id: 'pdv_remove',       name: 'Remover produto',          emoji: '✖️', category: 'functional', module: 'pdv' },
  { id: 'pdv_payment',      name: 'Forma de pagamento',       emoji: '💳', category: 'functional', module: 'pdv' },
  { id: 'pdv_finish',       name: 'Finalizar venda',          emoji: '✅', category: 'functional', module: 'pdv' },
  { id: 'pdv_cancel',       name: 'Cancelar venda',           emoji: '🚫', category: 'functional', module: 'pdv' },

  // ── Checkout ──────────────────────────────────────────────────────────────
  { id: 'checkout_browse',  name: 'Navegar produtos',         emoji: '🛍️', category: 'functional', module: 'checkout' },
  { id: 'checkout_cart',    name: 'Adicionar ao carrinho',    emoji: '🛒', category: 'functional', module: 'checkout' },
  { id: 'checkout_qty',     name: 'Alterar quantidade',       emoji: '🔢', category: 'functional', module: 'checkout' },
  { id: 'checkout_remove',  name: 'Remover item',             emoji: '✖️', category: 'functional', module: 'checkout' },
  { id: 'checkout_delivery',name: 'Dados de entrega',         emoji: '📦', category: 'functional', module: 'checkout' },
  { id: 'checkout_payment', name: 'Pagamento',                emoji: '💳', category: 'functional', module: 'checkout' },
  { id: 'checkout_confirm', name: 'Confirmar pedido',         emoji: '✅', category: 'functional', module: 'checkout' },

  // ── Produtos ──────────────────────────────────────────────────────────────
  { id: 'produtos_list',    name: 'Listar produtos',          emoji: '📦', category: 'functional', module: 'produtos' },
  { id: 'produtos_search',  name: 'Buscar produto',           emoji: '🔍', category: 'functional', module: 'produtos' },
  { id: 'produtos_create',  name: 'Criar produto',            emoji: '➕', category: 'functional', module: 'produtos' },
  { id: 'produtos_edit',    name: 'Editar produto',           emoji: '✏️', category: 'functional', module: 'produtos' },
  { id: 'produtos_deact',   name: 'Inativar produto',         emoji: '🚫', category: 'functional', module: 'produtos' },

  // ── Estoque ───────────────────────────────────────────────────────────────
  { id: 'estoque_view',     name: 'Visualizar estoque',       emoji: '📊', category: 'functional', module: 'estoque' },
  { id: 'estoque_search',   name: 'Buscar item',              emoji: '🔍', category: 'functional', module: 'estoque' },
  { id: 'estoque_entry',    name: 'Entrada de mercadoria',    emoji: '📥', category: 'functional', module: 'estoque' },
  { id: 'estoque_exit',     name: 'Saída de mercadoria',      emoji: '📤', category: 'functional', module: 'estoque' },
  { id: 'estoque_alert',    name: 'Alertas de mínimo',        emoji: '⚠️', category: 'functional', module: 'estoque' },

  // ── Pedidos ───────────────────────────────────────────────────────────────
  { id: 'pedidos_list',     name: 'Listar pedidos',           emoji: '📋', category: 'functional', module: 'pedidos' },
  { id: 'pedidos_detail',   name: 'Detalhe do pedido',        emoji: '🔍', category: 'functional', module: 'pedidos' },
  { id: 'pedidos_status',   name: 'Alterar status',           emoji: '🔄', category: 'functional', module: 'pedidos' },
  { id: 'pedidos_cancel',   name: 'Cancelar pedido',          emoji: '🚫', category: 'functional', module: 'pedidos' },

  // ── Financeiro ────────────────────────────────────────────────────────────
  { id: 'fin_dashboard',    name: 'Painel financeiro',        emoji: '💰', category: 'functional', module: 'financeiro' },
  { id: 'fin_pagar',        name: 'Conta a pagar',            emoji: '💸', category: 'functional', module: 'financeiro' },
  { id: 'fin_receber',      name: 'Conta a receber',          emoji: '💵', category: 'functional', module: 'financeiro' },
  { id: 'fin_fluxo',        name: 'Fluxo de caixa',           emoji: '📈', category: 'functional', module: 'financeiro' },

  // ── Relatórios ────────────────────────────────────────────────────────────
  { id: 'rel_view',         name: 'Ver relatórios',           emoji: '📈', category: 'functional', module: 'relatorios' },
  { id: 'rel_filter',       name: 'Filtrar por período',      emoji: '📅', category: 'functional', module: 'relatorios' },
  { id: 'rel_export',       name: 'Exportar relatório',       emoji: '📥', category: 'functional', module: 'relatorios' },

  // ── Cadastro ──────────────────────────────────────────────────────────────
  { id: 'cad_form',         name: 'Formulário de cadastro',   emoji: '📝', category: 'functional', module: 'cadastro' },
  { id: 'cad_validate',     name: 'Validações do form',       emoji: '✅', category: 'functional', module: 'cadastro' },
  { id: 'cad_duplicate',    name: 'Cadastro duplicado',       emoji: '🔁', category: 'functional', module: 'cadastro' },
];

// ─── Module summary labels (for forbidden items list) ─────────────────────────

const MODULE_LABELS: Record<string, { name: string; emoji: string }> = {
  pdv:        { name: 'PDV / Caixa',   emoji: '🏪' },
  checkout:   { name: 'Checkout',      emoji: '🛒' },
  produtos:   { name: 'Produtos',      emoji: '📦' },
  estoque:    { name: 'Estoque',       emoji: '📊' },
  pedidos:    { name: 'Pedidos',       emoji: '📋' },
  financeiro: { name: 'Financeiro',    emoji: '💰' },
  relatorios: { name: 'Relatórios',    emoji: '📈' },
  cadastro:   { name: 'Cadastro',      emoji: '📝' },
};

// ─── Contract builder ─────────────────────────────────────────────────────────

export function buildContract(
  mode: AuditMode,
  intentId: string,
  customSteps?: string[],
): ExecutionContract {

  const seoTests    = TEST_GROUPS.filter(t => t.category === 'seo');
  const linksTests  = TEST_GROUPS.filter(t => t.category === 'links');
  const a11yTests   = TEST_GROUPS.filter(t => t.category === 'accessibility');
  const perfTests   = TEST_GROUPS.filter(t => t.category === 'performance' || t.category === 'network');
  const loginTest   = TEST_GROUPS.find(t => t.id === 'login')!;
  const infraTests  = [...seoTests, ...linksTests, ...a11yTests];

  // ── Global: everything runs ───────────────────────────────────────────────
  if (mode === 'global') {
    const intent = getIntent(intentId);
    const moduleTests = intent ? TEST_GROUPS.filter(t => t.module === intent.id) : [];
    const allFunctional = intent && intent.id !== 'exploratorio'
      ? [loginTest, ...moduleTests, ...perfTests]
      : TEST_GROUPS.filter(t => t.category === 'functional');

    return {
      mode,
      intent: intent?.id || 'exploratorio',
      intentName: intent?.id !== 'exploratorio' ? intent!.name : 'Sistema Completo',
      intentEmoji: intent?.id !== 'exploratorio' ? intent!.emoji : '🌐',
      allowedTests: [...allFunctional, ...infraTests, ...perfTests].filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i),
      forbiddenItems: [],
      forbiddenCategories: [],
      customSteps,
    };
  }

  // ── Unknown intent: need clarification ───────────────────────────────────
  const intent = getIntent(intentId);
  if (!intent || intent.id === 'exploratorio') {
    return {
      mode,
      intent: 'exploratorio',
      intentName: 'Módulo não identificado',
      intentEmoji: '❓',
      allowedTests: [loginTest, ...perfTests],
      forbiddenItems: [],
      forbiddenCategories: [],
      needsClarification: true,
      customSteps,
    };
  }

  const moduleTests = TEST_GROUPS.filter(t => t.module === intent.id);

  // Other modules as single items in the forbidden list (collapsed)
  const otherModuleItems: TestGroup[] = Object.entries(MODULE_LABELS)
    .filter(([mod]) => mod !== intent.id)
    .map(([mod, label]) => ({
      id: `module_${mod}`,
      name: label.name,
      emoji: label.emoji,
      category: 'functional' as const,
      module: mod,
    }));

  // ── Module: functional focus + monitoring, no SEO/links/a11y ─────────────
  if (mode === 'module') {
    return {
      mode,
      intent: intent.id,
      intentName: intent.name,
      intentEmoji: intent.emoji,
      allowedTests: [loginTest, ...moduleTests, ...perfTests],
      forbiddenItems: [...seoTests, ...linksTests, ...a11yTests, ...otherModuleItems],
      forbiddenCategories: ['seo', 'links', 'accessibility'],
      customSteps,
    };
  }

  // ── Flow: only functional steps, zero infrastructure ─────────────────────
  return {
    mode,
    intent: intent.id,
    intentName: intent.name,
    intentEmoji: intent.emoji,
    allowedTests: [loginTest, ...moduleTests],
    forbiddenItems: [...seoTests, ...linksTests, ...a11yTests, ...perfTests, ...otherModuleItems],
    forbiddenCategories: ['seo', 'links', 'accessibility', 'performance', 'network'],
    customSteps,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isAllowedCategory(contract: ExecutionContract | undefined, category: string): boolean {
  if (!contract) return true;
  return !contract.forbiddenCategories.includes(category);
}

export const ALL_INTENT_SUMMARIES = Object.values(INTENTS).map(i => ({
  id: i.id, name: i.name, emoji: i.emoji, description: i.description,
}));
