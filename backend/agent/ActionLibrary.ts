/**
 * ActionLibrary — reusable atomic Playwright actions.
 *
 * Each action:
 *   1. Tries multiple strategies via SmartLocator
 *   2. Returns a structured ActionResult with success/detail/log
 *   3. Never throws — errors become failed ActionResults
 *   4. Never interprets natural language — caller passes typed params
 */

import type { Page } from 'playwright';
import { SmartLocator, type LocatorStrategy } from './SmartLocator';
import { Navigation } from './Navigation';

export interface ActionResult {
  success: boolean;
  detail: string;
  duration: number;
  log: string[];
}

export class ActionLibrary {
  private loc = new SmartLocator();
  private nav = new Navigation();

  // ── Navigation ───────────────────────────────────────────────────────────────

  async openModule(page: Page, module: string, baseUrl: string): Promise<ActionResult> {
    const start = Date.now();
    const result = await this.nav.openModule(page, module, baseUrl);
    return {
      success:  result.success,
      detail:   result.success
        ? `Módulo "${module}" aberto via: ${result.strategyUsed}`
        : result.error || `Falha ao abrir "${module}"`,
      duration: Date.now() - start,
      log:      result.log,
    };
  }

  async validateModule(page: Page, module: string): Promise<ActionResult> {
    const start = Date.now();
    const valid = await this.nav.validateModule(page, module);
    return {
      success:  valid,
      detail:   valid
        ? `Módulo "${module}" confirmado na página atual (${page.url()})`
        : `Módulo "${module}" NÃO confirmado — URL: ${page.url()}`,
      duration: Date.now() - start,
      log: [valid
        ? `  ✔ Validação OK: URL ou DOM confirmou "${module}"`
        : `  ✖ Validação falhou — nenhum indicador de "${module}" encontrado`,
      ],
    };
  }

  // ── Modal ────────────────────────────────────────────────────────────────────

  async closeModal(page: Page): Promise<ActionResult> {
    const start = Date.now();
    const strategies: LocatorStrategy[] = [
      { description: '[aria-label*=close/fechar]',     type: 'css',      value: '[aria-label*="close" i],[aria-label*="fechar" i]' },
      { description: '.modal-close / .close-btn',      type: 'css',      value: '.modal-close,.close-btn,[data-dismiss="modal"],.swal2-close,.btn-close' },
      { description: 'button.close',                   type: 'css',      value: 'button.close,button[class*="close"]' },
      { description: '[data-modal-close]',             type: 'css',      value: '[data-modal-close],[class*="modal__close"],[class*="closeButton"]' },
      { description: 'Botão ×',                        type: 'text',     value: '×' },
      { description: 'Botão ✕',                        type: 'text',     value: '✕' },
      { description: 'Botão Fechar (texto)',            type: 'text',     value: 'Fechar' },
      { description: 'role=button X/×',                type: 'role',     value: 'button', options: { name: /^[x×✕✗]$/i } },
    ];

    const { found, locator, strategy, log } = await this.loc.find(page, strategies, 1500);
    if (found && locator) {
      await locator.click({ timeout: 5000 });
      await page.waitForTimeout(500);
      return { success: true, detail: `Modal fechado via: ${strategy!.description}`, duration: Date.now() - start, log };
    }
    return { success: false, detail: 'Nenhum modal/popup visível encontrado', duration: Date.now() - start, log };
  }

  // ── PDV / Carrinho ───────────────────────────────────────────────────────────

