import { createContext, useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "react-router";
import { api } from "../services/api";

export const TesterContext = createContext();

function buildUserShape(user) {
  return {
    id:       user.id,
    name:     user.name,
    email:    user.email,
    role:     user.role || "QA Engineer",
    joinDate: user.created_at
      ? new Date(user.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      : "—",
    initials: user.name
      .split(" ")
      .map(w => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  };
}

export const TesterProvider = ({ children }) => {
  const navigate = useNavigate();

  const savedUser = api.getSavedUser();
  const [tester, setTester]  = useState(savedUser ? buildUserShape(savedUser) : null);
  const [login,  setLogin]   = useState(!!api.getToken() && !!savedUser);

  const [backendOnline,  setBackendOnline]  = useState(false);
  const [projects,       setProjects]       = useState([]);
  const [reports,        setReports]        = useState([]);
  const [executions,     setExecutions]     = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const stats = {
    iniciados:   executions.filter(e => e.status === "pending").length,
    emAndamento: executions.filter(e => e.status === "running").length,
    completos:   reports.filter(r => r.status === "completo" || r.score).length,
  };

  // Compute last 6 months of performance from real reports
  const performanceData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
      const label = monthDate.toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", "").replace(/^\w/, c => c.toUpperCase());
      const monthReports = reports.filter(r => {
        if (!r.rawDate || !r.score) return false;
        const d = new Date(r.rawDate);
        return d >= monthDate && d < nextMonth;
      });
      const avgScore = monthReports.length
        ? Math.round(monthReports.reduce((s, r) => s + r.score, 0) / monthReports.length)
        : 0;
      const issues = monthReports.reduce((s, r) =>
        s + (r.issues?.critical || 0) + (r.issues?.warning || 0), 0);
      return { label, score: avgScore, issues };
    });
  }, [reports]);

  useEffect(() => {
    api.health()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

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
      console.warn("Falha ao carregar dados:", err.message);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const r = await api.getReports();
      setReports(r.map(e => ({
        id:          e.id,
        title:       e.flow_name || "Auditoria",
        url:         e.base_url,
        status:      e.status === "passed"  ? "completo"
                   : e.status === "running" ? "em_andamento"
                   : "completo",
        date:        e.started_at ? new Date(e.started_at).toLocaleDateString("pt-BR") : "—",
        rawDate:     e.started_at,
        score:       e.score,
        duration:    e.duration_ms ? `${(e.duration_ms / 1000).toFixed(0)}s` : null,
        issues: {
          critical: (e.findings || []).filter(f => f.type === "critical").length,
          warning:  (e.findings || []).filter(f => f.type === "warning").length,
          info:     (e.findings || []).filter(f => f.type === "info").length,
        },
        checks:      [],
        findings:    e.findings    || [],
        suggestions: e.suggestions || [],
        project_name: e.project_name,
        htmlUrl:     api.reportHtmlUrl(e.id),
        pdfUrl:      api.reportPdfUrl(e.id),
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

  const handleLogin = useCallback((user) => {
    const shaped = buildUserShape(user);
    api.setUser(user);
    setTester(shaped);
    setLogin(true);
    navigate("/dashboard");
  }, [navigate]);

  const updateProfile = useCallback(async ({ name, role }) => {
    const shaped = buildUserShape({ ...api.getSavedUser(), name, role });
    setTester(shaped);
    api.setUser({ ...api.getSavedUser(), name, role });
    try { await api.updateProfile({ name, role }); } catch (_) {}
  }, []);

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
    updateProfile,

    backendOnline,
    projects,
    setProjects,
    loadData,

    reports,
    setReports,
    addReport,
    loadReports,
    loadingReports,

    executions,
    setExecutions,
    refreshExecutions,

    stats,
    performanceData,
  };

  return (
    <TesterContext.Provider value={value}>
      {children}
    </TesterContext.Provider>
  );
};
