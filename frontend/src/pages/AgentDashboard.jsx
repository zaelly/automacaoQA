import { useState, useEffect, useRef, useCallback } from 'react'

const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5005/api')
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5005/ws'

// ─── API helpers ─────────────────────────────────────────────────────────────
async function apiPost(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}
async function apiGet(path) {
  const res = await fetch(BASE + path)
  return res.json()
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    running:   { label: 'Executando', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
    completed: { label: 'Concluído',  color: '#22c55e', bg: 'rgba(34,197,94,0.15)'  },
    failed:    { label: 'Falhou',     color: '#ef4444', bg: 'rgba(239,68,68,0.15)'  },
    pending:   { label: 'Aguardando', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  }
  const s = map[status] || map.pending
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 12,
      background: s.bg, color: s.color,
      fontSize: 12, fontWeight: 600,
    }}>{s.label}</span>
  )
}

// ─── Action icon ─────────────────────────────────────────────────────────────
function actionIcon(type) {
  const icons = {
    goto: '🌐', click: '👆', doubleClick: '👆', hover: '🖱️',
    fill: '✍️', type: '⌨️', press: '⌨️', scroll: '📜',
    select: '📋', check: '☑️', uncheck: '☐', wait: '⏳',
    upload: '📤', download: '📥', drag: '🤏',
    assertText: '🔍', assertVisible: '👁️', assertUrl: '🔗',
    takeScreenshot: '📸', finish: '🏁',
  }
  return icons[type] || '⚙️'
}

