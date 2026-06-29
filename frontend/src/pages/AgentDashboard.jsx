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
    if (l.startsWith('→') || l.includes('Plano') || l.includes('Intenção')) return '#7c3aed'
    if (l.includes('⚡')) return '#fbbf24'
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

// ── Audit mode selector ───────────────────────────────────────────────────────
const MODES = [
  {
    id: 'global',
    name: 'Auditoria Global',
    emoji: '🌐',
    desc: 'Testa tudo: SEO, funcional, links, acessibilidade e performance',
  },
  {
    id: 'module',
    name: 'Por Módulo',
    emoji: '🎯',
    desc: 'Foca em um módulo específico. Ignora SEO, links e acessibilidade',
  },
  {
    id: 'flow',
    name: 'Por Fluxo',
    emoji: '⚡',
    desc: 'Apenas os passos funcionais do fluxo. Zero infra, zero ruído',
  },
]

function ModeSelector({ value, onChange, disabled }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {MODES.map(m => (
        <button key={m.id} onClick={() => !disabled && onChange(m.id)} style={{
          padding: '12px 10px', borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
          textAlign: 'left', border: 'none',
          outline: value === m.id ? '2px solid rgba(124,58,237,0.7)' : '1px solid rgba(255,255,255,0.08)',
          background: value === m.id ? 'rgba(124,58,237,0.22)' : 'rgba(15,10,40,0.5)',
          opacity: disabled ? 0.7 : 1,
        }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>{m.emoji}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: value === m.id ? '#c4b5fd' : '#e2e8f0' }}>{m.name}</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, lineHeight: 1.4 }}>{m.desc}</div>
        </button>
      ))}
    </div>
  )
}

// ── Intent picker (clarify stage) ─────────────────────────────────────────────
function IntentPicker({ allIntents, selected, onSelect }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
      {allIntents.map(intent => (
        <button key={intent.id} onClick={() => onSelect(intent)} style={{
          padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left', border: 'none',
          outline: selected?.id === intent.id ? '2px solid rgba(124,58,237,0.7)' : '1px solid rgba(255,255,255,0.08)',
          background: selected?.id === intent.id ? 'rgba(124,58,237,0.25)' : 'rgba(15,10,40,0.5)',
        }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>{intent.emoji}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{intent.name}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{intent.description}</div>
        </button>
      ))}
    </div>
  )
}

