import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { TesterContext } from '../context/TesterContext'

function LineChart({ data }) {
  const hasData = data.some(d => d.score > 0)
  if (!hasData) return (
    <div className="chart-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
      <p style={{ fontSize: 12 }}>Execute auditorias para ver o histórico</p>
    </div>
  )
  const W = 500, H = 140, pad = { t: 12, r: 12, b: 28, l: 36 }
  const w = W - pad.l - pad.r, h = H - pad.t - pad.b
  const maxV = Math.max(...data.map(d => d.score)) + 5
  const minV = Math.max(0, Math.min(...data.map(d => d.score)) - 5)
  const pts = data.map((d, i) => ({
    x: pad.l + i * (w / (data.length - 1)),
    y: pad.t + h - ((d.score - minV) / (maxV - minV || 1)) * h, ...d,
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = pathD + ` L${pts[pts.length-1].x.toFixed(1)},${(pad.t+h).toFixed(1)} L${pts[0].x.toFixed(1)},${(pad.t+h).toFixed(1)} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0, .25, .5, .75, 1].map((t, i) => {
        const y = pad.t + t * h; const val = Math.round(maxV - t * (maxV - minV))
        return <g key={i}><line x1={pad.l} y1={y} x2={pad.l+w} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/><text x={pad.l-6} y={y+4} textAnchor="end" fontSize="10" fill="#64748b">{val}</text></g>
      })}
      <path d={areaD} fill="url(#lineGrad)"/>
      <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#a78bfa" stroke="#07071a" strokeWidth="2"/>
          <text x={p.x} y={pad.t+h+18} textAnchor="middle" fontSize="11" fill="#64748b">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

function BarChart({ data }) {
  const hasData = data.some(d => d.issues > 0)
  if (!hasData) return (
    <div className="chart-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
        <rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/>
      </svg>
      <p style={{ fontSize: 12 }}>Nenhum issue registrado ainda</p>
    </div>
  )
  const W = 500, H = 140, pad = { t: 12, r: 12, b: 28, l: 36 }
  const w = W - pad.l - pad.r, h = H - pad.t - pad.b
  const maxV = Math.max(...data.map(d => d.issues), 1) + 1
  const barW = (w / data.length) * 0.5
  const barGap = w / data.length
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.85"/>
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.25"/>
        </linearGradient>
      </defs>
      {[0, .33, .66, 1].map((t, i) => {
        const y = pad.t + t * h; const val = Math.round(maxV - t * maxV)
        return <g key={i}><line x1={pad.l} y1={y} x2={pad.l+w} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/><text x={pad.l-6} y={y+4} textAnchor="end" fontSize="10" fill="#64748b">{val}</text></g>
      })}
      {data.map((d, i) => {
        const bH = Math.max((d.issues / maxV) * h, d.issues > 0 ? 2 : 0)
        const x = pad.l + i * barGap + (barGap - barW) / 2
        const y = pad.t + h - bH
        return <g key={i}><rect x={x} y={y} width={barW} height={bH} rx="3" fill="url(#barGrad)"/><text x={x+barW/2} y={pad.t+h+18} textAnchor="middle" fontSize="11" fill="#64748b">{d.label}</text></g>
      })}
    </svg>
  )
}

function DonutChart({ value, color = '#7c3aed', size = 48 }) {
  const r = 16, circ = 2 * Math.PI * r, dash = (value / 100) * circ
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ/4} strokeLinecap="round"/>
      <text x="20" y="24" textAnchor="middle" fontSize="9" fontWeight="700" fill="#f1f5f9">{value}</text>
    </svg>
  )
}

const statAccents = [
  { label: 'Total de Projetos', colorKey: 'primary-l', accent: 'rgba(124,58,237,0.2)', icon: '📁' },
  { label: 'Em Andamento',      colorKey: 'cyan',      accent: 'rgba(34,211,238,0.15)', icon: '⚡' },
  { label: 'Score Médio',       colorKey: 'success',   accent: 'rgba(52,211,153,0.15)', icon: '🎯' },
  { label: 'Issues Reportados', colorKey: 'warning',   accent: 'rgba(251,191,36,0.12)', icon: '🔍' },
]
const colorMap = {
  'primary-l': 'var(--primary-l)',
  'cyan':      'var(--cyan)',
  'success':   'var(--success)',
  'warning':   'var(--warning)',
}

export default function Dashboard() {
  const { tester, stats, performanceData, reports } = useContext(TesterContext)
  const navigate = useNavigate()

  const completedReports = reports.filter(r => r.score)
  const avgScore = completedReports.length
    ? Math.round(completedReports.reduce((a, r) => a + r.score, 0) / completedReports.length) : 0
  const totalIssues = reports.reduce((a, r) => a + (r.issues?.critical || 0) + (r.issues?.warning || 0), 0)
  const total = stats.iniciados + stats.emAndamento + stats.completos
  const maxStat = Math.max(stats.completos, stats.emAndamento, stats.iniciados, 1)

  const statValues = [total, stats.emAndamento, `${avgScore}%`, totalIssues]

  return (
    <div className="page animate-fade-in">
      <div className="page-hdr">
        <h1>Olá, {tester?.name?.split(' ')[0] ?? 'tester'} 👋</h1>
        <p>Aqui está o resumo das suas atividades de QA</p>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        {statAccents.map((s, i) => (
          <div key={s.label} className="card stat-card" style={{ animationDelay: `${i * 0.06}s` }}>
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${s.accent} 0%, transparent 60%)`, pointerEvents: 'none', borderRadius: 16 }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>{s.icon}</span>
                <span style={{ fontSize: 11, color: 'var(--faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</span>
              </div>
              <p style={{ fontSize: 34, fontWeight: 800, lineHeight: 1, color: colorMap[s.colorKey] }}>{statValues[i]}</p>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="chart-grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="card p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="chart-hdr">
            <div>
              <p className="chart-title">Score de Desempenho</p>
              <p className="chart-sub">Últimos 6 meses</p>
            </div>
            <span className="badge badge-primary">Mensal</span>
          </div>
          <div style={{ height: 160 }}><LineChart data={performanceData}/></div>
        </div>

        <div className="card p-6 animate-fade-in" style={{ animationDelay: '0.25s' }}>
          <div className="chart-hdr">
            <div>
              <p className="chart-title">Issues Encontrados</p>
              <p className="chart-sub">Por mês</p>
            </div>
            <span className="badge badge-cyan">Histórico</span>
          </div>
          <div style={{ height: 160 }}><BarChart data={performanceData}/></div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20 }}>

        {/* Recent reports */}
        <div className="card p-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--bright)' }}>Relatórios Recentes</p>
            <button onClick={() => navigate('/relatorios')}
              style={{ fontSize: 13, color: 'var(--primary-l)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              Ver todos →
            </button>
          </div>
          {reports.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📄</div>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum relatório ainda</p>
              <button onClick={() => navigate('/automacao')}
                style={{ marginTop: 4, fontSize: 12, color: 'var(--primary-l)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                Iniciar primeira auditoria →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {reports.slice(0, 4).map(r => {
                const score = r.score || 0
                const color = score >= 85 ? '#34d399' : score >= 70 ? '#fbbf24' : '#f87171'
                return (
                  <div key={r.id} onClick={() => navigate('/relatorios')} className="report-mini">
                    <DonutChart value={score} color={color} size={44}/>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--bright)' }} className="truncate">{r.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{r.date}</p>
                    </div>
                    <span className={`badge ${r.status === 'completo' ? 'badge-success' : 'badge-warning'}`}>
                      {r.status === 'completo' ? '✓' : '⏳'}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Status */}
        <div className="card p-6 animate-fade-in" style={{ animationDelay: '0.35s' }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--bright)', marginBottom: 20 }}>Status das Execuções</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Completos',    value: stats.completos,   color: '#34d399' },
              { label: 'Em Andamento', value: stats.emAndamento, color: '#22d3ee' },
              { label: 'Pendentes',    value: stats.iniciados,   color: '#fbbf24' },
            ].map(s => (
              <div key={s.label}>
                <div className="status-bar-hdr">
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</span>
                </div>
                <div className="status-track">
                  <div className="status-fill" style={{ width: `${(s.value / maxStat) * 100}%`, background: s.color }}/>
                </div>
              </div>
            ))}
          </div>
          <div className="quick-box">
            <p style={{ fontSize: 11.5, color: 'var(--faint)', marginBottom: 10, fontWeight: 500 }}>Novo teste rápido</p>
            <button onClick={() => navigate('/automacao')} className="btn btn-primary btn-full">
              🚀 Iniciar Automação
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
