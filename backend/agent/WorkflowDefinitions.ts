/**
 * WorkflowDefinitions — pre-built structured workflows per intent.
 *
 * Each workflow has phases. Each phase has steps.
 * Steps reference action names from ActionLibrary — they are NOT natural language.
 * WorkflowRunner executes them deterministically.
 */

export interface WorkflowStep {
  action: string;
  params?: Record<string, unknown>;
  description: string;
  required?: boolean;
  retries?: number;
  skipOnFailure?: boolean;
  abortOnFailure?: boolean;
}

export interface WorkflowPhase {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  abortOnFailure?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  phases: WorkflowPhase[];
}

// ─── Utility: wrap any custom instruction step ────────────────────────────────
export function makeCustomStep(instruction: string, index: number): WorkflowStep {
  return {
    action: 'custom',
    params: { instruction },
    description: `[Instrução personalizada ${index + 1}] ${instruction}`,
    skipOnFailure: true,
  };
}

// ─── PDV (Ponto de Venda) ─────────────────────────────────────────────────────
const pdvWorkflow: WorkflowDefinition = {
  id: 'pdv',
  name: 'PDV — Ponto de Venda',
  description: 'Testa o fluxo completo de venda no módulo PDV',
  phases: [
    {
      id: 'preconditions',
      name: 'Pré-condições',
      description: 'Verifica estado inicial da página antes de navegar',
      abortOnFailure: false,
      steps: [
        {
          action: 'closeModal',
          description: 'Fechar qualquer modal ou popup aberto',
          skipOnFailure: true,
        },
        {
          action: 'buildInventory',
          description: 'Mapear links e módulos disponíveis na interface',
          required: true,
          skipOnFailure: true,
        },
      ],
    },
    {
      id: 'navigation',
      name: 'Navegação',
      description: 'Abrir o módulo PDV',
      abortOnFailure: true,
      steps: [
        {
          action: 'openModule',
          params: { module: 'pdv' },
          description: 'Navegar para o módulo PDV (URL-first, depois clique)',
          required: true,
          retries: 2,
          abortOnFailure: true,
        },
        {
          action: 'validateModule',
          params: { module: 'pdv' },
          description: 'Confirmar que o módulo PDV está ativo (URL + DOM)',
          required: true,
          abortOnFailure: true,
        },
      ],
    },
    {
      id: 'validation',
      name: 'Validação da Tela',
      description: 'Verificar elementos essenciais do PDV',
      abortOnFailure: false,
      steps: [
        {
          action: 'waitForText',
          params: { text: 'PDV', timeout: 4000 },
          description: 'Verificar título ou identificação "PDV" visível',
          skipOnFailure: true,
        },
      ],
    },
    {
      id: 'execution',
      name: 'Execução da Venda',
      description: 'Adicionar produto, selecionar pagamento e finalizar venda',
      abortOnFailure: false,
      steps: [
        {
          action: 'searchProduct',
          params: { query: 'produto' },
          description: 'Buscar produto pelo campo de pesquisa',
          retries: 1,
          skipOnFailure: true,
        },
        {
          action: 'addProduct',
          description: 'Adicionar produto ao carrinho/venda',
          retries: 1,
          skipOnFailure: true,
        },
        {
          action: 'selectPayment',
          description: 'Selecionar forma de pagamento disponível',
          skipOnFailure: true,
        },
        {
          action: 'finishSale',
          description: 'Finalizar a venda',
          skipOnFailure: true,
        },
      ],
    },
  ],
};

// ─── Checkout ─────────────────────────────────────────────────────────────────
const checkoutWorkflow: WorkflowDefinition = {
  id: 'checkout',
  name: 'Checkout / Carrinho',
  description: 'Testa o fluxo de checkout e carrinho de compras',
  phases: [
    {
      id: 'preconditions',
      name: 'Pré-condições',
      description: 'Fechar popups e mapear interface',
      abortOnFailure: false,
      steps: [
        { action: 'closeModal', description: 'Fechar modal inicial', skipOnFailure: true },
        { action: 'buildInventory', description: 'Mapear interface', skipOnFailure: true },
      ],
    },
    {
      id: 'navigation',
      name: 'Navegação',
      description: 'Abrir módulo de checkout',
      abortOnFailure: true,
      steps: [
        {
          action: 'openModule',
          params: { module: 'checkout' },
          description: 'Navegar para Checkout',
          required: true,
          retries: 2,
          abortOnFailure: true,
        },
        {
          action: 'validateModule',
          params: { module: 'checkout' },
          description: 'Confirmar módulo Checkout',
          required: true,
          abortOnFailure: true,
        },
      ],
    },
    {
      id: 'execution',
      name: 'Execução do Checkout',
      description: 'Adicionar item e concluir checkout',
      abortOnFailure: false,
      steps: [
        {
          action: 'searchProduct',
          params: { query: 'produto' },
          description: 'Buscar produto',
          skipOnFailure: true,
        },
        {
          action: 'addProduct',
          description: 'Adicionar ao carrinho',
          skipOnFailure: true,
        },
        {
          action: 'selectPayment',
          description: 'Selecionar pagamento',
          skipOnFailure: true,
        },
        {
          action: 'finishSale',
          description: 'Confirmar checkout',
          skipOnFailure: true,
        },
      ],
    },
  ],
};