  async searchProduct(page: Page, query = 'produto'): Promise<ActionResult> {
    const start = Date.now();
    const strategies: LocatorStrategy[] = [
      { description: 'placeholder "produto"',          type: 'css',  value: 'input[placeholder*="produto" i]' },
      { description: 'placeholder "buscar"',           type: 'css',  value: 'input[placeholder*="buscar" i]' },
      { description: 'placeholder "search"',           type: 'css',  value: 'input[placeholder*="search" i]' },
      { description: 'placeholder "adicionar"',        type: 'css',  value: 'input[placeholder*="adicionar" i]' },
      { description: 'input no [class*=pdv/pos/caixa]',type: 'css',  value: '[class*="pdv"] input[type="text"],[class*="pos"] input[type="text"],[class*="caixa"] input[type="text"]' },
      { description: 'input[class*=search/busca]',     type: 'css',  value: '[class*="search"] input,[class*="busca"] input,input[class*="search"]' },
      { description: 'input[name*=product/produto]',   type: 'css',  value: 'input[name*="product" i],input[name*="produto" i]' },
    ];
    const { found, locator, strategy, log } = await this.loc.find(page, strategies, 3000);
    if (found && locator) {
      await locator.clear({ timeout: 2000 }).catch(() => {});
      await locator.fill(query, { timeout: 3000 });
      await page.waitForTimeout(700);
      return { success: true, detail: `Busca "${query}" realizada (${strategy!.description})`, duration: Date.now() - start, log };
    }
    return { success: false, detail: 'Campo de busca de produto não encontrado', duration: Date.now() - start, log };
  }

  async addProduct(page: Page): Promise<ActionResult> {
    const start = Date.now();
    const strategies: LocatorStrategy[] = [
      { description: 'Botão Adicionar/Add',            type: 'css',  value: 'button:has-text("Adicionar"),button:has-text("Add"),button:has-text("Inserir")' },
      { description: 'Botão + Produto',                type: 'regex', value: '^[+] ?(Produto|Item|Adicionar)$' },
      { description: 'Primeiro resultado de busca',    type: 'css',  value: '[class*="search-result"]:first-child,[class*="product-result"]:first-child,[class*="item-result"]:first-child' },
      { description: 'Botão + (increment)',            type: 'css',  value: '[class*="add-btn"],[class*="add-product"],[data-testid*="add-product"]' },
      { description: 'Primeiro produto clicável',      type: 'css',  value: '[class*="product-item"]:first-child,[class*="produto-item"]:first-child,[class*="item-card"]:first-child' },
    ];
    const { found, locator, strategy, log } = await this.loc.find(page, strategies, 3000);
    if (found && locator) {
      const tag = await locator.evaluate(el => el.tagName.toLowerCase()).catch(() => 'div');
      if (tag === 'input') {
        await locator.press('Enter');
      } else {
        await locator.click({ timeout: 5000 });
      }
      await page.waitForTimeout(700);
      return { success: true, detail: `Produto adicionado via: ${strategy!.description}`, duration: Date.now() - start, log };
    }
    return { success: false, detail: 'Botão de adicionar produto não encontrado', duration: Date.now() - start, log };
  }

  async changeQuantity(page: Page, quantity = 2): Promise<ActionResult> {
    const start = Date.now();
    const strategies: LocatorStrategy[] = [
      { description: 'input name=qtd/qty/quantidade',  type: 'css',  value: 'input[name*="qtd" i],input[name*="qty" i],input[name*="quantidade" i]' },
      { description: 'input type=number no item',      type: 'css',  value: '[class*="cart"] input[type="number"],[class*="item"] input[type="number"],[class*="produto-lista"] input[type="number"]' },
      { description: 'Botão increment/+',              type: 'css',  value: 'button[class*="increment"],button[class*="increase"],[data-testid*="increment"],[data-testid*="qty-plus"]' },
      { description: 'input[class*=qty/qtd]',          type: 'css',  value: 'input[class*="qty" i],input[class*="qtd" i],input[class*="quantity" i]' },
    ];
    const { found, locator, strategy, log } = await this.loc.find(page, strategies, 3000);
    if (!found || !locator) {
      return { success: false, detail: 'Campo de quantidade não encontrado', duration: Date.now() - start, log };
    }
    const tag = await locator.evaluate(el => el.tagName.toLowerCase()).catch(() => 'button');
    if (tag === 'input') {
      await locator.fill(String(quantity), { timeout: 3000 });
      await locator.press('Tab');
    } else {
      for (let i = 1; i < quantity; i++) {
        await locator.click({ timeout: 3000 });
        await page.waitForTimeout(150);
      }
    }
    await page.waitForTimeout(400);
    return { success: true, detail: `Quantidade definida para ${quantity} via: ${strategy!.description}`, duration: Date.now() - start, log };
  }

