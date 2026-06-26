import { useContext, useState } from 'react'
import { TesterContext } from '../context/TesterContext'

const issueColors = { critical: '#f87171', warning: '#fbbf24', info: '#22d3ee' }
const issueLabels = { critical: '🔴 Crítico', warning: '🟡 Aviso', info: '🔵 Info' }
const issueBadge  = { critical: 'badge-red',  warning: 'badge-yellow', info: 'badge-cyan' }

function ScoreBadge({ score }) {
  if (score === null) return <span className="badge badge-yellow">Em andamento</span>
  const color  = score >= 85 ? '#34d399' : score >= 70 ? '#fbbf24' : '#f87171'
  const border = score >= 85 ? '#34d39933' : score >= 70 ? '#fbbf2433' : '#f8717133'
  const bg     = score >= 85 ? 'rgba(52,211,153,0.15)' : score >= 70 ? 'rgba(251,191,36,0.15)' : 'rgba(248,113,113,0.15)'
  return (
    <div className="w-13 h-13 rounded-full flex items-center justify-center text-[15px] font-extrabold shrink-0"
      style={{ background: bg, color, border: `2px solid ${border}` }}>
      {score}
    </div>
  )
}

function ReportDetail({ report, onClose }) {
  const [editMode, setEditMode] = useState(false)
  const [title, setTitle] = useState(report.title)

  return (
    <div className="fixed inset-0 bg-black/70 z-200 flex items-start justify-end backdrop-blur-sm" onClick={onClose}>
      <div className="w-140 h-screen overflow-y-auto bg-surface border-l border-white/8 p-8 flex flex-col gap-6 animate-slide-left"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-1">
            {editMode
              ? <input className="input-field text-base font-bold mb-2" value={title} onChange={e => setTitle(e.target.value)}/>
              : <h2 className="text-lg font-extrabold text-bright leading-snug mb-1.5">{title}</h2>
            }
            <p className="text-xs text-faint">🔗 {report.url} · {report.date}{report.duration ? ` · ⏱ ${report.duration}` : ''}</p>
          </div>
          <button onClick={onClose} className="text-faint text-xl p-1 bg-transparent border-none cursor-pointer hover:text-bright">✕</button>
        </div>

        {/* Score row */}
        {report.score && (
          <div className="flex gap-4 flex-wrap">
            <div className="card flex-1 p-4 flex items-center gap-3.5">
              <ScoreBadge score={report.score}/>
              <div>
                <p className="text-xs text-faint">Score Geral</p>
                <p className={`text-[22px] font-extrabold ${report.score >= 85 ? 'text-success' : report.score >= 70 ? 'text-warning' : 'text-danger'}`}>
                  {report.score}/100
                </p>
              </div>
            </div>
            {[['critical', report.issues.critical], ['warning', report.issues.warning], ['info', report.issues.info]].map(([type, count]) => (
              <div key={type} className="card px-4 py-3.5 text-center min-w-20">
                <p className="text-xl font-extrabold" style={{ color: issueColors[type] }}>{count}</p>
                <p className="text-[11px] text-faint mt-0.5">{type === 'critical' ? 'Críticos' : type === 'warning' ? 'Avisos' : 'Infos'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Checks */}
        {report.checks?.length > 0 && (
          <div>
            <h4 className="text-[13px] font-bold text-muted uppercase tracking-[0.5px] mb-2.5">Testes Executados</h4>
            <div className="flex flex-wrap gap-2">
              {report.checks.map(c => <span key={c} className="badge badge-purple">{c}</span>)}
            </div>
          </div>
        )}

        {/* Findings */}
        {report.findings?.length > 0 && (
          <div>
            <h4 className="text-[13px] font-bold text-muted uppercase tracking-[0.5px] mb-2.5">Issues Encontrados</h4>
            <div className="flex flex-col gap-2.5">
              {report.findings.map((f, i) => (
                <div key={i} className="card p-3.5" style={{ borderLeft: `3px solid ${issueColors[f.type]}` }}>
                  <span className={`badge ${issueBadge[f.type]} mb-1.5`}>{issueLabels[f.type]}</span>
                  <p className="text-sm font-semibold text-bright mb-1">{f.title}</p>
                  <p className="text-[13px] text-muted leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {report.suggestions?.length > 0 && (
          <div>
            <h4 className="text-[13px] font-bold text-muted uppercase tracking-[0.5px] mb-2.5">Sugestões de Melhoria</h4>
            <div className="flex flex-col gap-2">
              {report.suggestions.map((s, i) => (
                <div key={i} className="flex gap-2.5 items-start p-3 rounded-[10px] bg-success/6 border border-success/15">
                  <span className="text-success shrink-0 font-bold">→</span>
                  <p className="text-[13px] text-muted leading-relaxed">{s}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2.5 pt-2 mt-auto">
          <button onClick={() => setEditMode(!editMode)}
            className="flex-1 py-3 rounded-[10px] bg-primary text-white text-sm font-semibold border-none cursor-pointer hover:bg-primary-hover transition-all duration-200">
            {editMode ? '💾 Salvar Edições' : '✏️ Editar Relatório'}
          </button>
          <button className="py-3 px-5 rounded-[10px] bg-transparent text-muted text-sm font-medium border border-white/8 cursor-pointer hover:border-primary-light hover:text-primary-light transition-all duration-200">
            📥 Exportar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Relatorios() {
  const { reports } = useContext(TesterContext)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('todos')
  const [selected, setSelected] = useState(null)

  const filtered = reports.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.url.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'todos' || r.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="py-8 px-10 max-w-250">

      <div className="animate-fade-in mb-7">
        <h1 className="text-[28px] font-extrabold text-bright mb-1">Relatórios</h1>
        <p className="text-[15px] text-muted">Todos os relatórios gerados pelas suas automações</p>
      </div>

      {/* Search + filter */}
      <div className="animate-fade-in flex gap-3 mb-6 flex-wrap">
        <div className="flex-1 min-w-60 relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint text-base">🔍</span>
          <input className="input-field pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar relatório ou URL..."/>
        </div>
        <div className="flex gap-1.5 bg-white/5 rounded-[10px] p-1">
          {[['todos', 'Todos'], ['completo', 'Completos'], ['em_andamento', 'Em andamento']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-4 py-1.5 rounded-lg border-none cursor-pointer text-[13px] font-semibold transition-all duration-150
                ${filter === val ? 'bg-primary text-white' : 'bg-transparent text-muted hover:text-bright'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Mini stats */}
      <div className="animate-fade-in flex gap-3 mb-6 flex-wrap">
        {[
          { label: 'Total',          value: reports.length,                                    color: 'text-bright' },
          { label: 'Completos',      value: reports.filter(r => r.status === 'completo').length, color: 'text-success' },
          { label: 'Em andamento',   value: reports.filter(r => r.status === 'em_andamento').length, color: 'text-warning' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-white/4 border border-white/8">
            <span className={`text-lg font-extrabold ${s.color}`}>{s.value}</span>
            <span className="text-[13px] text-faint">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Report list */}
      <div className="animate-fade-in flex flex-col gap-3">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-faint">
            <p className="text-5xl mb-3">📭</p>
            <p className="text-[15px]">Nenhum relatório encontrado</p>
          </div>
        )}
        {filtered.map(r => (
          <div key={r.id} className="card p-5 flex items-center gap-4 cursor-pointer" onClick={() => setSelected(r)}>
            <ScoreBadge score={r.score}/>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="text-[15px] font-bold text-bright">{r.title}</p>
                <span className={`badge ${r.status === 'completo' ? 'badge-green' : 'badge-yellow'}`}>
                  {r.status === 'completo' ? '✓ Completo' : '⏳ Em andamento'}
                </span>
              </div>
              <p className="text-xs text-faint">🔗 {r.url} · {r.date}{r.duration ? ` · ⏱ ${r.duration}` : ''}</p>
              {r.checks?.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {r.checks.map(c => <span key={c} className="badge badge-purple text-[11px]">{c}</span>)}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {r.issues.critical > 0 && <span className="badge badge-red">🔴 {r.issues.critical} críticos</span>}
              {r.issues.warning  > 0 && <span className="badge badge-yellow">🟡 {r.issues.warning} avisos</span>}
              {r.issues.info     > 0 && <span className="badge badge-cyan">🔵 {r.issues.info} infos</span>}
              <button className="mt-1 px-3.5 py-1.5 rounded-lg bg-primary/20 text-primary-light text-xs font-semibold border-none cursor-pointer hover:bg-primary/30 transition-all duration-150">
                Ver detalhes →
              </button>
            </div>
          </div>
        ))}
      </div>

      {selected && <ReportDetail report={selected} onClose={() => setSelected(null)}/>}
    </div>
  )
}