// ─── Produtos ─────────────────────────────────────────────────────────────────
const produtosWorkflow: WorkflowDefinition = {
  id: 'produtos',
  name: 'Cadastro de Produtos',
  description: 'Testa o módulo de gestão de produtos',
  phases: [
    {
      id: 'preconditions',
      name: 'Pré-condições',
      description: 'Limpar estado inicial',
      abortOnFailure: false,
      steps: [
        { action: 'closeModal', description: 'Fechar modal', skipOnFailure: true },
        { action: 'buildInventory', description: 'Mapear interface', skipOnFailure: true },
      ],
    },
    {
      id: 'navigation',
      name: 'Navegação',
      description: 'Acessar módulo Produtos',
      abortOnFailure: true,
      steps: [
        {
          action: 'openModule',
          params: { module: 'produtos' },
          description: 'Navegar para Produtos',
          required: true,
          retries: 2,
          abortOnFailure: true,
        },
        {
          action: 'validateModule',
          params: { module: 'produtos' },
          description: 'Confirmar módulo Produtos',
          required: true,
          abortOnFailure: true,
        },
      ],
    },
    {
      id: 'execution',
      name: 'Operações de Produto',
      description: 'Buscar e interagir com produtos',
      abortOnFailure: false,
      steps: [
        {
          action: 'searchProduct',
          params: { query: 'produto' },
          description: 'Buscar produto na lista',
          skipOnFailure: true,
        },
        {
          action: 'clickButton',
          params: { label: 'Novo Produto' },
          description: 'Tentar abrir formulário de novo produto',
          skipOnFailure: true,
        },
        {
          action: 'closeModal',
          description: 'Fechar formulário se abriu',
          skipOnFailure: true,
        },
      ],
    },
  ],
};

// ─── Estoque ─────────────────────────────────────────────────────────────────
const estoqueWorkflow: WorkflowDefinition = {
  id: 'estoque',
  name: 'Controle de Estoque',
  description: 'Testa o módulo de estoque',
  phases: [
    {
      id: 'preconditions',
      name: 'Pré-condições',
      description: 'Estado inicial',
      abortOnFailure: false,
      steps: [
        { action: 'closeModal', description: 'Fechar modal', skipOnFailure: true },
        { action: 'buildInventory', description: 'Mapear interface', skipOnFailure: true },
      ],
    },
    {
      id: 'navigation',
      name: 'Navegação',
      description: 'Acessar Estoque',
      abortOnFailure: true,
      steps: [
        {
          action: 'openModule',
          params: { module: 'estoque' },
          description: 'Navegar para Estoque',
          required: true,
          retries: 2,
          abortOnFailure: true,
        },
        {
          action: 'validateModule',
          params: { module: 'estoque' },
          description: 'Confirmar módulo Estoque',
          required: true,
          abortOnFailure: true,
        },
      ],
    },
    {
      id: 'execution',
      name: 'Verificação de Estoque',
      description: 'Interagir com listagem de estoque',
      abortOnFailure: false,
      steps: [
        {
          action: 'searchProduct',
          params: { query: 'produto' },
          description: 'Filtrar produto no estoque',
          skipOnFailure: true,
        },
        {
          action: 'clickButton',
          params: { label: 'Ajustar Estoque' },
          description: 'Tentar ajuste de estoque',
          skipOnFailure: true,
        },
        {
          action: 'closeModal',
          description: 'Fechar modal de ajuste',
          skipOnFailure: true,
        },
      ],
    },
  ],
};