  async changePrice(page: Page, price: number): Promise<ActionResult> {
    const start = Date.now();
    const strategies: LocatorStrategy[] = [
      { description: 'input name=preco/price',         type: 'css',  value: 'input[name*="preco" i],input[name*="price" i],input[name*="valor" i]' },
      { description: 'input placeholder preço',        type: 'css',  value: 'input[placeholder*="preço" i],input[placeholder*="price" i],input[placeholder*="valor" i]' },
      { description: '[data-testid*=price]',           type: 'testid', value: 'price' },
    ];
    const { found, locator, strategy, log } = await this.loc.find(page, strategies, 2000);
    if (found && locator) {
      await locator.fill(String(price), { timeout: 3000 });
      await locator.press('Tab');
      return { success: true, detail: `Preço alterado para ${price} via: ${strategy!.description}`, duration: Date.now() - start, log };
    }
    return { success: false, detail: 'Campo de preço não encontrado', duration: Date.now() - start, log };
  }

  async applyDiscount(page: Page, discountPct = 10): Promise<ActionResult> {
    const start = Date.now();
    const strategies: LocatorStrategy[] = [
      { description: 'input desconto/discount',        type: 'css',  value: 'input[name*="desconto" i],input[placeholder*="desconto" i],input[name*="discount" i]' },
      { description: 'Botão Desconto (abre campo)',    type: 'regex', value: '^(Desconto|Aplicar Desconto|% Desconto)$' },
      { description: '[data-testid*=discount]',        type: 'testid', value: 'discount' },
    ];
    const { found, locator, strategy, log } = await this.loc.find(page, strategies, 2000);
    if (!found || !locator) {
      return { success: false, detail: 'Campo/botão de desconto não encontrado', duration: Date.now() - start, log };
    }
    const tag = await locator.evaluate(el => el.tagName.toLowerCase()).catch(() => 'button');
    if (tag === 'input') {
      await locator.fill(String(discountPct), { timeout: 3000 });
      await locator.press('Enter');
    } else {
      // Click button to open discount modal/field
      await locator.click({ timeout: 3000 });
      await page.waitForTimeout(500);
      const inp = await page.$('input[name*="desconto" i],input[placeholder*="desconto" i],[class*="discount"] input');
      if (inp) {
        await inp.fill(String(discountPct));
        await page.keyboard.press('Enter');
      }
    }
    await page.waitForTimeout(400);
    return { success: true, detail: `Desconto de ${discountPct}% aplicado (${strategy!.description})`, duration: Date.now() - start, log };
  }

  async removeProduct(page: Page): Promise<ActionResult> {
    const start = Date.now();
    const strategies: LocatorStrategy[] = [
      { description: 'button remove/delete no item',   type: 'css',  value: '[class*="cart"] button[class*="remove"],[class*="item"] button[class*="remove"],[class*="cart"] button[class*="delete"]' },
      { description: 'Ícone lixeira no item',          type: 'css',  value: '[class*="cart-item"] [class*="trash"],[class*="item"] [class*="delete-icon"],[class*="linha"] button[class*="remove"]' },
      { description: 'Botão × no item da lista',       type: 'css',  value: '[class*="cart-item"] button:has-text("×"),[class*="item"] button:has-text("✕")' },
      { description: '[data-testid*=remove]',          type: 'testid', value: 'remove' },
      { description: 'Botão Remover (texto)',          type: 'text',  value: 'Remover' },
      { description: 'Botão Excluir (texto)',          type: 'text',  value: 'Excluir' },
    ];
    const { found, locator, strategy, log } = await this.loc.find(page, strategies, 2000);
    if (found && locator) {
      await locator.click({ timeout: 5000 });
      await page.waitForTimeout(600);
      return { success: true, detail: `Item removido via: ${strategy!.description}`, duration: Date.now() - start, log };
    }
    return { success: false, detail: 'Botão de remover item não encontrado', duration: Date.now() - start, log };
  }

