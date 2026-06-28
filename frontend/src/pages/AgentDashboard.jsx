import { useState, useEffect, useRef, useCallback } from 'react'

const BASE   = import.meta.env.VITE_API_URL || 'http://localhost:5005/api'
const WS_URL = import.meta.env.VITE_WS_URL  || 'ws://localhost:5005/ws'

async function apiPost(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'rgba(15,10,40,0.7)', border: '1px solid rgba(124,58,237,0.2)',
      borderRadius: 12, padding: 20, ...style,
    }}>{children}</div>
  )
}

function Label({ children }) {
  return (
    <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5 }}>
      {children}
    </label>
  )
}

function TextInput({ value, onChange, placeholder, disabled, type = 'text' }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '10px 12px',
        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(124,58,237,0.22)',
        borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none',
        opacity: disabled ? 0.6 : 1,
      }}
    />
  )
}

function LiveTerminal({ logs }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [logs])
  const colorOf = (l) => {
    if (l.includes('❌') || l.startsWith('ERROR') || l.includes('falhou')) return '#ef4444'
    if (l.includes('⚠️') || l.startsWith('WARN'))  return '#f59e0b'
    if (l.includes('✅') || l.includes('OK'))       return '#22c55e'
    if (l.startsWith('→') || l.includes('Intenção')) return '#7c3aed'
    if (l.includes('⏭️')) return '#64748b'
    return '#94a3b8'
  }
  return (
    <div ref={ref} style={{
      height: 240, overflowY: 'auto', background: 'rgba(0,0,0,0.35)',
      borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12,
      scrollbarWidth: 'thin', scrollbarColor: '#7c3aed20 transparent',
    }}>
      {logs.length === 0 && <span style={{ color: '#475569' }}>Aguardando eventos...</span>}
      {logs.map((l, i) => <div key={i} style={{ color: colorOf(l), lineHeight: 1.7 }}>{l}</div>)}
    </div>
  )
}

// ── Intent picker ─────────────────────────────────────────────────────────────
function IntentPicker({ allIntents, selected, onSelect }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
      {allIntents.map(intent => (
        <button key={intent.id} onClick={() => onSelect(intent)}
          style={{
            padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
            border: selected?.id === intent.id
              ? '1px solid rgba(124,58,237,0.7)'
              : '1px solid rgba(255,255,255,0.08)',
            background: selected?.id === intent.id
              ? 'rgba(124,58,237,0.25)'
              : 'rgba(15,10,40,0.5)',
          }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>{intent.emoji}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{intent.name}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{intent.description}</div>
        </button>
      ))}
    </div>
  )
}

