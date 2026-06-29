/**
 * Navigation — structured module navigation with page validation.
 *
 * NEVER assumes a module was reached because a CSS class contains "pos".
 * Every navigation is confirmed by URL AND/OR DOM elements AND/OR visible text.
 *
 * Strategy order for every module:
 *   A. Direct URL navigation (fastest, works if route is known)
 *   B. Click card / quick-access widget
 *   C. Click sidebar/nav link
 *   D. Click "Acessar" button near module title
 *   E. Generic text click
 * Only after all strategies fail: return error with full attempt log.
 */

import type { Page } from 'playwright';
import { SmartLocator, type LocatorStrategy } from './SmartLocator';

interface ModuleConfig {
  paths: string[];                              // URL paths to try first
  navStrategies: Array<{
    name: string;
    strategies: LocatorStrategy[];
  }>;
  validators: string[];                         // CSS selectors that confirm we're on the module
  validatorTexts?: string[];                    // Visible texts that confirm the module
}

const MODULE_CONFIGS: Record<string, ModuleConfig> = {

  // ── PDV / POS ───────────────────────────────────────────────────────────────
  pdv: {
    paths: ['/pdv', '/pos', '/caixa', '/frente-de-caixa', '/ponto-de-venda', '/frente-caixa', '/vendas/nova'],
    navStrategies: [
      {
        name: 'Card de Acesso Rápido',
        strategies: [
          { description: 'Card com texto PDV',    type: 'css',  value: '[class*="card"]:has-text("PDV"),[class*="card"]:has-text("POS"),[class*="card"]:has-text("Caixa"),[class*="card"]:has-text("Frente de Caixa")' },
          { description: 'Quick-access POS',      type: 'css',  value: '[class*="quick"]:has-text("POS"),[class*="quick"]:has-text("PDV"),[class*="access"]:has-text("PDV")' },
          { description: 'div[title*=PDV]',       type: 'css',  value: 'div[title*="PDV" i],div[title*="POS" i],div[title*="caixa" i]' },
        ],
      },
      {
        name: 'Link de Navegação (sidebar/nav)',
        strategies: [
          { description: 'a[href*=/pdv]',         type: 'href', value: '/pdv' },
          { description: 'a[href*=/pos]',          type: 'href', value: '/pos' },
          { description: 'a[href*=/caixa]',        type: 'href', value: '/caixa' },
          { description: 'nav/aside link PDV',     type: 'css',  value: 'nav a:has-text("PDV"),aside a:has-text("PDV"),[class*="sidebar"] a:has-text("PDV"),[class*="menu"] a:has-text("PDV")' },
          { description: 'menu-item PDV',          type: 'css',  value: '[class*="menu-item"]:has-text("PDV"),[class*="nav-item"]:has-text("PDV"),li a:has-text("PDV")' },
        ],
      },
      {
        name: 'Botão Acessar / Abrir',
        strategies: [
          { description: 'XPath Botão Acessar perto de PDV', type: 'xpath', value: '//*[contains(translate(text(),"pdv","PDV"),"PDV") or contains(text(),"POS") or contains(text(),"Caixa")]/ancestor::*[position()<=5]//button[contains(text(),"Acessar") or contains(text(),"Entrar") or contains(text(),"Abrir") or contains(text(),"Ir")]' },
          { description: 'Botão Nova Venda',       type: 'regex', value: '^(Nova Venda|Iniciar Venda|Abrir Caixa|Novo Atendimento)$' },
        ],
      },
      {
        name: 'Texto / data-testid',
        strategies: [
          { description: 'Texto "PDV"',            type: 'text', value: 'PDV' },
          { description: 'Texto "POS"',            type: 'text', value: 'POS' },
          { description: 'Texto "Ponto de Venda"', type: 'text', value: 'Ponto de Venda' },
          { description: 'data-testid=pdv/pos',   type: 'testid', value: 'pdv' },
          { description: 'aria-label PDV',         type: 'arialabel', value: 'PDV' },
        ],
      },
    ],
    validators: [
      'input[placeholder*="produto" i]',
      'input[placeholder*="buscar produto" i]',
      'input[placeholder*="adicionar produto" i]',
      '[class*="cart-item"],[class*="sale-item"],[class*="venda-item"],[class*="item-venda"]',
      '[data-testid*="add-product"],[data-testid*="product-search"],[data-testid*="pdv"]',
      '[class*="pdv-page"],[class*="pos-page"],[class*="caixa-page"]',
      '[class*="pdv-container"],[class*="pos-container"]',
    ],
    validatorTexts: ['Nova Venda', 'Buscar Produto', 'Adicionar Produto', 'Finalizar Venda', 'Iniciar Venda'],
  },

  // ── Checkout ─────────────────────────────────────────────────────────────────
  checkout: {
    paths: ['/checkout', '/carrinho', '/cart', '/finalizar-compra', '/bag'],
    navStrategies: [
      {
        name: 'Ícone de Carrinho',
        strategies: [
          { description: 'Ícone carrinho',         type: 'css',  value: '[class*="cart-icon"],[class*="carrinho"],[aria-label*="cart" i],[aria-label*="carrinho" i]' },
          { description: 'a[href*=/checkout]',     type: 'href', value: '/checkout' },
          { description: 'a[href*=/carrinho]',     type: 'href', value: '/carrinho' },
          { description: 'Botão Ver Carrinho',     type: 'regex', value: '(Ver Carrinho|Ir para Checkout|Finalizar Compra)' },
        ],
      },
    ],
    validators: [
      '[class*="cart-item"],[class*="checkout-item"],[class*="carrinho-item"]',
      '[class*="order-summary"],[class*="cart-total"],[class*="subtotal"]',
      'input[placeholder*="endereço" i],input[placeholder*="CEP" i],input[name*="cep" i]',
    ],
    validatorTexts: ['Subtotal', 'Finalizar Compra', 'Revisar Pedido', 'Total do Pedido'],
  },

  // ── Produtos ─────────────────────────────────────────────────────────────────
  produtos: {
    paths: ['/produtos', '/products', '/catalogo', '/items', '/itens', '/mercadorias'],
    navStrategies: [
      {
        name: 'Link Produtos',
        strategies: [
          { description: 'nav link Produtos',      type: 'css',  value: 'nav a:has-text("Produtos"),[class*="sidebar"] a:has-text("Produtos"),[class*="menu"] a:has-text("Produto")' },
          { description: 'a[href*=/produto]',      type: 'href', value: '/produto' },
          { description: 'Card Produtos',          type: 'css',  value: '[class*="card"]:has-text("Produto"),[class*="card"]:has-text("Catálogo")' },
          { description: 'Texto Produtos',         type: 'text', value: 'Produtos' },
        ],
      },
    ],
    validators: [
      '[class*="product-list"],[class*="produto-list"],[class*="product-table"]',
      'button:has-text("Novo Produto"),button:has-text("Adicionar Produto"),button:has-text("+ Produto")',
      'table th:has-text("Produto"),table th:has-text("Preço")',
    ],
    validatorTexts: ['Novo Produto', 'Adicionar Produto', 'Catálogo de Produtos', 'Lista de Produtos'],
  },

  // ── Estoque ───────────────────────────────────────────────────────────────────
  estoque: {
    paths: ['/estoque', '/inventory', '/stock', '/almoxarifado', '/armazem'],
    navStrategies: [
      {
        name: 'Link Estoque',
        strategies: [
          { description: 'nav link Estoque',       type: 'css',  value: 'nav a:has-text("Estoque"),[class*="sidebar"] a:has-text("Estoque"),[class*="menu"] a:has-text("Estoque")' },
          { description: 'a[href*=/estoque]',      type: 'href', value: '/estoque' },
          { description: 'Card Estoque',           type: 'css',  value: '[class*="card"]:has-text("Estoque"),[class*="card"]:has-text("Inventário")' },
          { description: 'Texto Estoque',          type: 'text', value: 'Estoque' },
        ],
      },
    ],
    validators: [
      '[class*="stock-list"],[class*="estoque-list"],[class*="inventory-list"]',
      'button:has-text("Nova Entrada"),button:has-text("Entrada"),button:has-text("Saída de Estoque")',
      'table th:has-text("Estoque"),table th:has-text("Saldo")',
    ],
    validatorTexts: ['Entrada de Mercadoria', 'Saída de Mercadoria', 'Estoque Atual', 'Saldo em Estoque', 'Inventário'],
  },

  // ── Pedidos ───────────────────────────────────────────────────────────────────
  pedidos: {
    paths: ['/pedidos', '/orders', '/encomendas', '/vendas', '/order'],
    navStrategies: [
      {
        name: 'Link Pedidos',
        strategies: [
          { description: 'nav link Pedidos',       type: 'css',  value: 'nav a:has-text("Pedidos"),[class*="sidebar"] a:has-text("Pedidos"),[class*="menu"] a:has-text("Pedido")' },
          { description: 'a[href*=/pedido]',       type: 'href', value: '/pedido' },
          { description: 'Card Pedidos',           type: 'css',  value: '[class*="card"]:has-text("Pedidos"),[class*="card"]:has-text("Orders")' },
          { description: 'Texto Pedidos',          type: 'text', value: 'Pedidos' },
        ],
      },
    ],
    validators: [
      '[class*="order-list"],[class*="pedido-list"]',
      'table th:has-text("Status"),table th:has-text("Pedido")',
      'table th:has-text("Cliente"),table th:has-text("Valor")',
    ],
    validatorTexts: ['Lista de Pedidos', 'Número do Pedido', 'Status do Pedido', 'Novo Pedido'],
  },

  // ── Financeiro ────────────────────────────────────────────────────────────────
  financeiro: {
    paths: ['/financeiro', '/finance', '/contas', '/fluxo-caixa', '/contabil'],
    navStrategies: [
      {
        name: 'Link Financeiro',
        strategies: [
          { description: 'nav link Financeiro',    type: 'css',  value: 'nav a:has-text("Financeiro"),[class*="sidebar"] a:has-text("Financeiro"),[class*="menu"] a:has-text("Financeiro")' },
          { description: 'a[href*=/financeiro]',   type: 'href', value: '/financeiro' },
          { description: 'Card Financeiro',        type: 'css',  value: '[class*="card"]:has-text("Financeiro"),[class*="card"]:has-text("Finance")' },
          { description: 'Texto Financeiro',       type: 'text', value: 'Financeiro' },
        ],
      },
    ],
    validators: [
      '[class*="finance-dashboard"],[class*="financeiro"],[class*="financeiro-page"]',
      'table th:has-text("Vencimento"),table th:has-text("Valor")',
      'button:has-text("Nova Conta"),button:has-text("Lançamento")',
    ],
    validatorTexts: ['Contas a Pagar', 'Contas a Receber', 'Fluxo de Caixa', 'Saldo Atual'],
  },

  // ── Relatórios ────────────────────────────────────────────────────────────────
  relatorios: {
    paths: ['/relatorios', '/reports', '/relatorio', '/dashboard/relatorios', '/analytics'],
    navStrategies: [
      {
        name: 'Link Relatórios',
        strategies: [
          { description: 'nav link Relatório',     type: 'css',  value: 'nav a:has-text("Relatório"),[class*="sidebar"] a:has-text("Relatório"),[class*="menu"] a:has-text("Relatório")' },
          { description: 'a[href*=/relatorio]',    type: 'href', value: '/relatorio' },
          { description: 'Card Relatórios',        type: 'css',  value: '[class*="card"]:has-text("Relatório"),[class*="card"]:has-text("Report")' },
          { description: 'Texto Relatórios',       type: 'text', value: 'Relatórios' },
        ],
      },
    ],
    validators: [
      '[class*="report-list"],[class*="relatorio-list"]',
      'button:has-text("Exportar"),button:has-text("Gerar Relatório")',
      'select[name*="periodo" i],input[type="date"]',
    ],
    validatorTexts: ['Exportar', 'Gerar Relatório', 'Filtrar por Período', 'Relatórios Disponíveis'],
  },

  // ── Cadastro ──────────────────────────────────────────────────────────────────
  cadastro: {
    paths: ['/cadastro', '/registro', '/signup', '/register', '/nova-conta', '/criar-conta'],
    navStrategies: [
      {
        name: 'Link Cadastro',
        strategies: [
          { description: 'a:has-text Cadastro',    type: 'css',  value: 'a:has-text("Cadastro"),a:has-text("Registrar"),a:has-text("Criar Conta")' },
          { description: 'a[href*=/cadastro]',     type: 'href', value: '/cadastro' },
          { description: 'Botão Criar Conta',      type: 'regex', value: '(Criar Conta|Nova Conta|Registrar|Cadastrar)' },
        ],
      },
    ],
    validators: [
      'form input[type="email"]',
      'form input[name*="nome" i],form input[name*="name" i]',
      'button[type="submit"]:has-text("Cadastrar"),button[type="submit"]:has-text("Criar")',
    ],
    validatorTexts: ['Criar Conta', 'Fazer Cadastro', 'Registrar-se', 'Criar Minha Conta'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────

export interface NavigationResult {
  success: boolean;
  url?: string;
  strategyUsed?: string;
  log: string[];
  error?: string;
}

export interface PageInventory {
  title: string;
  url: string;
  navigationItems: string[];
  moduleCards: string[];
}

export class Navigation {
  private locator = new SmartLocator();

  async openModule(page: Page, module: string, baseUrl: string): Promise<NavigationResult> {
    const key = module.toLowerCase();
    const config = MODULE_CONFIGS[key];
    if (!config) {
      return { success: false, error: `Módulo "${module}" sem configuração de navegação`, log: [`✖ Módulo "${module}" não mapeado`] };
    }

    const log: string[] = [];
    log.push(`→ Abrindo módulo: ${module.toUpperCase()}`);

    // ── Strategy A: Direct URL ─────────────────────────────────────────────
    for (const tryPath of config.paths) {
      const url = `${new URL(baseUrl).origin}${tryPath}`;
      log.push(`  [URL] Tentando: ${url}`);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
        await page.waitForTimeout(400);
        if (await this.validateModule(page, module)) {
          log.push(`  ✔ Módulo confirmado via URL direta: ${tryPath}`);
          return { success: true, url: page.url(), strategyUsed: `URL: ${tryPath}`, log };
        }
        log.push(`  ✖ URL carregada mas módulo não confirmado (URL atual: ${page.url()})`);
      } catch {
        log.push(`  ✖ URL ${url}: timeout/erro de rede`);
      }
    }

    // Navigate back to base to try clicking
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 8000 });
      await page.waitForTimeout(500);
    } catch { /* continue */ }

    // ── Strategy B–E: Click navigation elements ────────────────────────────
    for (const navStrategy of config.navStrategies) {
      log.push(`  [Click] Estratégia: ${navStrategy.name}`);
      const { found, locator, strategy, log: findLog } = await this.locator.find(page, navStrategy.strategies, 2000);
      log.push(...findLog);

      if (found && locator) {
        log.push(`  → Clicando: ${strategy!.description}`);
        try {
          await locator.click({ timeout: 5000 });
          await page.waitForLoadState('domcontentloaded', { timeout: 8000 });
          await page.waitForTimeout(700);

          if (await this.validateModule(page, module)) {
            log.push(`  ✔ Módulo confirmado após clique em: ${strategy!.description}`);
            return { success: true, url: page.url(), strategyUsed: navStrategy.name, log };
          }
          log.push(`  ✖ Clicado mas módulo não confirmado (URL: ${page.url()})`);
        } catch (e) {
          log.push(`  ✖ Clique falhou: ${e instanceof Error ? e.message.slice(0, 60) : 'erro'}`);
        }
      }
    }

    return {
      success: false,
      log,
      error: `Módulo "${module}" não encontrado após ${config.paths.length + config.navStrategies.length} estratégias`,
    };
  }

  async validateModule(page: Page, module: string): Promise<boolean> {
    const key = module.toLowerCase();
    const config = MODULE_CONFIGS[key];
    if (!config) return false;

    const url = page.url().toLowerCase();

    // 1. URL match
    if (config.paths.some(p => url.includes(p.toLowerCase()))) return true;

    // 2. DOM element validators
    for (const sel of config.validators) {
      try {
        const el = await page.$(sel);
        if (el && await el.isVisible()) return true;
      } catch { /* try next */ }
    }

    // 3. Visible text validators
    for (const text of config.validatorTexts || []) {
      try {
        const el = page.getByText(text, { exact: false });
        if (await el.first().isVisible({ timeout: 800 })) return true;
      } catch { /* try next */ }
    }

    return false;
  }

  async buildInventory(page: Page): Promise<PageInventory> {
    const title = await page.title().catch(() => '');
    const url   = page.url();

    const navItems = await page.$$eval(
      'nav a,[class*="sidebar"] a,[class*="menu"] a,[class*="nav-link"]',
      els => [...new Set(
        els.map(el => (el.textContent || '').trim().replace(/\s+/g, ' '))
          .filter(t => t.length >= 2 && t.length <= 40)
      )],
    ).catch(() => [] as string[]);

    const cards = await page.$$eval(
      '[class*="card"],[class*="quick"],[class*="module-btn"],[class*="access-btn"]',
      els => [...new Set(
        els.map(el => (el.textContent || '').trim().split('\n')[0].trim())
          .filter(t => t.length >= 2 && t.length <= 40)
      )],
    ).catch(() => [] as string[]);

    return {
      title,
      url,
      navigationItems: navItems.slice(0, 20),
      moduleCards:     cards.slice(0, 15),
    };
  }
}