// ─── Step item ───────────────────────────────────────────────────────────────
function StepItem({ step, isLast }) {
  const [open, setOpen] = useState(isLast)
  const action = step.action || step.decision?.next_action || {}
  const success = step.success ?? step.result?.success
  const thought = step.thought || step.decision?.thought || ''
  const error = step.error || step.result?.error

  return (
    <div style={{
      background: '#1a1535', border: '1px solid',
      borderColor: success === false ? 'rgba(239,68,68,0.3)' : 'rgba(124,58,237,0.2)',
      borderRadius: 10, overflow: 'hidden', marginBottom: 8,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '10px 14px',
          background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', color: '#e2e8f0',
        }}
      >
        <span style={{ color: '#64748b', fontSize: 12, minWidth: 44 }}>
          #{step.step || step.stepNumber}
        </span>
        <span style={{ fontSize: 16 }}>{actionIcon(action.type)}</span>
        <span style={{ flex: 1, fontSize: 13 }}>
          <strong>{action.type}</strong>
          {action.target && <span style={{ color: '#a78bfa' }}> → "{action.target}"</span>}
          {action.value && <span style={{ color: '#94a3b8' }}> = "{action.value}"</span>}
        </span>
        <span style={{ fontSize: 12 }}>{success === false ? '❌' : success ? '✅' : '⏳'}</span>
        <span style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px', borderTop: '1px solid rgba(124,58,237,0.1)' }}>
          {thought && (
            <div style={{
              background: 'rgba(139,92,246,0.08)', borderRadius: 8, padding: 10, marginTop: 10,
              fontSize: 12, color: '#c4b5fd', lineHeight: 1.5,
            }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7 }}>
                💭 Raciocínio
              </span>
              <br />{thought}
            </div>
          )}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 10, marginTop: 8,
              fontSize: 12, color: '#fca5a5',
            }}>❌ {error}</div>
          )}
          {step.screenshotBase64 && (
            <img
              src={`data:image/png;base64,${step.screenshotBase64}`}
              alt="screenshot"
              style={{ width: '100%', borderRadius: 8, marginTop: 10, border: '1px solid rgba(124,58,237,0.2)' }}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Live session view ────────────────────────────────────────────────────────
function LiveSession({ sessionId, onDone }) {
  const [events, setEvents] = useState([])
  const [steps, setSteps] = useState([])
  const [status, setStatus] = useState('running')
  const [currentThought, setCurrentThought] = useState('')
  const [currentUrl, setCurrentUrl] = useState('')
  const wsRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (!data.__agent) return
        if (data.sessionId !== sessionId) return

        setEvents(prev => [...prev.slice(-100), data])

        if (data.type === 'action_decided') {
          setCurrentThought(data.payload?.thought || '')
        }
        if (data.type === 'page_analyzed') {
          setCurrentUrl(data.payload?.url || '')
        }
        if (data.type === 'step_completed') {
          const p = data.payload
          setSteps(prev => [...prev, {
            step: p.step, success: p.success, error: p.error,
            url: p.url,
          }])
        }
        if (data.type === 'action_decided') {
          setSteps(prev => {
            const p = data.payload
            const last = prev.at(-1)
            if (last && last.step === p.step) {
              return [...prev.slice(0, -1), { ...last, action: p.action, thought: p.thought }]
            }
            return [...prev, { step: p.step, action: p.action, thought: p.thought }]
          })
        }
        if (data.type === 'session_finished' || data.type === 'agent_finished') {
          setStatus('completed')
          onDone?.(sessionId)
        }
        if (data.type === 'session_error') {
          setStatus('failed')
        }
      } catch (_) {}
    }

    ws.onerror = () => {}
    ws.onclose = () => {}

    return () => ws.close()
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps])

  return (
    <div style={{ display: 'flex', gap: 16, height: 540 }}>
      {/* Left: Browser simulation */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          background: '#0f0d1f', borderRadius: 12, border: '1px solid rgba(124,58,237,0.3)',
          flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {/* Browser chrome */}
          <div style={{
            padding: '10px 14px', background: '#1a1535',
            borderBottom: '1px solid rgba(124,58,237,0.2)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => (
                <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <div style={{
              flex: 1, background: '#0f0d1f', borderRadius: 6, padding: '4px 10px',
              fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {currentUrl || 'Aguardando navegação...'}
            </div>
            {status === 'running' && (
              <div style={{ display: 'flex', gap: 3 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6',
                    animation: `bounce 0.8s ease-in-out ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
            )}
          </div>

          {/* Agent thought */}
          <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {status === 'running' ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, margin: '0 auto 16px',
                  boxShadow: '0 0 20px rgba(124,58,237,0.4)',
                }}>🤖</div>
                <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>Agente pensando...</p>
                {currentThought && (
                  <p style={{
                    color: '#c4b5fd', fontSize: 13, lineHeight: 1.6,
                    background: 'rgba(139,92,246,0.1)', borderRadius: 8, padding: '10px 14px',
                    maxWidth: 380, margin: '0 auto',
                  }}>{currentThought}</p>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>
                  {status === 'completed' ? '✅' : '❌'}
                </div>
                <p style={{ color: status === 'completed' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                  {status === 'completed' ? 'Sessão concluída!' : 'Sessão encerrada com erro'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'Passos', value: steps.length },
            { label: 'Sucesso', value: steps.filter(s => s.success).length, color: '#22c55e' },
            { label: 'Erro', value: steps.filter(s => s.success === false).length, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, background: '#1a1535', border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: 8, padding: '8px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: s.color || '#e2e8f0' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Steps timeline */}
      <div style={{
        width: 340, overflowY: 'auto',
        background: '#0f0d1f', borderRadius: 12, border: '1px solid rgba(124,58,237,0.2)',
        padding: 12,
      }}>
        <p style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
          Timeline de Ações
        </p>
        {steps.length === 0 && (
          <p style={{ color: '#64748b', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            Aguardando primeiros passos...
          </p>
        )}
        {steps.map((step, i) => (
          <StepItem key={step.step || i} step={step} isLast={i === steps.length - 1} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

// ─── Session list item ────────────────────────────────────────────────────────
function SessionCard({ session, onSelect }) {
  const duration = session.finishedAt
    ? Math.round((new Date(session.finishedAt) - new Date(session.startedAt)) / 1000)
    : null

  return (
    <div
      onClick={() => onSelect(session)}
      style={{
        background: '#1a1535', border: '1px solid rgba(124,58,237,0.2)',
        borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
        marginBottom: 8, transition: 'border-color 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <StatusBadge status={session.status} />
        {session.score !== undefined && (
          <span style={{
            marginLeft: 'auto', fontWeight: 700, fontSize: 14,
            color: session.score >= 80 ? '#22c55e' : session.score >= 50 ? '#f59e0b' : '#ef4444',
          }}>{session.score}%</span>
        )}
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4, lineHeight: 1.3 }}>
        {session.goal}
      </p>
      <p style={{ fontSize: 11, color: '#64748b' }}>
        {session.baseUrl}
        {duration !== null && ` · ${duration}s`}
        {session.passedSteps !== undefined && ` · ${session.passedSteps}✅ ${session.failedSteps}❌`}
      </p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AgentDashboard() {
  const [goal, setGoal] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [sessions, setSessions] = useState([])
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [view, setView] = useState('new') // 'new' | 'live' | 'detail'

  useEffect(() => {
    loadSessions()
    const t = setInterval(loadSessions, 8000)
    return () => clearInterval(t)
  }, [])

  async function loadSessions() {
    try {
      const data = await apiGet('/agent/sessions')
      if (Array.isArray(data)) setSessions(data)
    } catch (_) {}
  }

  async function handleStart(e) {
    e.preventDefault()
    if (!goal.trim() || !baseUrl.trim()) return
    setLoading(true)
    try {
      const res = await apiPost('/agent/sessions', { goal: goal.trim(), baseUrl: baseUrl.trim() })
      if (res.sessionId) {
        setActiveSessionId(res.sessionId)
        setView('live')
        await loadSessions()
      }
    } catch (err) {
      alert('Erro ao iniciar sessão: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleSelectSession(session) {
    if (session.status === 'running') {
      setActiveSessionId(session.id)
      setView('live')
    } else {
      setSelectedSession(session)
      setView('detail')
    }
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(139,92,246,0.4); }
          70% { box-shadow: 0 0 0 10px rgba(139,92,246,0); }
          100% { box-shadow: 0 0 0 0 rgba(139,92,246,0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
          🤖 Agente de QA com IA
        </h1>
        <p style={{ color: '#64748b', fontSize: 14 }}>
          Descreva o que testar em linguagem natural — o agente planeja, executa e valida automaticamente.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* Left panel */}
        <div style={{ width: 300, flexShrink: 0 }}>
          {/* New session form */}
          <div style={{
            background: '#1a1535', border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: 12, padding: 18, marginBottom: 16,
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa', marginBottom: 14 }}>
              + Nova Sessão de Teste
            </p>
            <form onSubmit={handleStart}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>
                  URL do site
                </label>
                <input
                  type="url"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  placeholder="https://meusite.com"
                  required
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    background: '#0f0d1f', border: '1px solid rgba(124,58,237,0.3)',
                    color: '#e2e8f0', fontSize: 13, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: '#64748b', display: 'block', marginBottom: 4 }}>
                  Objetivo do teste
                </label>
                <textarea
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  placeholder="Ex: Testar o fluxo de login com credenciais válidas e inválidas"
                  required
                  rows={4}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 8,
                    background: '#0f0d1f', border: '1px solid rgba(124,58,237,0.3)',
                    color: '#e2e8f0', fontSize: 13, resize: 'vertical', outline: 'none',
                    boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: '10px', borderRadius: 8,
                  background: loading ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  animation: !loading ? '' : 'none',
                }}
              >
                {loading ? '⏳ Iniciando...' : '🚀 Iniciar Agente'}
              </button>
            </form>
          </div>

          {/* Sessions list */}
          <div>
            <p style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
              Sessões Anteriores ({sessions.length})
            </p>
            {sessions.length === 0 && (
              <p style={{ color: '#64748b', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                Nenhuma sessão ainda
              </p>
            )}
            {sessions.map(s => (
              <SessionCard key={s.id} session={s} onSelect={handleSelectSession} />
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {view === 'new' && (
            <div style={{
              height: 500, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: '#1a1535', borderRadius: 12, border: '1px solid rgba(124,58,237,0.2)',
              color: '#64748b', gap: 12,
            }}>
              <span style={{ fontSize: 48 }}>🤖</span>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8' }}>
                Agente de QA com Gemini AI
              </p>
              <p style={{ fontSize: 13, textAlign: 'center', maxWidth: 320 }}>
                Configure um objetivo de teste e o agente irá navegar, interagir e validar automaticamente.
              </p>
            </div>
          )}

          {view === 'live' && activeSessionId && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6',
                  animation: 'pulse-ring 1.5s ease-out infinite',
                }} />
                <p style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>
                  Agente em execução
                </p>
                <button
                  onClick={() => setView('new')}
                  style={{
                    marginLeft: 'auto', padding: '4px 12px', borderRadius: 6,
                    background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)',
                    color: '#a78bfa', fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Nova sessão
                </button>
              </div>
              <LiveSession
                sessionId={activeSessionId}
                onDone={() => { loadSessions(); }}
              />
            </div>
          )}

          {view === 'detail' && selectedSession && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <StatusBadge status={selectedSession.status} />
                {selectedSession.score !== undefined && (
                  <span style={{
                    fontWeight: 700, fontSize: 20,
                    color: selectedSession.score >= 80 ? '#22c55e' :
                           selectedSession.score >= 50 ? '#f59e0b' : '#ef4444',
                  }}>{selectedSession.score}%</span>
                )}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <a
                    href={`${BASE}/agent/sessions/${selectedSession.id}/report`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '6px 12px', borderRadius: 8,
                      background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)',
                      color: '#a78bfa', fontSize: 12, textDecoration: 'none',
                    }}
                  >
                    📄 Ver Relatório
                  </a>
                  <button
                    onClick={() => setView('new')}
                    style={{
                      padding: '6px 12px', borderRadius: 8,
                      background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                      color: '#94a3b8', fontSize: 12, cursor: 'pointer',
                    }}
                  >✕ Fechar</button>
                </div>
              </div>

              <div style={{
                background: '#1a1535', borderRadius: 12, border: '1px solid rgba(124,58,237,0.2)',
                padding: 16, marginBottom: 14,
              }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 6 }}>
                  {selectedSession.goal}
                </p>
                <p style={{ fontSize: 12, color: '#64748b' }}>
                  {selectedSession.baseUrl}
                  {selectedSession.finishedAt && (
                    ` · ${Math.round((new Date(selectedSession.finishedAt) - new Date(selectedSession.startedAt)) / 1000)}s`
                  )}
                  {` · ${selectedSession.passedSteps ?? 0}✅ ${selectedSession.failedSteps ?? 0}❌`}
                </p>
              </div>

              <DetailSteps sessionId={selectedSession.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Detail steps loader ──────────────────────────────────────────────────────
function DetailSteps({ sessionId }) {
  const [session, setSession] = useState(null)

  useEffect(() => {
    apiGet(`/agent/sessions/${sessionId}`)
      .then(setSession)
      .catch(() => {})
  }, [sessionId])

  if (!session) return <p style={{ color: '#64748b', fontSize: 13 }}>Carregando...</p>

  return (
    <div style={{
      overflowY: 'auto', maxHeight: 420,
      background: '#0f0d1f', borderRadius: 12, border: '1px solid rgba(124,58,237,0.2)',
      padding: 12,
    }}>
      <p style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', marginBottom: 10 }}>
        {session.steps?.length || 0} passos executados
      </p>
      {(session.steps || []).map((step, i) => (
        <StepItem
          key={step.stepNumber || i}
          step={{
            step: step.stepNumber,
            stepNumber: step.stepNumber,
            action: step.decision?.next_action,
            thought: step.decision?.thought,
            success: step.result?.success,
            error: step.result?.error,
            decision: step.decision,
            result: step.result,
          }}
          isLast={false}
        />
      ))}
    </div>
  )
}
