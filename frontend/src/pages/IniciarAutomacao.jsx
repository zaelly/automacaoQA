import { useState, useRef, useEffect, useContext } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { TesterContext } from '../context/TesterContext'
import { api, subscribeToExecution } from '../services/api'

const testTypes = [
  { id: 'nav',   label: 'Navegação e UX',            desc: 'Links, fluxo e usabilidade' },
  { id: 'forms', label: 'Validação de Formulários',   desc: 'Inputs, labels e validações' },
  { id: 'a11y',  label: 'Acessibilidade',             desc: 'WCAG, ARIA e contraste' },
  { id: 'seo',   label: 'SEO Básico',                 desc: 'Meta tags, title e estrutura' },
  { id: 'perf',  label: 'Performance e Carregamento', desc: 'Tamanho de assets e imagens' },
  { id: 'sec',   label: 'Segurança Básica',           desc: 'HTTPS, headers e formulários' },
  { id: 'links', label: 'Links Quebrados',            desc: 'Links inválidos e âncoras vazias' },
  { id: 'js',    label: 'Erros de JavaScript',        desc: 'Console errors e exceções' },
]

const issueColor = { critical: '#f87171', warning: '#fbbf24', info: '#22d3ee' }

function getBotIcon(name = '') {
  const n = name.toLowerCase()
  if (n.includes('login') || n.includes('senha') || n.includes('credencial')) return '🔐'
  if (n.includes('naveg') || n.includes('url') || n.includes('página')) return '🌐'
  if (n.includes('formulário') || n.includes('form') || n.includes('input')) return '📝'
  if (n.includes('botão') || n.includes('button') || n.includes('click')) return '👆'
  if (n.includes('screenshot') || n.includes('print') || n.includes('captur')) return '📸'
  if (n.includes('link')) return '🔗'
  if (n.includes('acessib')) return '♿'
  if (n.includes('seo') || n.includes('meta') || n.includes('título')) return '🔍'
  if (n.includes('javascript') || n.includes('erro') || n.includes('console')) return '⚠️'
  if (n.includes('segurança') || n.includes('https') || n.includes('ssl')) return '🔒'
  if (n.includes('produto') || n.includes('pdv') || n.includes('venda')) return '🛒'
  if (n.includes('upload') || n.includes('arquivo')) return '📎'
  if (n.includes('relatório') || n.includes('report')) return '📊'
  if (n.includes('finaliz') || n.includes('conclu')) return '✅'
  return '🤖'
}

function ScoreBig({ score }) {
  const color  = score >= 85 ? 'var(--success)'  : score >= 70 ? 'var(--warning)'  : 'var(--danger)'
  const border = score >= 85 ? 'rgba(52,211,153,0.3)' : score >= 70 ? 'rgba(251,191,36,0.3)' : 'rgba(248,113,113,0.3)'
  const bg     = score >= 85 ? 'rgba(52,211,153,0.1)'  : score >= 70 ? 'rgba(251,191,36,0.1)'  : 'rgba(248,113,113,0.1)'
  return (
    <div style={{ width: 96, height: 96, borderRadius: '50%', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `3px solid ${border}`, background: bg }}>
      <span style={{ fontSize: 36, fontWeight: 900, color }}>{score}</span>
    </div>
  )
}

function StepBar({ step }) {
  const labels = ['Configuração', 'Executando', 'Relatório']
  return (
    <div className="step-bar">
      {labels.map((label, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className={`step-dot${step === i+1 ? ' active' : step > i+1 ? ' done' : ''}`}>
            {step > i+1 ? '✓' : i+1}
          </div>
          <span className={`step-lbl${step === i+1 ? ' active' : step > i+1 ? ' done' : ''}`}>{label}</span>
          {i < labels.length - 1 && <div className={`step-line${step > i+1 ? ' done' : ''}`}/>}
        </div>
      ))}
    </div>
  )
}

