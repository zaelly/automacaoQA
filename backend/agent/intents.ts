/**
 * Intent library — pre-defined QA test plans.
 * The AI only classifies the intent (cheap, ~50 tokens).
 * The system handles all the planning.
 */

export type IntentId =
  | 'login' | 'pdv' | 'checkout' | 'cadastro'
  | 'produtos' | 'estoque' | 'financeiro'
  | 'pedidos' | 'relatorios' | 'exploratorio';

export interface IntentDefinition {
  id: IntentId;
  name: string;
  emoji: string;
  description: string;
  steps: string[];
  paths: string[];          // Common URL paths to try
  selectors: string[];      // DOM indicators to detect this area
}

export const INTENTS: Record<IntentId, IntentDefinition> = {
  login: {
    id: 'login',
    name: 'Login',
    emoji: '🔐',
    description: 'Verificar autenticação e controle de acesso',
    paths: ['/login', '/auth', '/signin', '/entrar', '/acesso'],
    selectors: ['input[type="password"]', 'form[action*="login"]', '[class*="login"]'],
    steps: [
      'Abrir página de login',
      'Verificar presença dos campos usuário e senha',
      'Preencher credenciais válidas',
      'Submeter formulário e verificar redirecionamento',
      'Testar login com credenciais inválidas',
      'Verificar mensagem de erro adequada',
      'Verificar link "Esqueci minha senha" (se existir)',
    ],
  },

  pdv: {
    id: 'pdv',
    name: 'PDV (Ponto de Venda)',
    emoji: '🏪',
    description: 'Testar o fluxo completo do caixa/PDV',
    paths: ['/pdv', '/pos', '/caixa', '/venda', '/frente-de-caixa', '/point-of-sale'],
    selectors: ['[class*="pdv"]', '[class*="pos"]', '[class*="caixa"]', '[data-testid*="pdv"]'],
    steps: [
      'Abrir o PDV/caixa',
      'Buscar e adicionar produto ao carrinho',
      'Alterar quantidade do item',
      'Aplicar desconto no item',
      'Remover produto do carrinho',
      'Adicionar cliente à venda',
      'Selecionar forma de pagamento',
      'Finalizar venda',
      'Verificar comprovante/recibo gerado',
      'Testar cancelamento de venda',
    ],
  },

  checkout: {
    id: 'checkout',
    name: 'Checkout',
    emoji: '🛒',
    description: 'Testar fluxo de compra e finalização de pedido',
    paths: ['/checkout', '/carrinho', '/cart', '/finalizar-compra', '/bag'],
    selectors: ['[class*="cart"]', '[class*="checkout"]', '[class*="carrinho"]', '[class*="basket"]'],
    steps: [
      'Navegar para listagem de produtos',
      'Adicionar produto ao carrinho',
      'Acessar carrinho/checkout',
      'Alterar quantidade no carrinho',
      'Remover item do carrinho',
      'Preencher dados de entrega',
      'Selecionar forma de pagamento',
      'Confirmar pedido',
      'Verificar número do pedido e confirmação',
    ],
  },

  cadastro: {
    id: 'cadastro',
    name: 'Cadastro',
    emoji: '📝',
    description: 'Testar formulários de registro e criação de conta',
    paths: ['/cadastro', '/registro', '/signup', '/register', '/criar-conta', '/nova-conta'],
    selectors: ['[class*="register"]', '[class*="signup"]', '[class*="cadastro"]', 'form[action*="register"]'],
    steps: [
      'Navegar para página de cadastro',
      'Verificar campos obrigatórios do formulário',
      'Testar validações (e-mail inválido, senha fraca)',
      'Preencher todos os dados válidos',
      'Submeter cadastro e verificar confirmação',
      'Testar tentativa de cadastro com e-mail duplicado',
    ],
  },

  produtos: {
    id: 'produtos',
    name: 'Produtos / Catálogo',
    emoji: '📦',
    description: 'Testar gestão de catálogo de produtos',
    paths: ['/produtos', '/products', '/catalogo', '/itens', '/items', '/mercadorias'],
    selectors: ['[class*="product"]', '[class*="produto"]', '[class*="catalog"]', '[class*="item-list"]'],
    steps: [
      'Listar todos os produtos',
      'Buscar produto por nome',
      'Filtrar produtos por categoria',
      'Visualizar detalhes de um produto',
      'Criar novo produto',
      'Editar produto existente',
      'Inativar/remover produto',
    ],
  },

  estoque: {
    id: 'estoque',
    name: 'Estoque / Inventário',
    emoji: '📊',
    description: 'Testar controle de inventário e movimentações',
    paths: ['/estoque', '/inventory', '/armazem', '/almoxarifado', '/stock'],
    selectors: ['[class*="stock"]', '[class*="estoque"]', '[class*="inventory"]'],
    steps: [
      'Visualizar estoque atual de itens',
      'Buscar item específico',
      'Registrar entrada de mercadoria',
      'Registrar saída de mercadoria',
      'Verificar alertas de estoque mínimo',
      'Gerar relatório de movimentação',
    ],
  },

  financeiro: {
    id: 'financeiro',
    name: 'Financeiro',
    emoji: '💰',
    description: 'Testar módulo financeiro (contas, fluxo de caixa)',
    paths: ['/financeiro', '/finance', '/contas', '/fluxo-caixa', '/contabil', '/financas'],
    selectors: ['[class*="finance"]', '[class*="financeiro"]', '[class*="contabil"]'],
    steps: [
      'Acessar painel financeiro',
      'Verificar dashboard com totais',
      'Lançar conta a pagar',
      'Lançar conta a receber',
      'Verificar fluxo de caixa do período',
      'Testar conciliação ou fechamento',
    ],
  },

  pedidos: {
    id: 'pedidos',
    name: 'Pedidos',
    emoji: '📋',
    description: 'Testar gestão e ciclo de vida de pedidos',
    paths: ['/pedidos', '/orders', '/encomendas', '/vendas', '/order'],
    selectors: ['[class*="order"]', '[class*="pedido"]', '[class*="encomenda"]'],
    steps: [
      'Listar todos os pedidos',
      'Buscar pedido por número ou cliente',
      'Filtrar por status',
      'Visualizar detalhes de um pedido',
      'Alterar status do pedido',
      'Cancelar pedido',
      'Verificar histórico de alterações',
    ],
  },

  relatorios: {
    id: 'relatorios',
    name: 'Relatórios',
    emoji: '📈',
    description: 'Testar módulo de relatórios e exportações',
    paths: ['/relatorios', '/reports', '/relatorio', '/dashboard', '/bi', '/analytics'],
    selectors: ['[class*="report"]', '[class*="relatorio"]', '[class*="analytics"]'],
    steps: [
      'Acessar módulo de relatórios',
      'Verificar relatórios disponíveis',
      'Aplicar filtros de data/período',
      'Gerar relatório selecionado',
      'Testar exportação (PDF ou Excel)',
      'Verificar gráficos e métricas no dashboard',
    ],
  },

  exploratorio: {
    id: 'exploratorio',
    name: 'Exploração Automática',
    emoji: '🔍',
    description: 'Auditoria completa sem foco específico',
    paths: ['/'],
    selectors: [],
    steps: [
      'Verificar carregamento e performance da página principal',
      'Testar formulário de login (se detectado)',
      'Auditar todos os links internos',
      'Verificar acessibilidade (alt text, heading)',
      'Monitorar erros de console JavaScript',
      'Monitorar erros de rede (4xx / 5xx)',
      'Verificar meta tags e SEO básico',
      'Medir TTFB, FCP e LCP',
    ],
  },
};

export const ALL_INTENT_IDS = Object.keys(INTENTS) as IntentId[];

export function getIntent(id: string): IntentDefinition | undefined {
  return INTENTS[id as IntentId];
}
