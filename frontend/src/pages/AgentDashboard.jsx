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

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'rgba(15,10,40,0.7)',
      border: '1px solid rgba(124,58,237,0.2)',
      borderRadius: 12,
      padding: 20,
      ...style,
    }}>{children}</div>
  )
}

function LiveTerminal({ logs }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [logs])

  const colorOf = (log) => {
    if (log.startsWith('ERROR') || log.includes('❌') || log.includes('falhou')) return '#ef4444'
    if (log.startsWith('WARN')  || log.includes('⚠️')) return '#f59e0b'
    if (log.includes('✅') || log.includes('OK'))       return '#22c55e'
    if (log.startsWith('→') || log.startsWith('ℹ'))     return '#7c3aed'
    return '#94a3b8'
  }

  return (
    <div ref={ref} style={{
      height: 260, overflowY: 'auto', background: 'rgba(0,0,0,0.35)',
      borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12,
      scrollbarWidth: 'thin', scrollbarColor: '#7c3aed20 transparent',
    }}>
      {logs.length === 0 && <span style={{ color: '#475569' }}>Aguardando eventos...</span>}
      {logs.map((l, i) => (
        <div key={i} style={{ color: colorOf(l), lineHeight: 1.6 }}>{l}</div>
      ))}
    </div>
  )
}

export default function AgentDashboard() {
  const [goal, setGoal]         = useState('')
  const [baseUrl, setBaseUrl]   = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [running, setRunning]   = useState(false)
  const [logs, setLogs]         = useState([])
  const [lastSessionId, setLastSessionId] = useState(null)

  const wsRef    = useRef(null)
  const activeId = useRef(null)

  const addLog = useCallback((msg) => setLogs(prev => [...prev.slice(-200), msg]), [])

  // ── WebSocket ────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (!msg.__agent) return
        if (activeId.current && msg.sessionId !== activeId.current) return

        const { type, payload } = msg
        if (type === 'phase_change') {
          addLog(`→ ${payload.label}`)
        } else if (type === 'check_result') {
          const icon = payload.status === 'fail' ? '❌' : payload.status === 'warning' ? '⚠️' : payload.status === 'skipped' ? '⏭️' : '✅'
          addLog(`  ${icon} ${payload.name}${payload.detail ? ': ' + payload.detail : ''}`)
        } else if (type === 'report_ready') {
          addLog('✅ Relatório gerado! Acesse em Relatórios → Agente IA')
          setRunning(false)
        } else if (type === 'session_error') {
          addLog(`ERROR: ${payload.error}`)
          setRunning(false)
        }
      } catch { /* ignore */ }
    }

    return () => ws.close()
  }, [addLog])

  // ── Start session ────────────────────────────────────────────────────────
  const handleStart = async () => {
    if (!goal.trim() || !baseUrl.trim()) return
    setRunning(true)
    setLogs([])
    setLastSessionId(null)

    const body = {
      goal: goal.trim(),
      baseUrl: baseUrl.trim(),
      ...(username || password
        ? { credentials: { username: username.trim() || undefined, password: password || undefined } }
        : {}),
    }

    addLog(`→ Iniciando auditoria em ${baseUrl.trim()}`)
    try {
      const data = await apiPost('/agent/sessions', body)
      if (data.sessionId) {
        activeId.current = data.sessionId
        setLastSessionId(data.sessionId)
        addLog(`→ Sessão iniciada`)
      } else {
        addLog(`ERROR: ${data.error || 'Falha ao iniciar'}`)
        setRunning(false)
      }
    } catch (err) {
      addLog(`ERROR: ${err.message}`)
      setRunning(false)
    }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px' }}>
      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>
          Agente IA — Nova Auditoria
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Playwright + Groq AI · Os relatórios ficam em <strong style={{ color: '#a78bfa' }}>Relatórios → Agente IA</strong>
        </p>
      </div>

      {/* Form */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5 }}>
              URL DO SISTEMA *
            </label>
            <input
              value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://app.exemplo.com"
              disabled={running}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(124,58,237,0.25)',
                borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5 }}>
                USUÁRIO / E-MAIL
              </label>
              <input
                value={username} onChange={e => setUsername(e.target.value)}
                placeholder="usuario@exemplo.com"
                disabled={running}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(124,58,237,0.18)',
                  borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5 }}>
                SENHA
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={running}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(124,58,237,0.18)',
                  borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none',
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 5 }}>
              OBJETIVO DO TESTE *
            </label>
            <textarea
              value={goal} onChange={e => setGoal(e.target.value)}
              placeholder="Ex: Verificar se o login, o PDV e os relatórios funcionam corretamente"
              rows={3}
              disabled={running}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(124,58,237,0.25)',
                borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none',
                resize: 'vertical', fontFamily: 'inherit',
              }}
            />
          </div>

          <button
            onClick={handleStart}
            disabled={running || !goal.trim() || !baseUrl.trim()}
            style={{
              padding: '13px', borderRadius: 8, fontWeight: 700, fontSize: 14,
              cursor: running ? 'wait' : 'pointer', border: 'none',
              background: running ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              color: running ? '#a78bfa' : '#fff',
            }}
          >
            {running ? '⏳ Executando auditoria...' : '▶ Iniciar Auditoria'}
          </button>
        </div>
      </Card>

      {/* Terminal */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>TERMINAL AO VIVO</div>
          {running && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 11, color: '#7c3aed' }}>Executando...</span>
            </div>
          )}
          {!running && lastSessionId && (
            <span style={{ fontSize: 11, color: '#22c55e' }}>✅ Concluído · Ver em Relatórios</span>
          )}
        </div>
        <LiveTerminal logs={logs} />
      </Card>

      {/* Tip */}
      <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', fontSize: 12, color: '#64748b' }}>
        💡 Após a auditoria, acesse <strong style={{ color: '#a78bfa' }}>Relatórios → Agente IA</strong> para ver fluxos, timeline, erros de rede, links quebrados e achados da IA.
      </div>
    </div>
  )
}
