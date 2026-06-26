/**
 * Flow: Cadastro de Cliente
 * Testa o fluxo completo de criação de um novo cliente/registro.
 */
async function flow(page, { baseUrl, testUser, step }) {
  const timestamp = Date.now();
  const clienteData = {
    nome: `Cliente Teste ${timestamp}`,
    email: `teste.${timestamp}@exemplo.com`,
    telefone: '11999998888',
    cpf: '000.000.000-00',
  };

  await step('Fazer login na aplicação', async () => {
    await page.goto(baseUrl + '/login', { waitUntil: 'networkidle' });
    await page.fill('[name="email"], [name="username"]', testUser.username);
    await page.fill('[name="password"]', testUser.password);
    await page.click('[type="submit"]');
    await page.waitForURL(/dashboard|home|inicio/, { timeout: 8000 });
  });

  await step('Navegar para a listagem de clientes', async () => {
    await Promise.race([
      page.click('[href*="clientes"], a:has-text("Clientes"), [href*="customers"]'),
      page.goto(baseUrl + '/clientes'),
    ]);
    await page.waitForLoadState('networkidle');
  });

  await step('Abrir formulário de novo cliente', async () => {
    await page.click('button:has-text("Novo"), button:has-text("Adicionar"), button:has-text("Cadastrar"), [href*="novo"], [href*="new"]');
    await page.waitForSelector('form', { timeout: 5000 });
  });

  await step('Preencher nome do cliente', async () => {
    await page.fill('[name="nome"], [name="name"], #nome, #name', clienteData.nome);
  });

  await step('Preencher email do cliente', async () => {
    const emailField = await page.$('[name="email"], [type="email"]');
    if (emailField) await emailField.fill(clienteData.email);
  });

  await step('Preencher telefone', async () => {
    const telField = await page.$('[name="telefone"], [name="phone"], [name="celular"]');
    if (telField) await telField.fill(clienteData.telefone);
  });

  await step('Salvar o cadastro', async () => {
    await page.click('[type="submit"], button:has-text("Salvar"), button:has-text("Cadastrar"), button:has-text("Confirmar")');
    await page.waitForLoadState('networkidle');
  });

  await step('Verificar mensagem de sucesso', async () => {
    const successMsg = await page.$('.toast-success, .alert-success, [class*="success"], [role="alert"]');
    const pageText = await page.textContent('body');
    const hasSuccess = successMsg || pageText.includes('sucesso') || pageText.includes('cadastrado') || pageText.includes('salvo');
    if (!hasSuccess) throw new Error('Mensagem de sucesso não encontrada após o cadastro');
  });

  await step('Verificar que o cliente aparece na listagem', async () => {
    await Promise.race([
      page.waitForURL(/clientes|customers/, { timeout: 5000 }),
      page.goto(baseUrl + '/clientes'),
    ]);
    await page.waitForLoadState('networkidle');
    const pageText = await page.textContent('body');
    if (!pageText.includes(clienteData.nome) && !pageText.includes(clienteData.email)) {
      throw new Error('Cliente recém-cadastrado não aparece na listagem');
    }
  });
}