// ─── Pedidos ──────────────────────────────────────────────────────────────────
const pedidosWorkflow: WorkflowDefinition = {
  id: 'pedidos',
  name: 'Gestão de Pedidos',
  description: 'Testa o módulo de pedidos',
  phases: [
    {
      id: 'preconditions',
      name: 'Pré-condições',
      description: 'Estado inicial',
      abortOnFailure: false,
      steps: [
        { action: 'closeModal', description: 'Fechar modal', skipOnFailure: true },
        { action: 'buildInventory', description: 'Mapear interface', skipOnFailure: true },
      ],
    },
    {
      id: 'navigation',
      name: 'Navegação',
      description: 'Acessar Pedidos',
      abortOnFailure: true,
      steps: [
        {
          action: 'openModule',
          params: { module: 'pedidos' },
          description: 'Navegar para Pedidos',
          required: true,
          retries: 2,
          abortOnFailure: true,
        },
        {
          action: 'validateModule',
          params: { module: 'pedidos' },
          description: 'Confirmar módulo Pedidos',
          required: true,
          abortOnFailure: true,
        },
      ],
    },
    {
      id: 'execution',
      name: 'Verificação de Pedidos',
      description: 'Listar e verificar pedidos',
      abortOnFailure: false,
      steps: [
        {
          action: 'waitForText',
          params: { text: 'Pedido', timeout: 4000 },
          description: 'Verificar listagem de pedidos',
          skipOnFailure: true,
        },
        {
          action: 'clickButton',
          params: { label: 'Novo Pedido' },
          description: 'Tentar criar novo pedido',
          skipOnFailure: true,
        },
        {
          action: 'closeModal',
          description: 'Fechar modal se abriu',
          skipOnFailure: true,
        },
      ],
    },
  ],
};

// ─── Financeiro ───────────────────────────────────────────────────────────────
const financeiroWorkflow: WorkflowDefinition = {
  id: 'financeiro',
  name: 'Módulo Financeiro',
  description: 'Testa o módulo financeiro (caixa, contas, movimentações)',
  phases: [
    {
      id: 'preconditions',
      name: 'Pré-condições',
      description: 'Estado inicial',
      abortOnFailure: false,
      steps: [
        { action: 'closeModal', description: 'Fechar modal', skipOnFailure: true },
        { action: 'buildInventory', description: 'Mapear interface', skipOnFailure: true },
      ],
    },
    {
      id: 'navigation',
      name: 'Navegação',
      description: 'Acessar Financeiro',
      abortOnFailure: true,
      steps: [
        {
          action: 'openModule',
          params: { module: 'financeiro' },
          description: 'Navegar para Financeiro',
          required: true,
          retries: 2,
          abortOnFailure: true,
        },
        {
          action: 'validateModule',
          params: { module: 'financeiro' },
          description: 'Confirmar módulo Financeiro',
          required: true,
          abortOnFailure: true,
        },
      ],
    },
    {
      id: 'execution',
      name: 'Verificação Financeira',
      description: 'Verificar conteúdo do módulo financeiro',
      abortOnFailure: false,
      steps: [
        {
          action: 'waitForText',
          params: { text: 'Caixa', timeout: 4000 },
          description: 'Verificar referência ao caixa',
          skipOnFailure: true,
        },
        {
          action: 'clickButton',
          params: { label: 'Abrir Caixa' },
          description: 'Tentar abrir caixa',
          skipOnFailure: true,
        },
        {
          action: 'closeModal',
          description: 'Fechar modal de caixa',
          skipOnFailure: true,
        },
      ],
    },
  ],
};

// ─── Relatórios ───────────────────────────────────────────────────────────────
const relatoriosWorkflow: WorkflowDefinition = {
  id: 'relatorios',
  name: 'Relatórios',
  description: 'Testa o módulo de relatórios e dashboards',
  phases: [
    {
      id: 'preconditions',
      name: 'Pré-condições',
      description: 'Estado inicial',
      abortOnFailure: false,
      steps: [
        { action: 'closeModal', description: 'Fechar modal', skipOnFailure: true },
        { action: 'buildInventory', description: 'Mapear interface', skipOnFailure: true },
      ],
    },
    {
      id: 'navigation',
      name: 'Navegação',
      description: 'Acessar Relatórios',
      abortOnFailure: true,
      steps: [
        {
          action: 'openModule',
          params: { module: 'relatorios' },
          description: 'Navegar para Relatórios',
          required: true,
          retries: 2,
          abortOnFailure: true,
        },
        {
          action: 'validateModule',
          params: { module: 'relatorios' },
          description: 'Confirmar módulo Relatórios',
          required: true,
          abortOnFailure: true,
        },
      ],
    },
    {
      id: 'execution',
      name: 'Geração de Relatório',
      description: 'Interagir com relatórios disponíveis',
      abortOnFailure: false,
      steps: [
        {
          action: 'waitForText',
          params: { text: 'Relatório', timeout: 4000 },
          description: 'Verificar listagem de relatórios',
          skipOnFailure: true,
        },
        {
          action: 'clickButton',
          params: { label: 'Gerar Relatório' },
          description: 'Tentar gerar relatório',
          skipOnFailure: true,
        },
        {
          action: 'closeModal',
          description: 'Fechar modal/preview',
          skipOnFailure: true,
        },
      ],
    },
  ],
};

