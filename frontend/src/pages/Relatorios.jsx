import { useContext, useState, useEffect } from 'react'
import { TesterContext } from '../context/TesterContext'
import { api } from '../services/api'

const issueColors = { critical: '#f87171', warning: '#fbbf24', info: '#22d3ee' }
const issueLabels = { critical: '🔴 Crítico', warning: '🟡 Aviso', info: '🔵 Info' }

function ScoreBadge({ score }) {
  if (score == null) return <span className="badge badge-warning">Em andamento</span>
  const cls = score >= 85 ? 'score-success' : score >= 70 ? 'score-warning' : 'score-danger'
  return <div className={`score-ring ${cls}`}>{score}</div>
}

// ─── Comparison panel ───────────────────────────────────────────────────────────
function ComparePanel({ left, right, onClose }) {
  const cols = [left, right]
  const scoreColor = s => s >= 85 ? 'var(--success)' : s >= 70 ? 'var(--warning)' : 'var(--danger)'
  const types = ['critical', 'warning', 'info']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 880, width: '95vw', maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <h3 className="modal-title">⚖️ Comparação de Execuções</h3>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>

        {/* Scores side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {cols.map((r, i) => (
            <div key={i} className="card" style={{ padding: 20, textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 8 }}>{i === 0 ? '① Execução A' : '② Execução B'}</p>
              <p style={{ fontSize: 32, fontWeight: 900, color: scoreColor(r.score || 0) }}>{r.score ?? '—'}</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--bright)', marginTop: 4 }} className="truncate">{r.title}</p>
              <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 4 }}>{r.date}{r.duration ? ` · ⏱ ${r.duration}` : ''}</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12 }}>
                {types.map(t => (
                  <div key={t}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: issueColors[t] }}>{(r.findings || []).filter(f => f.type === t).length}</p>
                    <p style={{ fontSize: 10, color: 'var(--faint)' }}>{t}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Delta row */}
        {left.score != null && right.score != null && (
          <div className="card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 4 }}>VARIAÇÃO DE SCORE</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: right.score >= left.score ? 'var(--success)' : 'var(--danger)' }}>
                {right.score >= left.score ? '+' : ''}{right.score - left.score} pts
              </p>
            </div>
            {types.map(t => {
              const a = (left.findings || []).filter(f => f.type === t).length
              const b = (right.findings || []).filter(f => f.type === t).length
              const d = b - a
              return (
                <div key={t}>
                  <p style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 4 }}>{t.toUpperCase()}</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: d === 0 ? 'var(--muted)' : d > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {d > 0 ? '+' : ''}{d}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {/* Issues side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {cols.map((r, i) => (
            <div key={i}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>{i === 0 ? 'Issues A' : 'Issues B'}</p>
              {(r.findings || []).length === 0
                ? <p style={{ fontSize: 13, color: 'var(--faint)' }}>Sem issues.</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(r.findings || []).map((f, fi) => (
                      <div key={fi} className={`finding ${f.type}`}>
                        <span className={`finding-type ${f.type}`}>{issueLabels[f.type]}</span>
                        <p className="finding-title" style={{ fontSize: 12 }}>{f.title}</p>
                      </div>
                    ))}
                  </div>
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Report detail panel ────────────────────────────────────────────────────────
function ReportDetail({ report, onClose, onUpdate, onCompare, compareWith }) {
  const [editMode, setEditMode]       = useState(false)
  const [title, setTitle]             = useState(report.title)
  const [suggestions, setSuggestions] = useState([...(report.suggestions || [])])
  const [findings, setFindings]       = useState([...(report.findings || [])])
  const [newSug, setNewSug]           = useState('')
  const [newFinding, setNewFinding]   = useState({ type: 'warning', title: '', desc: '' })
  const [showAddFinding, setShowAddFinding] = useState(false)
  const [steps, setSteps]             = useState([])
  const [lightbox, setLightbox]       = useState(null)

  useEffect(() => {
    api.getExecution(report.id)
      .then(data => setSteps(data.steps || []))
      .catch(() => {})
  }, [report.id])

  const handleSave = () => {
    onUpdate({ ...report, title, suggestions, findings })
    setEditMode(false)
  }

  return (
    <>
    {lightbox && (
      <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={lightbox} alt="screenshot" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 10 }} onClick={e => e.stopPropagation()}/>
      </div>
    )}
    <div className="modal-overlay" style={{ alignItems: 'flex-start', justifyContent: 'flex-end' }} onClick={onClose}>
      <div className="side-panel" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div className="flex-1 min-w-0">
            {editMode
              ? <input className="input" style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }} value={title} onChange={e => setTitle(e.target.value)}/>
              : <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--bright)', marginBottom: 4 }}>{title}</h2>
            }
            <p style={{ fontSize: 12, color: 'var(--faint)' }}>🔗 {report.url} · {report.date}{report.duration ? ` · ⏱ ${report.duration}` : ''}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--faint)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, padding: 4, flexShrink: 0 }}>✕</button>
        </div>

        {/* Score row */}
        {report.score != null && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div className="card flex-1 p-4" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ScoreBadge score={report.score}/>
              <div>
                <p style={{ fontSize: 11, color: 'var(--faint)' }}>Score</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: report.score >= 85 ? 'var(--success)' : report.score >= 70 ? 'var(--warning)' : 'var(--danger)' }}>{report.score}/100</p>
              </div>
            </div>
            {['critical','warning','info'].map(type => (
              <div key={type} className="card px-4 py-3" style={{ textAlign: 'center', minWidth: 68 }}>
                <p style={{ fontSize: 18, fontWeight: 800, color: issueColors[type] }}>{findings.filter(f => f.type === type).length}</p>
                <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 2 }}>{type}</p>
              </div>
            ))}
          </div>
        )}

        {/* Compare button */}
        <button onClick={() => onCompare(report)}
          style={{ padding: '8px 14px', borderRadius: 8, background: compareWith && compareWith.id !== report.id ? 'rgba(34,211,238,0.2)' : 'rgba(34,211,238,0.08)', color: 'var(--cyan)', fontSize: 12, fontWeight: 700, border: '1px solid rgba(34,211,238,0.25)', cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left' }}>
          {compareWith && compareWith.id !== report.id ? `⚖️ Comparar com "${compareWith.title.slice(0, 25)}..."` : '⚖️ Marcar para comparação'}
        </button>

        {/* Steps */}
        {steps.length > 0 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Steps Executados</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {steps.map((s, i) => {
                const screenshotUrl = s.screenshot_path ? api.fileUrl(s.screenshot_path) : null
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: `1px solid ${s.status === 'passed' ? 'rgba(52,211,153,0.12)' : s.status === 'failed' ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.04)'}` }}>
                    <span style={{ flexShrink: 0 }}>{s.status === 'passed' ? '✅' : s.status === 'failed' ? '❌' : '⏳'}</span>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 12, fontWeight: 600, color: s.status === 'passed' ? 'var(--success)' : s.status === 'failed' ? 'var(--danger)' : 'var(--muted)' }} className="truncate">{s.name}</p>
                      {s.error_message && <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 1 }} className="line-clamp-2">{s.error_message}</p>}
                      {s.duration_ms > 0 && <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 1 }}>⏱ {s.duration_ms}ms</p>}
                    </div>
                    {screenshotUrl && (
                      <button onClick={() => setLightbox(screenshotUrl)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                        <img src={screenshotUrl} alt="ss" style={{ width: 48, height: 32, objectFit: 'cover', borderRadius: 4, border: '1px solid rgba(248,113,113,0.4)' }}/>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Findings */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Issues</p>
            {editMode && <button onClick={() => setShowAddFinding(v => !v)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'rgba(124,58,237,0.25)', color: 'var(--primary-l)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Add</button>}
          </div>
          {editMode && showAddFinding && (
            <div className="card" style={{ padding: 12, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <select className="input" style={{ fontSize: 12 }} value={newFinding.type} onChange={e => setNewFinding(f => ({ ...f, type: e.target.value }))}>
                <option value="critical">🔴 Crítico</option><option value="warning">🟡 Aviso</option><option value="info">🔵 Info</option>
              </select>
              <input className="input" style={{ fontSize: 13 }} placeholder="Título" value={newFinding.title} onChange={e => setNewFinding(f => ({ ...f, title: e.target.value }))}/>
              <input className="input" style={{ fontSize: 13 }} placeholder="Descrição" value={newFinding.desc} onChange={e => setNewFinding(f => ({ ...f, desc: e.target.value }))}/>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { if (!newFinding.title) return; setFindings(p => [...p, { ...newFinding }]); setNewFinding({ type: 'warning', title: '', desc: '' }); setShowAddFinding(false) }} className="btn btn-primary btn-sm flex-1">Adicionar</button>
                <button onClick={() => setShowAddFinding(false)} className="btn btn-secondary btn-sm">Cancelar</button>
              </div>
            </div>
          )}
          {findings.length === 0 && !editMode ? <p style={{ fontSize: 13, color: 'var(--faint)' }}>Sem issues.</p> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {findings.map((f, i) => (
              <div key={i} className={`finding ${f.type}`} style={{ position: 'relative' }}>
                <span className={`finding-type ${f.type}`}>{issueLabels[f.type]}</span>
                {editMode && <button onClick={() => setFindings(p => p.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(248,113,113,0.15)', color: 'var(--danger)', border: 'none', borderRadius: 6, width: 24, height: 24, cursor: 'pointer', fontWeight: 700 }}>✕</button>}
                {editMode
                  ? <input className="input" style={{ fontSize: 13, marginTop: 4 }} value={f.title} onChange={e => setFindings(p => p.map((item, idx) => idx === i ? { ...item, title: e.target.value } : item))}/>
                  : <p className="finding-title">{f.title}</p>
                }
                {!editMode && f.desc && <p className="finding-desc">{f.desc}</p>}
                {f.screenshot && (
                  <button onClick={() => setLightbox(f.screenshot.startsWith('/files/') ? api.fileUrl(f.screenshot.replace('/files/', '')) : f.screenshot)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 6, display: 'block' }}>
                    <img src={f.screenshot.startsWith('/files/') ? api.fileUrl(f.screenshot.replace('/files/', '')) : f.screenshot} alt="ss" style={{ maxHeight: 100, borderRadius: 6 }}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Sugestões</p>
          {editMode && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input className="input flex-1" style={{ fontSize: 13 }} placeholder="Nova sugestão..." value={newSug} onChange={e => setNewSug(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newSug.trim()) { setSuggestions(p => [...p, newSug.trim()]); setNewSug('') } }}/>
              <button onClick={() => { if (newSug.trim()) { setSuggestions(p => [...p, newSug.trim()]); setNewSug('') } }} className="btn btn-primary btn-sm">+</button>
            </div>
          )}
          {suggestions.length === 0 && !editMode ? <p style={{ fontSize: 13, color: 'var(--faint)' }}>Sem sugestões.</p> : null}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {suggestions.map((s, i) => (
              <div key={i} className="suggestion-row">
                <span style={{ color: 'var(--success)', fontWeight: 700, flexShrink: 0 }}>→</span>
                {editMode
                  ? <input className="input flex-1" style={{ fontSize: 13 }} value={s} onChange={e => setSuggestions(p => p.map((item, idx) => idx === i ? e.target.value : item))}/>
                  : <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{s}</p>
                }
                {editMode && <button onClick={() => setSuggestions(p => p.filter((_, idx) => idx !== i))} style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--danger)', border: 'none', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>✕</button>}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 10, paddingTop: 8, marginTop: 'auto' }}>
          {editMode ? (
            <>
              <button onClick={handleSave} className="btn btn-primary flex-1">💾 Salvar</button>
              <button onClick={() => { setTitle(report.title); setSuggestions([...(report.suggestions||[])]); setFindings([...(report.findings||[])]); setEditMode(false) }} className="btn btn-secondary">Cancelar</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditMode(true)} className="btn btn-primary flex-1">✏️ Editar</button>
              {report.pdfUrl && <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">📥 PDF</a>}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

// ─── Main page ──────────────────────────────────────────────────────────────────
export default function Relatorios() {
  const { reports, setReports, backendOnline } = useContext(TesterContext)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('todos')
  const [groupByProject, setGroupByProject] = useState(false)
  const [selected, setSelected] = useState(null)
  const [compareA, setCompareA] = useState(null)
  const [compareB, setCompareB] = useState(null)
  const [showCompare, setShowCompare] = useState(false)
  const [dbReports, setDbReports]     = useState([])
  const [loadingDb, setLoadingDb]     = useState(false)

  useEffect(() => {
    if (!backendOnline) return
    setLoadingDb(true)
    const base = import.meta.env.VITE_API_URL || 'http://localhost:5005/api'
    fetch(`${base}/reports`)
      .then(r => r.json())
      .then(data => {
        const mapped = (data || []).map(e => ({
          id:          e.id,
          title:       e.flow_name || e.project_name || 'Auditoria IA',
          url:         e.base_url || '',
          projectName: e.project_name || 'Sem Projeto',
          date:        e.started_at ? new Date(e.started_at).toLocaleDateString('pt-BR') : '—',
          duration:    e.duration_ms ? `${(e.duration_ms / 1000).toFixed(0)}s` : null,
          status:      (e.status === 'passed' || e.status === 'failed') ? 'completo' : 'em_andamento',
          score:       e.score,
          findings:    Array.isArray(e.findings) ? e.findings : (JSON.parse(e.findings || '[]')),
          suggestions: Array.isArray(e.suggestions) ? e.suggestions : (JSON.parse(e.suggestions || '[]')),
          pdfUrl:      api.reportPdfUrl(e.id),
          issues: {
            critical: (Array.isArray(e.findings) ? e.findings : []).filter(f => f.type === 'critical').length,
            warning:  (Array.isArray(e.findings) ? e.findings : []).filter(f => f.type === 'warning').length,
            info:     (Array.isArray(e.findings) ? e.findings : []).filter(f => f.type === 'info').length,
          },
          checks: [],
        }))
        setDbReports(mapped)
      })
      .catch(() => {})
      .finally(() => setLoadingDb(false))
  }, [backendOnline])

  const allReports = (() => {
    const map = new Map()
    ;[...reports, ...dbReports].forEach(r => map.set(r.id, r))
    return [...map.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  })()

  const filtered = allReports.filter(r => {
    const matchSearch = (r.title || '').toLowerCase().includes(search.toLowerCase()) ||
                        (r.url  || '').toLowerCase().includes(search.toLowerCase()) ||
                        (r.projectName || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'todos' || r.status === filter
    return matchSearch && matchFilter
  })

  const handleUpdate = (updated) => {
    setReports(prev => prev.map(r => r.id === updated.id ? updated : r))
    setDbReports(prev => prev.map(r => r.id === updated.id ? updated : r))
    setSelected(updated)
  }

  const handleCompare = (report) => {
    if (!compareA || (compareA && compareB)) {
      setCompareA(report); setCompareB(null); setShowCompare(false)
    } else if (compareA.id !== report.id) {
      setCompareB(report); setShowCompare(true)
    }
    setSelected(null)
  }

  const grouped = groupByProject
    ? filtered.reduce((acc, r) => {
        const key = r.projectName || 'Sem Projeto'
        if (!acc[key]) acc[key] = []
        acc[key].push(r)
        return acc
      }, {})
    : { all: filtered }

  const ReportRow = ({ r }) => (
    <div className="card"
      style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', border: `1px solid ${compareA?.id === r.id ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.06)'}` }}
      onClick={() => setSelected(r)}>
      <ScoreBadge score={r.score}/>
      <div className="flex-1 min-w-0">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--bright)' }}>{r.title}</p>
          <span className={`badge ${r.status === 'completo' ? 'badge-success' : 'badge-warning'}`}>{r.status === 'completo' ? '✓ Completo' : '⏳ Em andamento'}</span>
          {compareA?.id === r.id && <span className="badge badge-cyan">⚖️ A</span>}
        </div>
        <p style={{ fontSize: 12, color: 'var(--faint)' }}>
          {r.projectName && r.projectName !== 'Sem Projeto' && <span style={{ marginRight: 8 }}>📁 {r.projectName} ·</span>}
          🔗 {r.url} · {r.date}{r.duration ? ` · ⏱ ${r.duration}` : ''}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {r.issues?.critical > 0 && <span className="badge badge-danger">🔴 {r.issues.critical}</span>}
          {r.issues?.warning  > 0 && <span className="badge badge-warning">🟡 {r.issues.warning}</span>}
          {r.issues?.info     > 0 && <span className="badge badge-cyan">🔵 {r.issues.info}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={e => { e.stopPropagation(); setSelected(r) }}
            style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(124,58,237,0.2)', color: 'var(--primary-l)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            Ver →
          </button>
          <button onClick={e => { e.stopPropagation(); handleCompare(r) }} title="Comparar"
            style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(34,211,238,0.1)', color: 'var(--cyan)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            ⚖️
          </button>
          {r.pdfUrl && (
            <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(52,211,153,0.12)', color: 'var(--success)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              📥
            </a>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-hdr animate-fade-in">
        <h1>Relatórios</h1>
        <p>Todos os relatórios gerados pelas automações QA</p>
      </div>

      <div className="animate-fade-in" style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 220 }}>
          <span className="search-icon">🔍</span>
          <input className="input search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por título, projeto ou URL..."/>
        </div>
        <div className="filter-tabs">
          {[['todos','Todos'],['completo','Completos'],['em_andamento','Em andamento']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)} className={`filter-tab${filter === val ? ' active' : ''}`}>{label}</button>
          ))}
        </div>
        <button onClick={() => setGroupByProject(v => !v)}
          style={{ padding: '8px 14px', borderRadius: 8, background: groupByProject ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.06)', color: groupByProject ? 'var(--primary-l)' : 'var(--muted)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
          📁 Por Projeto
        </button>
      </div>

      <div className="animate-fade-in" style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',        value: allReports.length,                                          color: 'var(--bright)'  },
          { label: 'Completos',    value: allReports.filter(r => r.status === 'completo').length,     color: 'var(--success)' },
          { label: 'Em andamento', value: allReports.filter(r => r.status === 'em_andamento').length, color: 'var(--warning)' },
        ].map(s => (
          <div key={s.label} className="stat-pill">
            <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 13, color: 'var(--faint)' }}>{s.label}</span>
          </div>
        ))}
        {compareA && (
          <div className="stat-pill" style={{ borderColor: 'var(--cyan)', background: 'rgba(34,211,238,0.06)', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cyan)' }}>⚖️ {compareA.title.slice(0, 22)}</span>
            <button onClick={() => { setCompareA(null); setCompareB(null); setShowCompare(false) }} style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 12 }}>✕</button>
          </div>
        )}
      </div>

      {loadingDb && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-l)' }}/>
          <span style={{ fontSize: 12, color: 'var(--faint)' }}>Carregando do banco de dados...</span>
        </div>
      )}

      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {Object.entries(grouped).map(([key, items]) => (
          <div key={key}>
            {groupByProject && (
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                📁 {key} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--faint)' }}>({items.length})</span>
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.length === 0
                ? <div className="empty-state"><div className="empty-state-icon">📭</div><p style={{ color: 'var(--muted)' }}>Nenhum relatório encontrado</p></div>
                : items.map(r => <ReportRow key={r.id} r={r}/>)
              }
            </div>
          </div>
        ))}
        {filtered.length === 0 && !loadingDb && (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <p style={{ fontSize: 15, color: 'var(--muted)' }}>
              {search ? 'Nenhum relatório encontrado' : 'Nenhum relatório gerado ainda'}
            </p>
            {!search && <p style={{ fontSize: 13, color: 'var(--faint)' }}>Execute uma automação para gerar o primeiro relatório</p>}
          </div>
        )}
      </div>

      {selected && (
        <ReportDetail
          report={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onCompare={handleCompare}
          compareWith={compareA}
        />
      )}

      {showCompare && compareA && compareB && (
        <ComparePanel left={compareA} right={compareB} onClose={() => setShowCompare(false)}/>
      )}
    </div>
  )
}
