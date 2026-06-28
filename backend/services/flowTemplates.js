const FLOW_TEMPLATES = [
  // ─── Autenticação ───────────────────────────────────────────────────────────
  {
    id: 'login',
    name: 'Login',
    category: 'Autenticação',
    icon: '🔐',
    description: 'Autentica o usuário de teste e verifica acesso ao sistema',
    script: `async function flow(page, { baseUrl, testUser, step }) {
  await step('Acessar página de login', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  await step('Preencher credenciais', async () => {
    const emailSel = 'input[type="email"], input[name="email"], input[name="login"], input[name="username"], input[placeholder*="email" i], input[placeholder*="usuário" i]';
    const emailInput = await page.$(emailSel);
    if (!emailInput) throw new Error('Campo de e-mail/usuário não encontrado');
    await emailInput.fill(testUser.username);

    const passInput = await page.$('input[type="password"]');
    if (!passInput) throw new Error('Campo de senha não encontrado');
    await passInput.fill(testUser.password);
  });

  await step('Submeter login', async () => {
    const btnSel = 'button[type="submit"], input[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar")';
    const btn = await page.$(btnSel);
    if (!btn) throw new Error('Botão de login não encontrado');
    await btn.click();
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await page.waitForTimeout(1000);
  });

  await step('Verificar login bem-sucedido', async () => {
    const url = page.url();
    if (url.includes('/login') || url.includes('/signin') || url.includes('/auth')) {
      const errorEl = await page.$('.error, .alert-error, [class*="alert-danger"], [role="alert"]');
      const errText = errorEl ? (await errorEl.textContent() || '').trim() : '';
      throw new Error(errText ? 'Login falhou: ' + errText : 'Ainda na página de login após submissão');
    }
  });
}`,
  },

  // ─── Cadastro de Cliente ─────────────────────────────────────────────────────
  {
    id: 'cadastro_cliente',
    name: 'Cadastro de Cliente',
    category: 'Clientes',
    icon: '👤',
    description: 'Cria um novo cliente com nome, CPF/CNPJ, telefone e e-mail',
    script: `async function flow(page, { baseUrl, testUser, step }) {
  await step('Navegar para clientes', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
    const link = await page.$('a:has-text("Clientes"), a:has-text("Cliente"), nav a[href*="client"], a[href*="cliente"]');
    if (link) {
      await link.click();
      await page.waitForLoadState('domcontentloaded');
    }
  });

  await step('Abrir formulário de novo cliente', async () => {
    const btn = await page.$('button:has-text("Novo"), button:has-text("Adicionar"), button:has-text("+ Cliente"), a:has-text("Novo Cliente")');
    if (!btn) throw new Error('Botão de novo cliente não encontrado');
    await btn.click();
    await page.waitForTimeout(800);
  });

  await step('Preencher nome', async () => {
    const sel = 'input[name*="nome" i], input[name*="name" i], input[placeholder*="nome" i], input[id*="nome" i], input[placeholder*="razão" i]';
    const input = await page.$(sel);
    if (!input) throw new Error('Campo de nome não encontrado');
    await input.fill('Cliente Teste QATry');
  });

  await step('Preencher CPF ou CNPJ', async () => {
    const cpfSel = 'input[name*="cpf" i], input[name*="cnpj" i], input[placeholder*="cpf" i], input[placeholder*="cnpj" i], input[id*="cpf" i]';
    const input = await page.$(cpfSel);
    if (input) {
      await input.fill('529.982.247-25');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
    }
  });

  await step('Preencher telefone', async () => {
    const telSel = 'input[name*="tel" i], input[name*="fone" i], input[placeholder*="telefone" i], input[placeholder*="celular" i], input[placeholder*="("]';
    const input = await page.$(telSel);
    if (input) {
      await input.fill('(11) 99999-9999');
      await page.keyboard.press('Tab');
    }
  });

  await step('Preencher e-mail', async () => {
    const input = await page.$('input[type="email"], input[name*="email" i]');
    if (input) await input.fill('cliente.teste@qatry.com');
  });

  await step('Salvar e verificar sucesso', async () => {
    const saveBtn = await page.$('button:has-text("Salvar"), button:has-text("Cadastrar"), button:has-text("Confirmar"), button[type="submit"]');
    if (!saveBtn) throw new Error('Botão salvar não encontrado');
    await saveBtn.click();
    await page.waitForTimeout(1500);

    const success = await page.$('.success, .alert-success, .toast-success, [class*="success"]');
    const errEl   = await page.$('.error, .alert-error, .toast-error, [class*="danger"]');
    if (errEl) {
      const txt = (await errEl.textContent() || '').trim();
      throw new Error('Erro ao salvar cliente: ' + txt);
    }
    if (!success) {
      const body = await page.$eval('body', el => el.innerText);
      if (!body.includes('salvo') && !body.includes('cadastrado') && !body.includes('sucesso') && !body.includes('QATry')) {
        throw new Error('Confirmação de salvamento não detectada');
      }
    }
  });
}`,
  },

  // ─── Criar Pedido / Venda ────────────────────────────────────────────────────
  {
    id: 'criar_pedido',
    name: 'Criar Pedido/Venda',
    category: 'Vendas',
    icon: '🛒',
    description: 'Seleciona produtos, ajusta quantidades e finaliza uma venda',
    script: `async function flow(page, { baseUrl, testUser, step }) {
  await step('Navegar para nova venda/pedido', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
    const link = await page.$('a:has-text("Nova Venda"), a:has-text("Novo Pedido"), a:has-text("PDV"), button:has-text("Nova Venda"), a[href*="pdv"], a[href*="venda"]');
    if (link) {
      await link.click();
      await page.waitForLoadState('domcontentloaded');
    }
  });

  await step('Selecionar primeiro produto disponível', async () => {
    const prodSel = '[class*="product-card"], [class*="produto"], [class*="item-produto"], table tbody tr:first-child, .product-list > *:first-child';
    const produto = await page.$(prodSel);
    if (!produto) throw new Error('Nenhum produto encontrado na tela de venda');
    await produto.click();
    await page.waitForTimeout(600);
  });

  await step('Ajustar quantidade para 2', async () => {
    const qtdSel = 'input[type="number"], input[name*="qtd" i], input[name*="quantidade" i], input[placeholder*="qtd" i]';
    const qtdInput = await page.$(qtdSel);
    if (qtdInput) {
      await qtdInput.fill('2');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(400);
    }
  });

  await step('Selecionar segundo produto (se disponível)', async () => {
    const prodSel = '[class*="product-card"]:nth-child(2), [class*="produto"]:nth-child(2), table tbody tr:nth-child(2)';
    const produto = await page.$(prodSel).catch(() => null);
    if (produto) {
      await produto.click();
      await page.waitForTimeout(400);
    }
  });

  await step('Verificar carrinho/resumo', async () => {
    const cartSel = '[class*="cart"], [class*="resumo"], [class*="carrinho"], [id*="cart"], [id*="resumo"]';
    const cart = await page.$(cartSel).catch(() => null);
    if (!cart) {
      const hasTotals = await page.$('[class*="total"], [id*="total"]').catch(() => null);
      if (!hasTotals) throw new Error('Carrinho ou resumo de valores não encontrado');
    }
  });

  await step('Finalizar venda', async () => {
    const finBtn = await page.$('button:has-text("Finalizar"), button:has-text("Confirmar Venda"), button:has-text("Concluir"), button:has-text("Fechar Venda")');
    if (finBtn) {
      await finBtn.click();
      await page.waitForTimeout(1500);
    }
  });
}`,
  },

  // ─── Cancelar Pedido ─────────────────────────────────────────────────────────
  {
    id: 'cancelar_pedido',
    name: 'Cancelar Pedido',
    category: 'Vendas',
    icon: '🚫',
    description: 'Localiza o pedido mais recente e executa o cancelamento',
    script: `async function flow(page, { baseUrl, testUser, step }) {
  await step('Navegar para lista de pedidos', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
    const link = await page.$('a:has-text("Pedidos"), a:has-text("Vendas"), a[href*="pedido"], a[href*="venda"]');
    if (link) {
      await link.click();
      await page.waitForLoadState('domcontentloaded');
    }
  });

  await step('Localizar pedido para cancelar', async () => {
    const row = await page.$('table tbody tr:first-child, [class*="order-item"]:first-child, [class*="pedido-item"]:first-child');
    if (!row) throw new Error('Nenhum pedido encontrado na lista');
    await row.click();
    await page.waitForTimeout(600);
  });

  await step('Clicar em cancelar', async () => {
    const cancelBtn = await page.$('button:has-text("Cancelar"), button:has-text("Estornar"), a:has-text("Cancelar Pedido")');
    if (!cancelBtn) throw new Error('Botão de cancelar não encontrado');
    await cancelBtn.click();
    await page.waitForTimeout(500);
  });

  await step('Confirmar cancelamento', async () => {
    const confirmBtn = await page.$('button:has-text("Confirmar"), button:has-text("Sim"), button:has-text("OK"), [role="dialog"] button:last-child');
    if (confirmBtn) {
      await confirmBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  await step('Verificar status cancelado', async () => {
    const body = await page.$eval('body', el => el.innerText);
    if (!/cancelad|estornad|cancelado/i.test(body)) {
      const success = await page.$('.success, .toast-success, [class*="success"]');
      if (!success) throw new Error('Status de cancelamento não detectado na página');
    }
  });
}`,
  },

  // ─── Emitir Nota Fiscal ──────────────────────────────────────────────────────
  {
    id: 'emitir_nf',
    name: 'Emitir Nota Fiscal',
    category: 'Fiscal',
    icon: '📄',
    description: 'Preenche e emite uma nota fiscal com dados de cliente e CNPJ',
    script: `async function flow(page, { baseUrl, testUser, step }) {
  await step('Navegar para emissão de NF', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
    const link = await page.$('a:has-text("Nota Fiscal"), a:has-text("NF-e"), a:has-text("Fiscal"), a[href*="nota"], a[href*="fiscal"]');
    if (link) {
      await link.click();
      await page.waitForLoadState('domcontentloaded');
    }
  });

  await step('Abrir nova nota fiscal', async () => {
    const btn = await page.$('button:has-text("Nova NF"), button:has-text("Emitir"), button:has-text("Nova Nota"), a:has-text("Nova Nota")');
    if (btn) {
      await btn.click();
      await page.waitForTimeout(800);
    }
  });

  await step('Preencher CNPJ do destinatário', async () => {
    const cnpjSel = 'input[name*="cnpj" i], input[placeholder*="cnpj" i], input[id*="cnpj" i]';
    const input = await page.$(cnpjSel);
    if (!input) throw new Error('Campo CNPJ não encontrado');
    await input.fill('11.222.333/0001-81');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(800);
  });

  await step('Verificar preenchimento automático (se disponível)', async () => {
    const razaoSel = 'input[name*="razao" i], input[name*="empresa" i], input[placeholder*="razão" i]';
    const input = await page.$(razaoSel);
    if (input) {
      const val = await input.inputValue();
      if (!val) await input.fill('Empresa Teste QATry Ltda');
    }
  });

  await step('Preencher valor da nota', async () => {
    const valorSel = 'input[name*="valor" i], input[name*="total" i], input[placeholder*="valor" i]';
    const input = await page.$(valorSel);
    if (input) {
      await input.fill('150,00');
      await page.keyboard.press('Tab');
    }
  });

  await step('Salvar rascunho ou emitir', async () => {
    const btn = await page.$('button:has-text("Salvar"), button:has-text("Emitir"), button:has-text("Gerar"), button[type="submit"]');
    if (!btn) throw new Error('Botão de ação não encontrado');
    await btn.click();
    await page.waitForTimeout(2000);

    const errEl = await page.$('.error, .alert-error, [class*="danger"]');
    if (errEl) {
      const txt = (await errEl.textContent() || '').trim();
      throw new Error('Erro ao emitir NF: ' + txt);
    }
  });
}`,
  },

  // ─── Pagamento PIX ───────────────────────────────────────────────────────────
  {
    id: 'pagamento_pix',
    name: 'Pagamento PIX',
    category: 'Pagamentos',
    icon: '⚡',
    description: 'Inicia e verifica o fluxo de geração de QR Code PIX',
    script: `async function flow(page, { baseUrl, testUser, step }) {
  await step('Navegar para pagamento', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  await step('Selecionar método PIX', async () => {
    const pixSel = 'button:has-text("PIX"), input[value="pix"], label:has-text("PIX"), [data-method="pix"]';
    const pixBtn = await page.$(pixSel);
    if (!pixBtn) throw new Error('Opção de pagamento PIX não encontrada');
    await pixBtn.click();
    await page.waitForTimeout(600);
  });

  await step('Confirmar valor do pagamento', async () => {
    const valorSel = 'input[name*="valor" i], input[name*="amount" i], input[placeholder*="valor" i]';
    const input = await page.$(valorSel);
    if (input) {
      const val = await input.inputValue();
      if (!val) await input.fill('10,00');
    }
  });

  await step('Gerar QR Code PIX', async () => {
    const btn = await page.$('button:has-text("Gerar"), button:has-text("Pagar com PIX"), button:has-text("Confirmar"), button[type="submit"]');
    if (!btn) throw new Error('Botão de gerar PIX não encontrado');
    await btn.click();
    await page.waitForTimeout(2000);
  });

  await step('Verificar QR Code ou chave PIX gerada', async () => {
    const qrSel = 'img[src*="qr"], canvas, [class*="qr-code"], [class*="qrcode"], [id*="qr"]';
    const pixKeySel = 'input[readonly], [class*="pix-key"], [class*="copy-key"]';
    const hasQR  = await page.$(qrSel);
    const hasKey = await page.$(pixKeySel);
    if (!hasQR && !hasKey) {
      throw new Error('QR Code ou chave PIX não gerada na tela');
    }
  });
}`,
  },

  // ─── Pagamento Cartão ────────────────────────────────────────────────────────
  {
    id: 'pagamento_cartao',
    name: 'Pagamento Cartão',
    category: 'Pagamentos',
    icon: '💳',
    description: 'Preenche dados de cartão de crédito e verifica processamento',
    script: `async function flow(page, { baseUrl, testUser, step }) {
  await step('Navegar para pagamento', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  await step('Selecionar cartão de crédito', async () => {
    const cartSel = 'button:has-text("Cartão"), button:has-text("Crédito"), input[value*="cart" i], label:has-text("Cartão"), [data-method*="cart" i]';
    const btn = await page.$(cartSel);
    if (!btn) throw new Error('Opção de cartão de crédito não encontrada');
    await btn.click();
    await page.waitForTimeout(600);
  });

  await step('Preencher número do cartão', async () => {
    const numSel = 'input[name*="card" i], input[name*="cartao" i], input[placeholder*="número" i], input[placeholder*="card" i], input[maxlength="16"], input[maxlength="19"]';
    const input = await page.$(numSel);
    if (input) {
      await input.fill('4111 1111 1111 1111');
      await page.keyboard.press('Tab');
    }
  });

  await step('Preencher validade', async () => {
    const expSel = 'input[name*="validade" i], input[name*="expiry" i], input[name*="exp" i], input[placeholder*="MM/AA"], input[placeholder*="MM/YY"]';
    const input = await page.$(expSel);
    if (input) {
      await input.fill('12/26');
      await page.keyboard.press('Tab');
    }
  });

  await step('Preencher CVV', async () => {
    const cvvSel = 'input[name*="cvv" i], input[name*="cvc" i], input[name*="security" i], input[placeholder*="CVV"], input[maxlength="3"], input[maxlength="4"]';
    const input = await page.$(cvvSel);
    if (input) {
      await input.fill('123');
      await page.keyboard.press('Tab');
    }
  });

  await step('Preencher nome no cartão', async () => {
    const nameSel = 'input[name*="holder" i], input[name*="titular" i], input[placeholder*="nome no cartão" i]';
    const input = await page.$(nameSel);
    if (input) await input.fill('CLIENTE TESTE');
  });

  await step('Confirmar pagamento', async () => {
    const btn = await page.$('button:has-text("Pagar"), button:has-text("Confirmar"), button:has-text("Finalizar"), button[type="submit"]');
    if (!btn) throw new Error('Botão de confirmar pagamento não encontrado');
    await btn.click();
    await page.waitForTimeout(2000);
  });

  await step('Verificar resultado do pagamento', async () => {
    const errEl = await page.$('.error, .alert-error, [class*="danger"], [class*="declined"]');
    if (errEl) {
      const txt = (await errEl.textContent() || '').trim();
      throw new Error('Pagamento recusado: ' + txt);
    }
  });
}`,
  },

  // ─── Upload de Arquivo ───────────────────────────────────────────────────────
  {
    id: 'upload_arquivo',
    name: 'Upload de Arquivo',
    category: 'Utilitários',
    icon: '📎',
    description: 'Encontra input de upload e envia um arquivo de teste',
    script: `async function flow(page, { baseUrl, testUser, step }) {
  const path = require('path');
  const fs   = require('fs');

  await step('Navegar para página com upload', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  await step('Localizar campo de upload', async () => {
    const input = await page.$('input[type="file"]');
    if (!input) throw new Error('Nenhum campo input[type="file"] encontrado na página');
  });

  await step('Criar arquivo de teste temporário', async () => {
    const tmpPath = path.join(require('os').tmpdir(), 'qatry_test_upload.txt');
    fs.writeFileSync(tmpPath, 'Arquivo de teste criado pelo QATry - ' + new Date().toISOString());
    page.__uploadFile = tmpPath;
  });

  await step('Fazer upload do arquivo', async () => {
    const input = await page.$('input[type="file"]');
    if (!input) throw new Error('Input de upload não encontrado');
    await input.setInputFiles(page.__uploadFile);
    await page.waitForTimeout(1000);
  });

  await step('Verificar upload aceito', async () => {
    const successSel = '[class*="file-name"], [class*="filename"], [class*="uploaded"], .file-preview, [class*="success"]';
    const successEl  = await page.$(successSel);
    const errEl      = await page.$('.error, [class*="danger"], [class*="invalid-file"]');
    if (errEl) {
      const txt = (await errEl.textContent() || '').trim();
      throw new Error('Upload rejeitado: ' + txt);
    }
    if (!successEl) {
      const body = await page.$eval('body', el => el.innerText);
      if (!body.includes('qatry_test_upload') && !body.includes('upload') && !body.includes('enviado')) {
        throw new Error('Arquivo não aparece na página após upload');
      }
    }
  });

  await step('Verificar botão de submissão (se houver)', async () => {
    const submit = await page.$('button:has-text("Enviar"), button:has-text("Upload"), button:has-text("Salvar"), button[type="submit"]');
    if (submit) {
      await submit.click();
      await page.waitForTimeout(1500);
      const errEl = await page.$('.error, [class*="danger"]');
      if (errEl) {
        const txt = (await errEl.textContent() || '').trim();
        throw new Error('Erro ao submeter upload: ' + txt);
      }
    }
  });
}`,
  },

  // ─── Verificar Mensagens ─────────────────────────────────────────────────────
  {
    id: 'verificar_mensagens',
    name: 'Verificar Mensagens e Alertas',
    category: 'Utilitários',
    icon: '💬',
    description: 'Testa se mensagens de sucesso, erro e aviso aparecem corretamente',
    script: `async function flow(page, { baseUrl, testUser, step }) {
  await step('Navegar para a aplicação', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  await step('Verificar mensagens de erro em formulários vazios', async () => {
    const forms = await page.$$('form');
    if (forms.length === 0) return;
    const submit = await page.$('button[type="submit"], input[type="submit"]');
    if (!submit) return;
    await submit.click();
    await page.waitForTimeout(600);

    const validationSel = '.invalid-feedback, [class*="error"], [class*="required"], [aria-invalid="true"]';
    const msgs = await page.$$(validationSel);
    if (msgs.length === 0) {
      throw new Error('Nenhuma mensagem de validação exibida ao submeter formulário vazio');
    }
  });

  await step('Verificar toasts e alertas visíveis', async () => {
    const toastSel = '[class*="toast"], [class*="snackbar"], [role="alert"], .alert, [class*="notification"]';
    const toasts   = await page.$$(toastSel);
    if (toasts.length === 0) return; // not an error, page may not have shown any yet
    for (const toast of toasts) {
      const txt = (await toast.textContent() || '').trim();
      // Flag unexpected errors
      if (/500|server error|unexpected/i.test(txt)) {
        throw new Error('Toast de erro interno detectado: ' + txt.slice(0, 100));
      }
    }
  });

  await step('Verificar campos required marcados corretamente', async () => {
    const requiredInputs = await page.$$('input[required], select[required], textarea[required]');
    let unmarkedCount = 0;
    for (const input of requiredInputs) {
      const label = await page.$eval('body', (body, id) => {
        const inp = body.querySelector('#' + id);
        const lbl = inp ? body.querySelector('label[for="' + id + '"]') : null;
        return lbl ? lbl.textContent : '';
      }, await input.getAttribute('id') || '').catch(() => '');
      if (label && !label.includes('*') && !label.includes('obrigatório')) unmarkedCount++;
    }
    if (unmarkedCount > 3) {
      throw new Error(unmarkedCount + ' campos obrigatórios sem marcação visual de obrigatoriedade');
    }
  });

  await step('Verificar ausência de erros de console críticos', async () => {
    // errors are captured by the executor via page.on('console')
    // just wait for any pending async operations
    await page.waitForTimeout(500);
  });
}`,
  },

  // ─── Logout ─────────────────────────────────────────────────────────────────
  {
    id: 'logout',
    name: 'Logout',
    category: 'Autenticação',
    icon: '🚪',
    description: 'Sai da sessão do usuário e verifica redirecionamento para login',
    script: `async function flow(page, { baseUrl, testUser, step }) {
  await step('Acessar aplicação logado', async () => {
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
  });

  await step('Localizar e clicar em logout', async () => {
    const logoutSel = [
      'button:has-text("Sair")', 'a:has-text("Sair")',
      'button:has-text("Logout")', 'a:has-text("Logout")',
      'button:has-text("Deslogar")', 'a:has-text("Sign out")',
      '[class*="logout"]', '[id*="logout"]',
    ].join(', ');

    const btn = await page.$(logoutSel);
    if (!btn) {
      // Try avatar/menu first
      const avatar = await page.$('[class*="avatar"], [class*="user-menu"], [class*="profile-btn"]');
      if (avatar) {
        await avatar.click();
        await page.waitForTimeout(400);
        const logoutInMenu = await page.$(logoutSel);
        if (logoutInMenu) {
          await logoutInMenu.click();
        } else {
          throw new Error('Botão de logout não encontrado dentro do menu de usuário');
        }
      } else {
        throw new Error('Botão de logout não encontrado na página');
      }
    } else {
      await btn.click();
    }
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    await page.waitForTimeout(500);
  });

  await step('Verificar redirecionamento para login', async () => {
    const url = page.url();
    if (!url.includes('/login') && !url.includes('/signin') && !url.includes('/auth')) {
      const loginForm = await page.$('input[type="password"], form[action*="login"], form[action*="auth"]');
      if (!loginForm) throw new Error('Após logout, não redirecionou para página de login');
    }
  });
}`,
  },
];

module.exports = { FLOW_TEMPLATES };