  async selectPayment(page: Page): Promise<ActionResult> {
    const start = Date.now();
    const log: string[] = [];

    // Step 1: Click payment button (if present)
    const payBtnStrategies: LocatorStrategy[] = [
      { description: 'Botão Pagamento/Pagar',          type: 'regex', value: '^(Pagamento|Pagar|Forma de Pagamento|Selecionar Pagamento)$' },
      { description: '[class*=payment-btn]',            type: 'css',  value: '[class*="payment-btn"],[class*="pagamento-btn"],[data-testid*="payment"]' },
    ];
    const { found: pFound, locator: pLoc, log: pLog } = await this.loc.find(page, payBtnStrategies, 2000);
    log.push(...pLog);
    if (pFound && pLoc) {
      await pLoc.click({ timeout: 5000 });
      await page.waitForTimeout(700);
    }

    // Step 2: Select a payment method
    const methodStrategies: LocatorStrategy[] = [
      { description: 'Dinheiro / Espécie',             type: 'regex', value: '^(Dinheiro|Espécie|Cash)$' },
      { description: 'Cartão de Crédito',              type: 'regex', value: '^(Crédito|Cartão de Crédito|Credit)$' },
      { description: 'PIX',                            type: 'regex', value: '^PIX$' },
      { description: 'Débito',                         type: 'regex', value: '^(Débito|Cartão de Débito|Debit)$' },
      { description: 'Primeiro método disponível',     type: 'css',  value: '[class*="payment-method"]:first-child,[class*="forma-pagamento"]:first-child,[class*="method-item"]:first-child' },
    ];
    const { found: mFound, locator: mLoc, strategy: mStrat, log: mLog } = await this.loc.find(page, methodStrategies, 2500);
    log.push(...mLog);
    if (mFound && mLoc) {
      await mLoc.click({ timeout: 5000 });
      await page.waitForTimeout(500);
      return { success: true, detail: `Pagamento: ${mStrat!.description}`, duration: Date.now() - start, log };
    }
    return { success: false, detail: 'Nenhuma forma de pagamento encontrada', duration: Date.now() - start, log };
  }

