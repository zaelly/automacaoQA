import { createContext, useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router";
import { api } from "../services/api";

export const TesterContext = createContext();

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
  { id: 2, type: "report", title: "Auditoria - Portal RH",            date: "15/06/2026", score: 72 },
  { id: 3, type: "report", title: "Performance - Landing SaaS",       date: "08/06/2026", score: 94 },
];

function buildUserShape(user) {
  return {
    id:        user.id,
    name:      user.name,
    email:     user.email,
    role:      user.role || "QA Engineer",
    joinDate:  user.created_at
      ? new Date(user.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : "Janeiro 2025",
    initials:  user.name
      .split(" ")
      .map(w => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  };
}

export const TesterProvider = ({ children }) => {
  const navigate = useNavigate();

  // ── Auth state ──────────────────────────────────────────────────────────
  const savedUser = api.getSavedUser();
  const [tester, setTester]   = useState(savedUser ? buildUserShape(savedUser) : null);
  const [login,  setLogin]    = useState(!!api.getToken() && !!savedUser);

  // ── Backend / data state ────────────────────────────────────────────────
  const [backendOnline,   setBackendOnline]   = useState(false);
  const [projects,        setProjects]        = useState([]);
  const [reports,         setReports]         = useState([]);
  const [executions,      setExecutions]      = useState([]);
  const [loadingReports,  setLoadingReports]  = useState(false);

  const stats = {
    iniciados:    executions.filter(e => e.status === "pending").length,
    emAndamento:  executions.filter(e => e.status === "running").length,
    completos:    executions.filter(e => e.status === "passed" || e.status === "failed").length,
  };

  // ── Health check ────────────────────────────────────────────────────────
  useEffect(() => {
    api.health()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  // ── Load data when logged in + backend is up ────────────────────────────
  useEffect(() => {
    if (!login || !backendOnline) return;
    loadData();
  }, [login, backendOnline]);

  const loadData = useCallback(async () => {
    try {
      const [projs, execs] = await Promise.all([
        api.getProjects(),
        api.getAllExecutions(100),
      ]);
      setProjects(projs);
      setExecutions(execs);
      loadReports();
    } catch (err) {
      console.warn("Falha ao carregar dados da API:", err.message);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const r = await api.getReports();
      setReports(r.map(e => ({
        id:    e.id,
        title: e.flow_name || "Auditoria",
        url:   e.base_url,
        status: e.status === "passed"  ? "completo"
               : e.status === "running" ? "em_andamento"
               : "completo",
        date:     e.started_at ? new Date(e.started_at).toLocaleDateString("pt-BR") : "—",
        score:    e.score,
        duration: e.duration_ms ? `${(e.duration_ms / 1000).toFixed(0)}s` : null,
        issues: {
          critical: (e.findings || []).filter(f => f.type === "critical").length,
          warning:  (e.findings || []).filter(f => f.type === "warning").length,
          info:     (e.findings || []).filter(f => f.type === "info").length,
        },
        checks:       [],
        findings:     e.findings     || [],
        suggestions:  e.suggestions  || [],
        project_name: e.project_name,
        htmlUrl:      api.reportHtmlUrl(e.id),
        pdfUrl:       api.reportPdfUrl(e.id),
      })));
    } catch (err) {
      console.warn("Falha ao carregar relatórios:", err.message);
    } finally {
      setLoadingReports(false);
    }
  }, []);

  const addReport = useCallback((report) => {
    setReports(prev => [report, ...prev]);
  }, []);

  const refreshExecutions = useCallback(async () => {
    if (!backendOnline) return;
    try {
      const execs = await api.getAllExecutions(100);
      setExecutions(execs);
    } catch (_) {}
  }, [backendOnline]);

  // ── Auth handlers ────────────────────────────────────────────────────────
  const handleLogin = useCallback((user) => {
    const shaped = buildUserShape(user);
    api.setUser(user);
    setTester(shaped);
    setLogin(true);
    navigate("/dashboard");
  }, [navigate]);

  const handleLogout = useCallback(() => {
    api.clearSession();
    setTester(null);
    setLogin(false);
    setProjects([]);
    setReports([]);
    setExecutions([]);
    navigate("/");
  }, [navigate]);

  const value = {
    navigate,
    tester,
    setTester,
    login,
    setLogin,
    handleLogin,
    handleLogout,

    // Backend
    backendOnline,
    projects,
    setProjects,
    loadData,

    // Reports
    reports,
    setReports,
    addReport,
    loadReports,
    loadingReports,

    // Executions
    executions,
    setExecutions,
    refreshExecutions,

    // Stats + chart data (computed or mock fallback)
    mockStats:        stats,
    mockPerformance,
    mockHistory,
  };

  return (
    <TesterContext.Provider value={value}>
      {children}
    </TesterContext.Provider>
  );
};
