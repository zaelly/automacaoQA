import { useState, useRef, useEffect, useContext } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import { TesterContext } from '../context/TesterContext'
import { api, subscribeToExecution } from '../services/api'

const testTypes = [
  { id: 'nav',   label: 'Navegação e UX',             desc: 'Links, fluxo e usabilidade' },
  { id: 'forms', label: 'Validação de Formulários',    desc: 'Inputs, labels e validações' },
  { id: 'a11y',  label: 'Acessibilidade',              desc: 'WCAG, ARIA e contraste' },
  { id: 'seo',   label: 'SEO Básico',                  desc: 'Meta tags, title e estrutura' },
  { id: 'perf',  label: 'Performance e Carregamento',  desc: 'Tamanho de assets e imagens' },
  { id: 'sec',   label: 'Segurança Básica',            desc: 'HTTPS, headers e formulários' },
  { id: 'links', label: 'Links Quebrados',             desc: 'Links inválidos e âncoras vazias' },
  { id: 'js',    label: 'Erros de JavaScript',         desc: 'Console errors e exceções' },
]

const issueColor = { critical: '#f87171', warning: '#fbbf24', info: '#22d3ee' }

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
  const [totalSteps]                  = useState(14)
  const [doneSteps, setDoneSteps]     = useState(0)
  const [result, setResult]           = useState(null)
  const logRef   = useRef(null)
  const unsubRef = useRef(null)

  // If resuming a running execution, connect immediately
  useEffect(() => {
    if (prefill.resumeExecId) {
      addLog('🔗', `Reconectando à execução #${prefill.resumeExecId.slice(0, 8)}...`)
      const unsub = subscribeToExecution(prefill.resumeExecId, {
        onAny: (data) => {
          if (data.type === 'step_start') addLog('▶', data.name)
          else if (data.type === 'step_pass') {
            addLog('✅', data.name, 'success')
            setDoneSteps(d => d + 1)
            setProgress(p => Math.min(95, p + Math.round(100 / totalSteps)))
          } else if (data.type === 'step_fail') {
            addLog('❌', `${data.name}: ${data.error || 'Falhou'}`, 'error')
            setDoneSteps(d => d + 1)
            setProgress(p => Math.min(95, p + Math.round(100 / totalSteps)))
          } else if (data.type === 'finished') {
            setProgress(100)
            handleFinished(prefill.resumeExecId, data)
          }
        }
      })
      unsubRef.current = unsub
    }
    return () => { if (unsubRef.current) unsubRef.current() }
  }, [])

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logs])

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const addLog = (icon, text, type = 'info') => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [...prev, { icon, text, type, time }])
  }

  const startAudit = async () => {
    if (!url) return
    if (!backendOnline) { toast.error('Backend offline — inicie o servidor para executar auditorias.'); return }
    setStep(2); setLogs([]); setProgress(0); setDoneSteps(0); setResult(null)
    addLog('🚀', 'Iniciando execução QA...')

    if (prefill.projectId) {
      localStorage.setItem(`qatry_lastrun_${prefill.projectId}`, JSON.stringify({ url, testName, checks: selected }))
    }

    const credentialsPayload = showCreds && (creds.email || creds.username) && creds.password
      ? { email: creds.email || undefined, username: creds.username || undefined, password: creds.password }
      : null

    try {
      const exec = await api.startExecution({
        base_url: url,
        trigger_type: 'manual',
        record_video: recordVideo,
        flow_name: testName || undefined,
        credentials: credentialsPayload,
      })
      setExecutionId(exec.id)
      addLog('🔗', `Execução #${exec.id.slice(0, 8)} criada`)
      const unsub = subscribeToExecution(exec.id, {
        onAny: (data) => {
          if (data.type === 'step_start') addLog('▶', data.name)
          else if (data.type === 'step_pass') {
            addLog('✅', data.name, 'success')
            setDoneSteps(d => d + 1)
            setProgress(p => Math.min(95, p + Math.round(100 / totalSteps)))
          } else if (data.type === 'step_fail') {
            addLog('❌', `${data.name}: ${data.error || 'Falhou'}`, 'error')
            setDoneSteps(d => d + 1)
            setProgress(p => Math.min(95, p + Math.round(100 / totalSteps)))
          } else if (data.type === 'finished') {
            setProgress(100)
            handleFinished(exec.id, data)
          }
        }
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

  const resetForm = () => {
    setStep(1); setUrl(''); setTestName(''); setResult(null); setExecutionId(null)
    setSelected(['nav', 'a11y', 'seo', 'sec']); setCreds({ email: '', username: '', password: '' })
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: 860 }}>
      <div className="page-hdr">
        <h1>Iniciar Automação</h1>
        <p>A IA testa sua aplicação como um QA experiente e gera um relatório completo</p>
      </div>

      <StepBar step={step}/>

      {/* Step 1 — Config */}
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
            🚀 Iniciar Auditoria IA
          </button>
        </div>
      )}

      {/* Step 2 — Running */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card p-6">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', border: '2px solid rgba(124,58,237,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }} className="animate-pulse-glow">🤖</div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--bright)', marginBottom: 2 }}>IA executando testes...</p>
                <p style={{ fontSize: 13, color: 'var(--faint)' }} className="truncate">{url || prefill.url}</p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--faint)' }}>Progresso</span>
              <span style={{ fontWeight: 700, color: 'var(--primary-l)' }}>{progress}%</span>
            </div>
            <div className="progress-track" style={{ marginBottom: 4 }}>
              <div className="progress-fill" style={{ width: `${progress}%` }}/>
            </div>
            <p style={{ fontSize: 11, color: 'var(--faint)', textAlign: 'right', marginBottom: 20 }}>{doneSteps}/{totalSteps} steps concluídos</p>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 8 }}>Log de execução</p>
            <div ref={logRef} className="log-term">
              {logs.map((log, i) => (
                <div key={i} className="log-row">
                  <span className="log-time">{log.time}</span>
                  <span>{log.icon}</span>
                  <span className={`log-${log.type}`}>{log.text}</span>
                </div>
              ))}
              {!logs.length && <span style={{ color: 'var(--faint)' }}>Inicializando...</span>}
            </div>
          </div>
          <button onClick={stopExecution} className="btn btn-danger-soft btn-full" style={{ padding: '12px 20px' }}>
            ⏹ Parar Execução
          </button>
        </div>
      )}

      {/* Step 3 — Result */}
      {step === 3 && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card p-8" style={{ textAlign: 'center' }}>
            <ScoreBig score={result.score}/>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, color: result.score >= 85 ? 'var(--success)' : result.score >= 70 ? 'var(--warning)' : 'var(--danger)' }}>
              {result.score >= 85 ? 'Excelente! 🎉' : result.score >= 70 ? 'Bom, com melhorias 💪' : 'Atenção necessária ⚠️'}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 16 }} className="truncate">{url || prefill.url}</p>
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
            <button onClick={resetForm} className="btn btn-secondary">
              ↺ Novo Teste
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
