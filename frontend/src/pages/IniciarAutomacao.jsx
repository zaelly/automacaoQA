import { useState, useRef, useEffect, useContext } from 'react'
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

function StepBar({ step }) {
  const labels = ['Configuração', 'Executando', 'Relatório']
  return (
    <div className="flex items-center gap-2 mb-8">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold transition-all duration-300
            ${step === i+1 ? 'bg-primary text-white shadow-[0_0_12px_rgba(124,58,237,0.5)]'
            : step > i+1 ? 'bg-success/20 text-success border border-success/40'
            : 'bg-white/8 text-faint'}`}>
            {step > i+1 ? '✓' : i+1}
          </div>
          <span className={`text-[13px] font-semibold ${step === i+1 ? 'text-bright' : 'text-faint'}`}>{label}</span>
          {i < labels.length - 1 && <div className={`h-px w-8 mx-1 ${step > i+1 ? 'bg-success/40' : 'bg-white/8'}`}/>}
        </div>
      ))}
    </div>
  )
}

export default function IniciarAutomacao() {
  const { addReport, loadReports, backendOnline } = useContext(TesterContext)
  const [step, setStep] = useState(1)
  const [url, setUrl] = useState('')
  const [testName, setTestName] = useState('')
  const [selected, setSelected] = useState(['nav', 'a11y', 'seo', 'sec'])
  const [recordVideo, setRecordVideo] = useState(false)

  const [executionId, setExecutionId] = useState(null)
  const [logs, setLogs] = useState([])
  const [progress, setProgress] = useState(0)
  const [totalSteps] = useState(14)
  const [doneSteps, setDoneSteps] = useState(0)
  const [result, setResult] = useState(null)
  const logRef = useRef(null)
  const unsubRef = useRef(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  useEffect(() => () => { if (unsubRef.current) unsubRef.current() }, [])

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const addLog = (icon, text, type = 'info') => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [...prev, { icon, text, type, time }])
  }

  const startAudit = async () => {
    if (!url) return
    setStep(2); setLogs([]); setProgress(0); setDoneSteps(0); setResult(null)
    addLog('🚀', 'Iniciando execução QA...')

    if (!backendOnline) { runMockExecution(); return }

    try {
      const exec = await api.startExecution({ base_url: url, trigger_type: 'manual', record_video: recordVideo })
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
      addLog('⚠️', `Backend offline: ${err.message}`, 'error')
      runMockExecution()
    }
  }

  const handleFinished = async (execId, data) => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
    if (data.status === 'stopped') { addLog('⏹', 'Parado', 'warning'); setStep(1); return }
    addLog('📊', 'Buscando resultado...')
    try {
      const exec = await api.getExecution(execId)
      const r = {
        score: exec.score,
        findings: exec.findings || [],
        suggestions: exec.suggestions || [],
        passed: exec.passed_steps, failed: exec.failed_steps, total: exec.total_steps,
        duration: exec.duration_ms ? `${(exec.duration_ms / 1000).toFixed(0)}s` : null,
        htmlUrl: api.reportHtmlUrl(execId),
        pdfUrl: api.reportPdfUrl(execId),
      }
      setResult(r)
      addLog('✅', 'Relatório pronto!', 'success')
      addReport({
        id: execId, title: testName || `Auditoria — ${url}`, url,
        status: 'completo', date: new Date().toLocaleDateString('pt-BR'),
        score: exec.score, duration: r.duration,
        issues: {
          critical: r.findings.filter(f => f.type === 'critical').length,
          warning: r.findings.filter(f => f.type === 'warning').length,
          info: r.findings.filter(f => f.type === 'info').length,
        },
        checks: selected.map(id => testTypes.find(t => t.id === id)?.label).filter(Boolean),
        findings: r.findings, suggestions: r.suggestions,
        htmlUrl: r.htmlUrl, pdfUrl: r.pdfUrl,
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

  const runMockExecution = () => {
    const mockSteps = [
      'Carregando a URL alvo','Verificando título','Verificando meta description',
      'Verificando imagens sem alt','Verificando formulários','Verificando links quebrados',
      'Verificando erros de console','Verificando contraste','Verificando viewport',
      'Verificando HTTPS','Verificando favicon','Verificando imagens grandes',
      'Verificando botões acessíveis','Capturando screenshot',
    ]
    let i = 0
    const interval = setInterval(() => {
      if (i >= mockSteps.length) {
        clearInterval(interval); setProgress(100)
        const r = generateMockResult()
        setResult(r)
        addLog('✅', 'Concluído (modo offline)!', 'success')
        addReport({
          id: Date.now(), title: testName || `Auditoria — ${url}`, url, status: 'completo',
          date: new Date().toLocaleDateString('pt-BR'), score: r.score, duration: '42s',
          issues: { critical: r.findings.filter(f => f.type === 'critical').length, warning: r.findings.filter(f => f.type === 'warning').length, info: r.findings.filter(f => f.type === 'info').length },
          checks: selected.map(id => testTypes.find(t => t.id === id)?.label).filter(Boolean),
          findings: r.findings, suggestions: r.suggestions,
        })
        setTimeout(() => setStep(3), 400); return
      }
      addLog('▶', mockSteps[i])
      setTimeout(() => { addLog('✅', mockSteps[i], 'success'); setDoneSteps(d => d+1); setProgress(Math.round(((i+1)/mockSteps.length)*95)) }, 300)
      i++
    }, 800)
  }

  const generateMockResult = () => {
    const score = 60 + Math.floor(Math.random() * 35)
    const findings = [
      { type: 'warning', title: 'Imagens sem atributo alt', desc: '3 imagens encontradas sem descrição alternativa.' },
      { type: 'info', title: 'Meta description ausente', desc: 'A página não possui meta description.' },
    ]
    if (score < 80) findings.unshift({ type: 'critical', title: 'Campos sem labels acessíveis', desc: '2 campos de formulário sem label associada.' })
    return { score, findings, suggestions: ['Adicione alt em todas as imagens', 'Configure meta description', 'Associe labels a campos de formulário'], passed: 11, failed: 3, total: 14 }
  }

  const scoreCls = (s) => s >= 85 ? 'text-success' : s >= 70 ? 'text-warning' : 'text-danger'
  const scoreBorder = (s) => s >= 85 ? 'border-success/30' : s >= 70 ? 'border-warning/30' : 'border-danger/30'
  const scoreBg = (s) => s >= 85 ? 'bg-success/10' : s >= 70 ? 'bg-warning/10' : 'bg-danger/10'
  const issueColors = { critical: '#f87171', warning: '#fbbf24', info: '#22d3ee' }

  return (
    <div className="py-8 px-10 max-w-215 animate-fade-in">
      <div className="mb-7">
        <h1 className="text-[28px] font-extrabold text-bright mb-1">Iniciar Automação</h1>
        <p className="text-[15px] text-muted">
          A IA testa sua aplicação como um QA experiente e gera um relatório completo
          {!backendOnline && <span className="ml-2 badge badge-yellow">backend offline</span>}
        </p>
      </div>

      <StepBar step={step}/>

      {/* Step 1 — Config */}
      {step === 1 && (
        <div className="card p-8 flex flex-col gap-5">
          <div>
            <label className="block text-[13px] font-semibold text-muted mb-1.5">URL da Aplicação *</label>
            <input className="input-field text-[15px]" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://minha-aplicacao.com"/>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-muted mb-1.5">Nome do Teste <span className="font-normal text-faint">(opcional)</span></label>
            <input className="input-field" value={testName} onChange={e => setTestName(e.target.value)} placeholder="Ex: Auditoria de Acessibilidade - v2.1"/>
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-muted mb-3">Tipos de Verificação</label>
            <div className="grid grid-cols-2 gap-2">
              {testTypes.map(t => {
                const active = selected.includes(t.id)
                return (
                  <div key={t.id} onClick={() => toggle(t.id)}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-150
                      ${active ? 'bg-primary/15 border-primary/40' : 'bg-white/3 border-white/8 hover:border-white/20'}`}>
                    <div className={`w-4 h-4 rounded border mt-0.5 shrink-0 flex items-center justify-center text-[10px] font-bold
                      ${active ? 'bg-primary border-primary text-white' : 'border-white/20'}`}>
                      {active ? '✓' : ''}
                    </div>
                    <div>
                      <p className={`text-[13px] font-bold mb-0.5 ${active ? 'text-primary-light' : 'text-bright'}`}>{t.label}</p>
                      <p className="text-[11px] text-faint">{t.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div onClick={() => setRecordVideo(v => !v)}
              className={`w-10 h-6 rounded-full transition-all duration-200 relative ${recordVideo ? 'bg-primary' : 'bg-white/10'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200 ${recordVideo ? 'left-5' : 'left-1'}`}/>
            </div>
            <span className="text-[13px] text-muted">Gravar vídeo da execução</span>
          </label>
          <button onClick={startAudit} disabled={!url}
            className="btn-primary py-3.5 text-[15px] font-bold disabled:opacity-40 disabled:cursor-not-allowed">
            🚀 Iniciar Auditoria IA
          </button>
        </div>
      )}

      {/* Step 2 — Running */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div className="card p-6">
            <div className="flex items-center gap-4 mb-5">
              <div className="w-18 h-18 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-3xl animate-pulse-glow shrink-0">🤖</div>
              <div>
                <h3 className="text-base font-bold text-bright mb-1">IA executando testes...</h3>
                <p className="text-sm text-faint truncate">{url}</p>
              </div>
            </div>
            <div className="flex justify-between text-[13px] mb-1.5">
              <span className="text-faint">Progresso</span>
              <span className="font-bold text-primary-light">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/8 overflow-hidden mb-5">
              <div className="h-full rounded-full bg-linear-to-r from-primary to-cyan transition-all duration-500" style={{ width: `${progress}%` }}/>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-semibold text-muted">Log de execução</span>
              <span className="text-[11px] text-faint">{doneSteps}/{totalSteps} steps</span>
            </div>
            <div ref={logRef} className="bg-black/30 rounded-xl p-4 h-52 overflow-y-auto font-mono text-[12px] flex flex-col gap-1.5">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-faint shrink-0">{log.time}</span>
                  <span>{log.icon}</span>
                  <span className={log.type === 'error' ? 'text-danger' : log.type === 'success' ? 'text-success' : log.type === 'warning' ? 'text-warning' : 'text-muted'}>
                    {log.text}
                  </span>
                </div>
              ))}
              {!logs.length && <span className="text-faint">Iniciando...</span>}
            </div>
          </div>
          <button onClick={stopExecution}
            className="py-3 rounded-xl bg-danger/10 text-danger text-[13px] font-semibold border border-danger/20 cursor-pointer hover:bg-danger/20 transition-all duration-200">
            ⏹ Parar Execução
          </button>
        </div>
      )}

      {/* Step 3 — Result */}
      {step === 3 && result && (
        <div className="flex flex-col gap-5">
          <div className="card p-8 text-center">
            <div className={`w-25 h-25 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl font-black border-[3px] ${scoreBg(result.score)} ${scoreBorder(result.score)}`}>
              <span className={scoreCls(result.score)}>{result.score}</span>
            </div>
            <h2 className={`text-2xl font-extrabold mb-1 ${scoreCls(result.score)}`}>
              {result.score >= 85 ? 'Excelente! 🎉' : result.score >= 70 ? 'Bom, com melhorias 💪' : 'Atenção necessária ⚠️'}
            </h2>
            <p className="text-sm text-faint mb-4">{url}</p>
            <div className="flex justify-center gap-6 text-[13px]">
              <span className="text-success font-bold">{result.passed} steps OK</span>
              <span className="text-danger font-bold">{result.failed} com falha</span>
              {result.duration && <span className="text-muted">⏱ {result.duration}</span>}
            </div>
          </div>

          <div className="flex gap-3">
            {[['critical','Críticos','#f87171'],['warning','Avisos','#fbbf24'],['info','Infos','#22d3ee']].map(([type, label, color]) => (
              <div key={type} className="card flex-1 px-4 py-3 text-center">
                <p className="text-xl font-extrabold" style={{ color }}>{result.findings.filter(f => f.type === type).length}</p>
                <p className="text-[11px] text-faint mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {result.findings.length > 0 && (
            <div className="card p-6">
              <h4 className="text-[15px] font-bold text-bright mb-4">Issues Encontrados</h4>
              <div className="flex flex-col gap-2.5">
                {result.findings.map((f, i) => (
                  <div key={i} className="p-3.5 rounded-[10px] bg-white/3" style={{ borderLeft: `3px solid ${issueColors[f.type]}` }}>
                    <span className="text-[11px] font-bold" style={{ color: issueColors[f.type] }}>
                      {f.type === 'critical' ? '🔴 CRÍTICO' : f.type === 'warning' ? '🟡 AVISO' : '🔵 INFO'}
                    </span>
                    <p className="text-sm font-semibold text-bright mt-1 mb-0.5">{f.title}</p>
                    <p className="text-[13px] text-muted leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div className="card p-6">
              <h4 className="text-[15px] font-bold text-bright mb-4">💡 Sugestões de Melhoria</h4>
              <div className="flex flex-col gap-2">
                {result.suggestions.map((s, i) => (
                  <div key={i} className="flex gap-2.5 p-3 rounded-[10px] bg-success/6 border border-success/15">
                    <span className="text-success shrink-0 font-bold">→</span>
                    <p className="text-[13px] text-muted leading-relaxed">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            {result.htmlUrl && (
              <a href={result.htmlUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-3 px-5 rounded-xl bg-primary text-white text-[14px] font-semibold text-center hover:bg-primary-hover transition-all duration-200">
                📄 Ver Relatório HTML
              </a>
            )}
            {result.pdfUrl && (
              <a href={result.pdfUrl} target="_blank" rel="noopener noreferrer"
                className="py-3 px-5 rounded-xl bg-transparent text-muted text-[14px] font-medium border border-white/8 hover:border-primary-light hover:text-primary-light transition-all duration-200">
                📥 Baixar PDF
              </a>
            )}
            <button onClick={() => { setStep(1); setUrl(''); setTestName(''); setResult(null); setExecutionId(null) }}
              className="py-3 px-7 rounded-xl bg-transparent text-muted text-[14px] font-medium border border-white/8 cursor-pointer hover:border-primary-light hover:text-primary-light transition-all duration-200">
              ↺ Novo Teste
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