// ─── Bot live viewer ────────────────────────────────────────────────────────────
function BotViewer({ url, botActivity }) {
  const isRunning = botActivity.status === 'running'
  const isDone    = botActivity.status === 'done'
  const isFail    = botActivity.status === 'fail'

  const ringColor  = isRunning ? 'rgba(124,58,237,0.5)'  : isDone ? 'rgba(52,211,153,0.5)'  : isFail ? 'rgba(248,113,113,0.5)'  : 'rgba(255,255,255,0.1)'
  const ringBg     = isRunning ? 'rgba(124,58,237,0.12)' : isDone ? 'rgba(52,211,153,0.12)' : isFail ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.04)'
  const dotColor   = isRunning ? '#34d399' : isDone ? '#34d399' : '#f87171'

  return (
    <div className="card" style={{ padding: 20, marginBottom: 0 }}>
      {/* Bot header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', border: `2px solid ${ringColor}`, background: ringBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, transition: 'all 0.3s' }}
          className={isRunning ? 'animate-pulse-glow' : ''}>
          {botActivity.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--faint)', fontWeight: 600 }}>Bot QA</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, boxShadow: isRunning ? `0 0 6px ${dotColor}` : 'none', transition: 'all 0.3s' }}/>
              <span style={{ fontSize: 10, color: dotColor, fontWeight: 600, transition: 'all 0.3s' }}>
                {isRunning ? 'ao vivo' : isDone ? 'concluído' : 'aguardando'}
              </span>
            </div>
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--bright)', lineHeight: 1.3 }}>
            {botActivity.step}
            {isRunning && (
              <span style={{ display: 'inline-flex', gap: 2, marginLeft: 4, verticalAlign: 'middle' }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--primary-l)', display: 'inline-block', animation: `bounce 1.2s ${i * 0.2}s infinite` }}/>
                ))}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Simulated browser window */}
      <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        {/* Browser chrome bar */}
        <div style={{ background: 'rgba(255,255,255,0.04)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(248,113,113,0.6)' }}/>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(251,191,36,0.6)' }}/>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(52,211,153,0.6)' }}/>
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--faint)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10 }}>🔒</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url || 'https://...'}</span>
          </div>
          <div style={{ flexShrink: 0 }}>
            {isRunning
              ? <div className="spinner" style={{ width: 12, height: 12, border: '2px solid rgba(124,58,237,0.25)', borderTopColor: 'var(--primary-l)' }}/>
              : <span style={{ fontSize: 10, color: isDone ? 'var(--success)' : 'var(--faint)' }}>{isDone ? '✓' : '⊙'}</span>
            }
          </div>
        </div>

        {/* Browser body */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px 16px', minHeight: 88 }}>
          {isRunning && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Skeleton lines animated */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(124,58,237,0.15)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{botActivity.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 7, borderRadius: 4, background: 'rgba(124,58,237,0.25)', width: '70%', marginBottom: 5, animation: 'shimmer 1.8s infinite' }}/>
                  <div style={{ height: 5, borderRadius: 4, background: 'rgba(255,255,255,0.07)', width: '45%' }}/>
                </div>
              </div>
              <div style={{ height: 5, borderRadius: 4, background: 'rgba(255,255,255,0.06)', width: '88%' }}/>
              <div style={{ height: 5, borderRadius: 4, background: 'rgba(255,255,255,0.05)', width: '62%' }}/>
              <div style={{ marginTop: 4, padding: '5px 10px', borderRadius: 6, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-l)', animation: 'pulse 1s infinite' }}/>
                <span style={{ fontSize: 11, color: 'var(--primary-l)', fontWeight: 600 }}>Bot executando: {botActivity.step}</span>
              </div>
            </div>
          )}
          {!isRunning && !isDone && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, gap: 10, color: 'var(--faint)', fontSize: 12 }}>
              <div className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.08)', borderTopColor: 'var(--faint)' }}/>
              Inicializando navegador headless...
            </div>
          )}
          {isDone && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 60, gap: 10, color: 'var(--success)', fontSize: 13, fontWeight: 700 }}>
              ✅ Navegador concluiu todos os testes
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export default function IniciarAutomacao() {
  const { addReport, loadReports, backendOnline } = useContext(TesterContext)
  const location = useLocation()
  const prefill  = location.state || {}

  const [step, setStep]               = useState(prefill.resumeExecId ? 2 : 1)
  const [url, setUrl]                 = useState(prefill.url || '')
  const [testName, setTestName]       = useState(prefill.testName || '')
  const [selected, setSelected]       = useState(prefill.checks || ['nav', 'a11y', 'seo', 'sec'])
  const [recordVideo, setRecordVideo] = useState(false)
  const [showCreds, setShowCreds]     = useState(false)
  const [creds, setCreds]             = useState({ email: '', username: '', password: '' })
  const [executionId, setExecutionId] = useState(prefill.resumeExecId || null)
  const [logs, setLogs]               = useState([])
  const [progress, setProgress]       = useState(0)
  const [totalSteps, setTotalSteps]   = useState(14)
  const [doneSteps, setDoneSteps]     = useState(0)
  const [result, setResult]           = useState(null)
  const [lightbox, setLightbox]       = useState(null)

  // Project binding
  const [projects, setProjects]       = useState([])
  const [projectId, setProjectId]     = useState(prefill.projectId || '')
  const [botActivity, setBotActivity] = useState({ step: 'Aguardando início...', status: 'idle', icon: '🤖' })

  const logRef    = useRef(null)
  const unsubRef  = useRef(null)

  // Load projects list
  useEffect(() => {
    if (!backendOnline) return
    api.getProjects().then(setProjects).catch(() => {})
  }, [backendOnline])

  // Auto-fill URL from selected project
  const handleProjectChange = (pid) => {
    setProjectId(pid)
    if (pid) {
      const proj = projects.find(p => p.id === pid)
      if (proj?.base_url && !url) setUrl(proj.base_url)
    }
  }

  // If resuming a running execution, connect immediately
  useEffect(() => {
    if (prefill.resumeExecId) {
      addLog('🔗', `Reconectando à execução #${prefill.resumeExecId.slice(0, 8)}...`)
      const unsub = subscribeToExecution(prefill.resumeExecId, {
        onAny: (data) => handleWsEvent(data, prefill.resumeExecId)
      })
      unsubRef.current = unsub
    }
    return () => { if (unsubRef.current) unsubRef.current() }
  }, [])

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logs])

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const addLog = (icon, text, type = 'info', screenshotUrl = null) => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [...prev, { icon, text, type, time, screenshotUrl }])
  }

  const backendFileUrl = (relPath) => {
    const base = (import.meta.env.VITE_API_URL || 'http://localhost:5005/api').replace('/api', '')
    return relPath.startsWith('/') ? `${base}${relPath}` : `${base}/${relPath}`
  }

  const handleWsEvent = (data, execId) => {
    if (data.type === 'started' && data.estimatedSteps) {
      setTotalSteps(data.estimatedSteps)
      setBotActivity({ step: 'Abrindo navegador...', status: 'running', icon: '🌐' })
    } else if (data.type === 'step_start') {
      addLog('▶', data.name)
      setBotActivity({ step: data.name, status: 'running', icon: getBotIcon(data.name) })
    } else if (data.type === 'step_pass') {
      addLog('✅', data.name, 'success')
      setBotActivity(prev => ({ ...prev, status: 'running' }))
      setDoneSteps(d => d + 1)
      setProgress(p => Math.min(95, p + Math.round(100 / totalSteps)))
    } else if (data.type === 'step_fail') {
      addLog('❌', `${data.name}: ${data.error || 'Falhou'}`, 'error', data.screenshotUrl || null)
      setBotActivity(prev => ({ ...prev, status: 'fail', icon: '❌' }))
      setDoneSteps(d => d + 1)
      setProgress(p => Math.min(95, p + Math.round(100 / totalSteps)))
      // Recover to running after showing fail
      setTimeout(() => setBotActivity(prev => prev.status === 'fail' ? { ...prev, status: 'running', icon: '🤖' } : prev), 1500)
    } else if (data.type === 'finished') {
      setProgress(100)
      setBotActivity({ step: 'Finalizando relatório...', status: 'done', icon: '📊' })
      handleFinished(execId, data)
    } else if (data.type === 'stopped') {
      setBotActivity({ step: 'Parado pelo usuário', status: 'idle', icon: '⏹' })
    }
  }

  const startAudit = async () => {
    if (!url) return
    if (!backendOnline) { toast.error('Backend offline — inicie o servidor para executar auditorias.'); return }
    setStep(2); setLogs([]); setProgress(0); setDoneSteps(0); setResult(null)
    setBotActivity({ step: 'Inicializando...', status: 'idle', icon: '🤖' })
    addLog('🚀', 'Iniciando execução QA...')

    if (projectId) {
      localStorage.setItem(`qatry_lastrun_${projectId}`, JSON.stringify({ url, testName, checks: selected }))
    }

    const credentialsPayload = showCreds && (creds.email || creds.username) && creds.password
      ? { email: creds.email || undefined, username: creds.username || undefined, password: creds.password }
      : null

    try {
      const exec = await api.startExecution({
        base_url:     url,
        trigger_type: 'manual',
        record_video: recordVideo,
        flow_name:    testName || undefined,
        credentials:  credentialsPayload,
        project_id:   projectId || undefined,
        checks:       selected,
      })
      setExecutionId(exec.id)
      addLog('🔗', `Execução #${exec.id.slice(0, 8)} criada`)
      setBotActivity({ step: 'Abrindo navegador...', status: 'running', icon: '🌐' })
      const unsub = subscribeToExecution(exec.id, {
        onAny: (data) => handleWsEvent(data, exec.id)
      })
      unsubRef.current = unsub
    } catch (err) {
      addLog('❌', `Erro ao iniciar: ${err.message}`, 'error')
      toast.error(err.message)
      setStep(1)
    }
  }

  const handleFinished = async (execId, data) => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
    if (data.status === 'stopped') { addLog('⏹', 'Parado pelo usuário', 'warning'); setStep(1); return }
    addLog('📊', 'Buscando resultado...')
    try {
      const exec = await api.getExecution(execId)
      const r = {
        score: exec.score, findings: exec.findings || [], suggestions: exec.suggestions || [],
        passed: exec.passed_steps, failed: exec.failed_steps, total: exec.total_steps,
        duration: exec.duration_ms ? `${(exec.duration_ms / 1000).toFixed(0)}s` : null,
        pdfUrl: api.reportPdfUrl(execId),
      }
      setResult(r)
      addLog('✅', 'Relatório pronto!', 'success')
      const resolvedTitle = testName || exec.flow_name || `Auditoria — ${url}`
      addReport({
        id: execId, title: resolvedTitle, url: url || exec.base_url,
        projectName: exec.project_name || (projects.find(p => p.id === projectId)?.name) || undefined,
        status: 'completo', date: new Date().toLocaleDateString('pt-BR'),
        score: exec.score, duration: r.duration,
        issues: {
          critical: r.findings.filter(f => f.type === 'critical').length,
          warning:  r.findings.filter(f => f.type === 'warning').length,
          info:     r.findings.filter(f => f.type === 'info').length,
        },
        checks: selected.map(id => testTypes.find(t => t.id === id)?.label).filter(Boolean),
        findings: r.findings, suggestions: r.suggestions,
        pdfUrl: r.pdfUrl,
      })
      loadReports?.()
    } catch (err) {
      addLog('⚠️', `Erro ao buscar resultado: ${err.message}`, 'error')
    }
    setStep(3)
  }

  const stopExecution = async () => {
    if (executionId) try { await api.stopExecution(executionId) } catch (_) {}
    setStep(1)
  }

  const resetForm = (keepParams = false) => {
    setStep(1)
    setResult(null); setExecutionId(null)
    if (!keepParams) {
      setUrl(''); setTestName('')
      setSelected(['nav', 'a11y', 'seo', 'sec']); setCreds({ email: '', username: '', password: '' })
    }
  }

  const selectedProject = projects.find(p => p.id === projectId)

  return (
    <div className="page animate-fade-in" style={{ maxWidth: 860 }}>
      <div className="page-hdr">
        <h1>Iniciar Automação</h1>
        <p>A IA testa sua aplicação como um QA experiente e gera um relatório completo</p>
      </div>

      <StepBar step={step}/>

      {/* ─── Step 1 — Config ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="card p-8" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {!backendOnline && (
            <div className="alert-warn">
              <span style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }}>⚠</span>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--warning)' }}>Backend offline</p>
                <p style={{ fontSize: 12.5, color: 'rgba(251,191,36,0.7)', marginTop: 2 }}>
                  Execute <code>npm run dev</code> na pasta backend/ para iniciar auditorias reais.
                </p>
              </div>
            </div>
          )}

          {/* Project selector */}
          <div className="form-group">
            <label className="form-label">
              📁 Projeto <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(opcional — vincula ao histórico do projeto)</span>
            </label>
            <select
              className="input"
              value={projectId}
              onChange={e => handleProjectChange(e.target.value)}
              style={{ cursor: 'pointer' }}>
              <option value="">— Sem projeto (auditoria avulsa) —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.base_url ? ` · ${p.base_url}` : ''}</option>
              ))}
            </select>
            {selectedProject && (
              <p style={{ fontSize: 11, color: 'var(--success)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                ✓ Vinculado a <strong>{selectedProject.name}</strong> — a execução aparecerá no histórico do projeto
              </p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">URL da Aplicação *</label>
            <input className="input" style={{ fontSize: 15 }} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://minha-aplicacao.com"/>
          </div>

          <div className="form-group">
            <label className="form-label">
              Nome do Teste <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(opcional)</span>
            </label>
            <input className="input" value={testName} onChange={e => setTestName(e.target.value)} placeholder="Ex: Auditoria de Acessibilidade v2.1"/>
          </div>

          {/* Credentials toggle */}
          <div>
            <button
              onClick={() => setShowCreds(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: showCreds ? 'var(--primary-l)' : 'var(--muted)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', padding: 0 }}>
              <span style={{ fontSize: 16 }}>{showCreds ? '🔓' : '🔒'}</span>
              {showCreds ? 'Ocultar credenciais de acesso' : 'Adicionar credenciais de acesso (login)'}
              <span style={{ fontSize: 11, opacity: 0.6 }}>{showCreds ? '▲' : '▼'}</span>
            </button>

            {showCreds && (
              <div style={{ marginTop: 14, padding: 16, borderRadius: 12, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.18)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 2 }}>
                  As credenciais são usadas apenas durante o teste e <strong style={{ color: 'var(--muted)' }}>não são armazenadas</strong>.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">E-mail</label>
                    <input className="input" type="email" value={creds.email} onChange={e => setCreds(c => ({ ...c, email: e.target.value }))} placeholder="usuario@exemplo.com"/>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Usuário <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(ou login)</span></label>
                    <input className="input" value={creds.username} onChange={e => setCreds(c => ({ ...c, username: e.target.value }))} placeholder="nome_de_usuario"/>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Senha *</label>
                  <input className="input" type="password" value={creds.password} onChange={e => setCreds(c => ({ ...c, password: e.target.value }))} placeholder="••••••••"/>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--faint)' }}>
                  💡 A IA tentará preencher automaticamente o formulário de login antes de iniciar os testes.
                </p>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" style={{ marginBottom: 12 }}>Tipos de Verificação</label>
            <div className="check-grid">
              {testTypes.map(t => {
                const active = selected.includes(t.id)
                return (
                  <div key={t.id} onClick={() => toggle(t.id)} className={`check-item${active ? ' on' : ''}`}>
                    <div className="check-box">{active ? '✓' : ''}</div>
                    <div>
                      <p className="check-label">{t.label}</p>
                      <p className="check-desc">{t.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <div onClick={() => setRecordVideo(v => !v)} className={`toggle-sw${recordVideo ? ' on' : ''}`}>
              <div className="toggle-sw-thumb"/>
            </div>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Gravar vídeo da execução</span>
          </label>

          <button onClick={startAudit} disabled={!url || !backendOnline} className="btn btn-lg btn-primary btn-full">
            🚀 Iniciar Auditoria IA{selectedProject ? ` no projeto "${selectedProject.name}"` : ''}
          </button>
        </div>
      )}

      {/* ─── Step 2 — Running ─────────────────────────────────────────── */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Bot viewer */}
          <BotViewer url={url || prefill.url} botActivity={botActivity}/>

          {/* Progress card */}
          <div className="card p-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--faint)' }}>Progresso</span>
              <span style={{ fontWeight: 700, color: 'var(--primary-l)' }}>{progress}%</span>
            </div>
            <div className="progress-track" style={{ marginBottom: 6 }}>
              <div className="progress-fill" style={{ width: `${progress}%`, transition: 'width 0.4s ease' }}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--faint)', marginBottom: 20 }}>
              <span>{doneSteps}/{totalSteps} steps concluídos</span>
              {selectedProject && <span>📁 {selectedProject.name}</span>}
            </div>

            <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>Log de execução</p>
            <div ref={logRef} className="log-term">
              {logs.map((log, i) => (
                <div key={i} style={{ marginBottom: log.screenshotUrl ? 8 : 0 }}>
                  <div className="log-row">
                    <span className="log-time">{log.time}</span>
                    <span>{log.icon}</span>
                    <span className={`log-${log.type}`}>{log.text}</span>
                  </div>
                  {log.screenshotUrl && (
                    <button
                      onClick={() => setLightbox(backendFileUrl(log.screenshotUrl))}
                      title="Ver screenshot do erro"
                      style={{ display: 'block', marginTop: 4, marginLeft: 68, background: 'none', border: '1px solid rgba(248,113,113,0.4)', borderRadius: 6, padding: 3, cursor: 'pointer' }}>
                      <img
                        src={backendFileUrl(log.screenshotUrl)}
                        alt="erro screenshot"
                        style={{ height: 72, borderRadius: 4, display: 'block' }}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                      <span style={{ fontSize: 10, color: '#f87171', display: 'block', textAlign: 'center', marginTop: 2 }}>clique para ampliar</span>
                    </button>
                  )}
                </div>
              ))}
              {!logs.length && <span style={{ color: 'var(--faint)' }}>Inicializando...</span>}
            </div>
          </div>

          <button onClick={stopExecution} className="btn btn-danger-soft btn-full" style={{ padding: '12px 20px' }}>
            ⏹ Parar Execução
          </button>

          {lightbox && (
            <div onClick={() => setLightbox(null)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000,
                       display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                <img src={lightbox} alt="Screenshot" style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 10, display: 'block' }}/>
                <button onClick={() => setLightbox(null)}
                  style={{ position: 'absolute', top: -14, right: -14, width: 32, height: 32, borderRadius: '50%',
                           background: '#f87171', border: 'none', color: '#fff', fontWeight: 900, fontSize: 16,
                           cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Step 3 — Result ─────────────────────────────────────────── */}
      {step === 3 && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card p-8" style={{ textAlign: 'center' }}>
            <ScoreBig score={result.score}/>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, color: result.score >= 85 ? 'var(--success)' : result.score >= 70 ? 'var(--warning)' : 'var(--danger)' }}>
              {result.score >= 85 ? 'Excelente! 🎉' : result.score >= 70 ? 'Bom, com melhorias 💪' : 'Atenção necessária ⚠️'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 8 }} className="truncate">{url || prefill.url}</p>
            {selectedProject && (
              <p style={{ fontSize: 12, color: 'var(--success)', marginBottom: 12 }}>
                ✓ Salvo em <strong>{selectedProject.name}</strong>
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 28, fontSize: 13 }}>
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>{result.passed} steps OK</span>
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{result.failed} com falha</span>
              {result.duration && <span style={{ color: 'var(--muted)' }}>⏱ {result.duration}</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[['critical','Críticos'], ['warning','Avisos'], ['info','Infos']].map(([type, label]) => (
              <div key={type} className="card px-4 py-3" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: issueColor[type] }}>{result.findings.filter(f => f.type === type).length}</p>
                <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{label}</p>
              </div>
            ))}
          </div>

          {result.findings.length > 0 && (
            <div className="card p-6">
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--bright)', marginBottom: 16 }}>Issues Encontrados</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.findings.map((f, i) => (
                  <div key={i} className={`finding ${f.type}`}>
                    <span className={`finding-type ${f.type}`}>
                      {f.type === 'critical' ? '🔴 CRÍTICO' : f.type === 'warning' ? '🟡 AVISO' : '🔵 INFO'}
                    </span>
                    <p className="finding-title">{f.title}</p>
                    <p className="finding-desc">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div className="card p-6">
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--bright)', marginBottom: 16 }}>💡 Sugestões de Melhoria</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.suggestions.map((s, i) => (
                  <div key={i} className="suggestion-row">
                    <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 2 }}>→</span>
                    <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{s}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {result.pdfUrl && (
              <a href={result.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary flex-1">
                📥 Relatório em PDF
              </a>
            )}
            <button onClick={() => resetForm(true)} className="btn btn-secondary" title="Repetir com os mesmos parâmetros">
              ↺ Repetir Teste
            </button>
            <button onClick={() => resetForm(false)} className="btn btn-secondary">
              + Novo Teste
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
