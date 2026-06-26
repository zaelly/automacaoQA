import { createContext, useState } from "react"
import { useNavigate } from "react-router";

export const TesterContext = createContext();

const mockUser = {
  name: "Zaelly Barbosa",
  email: "zazabarbosa2@gmail.com",
  role: "QA Engineer",
  initials: "ZB",
  joinDate: "Janeiro 2025",
};

const mockStats = {
  iniciados: 3,
  emAndamento: 5,
  completos: 12,
};

const mockReports = [
  {
    id: 1,
    title: "Teste de Login - E-commerce Demo",
    url: "https://demo-shop.example.com",
    status: "completo",
    date: "2026-06-20",
    score: 87,
    duration: "2m 34s",
    issues: { critical: 1, warning: 3, info: 8 },
    checks: ["Navegação e UX", "Validação de Formulários", "Links Quebrados"],
    findings: [
      { type: "critical", title: "Formulário de login sem proteção CSRF", desc: "O endpoint de autenticação não valida token CSRF, permitindo ataques cross-site." },
      { type: "warning", title: "Imagens sem atributo alt", desc: "12 imagens encontradas sem descrição alternativa, prejudicando acessibilidade." },
      { type: "warning", title: "Tempo de resposta acima de 2s", desc: "A página de checkout demora 2.8s para carregar completamente." },
      { type: "warning", title: "Links externos sem rel='noopener'", desc: "3 links externos podem expor referrer desnecessariamente." },
      { type: "info", title: "Meta description ausente", desc: "A página inicial não possui meta description configurada." },
      { type: "info", title: "Cache de assets não configurado", desc: "Imagens e CSS não possuem headers de cache definidos." },
    ],
    suggestions: [
      "Implementar CSRF token em todos os formulários de autenticação",
      "Adicionar atributos alt descritivos em todas as imagens",
      "Otimizar o carregamento da página de checkout com lazy loading",
      "Configurar headers de cache para assets estáticos",
    ],
  },
  {
    id: 2,
    title: "Auditoria de Acessibilidade - Portal RH",
    url: "https://portal-rh.example.com",
    status: "completo",
    date: "2026-06-15",
    score: 72,
    duration: "4m 12s",
    issues: { critical: 3, warning: 5, info: 10 },
    checks: ["Acessibilidade", "Navegação e UX", "SEO Básico"],
    findings: [
      { type: "critical", title: "Contraste de texto insuficiente", desc: "Textos em cinza claro sobre fundo branco não atingem a razão de contraste mínima WCAG 2.1." },
      { type: "critical", title: "Elementos interativos sem foco visível", desc: "Botões e links não exibem indicador de foco ao navegar com teclado." },
      { type: "critical", title: "Formulários sem labels associadas", desc: "5 campos de formulário não possuem labels acessíveis." },
      { type: "warning", title: "Navegação por teclado inconsistente", desc: "Tab order não segue a ordem visual da página em algumas seções." },
    ],
    suggestions: [
      "Aumentar contraste de texto para ratio mínimo de 4.5:1",
      "Adicionar outline visível em todos os elementos focáveis",
      "Associar labels a todos os campos de formulário com htmlFor",
    ],
  },
  {
    id: 3,
    title: "Performance - Landing Page SaaS",
    url: "https://startup-saas.example.com",
    status: "completo",
    date: "2026-06-08",
    score: 94,
    duration: "1m 48s",
    issues: { critical: 0, warning: 1, info: 5 },
    checks: ["Performance e Carregamento", "SEO Básico", "Links Quebrados"],
    findings: [
      { type: "warning", title: "Fontes bloqueiam renderização", desc: "2 fontes Google carregadas de forma síncrona atrasam o First Contentful Paint em ~400ms." },
      { type: "info", title: "Oportunidade de compressão de imagens", desc: "3 imagens podem ser reduzidas em ~60% com compressão WebP." },
    ],
    suggestions: [
      "Carregar fontes com font-display: swap e preconnect",
      "Converter imagens para formato WebP",
      "Implementar lazy loading em imagens abaixo da dobra",
    ],
  },
  {
    id: 4,
    title: "Teste Completo - App de Delivery",
    url: "https://delivery-app.example.com",
    status: "em_andamento",
    date: "2026-06-25",
    score: null,
    duration: null,
    issues: { critical: 0, warning: 0, info: 0 },
    checks: ["Navegação e UX", "Validação de Formulários", "Performance e Carregamento", "Acessibilidade"],
    findings: [],
    suggestions: [],
  },
];

const mockPerformance = [
  { label: "Jan", score: 68, issues: 18 },
  { label: "Fev", score: 72, issues: 14 },
  { label: "Mar", score: 75, issues: 11 },
  { label: "Abr", score: 80, issues: 9 },
  { label: "Mai", score: 78, issues: 12 },
  { label: "Jun", score: 87, issues: 7 },
];

const mockHistory = [
  { id: 1, type: "report", title: "Teste de Login - E-commerce Demo", date: "20/06/2026", score: 87 },
  { id: 2, type: "report", title: "Auditoria de Acessibilidade - Portal RH", date: "15/06/2026", score: 72 },
  { id: 3, type: "report", title: "Performance - Landing Page SaaS", date: "08/06/2026", score: 94 },
  { id: 4, type: "project", title: "Projeto Banco Digital - Testes de Regressão", date: "01/06/2026", score: 88 },
  { id: 5, type: "project", title: "App Mobile Web - Testes de Usabilidade", date: "22/05/2026", score: 76 },
];

export const TesterProvider = ({ children }) => {
  const navigate = useNavigate();
  const [tester, setTester] = useState(null);
  const [login, setLogin] = useState(false);
  const [reports, setReports] = useState(mockReports);
  const [selectedReport, setSelectedReport] = useState(null);

  const handleLogin = (userData) => {
    setTester(userData || mockUser);
    setLogin(true);
    navigate("/dashboard");
  };

  const handleLogout = () => {
    setTester(null);
    setLogin(false);
    navigate("/");
  };

  const addReport = (report) => {
    setReports(prev => [report, ...prev]);
  };

  const value = {
    navigate,
    tester,
    setTester,
    login,
    setLogin,
    handleLogin,
    handleLogout,
    reports,
    setReports,
    addReport,
    selectedReport,
    setSelectedReport,
    mockUser,
    mockStats,
    mockPerformance,
    mockHistory,
  };

  return (
    <TesterContext.Provider value={value}>
      {children}
    </TesterContext.Provider>
  );
};