// ── Contract preview — the ✔/✖ panel ──────────────────────────────────────────
function ContractPreview({ contract }) {
  if (!contract) return null

  const hasCustom = contract.customSteps?.length > 0
  const hasForbidden = contract.forbiddenItems?.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Mode badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)' }}>
        <span style={{ fontSize: 26 }}>{contract.intentEmoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 2 }}>
            {contract.mode === 'global' ? '🌐 AUDITORIA GLOBAL'
              : contract.mode === 'module' ? '🎯 AUDITORIA POR MÓDULO'
              : '⚡ AUDITORIA POR FLUXO'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>{contract.intentName}</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b' }}>
          <div>{contract.allowedTests?.length || 0} habilitados</div>
          {hasForbidden && <div style={{ color: '#ef4444' }}>{contract.forbiddenItems.length} ignorados</div>}
        </div>
      </div>

      {/* ✔/✖ two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: hasForbidden ? '1fr 1fr' : '1fr', gap: 12 }}>

        {/* Allowed column */}
        <div style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#22c55e', marginBottom: 10, letterSpacing: '0.05em' }}>
            ESCOPO DETECTADO
          </div>
          {contract.allowedTests?.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0' }}>
              <span style={{ color: '#22c55e', fontSize: 12, width: 14, flexShrink: 0 }}>✔</span>
              <span style={{ fontSize: 11, color: '#4ade80' }}>{t.emoji}</span>
              <span style={{ fontSize: 12, color: '#86efac' }}>{t.name}</span>
            </div>
          ))}
          {hasCustom && (
            <>
              <div style={{ borderTop: '1px solid rgba(245,158,11,0.2)', margin: '8px 0 6px' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>INSTRUÇÕES PERSONALIZADAS</div>
              {contract.customSteps.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '3px 0' }}>
                  <span style={{ color: '#f59e0b', fontSize: 12, width: 14, flexShrink: 0 }}>⚡</span>
                  <span style={{ fontSize: 11, color: '#fbbf24', fontStyle: 'italic', lineHeight: 1.4 }}>{s}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Forbidden column */}
        {hasForbidden && (
          <div style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', marginBottom: 10, letterSpacing: '0.05em' }}>
              IGNORADO
            </div>
            {contract.forbiddenItems?.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0' }}>
                <span style={{ color: '#475569', fontSize: 12, width: 14, flexShrink: 0 }}>✖</span>
                <span style={{ fontSize: 11, color: '#475569' }}>{t.emoji}</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>{t.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AgentDashboard() {
  const [goal, setGoal]         = useState('')
  const [baseUrl, setBaseUrl]   = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode]         = useState('module')

  // State machine: 'form' → 'planning' → 'review' | 'clarify' → 'running' → 'done'
  const [stage, setStage]               = useState('form')
  const [contract, setContract]         = useState(null)
  const [allIntents, setAllIntents]     = useState([])
  const [selectedIntent, setSelectedIntent] = useState(null)

  const [logs, setLogs]                 = useState([])
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
        if (type === 'phase_change')   addLog(`→ ${payload.label}`)
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

  // ── Step 1: Generate plan ─────────────────────────────────────────────────
  const handlePlan = async () => {
    if (!goal.trim() || !baseUrl.trim()) return
    setStage('planning')
    setLogs([])
    setContract(null)
    setSelectedIntent(null)

    const modeName = MODES.find(m => m.id === mode)?.name || mode
    addLog(`→ Gerando plano — modo: ${modeName}`)

    try {
      const data = await apiPost('/agent/plan', { goal: goal.trim(), mode })
      if (data.allIntents) setAllIntents(data.allIntents)

      if (data.needsClarification) {
        addLog('→ Objetivo amplo — selecione o módulo alvo')
        setStage('clarify')
        return
      }

      setContract(data)
      const allowed = data.allowedTests?.length || 0
      const forbidden = data.forbiddenItems?.length || 0
      addLog(`→ Plano: ${data.intentEmoji} ${data.intentName}`)
      addLog(`→ ${allowed} testes habilitados · ${forbidden} ignorados`)
      if (data.customSteps?.length) {
        addLog(`→ ${data.customSteps.length} instrução(ões) personalizada(s):`)
        data.customSteps.forEach(s => addLog(`  ⚡ ${s}`))
      }
      setStage('review')
    } catch {
      addLog('→ Erro ao gerar plano — usando exploração automática')
      setContract({ mode, intent: 'exploratorio', intentName: 'Exploração Automática', intentEmoji: '🔍', allowedTests: [], forbiddenItems: [], forbiddenCategories: [] })
      setStage('review')
    }
  }

  // ── Step 1b: Clarify — user picks intent manually ─────────────────────────
  const handleConfirmClarify = async () => {
    if (!selectedIntent) return
    setStage('planning')
    addLog(`→ Gerando plano para ${selectedIntent.emoji} ${selectedIntent.name}...`)

    try {
      const data = await apiPost('/agent/plan', { goal: goal.trim(), mode, forceIntent: selectedIntent.id })
      setContract(data)
      const allowed = data.allowedTests?.length || 0
      const forbidden = data.forbiddenItems?.length || 0
      addLog(`→ ${allowed} testes habilitados · ${forbidden} ignorados`)
      setStage('review')
    } catch {
      setContract({ mode, intent: selectedIntent.id, intentName: selectedIntent.name, intentEmoji: selectedIntent.emoji, allowedTests: [], forbiddenItems: [], forbiddenCategories: [] })
      setStage('review')
    }
  }

  // ── Step 2: Start session ─────────────────────────────────────────────────
  const handleStart = async () => {
    setStage('running')
    activeId.current = null

    const intentId   = contract?.intent || 'exploratorio'
    const intentName = contract?.intentName || 'Exploração Automática'
    addLog(`→ Iniciando ${contract?.intentEmoji || '🔍'} ${intentName} em ${baseUrl.trim()}`)

    const body = {
      goal:       goal.trim(),
      baseUrl:    baseUrl.trim(),
      mode,
      intent:     intentId,
      customSteps: contract?.customSteps?.length ? contract.customSteps : undefined,
      ...(username || password
        ? { credentials: { username: username.trim() || undefined, password: password || undefined } }
        : {}),
    }

    try {
      const data = await apiPost('/agent/sessions', body)
      if (data.sessionId) {
        activeId.current = data.sessionId
        setLastSessionId(data.sessionId)
        addLog(`→ Sessão iniciada · ID: ${data.sessionId.slice(0, 8)}...`)
      } else {
        addLog(`ERROR: ${data.error || 'Falha ao iniciar'}`)
        setStage('review')
      }
    } catch (err) {
      addLog(`ERROR: ${err.message}`)
      setStage('review')
    }
  }

  const handleReset = () => {
    setStage('form')
    setContract(null)
    setSelectedIntent(null)
    setLogs([])
    setLastSessionId(null)
    activeId.current = null
  }

  const isRunning = stage === 'running'

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px' }}>
      {/* Title */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e2e8f0', margin: 0 }}>Agente IA — Nova Auditoria</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Playwright + Groq · Escopo preciso antes de executar
        </p>
      </div>

      {/* ── FORM ──────────────────────────────────────────────────────────── */}
      {(stage === 'form' || stage === 'planning') && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Mode selector */}
            <div>
              <Label>MODO DE AUDITORIA</Label>
              <ModeSelector value={mode} onChange={setMode} disabled={stage === 'planning'} />
            </div>

            <div style={{ borderTop: '1px solid rgba(124,58,237,0.1)', marginTop: 2 }} />

            {/* URL + credentials */}
            <div>
              <Label>URL DO SISTEMA *</Label>
              <TextInput value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://app.exemplo.com" disabled={stage === 'planning'} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Label>USUÁRIO / E-MAIL</Label><TextInput value={username} onChange={e => setUsername(e.target.value)} placeholder="usuario@exemplo.com" disabled={stage === 'planning'} /></div>
              <div><Label>SENHA</Label><TextInput type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" disabled={stage === 'planning'} /></div>
            </div>

            {/* Goal */}
            <div>
              <Label>OBJETIVO DO TESTE *</Label>
              <textarea value={goal} onChange={e => setGoal(e.target.value)} disabled={stage === 'planning'}
                placeholder={mode === 'global'
                  ? 'Ex: "Audite o sistema inteiro" — testa tudo sem filtros'
                  : mode === 'module'
                  ? 'Ex: "Teste o PDV completo" ou "Verifique o checkout" — foca no módulo'
                  : 'Ex: "Teste o fluxo de pagamento no PDV" — apenas os passos funcionais'}
                rows={3} style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(124,58,237,0.22)',
                  borderRadius: 8, color: '#e2e8f0', fontSize: 13, outline: 'none',
                  resize: 'vertical', fontFamily: 'inherit', opacity: stage === 'planning' ? 0.6 : 1,
                }}
              />
            </div>

            <button onClick={handlePlan} disabled={stage === 'planning' || !goal.trim() || !baseUrl.trim()} style={{
              padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 14,
              cursor: stage === 'planning' ? 'wait' : 'pointer', border: 'none',
              background: stage === 'planning' ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              color: stage === 'planning' ? '#a78bfa' : '#fff',
            }}>
              {stage === 'planning' ? '🧠 Gerando plano...' : '🧠 Gerar Plano de Execução'}
            </button>
          </div>
        </Card>
      )}

      {/* ── CLARIFY ──────────────────────────────────────────────────────── */}
      {stage === 'clarify' && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>
              Qual módulo deseja testar?
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              O objetivo estava amplo demais. Selecione o foco da auditoria:
            </div>
          </div>
          <IntentPicker allIntents={allIntents} selected={selectedIntent} onSelect={setSelectedIntent} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setStage('form')} style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 13 }}>
              ← Voltar
            </button>
            <button onClick={handleConfirmClarify} disabled={!selectedIntent} style={{
              flex: 1, padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 13, border: 'none',
              cursor: selectedIntent ? 'pointer' : 'not-allowed',
              background: selectedIntent ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : 'rgba(124,58,237,0.2)',
              color: selectedIntent ? '#fff' : '#a78bfa',
            }}>
              {selectedIntent ? `Ver plano para ${selectedIntent.emoji} ${selectedIntent.name} →` : 'Selecione um módulo'}
            </button>
          </div>
        </Card>
      )}

      {/* ── REVIEW CONTRACT ──────────────────────────────────────────────── */}
      {stage === 'review' && contract && (
        <Card style={{ marginBottom: 16 }}>
          <ContractPreview contract={contract} />

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setStage('form')} style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 13 }}>
              ← Editar
            </button>
            <button onClick={() => { setStage('clarify') }} style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 13 }}>
              Mudar módulo
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

      {/* ── TERMINAL ─────────────────────────────────────────────────────── */}
      {(stage === 'running' || stage === 'done' || logs.length > 0) && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>TERMINAL AO VIVO</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isRunning && (
                <>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7c3aed', animation: 'pulse 1.5s infinite' }} />
                  <span style={{ fontSize: 11, color: '#7c3aed' }}>Executando...</span>
                </>
              )}
              {stage === 'done' && <span style={{ fontSize: 11, color: '#22c55e' }}>✅ Concluído</span>}
            </div>
          </div>
          <LiveTerminal logs={logs} />
        </Card>
      )}

      {/* ── DONE ─────────────────────────────────────────────────────────── */}
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

      {/* ── Tip ──────────────────────────────────────────────────────────── */}
      {stage === 'form' && (
        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.12)', fontSize: 12, color: '#64748b' }}>
          💡 Dica: Use <em style={{ color: '#7c3aed' }}>Por Fluxo</em> para testes rápidos sem ruído de SEO/links.
          Use <em style={{ color: '#7c3aed' }}>Por Módulo</em> para relatórios de qualidade de um módulo específico.
          Use <em style={{ color: '#7c3aed' }}>Global</em> para auditorias de release completas.
        </div>
      )}
    </div>
  )
}
