/**
 * Flow: Login
 * Testa o fluxo completo de autenticação.
 * Adapte os seletores conforme sua aplicação.
 *
 * Copie o conteúdo desta função para o campo "Script" ao criar um flow.
 */
async function flow(page, { baseUrl, testUser, step }) {
  await step('Navegar para a tela de login', async () => {
    await page.goto(baseUrl + '/login', { waitUntil: 'networkidle' });
  });

  await step('Verificar que o formulário de login está visível', async () => {
    await page.waitForSelector('form', { timeout: 5000 });
  });

  await step('Preencher o campo de email/usuário', async () => {
    const emailField = await page.$('[name="email"], [name="username"], [type="email"]');
    if (!emailField) throw new Error('Campo de email não encontrado');
    await emailField.fill(testUser.username);
  });

  await step('Preencher o campo de senha', async () => {
    const pwField = await page.$('[name="password"], [type="password"]');
    if (!pwField) throw new Error('Campo de senha não encontrado');
    await pwField.fill(testUser.password);
  });

  await step('Clicar no botão de entrar', async () => {
    await page.click('[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar")');
  });

  await step('Verificar login bem-sucedido', async () => {
    await Promise.race([
      page.waitForURL('**/dashboard', { timeout: 8000 }),
      page.waitForURL('**/home', { timeout: 8000 }),
      page.waitForURL('**/inicio', { timeout: 8000 }),
    ]);
  });

  await step('Verificar elemento da área logada', async () => {
    const loggedIn = await page.$('[data-testid="user-menu"], .user-avatar, .logout, [href*="logout"]');
    if (!loggedIn) throw new Error('Não foi possível confirmar o estado logado');
  });
}
