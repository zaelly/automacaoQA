import { useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { TesterContext } from '../context/TesterContext'

function LineChart({ data }) {
  const W = 500; const H = 140
  const pad = { t: 12, r: 12, b: 28, l: 36 }
  const w = W - pad.l - pad.r; const h = H - pad.t - pad.b
  const maxV = Math.max(...data.map(d => d.score)) + 5
  const minV = Math.min(...data.map(d => d.score)) - 5
  const pts = data.map((d, i) => ({
    x: pad.l + i * (w / (data.length - 1)),
    y: pad.t + h - ((d.score - minV) / (maxV - minV)) * h,
    ...d,
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaD = pathD + ` L${pts[pts.length-1].x.toFixed(1)},${(pad.t+h).toFixed(1)} L${pts[0].x.toFixed(1)},${(pad.t+h).toFixed(1)} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[0,.25,.5,.75,1].map((t,i) => {
        const y = pad.t + t*h; const val = Math.round(maxV - t*(maxV-minV))
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={pad.l+w} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
            <text x={pad.l-6} y={y+4} textAnchor="end" fontSize="10" fill="#64748b">{val}</text>
          </g>
        )
      })}
      <path d={areaD} fill="url(#lineGrad)"/>
      <path d={pathD} fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#a78bfa" stroke="#07071a" strokeWidth="2"/>
          <text x={p.x} y={pad.t+h+18} textAnchor="middle" fontSize="11" fill="#64748b">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}

function BarChart({ data }) {
  const W = 500; const H = 140
  const pad = { t: 12, r: 12, b: 28, l: 36 }
  const w = W - pad.l - pad.r; const h = H - pad.t - pad.b
  const maxV = Math.max(...data.map(d => d.issues)) + 2
  const barW = (w / data.length) * 0.55
  const barGap = w / data.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.3"/>
        </linearGradient>
      </defs>
      {[0,.33,.66,1].map((t,i) => {
        const y = pad.t + t*h; const val = Math.round(maxV - t*maxV)
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={pad.l+w} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1"/>
            <text x={pad.l-6} y={y+4} textAnchor="end" fontSize="10" fill="#64748b">{val}</text>
          </g>
        )
      })}
      {data.map((d,i) => {
        const bH = (d.issues / maxV) * h
        const x = pad.l + i*barGap + (barGap-barW)/2
        const y = pad.t + h - bH
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bH} rx="4" fill="url(#barGrad)"/>
            <text x={x+barW/2} y={pad.t+h+18} textAnchor="middle" fontSize="11" fill="#64748b">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function DonutChart({ value, color = '#7c3aed', size = 48 }) {
  const r = 16; const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4"/>
      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ/4} strokeLinecap="round"/>
      <text x="20" y="24" textAnchor="middle" fontSize="9" fontWeight="700" fill="#f1f5f9">{value}</text>
    </svg>
  )
}

export default function Dashboard() {
  const { tester, mockUser, mockStats, mockPerformance, reports } = useContext(TesterContext)
  const navigate = useNavigate()
  const user = tester || mockUser
  const completedReports = reports.filter(r => r.score)
  const avgScore = completedReports.length
    ? Math.round(completedReports.reduce((a, r) => a + r.score, 0) / completedReports.length)
    : 0
  const totalIssues = reports.reduce((a, r) => a + (r.issues?.critical || 0) + (r.issues?.warning || 0), 0)

  const statCards = [
    { label: 'Total de Projetos', value: mockStats.iniciados + mockStats.emAndamento + mockStats.completos, color: 'text-primary-light', icon: '📁' },
    { label: 'Em Andamento',      value: mockStats.emAndamento, color: 'text-cyan',         icon: '⚡' },
    { label: 'Score Médio',       value: `${avgScore}%`,        color: 'text-success',      icon: '🎯' },
    { label: 'Issues Reportados', value: totalIssues,           color: 'text-warning',      icon: '🔍' },
  ]

  return (
    <div className="py-8 px-10 max-w-300">

      {/* Header */}
      <div className="animate-fade-in mb-8">
        <h1 className="text-[28px] font-extrabold text-bright mb-1">Olá, {user.name.split(' ')[0]} 👋</h1>
        <p className="text-[15px] text-muted">Aqui está o resumo das suas atividades de QA</p>
      </div>

      {/* Stat cards */}
      <div className="animate-fade-in grid grid-cols-4 gap-4 mb-7">
        {statCards.map((s, i) => (
          <div key={s.label} className="card p-5" style={{ animationDelay: `${i * 0.07}s` }}>
            <div className="flex justify-between items-start mb-3">
              <span className="text-2xl">{s.icon}</span>
              <span className="text-[11px] text-faint font-semibold uppercase tracking-[0.5px]">Este mês</span>
            </div>
            <p className={`text-[32px] font-extrabold leading-none ${s.color}`}>{s.value}</p>
            <p className="text-[13px] text-muted mt-1.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-5 mb-6" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <div className="card animate-fade-in p-6" style={{ animationDelay: '0.2s' }}>
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-base font-bold text-bright">Score de Desempenho</h3>
              <p className="text-xs text-faint mt-0.5">Últimos 6 meses</p>
            </div>
            <span className="badge badge-purple">Mensal</span>
          </div>
          <div className="h-40"><LineChart data={mockPerformance}/></div>
        </div>

        <div className="card animate-fade-in p-6" style={{ animationDelay: '0.25s' }}>
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-base font-bold text-bright">Issues Encontrados</h3>
              <p className="text-xs text-faint mt-0.5">Por mês</p>
            </div>
            <span className="badge badge-cyan">Histórico</span>
          </div>
          <div className="h-40"><BarChart data={mockPerformance}/></div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid gap-5" style={{ gridTemplateColumns: '1.6fr 1fr' }}>
        {/* Recent reports */}
        <div className="card animate-fade-in p-6" style={{ animationDelay: '0.3s' }}>
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-bold text-bright">Relatórios Recentes</h3>
            <button onClick={() => navigate('/relatorios')} className="text-[13px] text-primary-light bg-none border-none cursor-pointer hover:underline">
              Ver todos →
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {reports.slice(0, 4).map(r => {
              const score = r.score || 0
              const color = score >= 85 ? '#34d399' : score >= 70 ? '#fbbf24' : '#f87171'
              return (
                <div key={r.id} onClick={() => navigate('/relatorios')}
                  className="flex items-center gap-3.5 p-3 rounded-[10px] cursor-pointer transition-all duration-150 bg-white/3 hover:bg-white/6">
                  <DonutChart value={score} color={color} size={48}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-bright truncate">{r.title}</p>
                    <p className="text-xs text-faint mt-0.5">{r.date}</p>
                  </div>
                  <span className={`badge ${r.status === 'completo' ? 'badge-green' : 'badge-yellow'}`}>
                    {r.status === 'completo' ? 'Completo' : 'Em andamento'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Project status */}
        <div className="card animate-fade-in p-6" style={{ animationDelay: '0.35s' }}>
          <h3 className="text-base font-bold text-bright mb-5">Status dos Projetos</h3>
          <div className="flex flex-col gap-4">
            {[
              { label: 'Completos',    value: mockStats.completos,   color: '#34d399', pct: (mockStats.completos/20)*100 },
              { label: 'Em Andamento', value: mockStats.emAndamento, color: '#22d3ee', pct: (mockStats.emAndamento/20)*100 },
              { label: 'Iniciados',    value: mockStats.iniciados,   color: '#fbbf24', pct: (mockStats.iniciados/20)*100 },
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[13px] text-muted">{s.label}</span>
                  <span className="text-[13px] font-bold" style={{ color: s.color }}>{s.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.pct}%`, background: s.color }}/>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 p-4 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-xs text-faint mb-2">Novo teste rápido</p>
            <button onClick={() => navigate('/automacao')}
              className="w-full py-2.5 rounded-lg bg-primary text-white text-[13px] font-semibold border-none cursor-pointer transition-all duration-200 hover:bg-primary-hover">
              🚀 Iniciar Automação
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
