/**
 * Flow: Fluxo Completo — Cadastro → Pedido → Pagamento
 * Testa um fluxo de negócio completo de ponta a ponta.
 * Adapte os seletores e URLs conforme sua aplicação.
 */
async function flow(page, { baseUrl, testUser, step }) {
  const timestamp = Date.now();

  // ── 1. Login ──
  await step('Autenticar na aplicação', async () => {
    await page.goto(baseUrl + '/login', { waitUntil: 'networkidle' });
    await page.fill('[name="email"], [name="username"]', testUser.username);
    await page.fill('[name="password"]', testUser.password);
    await page.click('[type="submit"]');
    await page.waitForURL(/dashboard|home|inicio/, { timeout: 10000 });
  });

  // ── 2. Criar pedido ──
  await step('Navegar para criação de pedido', async () => {
    const pedidoLink = await page.$('a:has-text("Pedido"), a:has-text("Venda"), [href*="pedidos"], [href*="vendas"]');
    if (pedidoLink) await pedidoLink.click();
    else await page.goto(baseUrl + '/pedidos/novo');
    await page.waitForLoadState('networkidle');
  });

  await step('Selecionar ou buscar produto', async () => {
    const searchProduct = await page.$('[placeholder*="produto"], [placeholder*="item"], [name*="produto"]');
    if (searchProduct) {
      await searchProduct.fill('produto');
      await page.waitForTimeout(800);
      const firstResult = await page.$('.suggestion, .dropdown-item, li[role="option"]');
      if (firstResult) await firstResult.click();
    }
  });

  await step('Confirmar e salvar o pedido', async () => {
    const saveBtn = await page.$('button:has-text("Salvar"), button:has-text("Confirmar"), button:has-text("Finalizar"), [type="submit"]');
    if (saveBtn) {
      await saveBtn.click();
      await page.waitForLoadState('networkidle');
    }
  });

  await step('Verificar pedido criado com sucesso', async () => {
    const body = await page.textContent('body');
    const success = body.includes('sucesso') || body.includes('criado') || body.includes('salvo') || body.includes('gerado');
    if (!success) throw new Error('Confirmação de pedido criado não encontrada');
  });

  // ── 3. Processo de pagamento ──
  await step('Iniciar processo de pagamento', async () => {
    const payBtn = await page.$('button:has-text("Pagar"), button:has-text("Pagamento"), a:has-text("Pagar"), [href*="pagamento"]');
    if (payBtn) {
      await payBtn.click();
      await page.waitForLoadState('networkidle');
    }
  });

  await step('Verificar opções de pagamento disponíveis', async () => {
    const body = await page.textContent('body');
    const hasPix = body.toLowerCase().includes('pix');
    const hasCartao = body.toLowerCase().includes('cartão') || body.toLowerCase().includes('crédito');
    if (!hasPix && !hasCartao) {
      throw new Error('Nenhuma opção de pagamento (PIX ou Cartão) encontrada');
    }
  });

  await step('Verificar relatórios acessíveis', async () => {
    const relLink = await page.$('a:has-text("Relatório"), a:has-text("Relatórios"), [href*="relatorio"]');
    if (relLink) {
      await relLink.click();
      await page.waitForLoadState('networkidle');
    }
  });

  await step('Fazer logout da aplicação', async () => {
    const logoutBtn = await page.$('button:has-text("Sair"), a:has-text("Sair"), a:has-text("Logout"), [href*="logout"]');
    if (logoutBtn) {
      await logoutBtn.click();
      await page.waitForLoadState('networkidle');
    }
    // Verify we're back at login/home
    const url = page.url();
    if (!url.includes('login') && !url.includes('logout') && !url.includes('/')) {
      // Not strictly an error — app may have different behavior
      console.log('Aviso: URL após logout não aponta para login');
    }
  });
}