  async finishSale(page: Page): Promise<ActionResult> {
    const start = Date.now();
    const strategies: LocatorStrategy[] = [
      { description: 'Botão Finalizar Venda (exato)',  type: 'regex', value: '^(Finalizar Venda|Concluir Venda|Fechar Venda|Confirmar Venda)$' },
      { description: '[class*=finish-sale]',           type: 'css',  value: '[class*="finish-sale"],[class*="finalizar-venda"],[data-testid*="finish"]' },
      { description: 'Botão Confirmar',                type: 'regex', value: '^(Confirmar|Concluir|OK)$' },
      { description: 'Botão Finalizar genérico',       type: 'text', value: 'Finalizar' },
    ];
    const { found, locator, strategy, log } = await this.loc.find(page, strategies, 3000);
    if (found && locator) {
      await locator.click({ timeout: 5000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1000);
      return { success: true, detail: `Venda finalizada via: ${strategy!.description}`, duration: Date.now() - start, log };
    }
    return { success: false, detail: 'Botão de finalizar venda não encontrado', duration: Date.now() - start, log };
  }

  async cancelSale(page: Page): Promise<ActionResult> {
    const start = Date.now();
    const strategies: LocatorStrategy[] = [
      { description: 'Botão Cancelar Venda',           type: 'regex', value: '^(Cancelar Venda|Cancelar)$' },
      { description: '[class*=cancel-sale]',           type: 'css',  value: '[class*="cancel-sale"],[data-testid*="cancel-sale"]' },
    ];
    const { found, locator, strategy, log } = await this.loc.find(page, strategies, 2000);
    if (!found || !locator) {
      return { success: false, detail: 'Botão cancelar venda não encontrado', duration: Date.now() - start, log };
    }
    await locator.click({ timeout: 5000 });
    await page.waitForTimeout(600);
    // Confirm cancellation if dialog appears
    const confirmBtn = await page.$('button:has-text("Confirmar"),button:has-text("Sim"),button:has-text("OK")');
    if (confirmBtn) { await confirmBtn.click({ timeout: 3000 }); await page.waitForTimeout(400); }
    return { success: true, detail: `Venda cancelada via: ${strategy!.description}`, duration: Date.now() - start, log };
  }

  // ── Generic ──────────────────────────────────────────────────────────────────

  async clickButton(page: Page, label: string): Promise<ActionResult> {
    const start = Date.now();
    const strategies: LocatorStrategy[] = [
      { description: `role=button "${label}"`,         type: 'role', value: 'button', options: { name: new RegExp(label, 'i') } },
      { description: `Texto exato "${label}"`,         type: 'text', value: label },
      { description: `Regex "${label}"`,               type: 'regex', value: label },
      { description: `a:has-text "${label}"`,          type: 'css',  value: `a:has-text("${label}")` },
    ];
    const { found, locator, strategy, log } = await this.loc.find(page, strategies, 3000);
    if (found && locator) {
      await locator.click({ timeout: 5000 });
      await page.waitForTimeout(500);
      return { success: true, detail: `Clicou em "${label}" via: ${strategy!.description}`, duration: Date.now() - start, log };
    }
    return { success: false, detail: `Elemento "${label}" não encontrado na página`, duration: Date.now() - start, log };
  }

  async fillField(page: Page, fieldName: string, value: string): Promise<ActionResult> {
    const start = Date.now();
    const strategies: LocatorStrategy[] = [
      { description: `name*="${fieldName}"`,            type: 'css',  value: `input[name*="${fieldName}" i],textarea[name*="${fieldName}" i]` },
      { description: `id*="${fieldName}"`,              type: 'css',  value: `input[id*="${fieldName}" i]` },
      { description: `label "${fieldName}"`,            type: 'arialabel', value: fieldName },
      { description: `placeholder "${fieldName}"`,      type: 'css',  value: `input[placeholder*="${fieldName}" i]` },
    ];
    const { found, locator, strategy, log } = await this.loc.find(page, strategies, 3000);
    if (found && locator) {
      await locator.fill(value, { timeout: 5000 });
      return { success: true, detail: `"${fieldName}" preenchido com "${value}"`, duration: Date.now() - start, log };
    }
    return { success: false, detail: `Campo "${fieldName}" não encontrado`, duration: Date.now() - start, log };
  }

  async waitForText(page: Page, text: string, timeout = 5000): Promise<ActionResult> {
    const start = Date.now();
    try {
      await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
      return { success: true, detail: `Texto "${text}" apareceu na página`, duration: Date.now() - start, log: [] };
    } catch {
      return { success: false, detail: `Texto "${text}" não apareceu em ${timeout}ms`, duration: Date.now() - start, log: [] };
    }
  }

  async buildInventory(page: Page): Promise<ActionResult & { inventory?: object }> {
    const start = Date.now();
    const inv = await this.nav.buildInventory(page);
    const summary = `Título: "${inv.title}" | Nav: ${inv.navigationItems.length} itens | Cards: ${inv.moduleCards.length}`;
    return {
      success: true,
      detail: summary,
      duration: Date.now() - start,
      log: [
        `  Navegação: ${inv.navigationItems.join(', ') || '(nenhum)'}`,
        `  Módulos detectados: ${inv.moduleCards.join(', ') || '(nenhum)'}`,
      ],
      inventory: inv,
    };
  }
}