// ── Intent steps preview ──────────────────────────────────────────────────────
function IntentSteps({ intent }) {
  if (!intent?.steps) return null
  return (
    <div style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 8 }}>PLANO DE EXECUÇÃO — {intent.emoji} {intent.name}</div>
      {intent.steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
          <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', flexShrink: 0, width: 18 }}>{String(i+1).padStart(2,'0')}.</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{step}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AgentDashboard() {
  const [goal, setGoal]         = useState('')
  const [baseUrl, setBaseUrl]   = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Intent state machine:  'form' → 'detecting' → 'confirm' | 'clarify' → 'running' → 'done'
  const [stage, setStage]                = useState('form')
  const [detectedIntent, setDetectedIntent]  = useState(null)
  const [selectedIntent, setSelectedIntent]  = useState(null)
  const [allIntents, setAllIntents]          = useState([])

  const [logs, setLogs]             = useState([])
  const [lastSessionId, setLastSessionId] = useState(null)

  const wsRef    = useRef(null)
  const activeId = useRef(null)

  const addLog = useCallback((msg) => setLogs(prev => [...prev.slice(-200), msg]), [])

  // ── WebSocket ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (!msg.__agent) return
        if (activeId.current && msg.sessionId !== activeId.current) return
        const { type, payload } = msg
        if (type === 'phase_change')  addLog(`→ ${payload.label}`)
        else if (type === 'check_result') {
          const icon = payload.status === 'fail' ? '❌' : payload.status === 'warning' ? '⚠️' : payload.status === 'skipped' ? '⏭️' : '✅'
          addLog(`  ${icon} ${payload.name}${payload.detail ? ': ' + payload.detail : ''}`)
        } else if (type === 'report_ready') {
          addLog('✅ Relatório gerado! Acesse em Relatórios → Agente IA')
          setStage('done')
        } else if (type === 'session_error') {
          addLog(`ERROR: ${payload.error}`)
          setStage('done')
        }
      } catch { /* ignore */ }
    }
    return () => ws.close()
  }, [addLog])

  // ── Step 1: Detect intent ─────────────────────────────────────────────────
  const handleDetect = async () => {
    if (!goal.trim() || !baseUrl.trim()) return
    setStage('detecting')
    setLogs([])
    addLog(`→ Analisando objetivo...`)

    try {
      const data = await apiPost('/agent/detect-intent', { goal: goal.trim() })
      if (data.allIntents) setAllIntents(data.allIntents)

      if (data.needsClarification || data.intent === 'unknown') {
        addLog('→ Objetivo amplo — selecione o foco do teste')
        setStage('clarify')
      } else {
        setDetectedIntent(data.intentData)
        setSelectedIntent(data.intentData)
        addLog(`→ Intenção detectada: ${data.intentData?.emoji} ${data.intentData?.name} (confiança: ${data.confidence})`)
        setStage('confirm')
      }
    } catch {
      addLog('→ Erro ao detectar intenção — usando exploração automática')
      setDetectedIntent(null)
      setSelectedIntent({ id: 'exploratorio', name: 'Exploração Automática', emoji: '🔍' })
      setStage('confirm')
    }
  }

  // ── Step 2: Start session with confirmed intent ────────────────────────────
  const handleStart = async () => {
    const intentToUse = selectedIntent
    setStage('running')
    activeId.current = null

    const icon = intentToUse?.emoji || '🔍'
    addLog(`→ Iniciando auditoria ${icon} ${intentToUse?.name || 'Exploração'} em ${baseUrl.trim()}`)

    const body = {
      goal: goal.trim(),
      baseUrl: baseUrl.trim(),
      intent: intentToUse?.id,
      ...(username || password
        ? { credentials: { username: username.trim() || undefined, password: password || undefined } }
        : {}),
    }

    try {
      const data = await apiPost('/agent/sessions', body)
      if (data.sessionId) {
        activeId.current = data.sessionId
        setLastSessionId(data.sessionId)
        addLog(`→ Sessão iniciada`)
      } else {
        addLog(`ERROR: ${data.error || 'Falha ao iniciar'}`)
        setStage('confirm')
      }
    } catch (err) {
      addLog(`ERROR: ${err.message}`)
      setStage('confirm')
    }
  }

  const handleReset = () => {
    setStage('form')
    setDetectedIntent(null)
    setSelectedIntent(null)
    setLogs([])
    setLastSessionId(null)
    activeId.current = null
  }

  const isRunning = stage === 'running'

  return (
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 16px' }}>
      {/* Title */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>Agente IA — Nova Auditoria</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Playwright + Groq · Relatórios em <strong style={{ color: '#a78bfa' }}>Relatórios → Agente IA</strong>
        </p>
      </div>

      {/* ── FORM (idle) ──────────────────────────────────────────────────── */}
      {(stage === 'form' || stage === 'detecting') && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <Label>URL DO SISTEMA *</Label>
              <TextInput value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://app.exemplo.com" disabled={stage === 'detecting'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Label>USUÁRIO / E-MAIL</Label><TextInput value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario@exemplo.com" disabled={stage === 'detecting'} /></div>
              <div><Label>SENHA</Label><TextInput type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" disabled={stage === 'detecting'} /></div>
            </div>
            <div>
              <Label>OBJETIVO DO TESTE *</Label>
              <textarea value={goal} onChange={e => setGoal(e.target.value)} disabled={stage === 'detecting'}
                placeholder={'Ex: "Teste o PDV inteiro" ou "Verifique se o checkout funciona"'}
                rows={3} style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(124,58,237,0.22)',
                  borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none',
                  resize: 'vertical', fontFamily: 'inherit', opacity: stage === 'detecting' ? 0.6 : 1,
                }}
              />
            </div>
            <button onClick={handleDetect} disabled={stage === 'detecting' || !goal.trim() || !baseUrl.trim()} style={{
              padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 14,
              cursor: stage === 'detecting' ? 'wait' : 'pointer', border: 'none',
              background: stage === 'detecting' ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              color: stage === 'detecting' ? '#a78bfa' : '#fff',
            }}>
              {stage === 'detecting' ? '🔎 Analisando objetivo...' : '🔎 Analisar e Planejar'}
            </button>
          </div>
        </Card>
      )}

      {/* ── CLARIFICATION (goal too broad) ───────────────────────────────── */}
      {stage === 'clarify' && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
              O objetivo é muito amplo
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              O que você deseja testar? Selecione um foco:
            </div>
          </div>
          <IntentPicker allIntents={allIntents} selected={selectedIntent} onSelect={setSelectedIntent} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => { setStage('form') }} style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 13 }}>
              ← Voltar
            </button>
            <button onClick={() => setStage('confirm')} disabled={!selectedIntent} style={{
              flex: 1, padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13,
              cursor: selectedIntent ? 'pointer' : 'not-allowed', border: 'none',
              background: selectedIntent ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(124,58,237,0.2)',
              color: selectedIntent ? '#fff' : '#a78bfa',
            }}>
              {selectedIntent ? `Continuar com ${selectedIntent.emoji} ${selectedIntent.name} →` : 'Selecione uma opção'}
            </button>
          </div>
        </Card>
      )}

      {/* ── CONFIRM INTENT ───────────────────────────────────────────────── */}
      {stage === 'confirm' && selectedIntent && (
        <Card style={{ marginBottom: 16 }}>
          {/* Intent detected badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <span style={{ fontSize: 28 }}>{selectedIntent.emoji}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 2 }}>
                {detectedIntent?.id === selectedIntent.id ? 'INTENÇÃO DETECTADA' : 'INTENÇÃO SELECIONADA'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}>{selectedIntent.name}</div>
            </div>
            <button onClick={() => setStage('clarify')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
              Mudar
            </button>
          </div>

          {/* Summary of what will run */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', fontSize: 12 }}>
            <div style={{ color: '#64748b' }}>🔗 {baseUrl}</div>
            {username && <div style={{ color: '#64748b' }}>👤 {username}</div>}
          </div>

          {/* Steps preview */}
          <IntentSteps intent={selectedIntent} />

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button onClick={() => setStage('form')} style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 13 }}>
              ← Editar
            </button>
            <button onClick={handleStart} style={{
              flex: 1, padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 14,
              cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff',
            }}>
              ▶ Iniciar Auditoria
            </button>
          </div>
        </Card>
      )}

      {/* ── TERMINAL (always visible during/after run) ────────────────────── */}
      {(stage === 'running' || stage === 'done' || logs.length > 0) && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>TERMINAL AO VIVO</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isRunning && (
                <>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed' }} />
                  <span style={{ fontSize: 11, color: '#7c3aed' }}>Executando...</span>
                </>
              )}
              {stage === 'done' && (
                <span style={{ fontSize: 11, color: '#22c55e' }}>✅ Concluído</span>
              )}
            </div>
          </div>
          <LiveTerminal logs={logs} />
        </Card>
      )}

      {/* ── DONE: call to action ──────────────────────────────────────────── */}
      {stage === 'done' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleReset} style={{
            flex: 1, padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 13,
            cursor: 'pointer', border: '1px solid rgba(124,58,237,0.3)',
            background: 'rgba(124,58,237,0.1)', color: '#a78bfa',
          }}>
            + Nova Auditoria
          </button>
          <a href="/relatorios" style={{
            flex: 1, padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 13,
            textAlign: 'center', textDecoration: 'none',
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff',
          }}>
            📊 Ver Relatório →
          </a>
        </div>
      )}

      {/* ── Tip (always) ─────────────────────────────────────────────────── */}
      {stage === 'form' && (
        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)', fontSize: 12, color: '#64748b' }}>
          💡 Exemplos: <em style={{ color: '#7c3aed' }}>"Teste o PDV inteiro"</em> · <em style={{ color: '#7c3aed' }}>"Verifique se o login funciona"</em> · <em style={{ color: '#7c3aed' }}>"Audite o checkout"</em>
        </div>
      )}
    </div>
  )
}