// ─── Cadastro ─────────────────────────────────────────────────────────────────
const cadastroWorkflow: WorkflowDefinition = {
  id: 'cadastro',
  name: 'Cadastros (Clientes / Fornecedores)',
  description: 'Testa o módulo de cadastros de pessoas',
  phases: [
    {
      id: 'preconditions',
      name: 'Pré-condições',
      description: 'Estado inicial',
      abortOnFailure: false,
      steps: [
        { action: 'closeModal', description: 'Fechar modal', skipOnFailure: true },
        { action: 'buildInventory', description: 'Mapear interface', skipOnFailure: true },
      ],
    },
    {
      id: 'navigation',
      name: 'Navegação',
      description: 'Acessar Cadastros',
      abortOnFailure: true,
      steps: [
        {
          action: 'openModule',
          params: { module: 'cadastro' },
          description: 'Navegar para Cadastros',
          required: true,
          retries: 2,
          abortOnFailure: true,
        },
        {
          action: 'validateModule',
          params: { module: 'cadastro' },
          description: 'Confirmar módulo Cadastro',
          required: true,
          abortOnFailure: true,
        },
      ],
    },
    {
      id: 'execution',
      name: 'Operações de Cadastro',
      description: 'Buscar e cadastrar pessoas',
      abortOnFailure: false,
      steps: [
        {
          action: 'clickButton',
          params: { label: 'Novo Cliente' },
          description: 'Tentar abrir formulário de novo cliente',
          skipOnFailure: true,
        },
        {
          action: 'fillField',
          params: { fieldName: 'nome', value: 'Cliente Teste QATry' },
          description: 'Preencher campo nome',
          skipOnFailure: true,
        },
        {
          action: 'closeModal',
          description: 'Fechar formulário sem salvar',
          skipOnFailure: true,
        },
      ],
    },
  ],
};

// ─── Exploratorio (fallback) ──────────────────────────────────────────────────
const exploratorioWorkflow: WorkflowDefinition = {
  id: 'exploratorio',
  name: 'Exploração Geral',
  description: 'Mapeia a interface e verifica navegação básica',
  phases: [
    {
      id: 'preconditions',
      name: 'Pré-condições',
      description: 'Estado inicial',
      abortOnFailure: false,
      steps: [
        { action: 'closeModal', description: 'Fechar modal inicial', skipOnFailure: true },
      ],
    },
    {
      id: 'exploration',
      name: 'Mapeamento',
      description: 'Mapear módulos disponíveis',
      abortOnFailure: false,
      steps: [
        {
          action: 'buildInventory',
          description: 'Mapear links de navegação e cards de módulos',
          required: true,
          skipOnFailure: true,
        },
        {
          action: 'waitForText',
          params: { text: 'Dashboard', timeout: 3000 },
          description: 'Verificar presença de Dashboard',
          skipOnFailure: true,
        },
      ],
    },
  ],
};

// ─── Registry ─────────────────────────────────────────────────────────────────
const WORKFLOWS: Record<string, WorkflowDefinition> = {
  pdv:          pdvWorkflow,
  checkout:     checkoutWorkflow,
  produtos:     produtosWorkflow,
  estoque:      estoqueWorkflow,
  pedidos:      pedidosWorkflow,
  financeiro:   financeiroWorkflow,
  relatorios:   relatoriosWorkflow,
  cadastro:     cadastroWorkflow,
  exploratorio: exploratorioWorkflow,
};

export function getWorkflow(intentId: string): WorkflowDefinition {
  return WORKFLOWS[intentId] ?? exploratorioWorkflow;
}

export function getWorkflowWithCustomSteps(
  intentId: string,
  customSteps: string[],
): WorkflowDefinition {
  const base = getWorkflow(intentId);
  if (!customSteps.length) return base;

  // Append custom steps as a new phase at the end
  const customPhase: WorkflowPhase = {
    id: 'custom',
    name: 'Instruções Personalizadas',
    description: 'Passos específicos definidos pelo usuário',
    abortOnFailure: false,
    steps: customSteps.map((instruction, i) => makeCustomStep(instruction, i)),
  };

  return {
    ...base,
    phases: [...base.phases, customPhase],
  };
}
