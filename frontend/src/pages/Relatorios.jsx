import { useContext, useState } from 'react'
import { TesterContext } from '../context/TesterContext'

const issueColors = { critical: '#f87171', warning: '#fbbf24', info: '#22d3ee' }
const issueLabels = { critical: '🔴 Crítico', warning: '🟡 Aviso', info: '🔵 Info' }

function ScoreBadge({ score }) {
  if (score === null) return <span className="badge badge-warning">Em andamento</span>
  const cls = score >= 85 ? 'score-success' : score >= 70 ? 'score-warning' : 'score-danger'
  return <div className={`score-ring ${cls}`}>{score}</div>
}

function ReportDetail({ report, onClose, onUpdate }) {
  const [editMode, setEditMode]       = useState(false)
  const [title, setTitle]             = useState(report.title)
  const [suggestions, setSuggestions] = useState([...(report.suggestions || [])])
  const [findings, setFindings]       = useState([...(report.findings || [])])
  const [newSug, setNewSug]           = useState('')
  const [newFinding, setNewFinding]   = useState({ type: 'warning', title: '', desc: '' })
  const [showAddFinding, setShowAddFinding] = useState(false)

  const handleSave = () => {
    onUpdate({ ...report, title, suggestions, findings })
    setEditMode(false)
  }

  const removeSuggestion = (i) => setSuggestions(prev => prev.filter((_, idx) => idx !== i))
  const addSuggestion = () => {
    if (!newSug.trim()) return
    setSuggestions(prev => [...prev, newSug.trim()])
    setNewSug('')
  }

  const removeFinding = (i) => setFindings(prev => prev.filter((_, idx) => idx !== i))
  const addFinding = () => {
    if (!newFinding.title.trim()) return
    setFindings(prev => [...prev, { ...newFinding }])
    setNewFinding({ type: 'warning', title: '', desc: '' })
    setShowAddFinding(false)
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-start', justifyContent: 'flex-end' }} onClick={onClose}>
      <div className="side-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div className="flex-1 min-w-0">
            {editMode
              ? <input className="input" style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }} value={title} onChange={e => setTitle(e.target.value)}/>
              : <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--bright)', marginBottom: 6, lineHeight: 1.3 }}>{title}</h2>
            }
            <p style={{ fontSize: 12, color: 'var(--faint)' }}>🔗 {report.url} · {report.date}{report.duration ? ` · ⏱ ${report.duration}` : ''}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--faint)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, padding: 4, flexShrink: 0 }}>✕</button>
        </div>

        {/* Score cards */}
        {report.score && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div className="card flex-1 p-4" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <ScoreBadge score={report.score}/>
              <div>
                <p style={{ fontSize: 12, color: 'var(--faint)' }}>Score Geral</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: report.score >= 85 ? 'var(--success)' : report.score >= 70 ? 'var(--warning)' : 'var(--danger)' }}>{report.score}/100</p>
              </div>
            </div>
            {[['critical', findings.filter(f => f.type === 'critical').length],
              ['warning',  findings.filter(f => f.type === 'warning').length],
              ['info',     findings.filter(f => f.type === 'info').length]].map(([type, count]) => (
              <div key={type} className="card px-4 py-3" style={{ textAlign: 'center', minWidth: 80 }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: issueColors[type] }}>{count}</p>
                <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{type === 'critical' ? 'Críticos' : type === 'warning' ? 'Avisos' : 'Infos'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Checks */}
        {report.checks?.length > 0 && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Testes Executados</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {report.checks.map(c => <span key={c} className="badge badge-primary">{c}</span>)}
            </div>
          </div>
        )}

        {/* Findings */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Issues Encontrados
            </p>
            {editMode && (
              <button onClick={() => setShowAddFinding(v => !v)}
                style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(124,58,237,0.25)', color: 'var(--primary-l)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                + Adicionar
              </button>
            )}
          </div>

          {editMode && showAddFinding && (
            <div className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select className="input" style={{ padding: '6px 10px', fontSize: 12 }} value={newFinding.type} onChange={e => setNewFinding(f => ({ ...f, type: e.target.value }))}>
                <option value="critical">🔴 Crítico</option>
                <option value="warning">🟡 Aviso</option>
                <option value="info">🔵 Info</option>
              </select>
              <input className="input" style={{ fontSize: 13 }} placeholder="Título do issue" value={newFinding.title} onChange={e => setNewFinding(f => ({ ...f, title: e.target.value }))}/>
              <input className="input" style={{ fontSize: 13 }} placeholder="Descrição (opcional)" value={newFinding.desc} onChange={e => setNewFinding(f => ({ ...f, desc: e.target.value }))}/>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={addFinding} className="btn btn-primary btn-sm flex-1">Adicionar Issue</button>
                <button onClick={() => setShowAddFinding(false)} className="btn btn-secondary btn-sm">Cancelar</button>
              </div>
            </div>
          )}

          {findings.length === 0 && !editMode && (
            <p style={{ fontSize: 13, color: 'var(--faint)' }}>Nenhum issue encontrado.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {findings.map((f, i) => (
              <div key={i} className={`finding ${f.type}`} style={{ position: 'relative' }}>
                <span className={`finding-type ${f.type}`}>{issueLabels[f.type]}</span>
                {editMode && (
                  <button onClick={() => removeFinding(i)}
                    style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(248,113,113,0.15)', color: 'var(--danger)', border: 'none', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
                    ✕
                  </button>
                )}
                {editMode
                  ? <input className="input" style={{ fontSize: 13, marginTop: 4, marginBottom: 4 }} value={f.title} onChange={e => setFindings(prev => prev.map((item, idx) => idx === i ? { ...item, title: e.target.value } : item))}/>
                  : <p className="finding-title">{f.title}</p>
                }
                {editMode
                  ? <input className="input" style={{ fontSize: 12 }} value={f.desc || ''} onChange={e => setFindings(prev => prev.map((item, idx) => idx === i ? { ...item, desc: e.target.value } : item))}/>
                  : f.desc && <p className="finding-desc">{f.desc}</p>
                }
              </div>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Sugestões de Melhoria
            </p>
          </div>

          {editMode && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input className="input flex-1" style={{ fontSize: 13 }} placeholder="Nova sugestão de melhoria..." value={newSug} onChange={e => setNewSug(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSuggestion()}/>
              <button onClick={addSuggestion} className="btn btn-primary btn-sm" style={{ flexShrink: 0 }}>+ Add</button>
            </div>
          )}

          {suggestions.length === 0 && !editMode && (
            <p style={{ fontSize: 13, color: 'var(--faint)' }}>Nenhuma sugestão disponível.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suggestions.map((s, i) => (
              <div key={i} className="suggestion-row" style={{ position: 'relative' }}>
                <span style={{ color: 'var(--success)', fontWeight: 700, flexShrink: 0 }}>→</span>
                {editMode
                  ? <input className="input flex-1" style={{ fontSize: 13 }} value={s}
                      onChange={e => setSuggestions(prev => prev.map((item, idx) => idx === i ? e.target.value : item))}/>
                  : <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{s}</p>
                }
                {editMode && (
                  <button onClick={() => removeSuggestion(i)}
                    style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--danger)', border: 'none', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', fontSize: 13, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 10, paddingTop: 8, marginTop: 'auto' }}>
          {editMode ? (
            <>
              <button onClick={handleSave} className="btn btn-primary flex-1">💾 Salvar Edições</button>
              <button onClick={() => { setTitle(report.title); setSuggestions([...(report.suggestions||[])]); setFindings([...(report.findings||[])]); setEditMode(false) }} className="btn btn-secondary">Cancelar</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditMode(true)} className="btn btn-primary flex-1">✏️ Editar Relatório</button>
              {report.pdfUrl && (
                <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">📥 Baixar PDF</a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Relatorios() {
  const { reports, setReports } = useContext(TesterContext)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('todos')
  const [selected, setSelected] = useState(null)

  const filtered = reports.filter(r => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.url.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'todos' || r.status === filter
    return matchSearch && matchFilter
  })

  const handleUpdate = (updated) => {
    setReports(prev => prev.map(r => r.id === updated.id ? updated : r))
    setSelected(updated)
  }

  return (
    <div className="page">
      <div className="page-hdr animate-fade-in">
        <h1>Relatórios</h1>
        <p>Todos os relatórios gerados pelas suas automações</p>
      </div>

      {/* Search + filter */}
      <div className="animate-fade-in" style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="search-wrap flex-1" style={{ minWidth: 240 }}>
          <span className="search-icon">🔍</span>
          <input className="input search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar relatório ou URL..."/>
        </div>
        <div className="filter-tabs">
          {[['todos','Todos'],['completo','Completos'],['em_andamento','Em andamento']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} className={`filter-tab${filter === val ? ' active' : ''}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Mini stats */}
      <div className="animate-fade-in" style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',        value: reports.length,                                           color: 'var(--bright)'  },
          { label: 'Completos',    value: reports.filter(r => r.status === 'completo').length,      color: 'var(--success)' },
          { label: 'Em andamento', value: reports.filter(r => r.status === 'em_andamento').length,  color: 'var(--warning)' },
        ].map(s => (
          <div key={s.label} className="stat-pill">
            <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 13, color: 'var(--faint)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p style={{ fontSize: 15, color: 'var(--muted)' }}>Nenhum relatório encontrado</p>
          </div>
        )}
        {filtered.map(r => (
          <div key={r.id} className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => setSelected(r)}>
            <ScoreBadge score={r.score}/>
            <div className="flex-1 min-w-0">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--bright)' }}>{r.title}</p>
                <span className={`badge ${r.status === 'completo' ? 'badge-success' : 'badge-warning'}`}>
                  {r.status === 'completo' ? '✓ Completo' : '⏳ Em andamento'}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--faint)' }}>🔗 {r.url} · {r.date}{r.duration ? ` · ⏱ ${r.duration}` : ''}</p>
              {r.checks?.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {r.checks.map(c => <span key={c} className="badge badge-primary">{c}</span>)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
              {r.issues.critical > 0 && <span className="badge badge-danger">🔴 {r.issues.critical} críticos</span>}
              {r.issues.warning  > 0 && <span className="badge badge-warning">🟡 {r.issues.warning} avisos</span>}
              {r.issues.info     > 0 && <span className="badge badge-cyan">🔵 {r.issues.info} infos</span>}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <button onClick={e => { e.stopPropagation(); setSelected(r) }}
                  style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.2)', color: 'var(--primary-l)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                  Ver detalhes →
                </button>
                {r.pdfUrl && (
                  <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(52,211,153,0.15)', color: 'var(--success)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    📥 PDF
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected && <ReportDetail report={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate}/>}
    </div>
  )
}
