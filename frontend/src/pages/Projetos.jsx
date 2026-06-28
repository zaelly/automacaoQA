import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { TesterContext } from '../context/TesterContext'
import { api } from '../services/api'

function ScreenshotModal({ src, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
               display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '85vh' }}>
        <img src={src} alt="Screenshot" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 10, display: 'block' }}/>
        <button onClick={onClose}
          style={{ position: 'absolute', top: -14, right: -14, width: 32, height: 32, borderRadius: '50%',
                   background: '#f87171', border: 'none', color: '#fff', fontWeight: 900, fontSize: 16,
                   cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ✕
        </button>
      </div>
    </div>
  )
}

const issueColors = { critical: '#f87171', warning: '#fbbf24', info: '#22d3ee' }
const issueLabels = { critical: '🔴 Crítico', warning: '🟡 Aviso', info: '🔵 Info' }

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <h3 className="modal-title">{title}</h3>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ProjectDetail({ project, onClose, onExecutar, onRepeat }) {
  const [executions, setExecutions]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(null)
  const [selectedSteps, setSelectedSteps] = useState([])
  const [stepsLoading, setStepsLoading]   = useState(false)
  const [lightbox, setLightbox]           = useState(null)

  useEffect(() => {
    api.getExecutions(project.id, 10)
      .then(execs => {
        const mapped = execs.map(e => ({
          ...e,
          findings:    typeof e.findings    === 'string' ? JSON.parse(e.findings    || '[]') : (e.findings    || []),
          suggestions: typeof e.suggestions === 'string' ? JSON.parse(e.suggestions || '[]') : (e.suggestions || []),
        }))
        setExecutions(mapped)
        if (mapped.length > 0) setSelected(mapped[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [project.id])

  // Load steps (with screenshots) when selected execution changes
  useEffect(() => {
    if (!selected?.id) { setSelectedSteps([]); return }
    setStepsLoading(true)
    api.getExecution(selected.id)
      .then(data => setSelectedSteps(data.steps || []))
      .catch(() => setSelectedSteps([]))
      .finally(() => setStepsLoading(false))
  }, [selected?.id])

  const scoreColor = (s) => s >= 85 ? 'var(--success)' : s >= 70 ? 'var(--warning)' : 'var(--danger)'
  const scoreBg    = (s) => s >= 85 ? 'rgba(52,211,153,0.12)' : s >= 70 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)'

  const statusLabel = (s) => s === 'passed' ? '✓ Passou' : s === 'failed' ? '✗ Falhou' : s === 'running' ? '▶ Executando' : s === 'stopped' ? '⏹ Parado' : '⏳ Pendente'
  const statusCls   = (s) => s === 'passed' ? 'badge-success' : s === 'failed' ? 'badge-danger' : s === 'running' ? 'badge-warning' : 'badge-cyan'

  return (
    <>
    {lightbox && <ScreenshotModal src={lightbox} onClose={() => setLightbox(null)}/>}
    <div className="modal-overlay" style={{ alignItems: 'flex-start', justifyContent: 'flex-end' }} onClick={onClose}>
      <div className="side-panel" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {project.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--bright)', marginBottom: 2 }} className="truncate">{project.name}</h2>
            {project.base_url && <p style={{ fontSize: 12, color: 'var(--faint)' }} className="truncate">🔗 {project.base_url}</p>}
          </div>
          <button onClick={onClose} style={{ color: 'var(--faint)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, padding: 4, flexShrink: 0 }}>✕</button>
        </div>

        {/* Quick action */}
        <button onClick={() => { onClose(); onExecutar(project) }} className="btn btn-primary btn-full" style={{ marginBottom: 4 }}>
          🚀 Executar Novo Teste
        </button>

        {/* Execution list */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
            Histórico de Execuções
          </p>
          {loading && <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner spinner-md" style={{ margin: '0 auto' }}/></div>}
          {!loading && executions.length === 0 && (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-state-icon">📋</div>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhuma execução ainda</p>
            </div>
          )}
          {!loading && executions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {executions.map(e => (
                <div key={e.id}
                  style={{ borderRadius: 10, border: `1px solid ${selected?.id === e.id ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.06)'}`, background: selected?.id === e.id ? 'rgba(124,58,237,0.1)' : 'rgba(255,255,255,0.02)', overflow: 'hidden', transition: 'all 0.15s' }}>
                  <div onClick={() => setSelected(e)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer' }}>
                    {e.score != null ? (
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: scoreBg(e.score), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: scoreColor(e.score), flexShrink: 0 }}>
                        {e.score}
                      </div>
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <div className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--warning)' }}/>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--bright)' }} className="truncate">
                        {e.flow_name || 'Auditoria IA'}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
                        {e.started_at ? new Date(e.started_at).toLocaleString('pt-BR') : '—'}
                        {e.duration_ms ? ` · ⏱ ${(e.duration_ms/1000).toFixed(0)}s` : ''}
                      </p>
                    </div>
                    <span className={`badge ${statusCls(e.status)}`}>{statusLabel(e.status)}</span>
                  </div>
                  {/* Repetir button row */}
                  {(e.status === 'passed' || e.status === 'failed' || e.status === 'stopped') && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '6px 14px', display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => { onClose(); onRepeat(project, e) }}
                        style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'rgba(124,58,237,0.18)', color: 'var(--primary-l)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ↺ Repetir com mesmos parâmetros
                      </button>
                      <button
                        onClick={() => { onClose(); onExecutar(project) }}
                        style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        + Novo teste
                      </button>
                    </div>
                  )}
                  {e.status === 'running' && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '6px 14px' }}>
                      <button
                        onClick={() => { onClose(); onExecutar(project, e.id) }}
                        style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, background: 'rgba(251,191,36,0.15)', color: 'var(--warning)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        ▶ Ver ao vivo
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Selected execution detail */}
          {selected && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                Detalhes: {selected.flow_name || 'Auditoria IA'}
              </p>

              {/* Stats row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Steps OK',  value: selected.passed_steps ?? '—',  color: 'var(--success)' },
                  { label: 'Falhou',    value: selected.failed_steps ?? '—',  color: 'var(--danger)'  },
                  { label: 'Total',     value: selected.total_steps  ?? '—',  color: 'var(--muted)'   },
                ].map(s => (
                  <div key={s.label} className="card" style={{ flex: 1, padding: '10px 14px', textAlign: 'center', minWidth: 70 }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</p>
                    <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Findings */}
              {selected.findings.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Issues Encontrados</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selected.findings.map((f, i) => (
                      <div key={i} className={`finding ${f.type}`}>
                        <span className={`finding-type ${f.type}`}>{issueLabels[f.type]}</span>
                        <p className="finding-title">{f.title}</p>
                        {f.desc && <p className="finding-desc">{f.desc}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {selected.suggestions.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>Sugestões</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selected.suggestions.map((s, i) => (
                      <div key={i} className="suggestion-row">
                        <span style={{ color: 'var(--success)', fontWeight: 700, flexShrink: 0 }}>→</span>
                        <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps with screenshots */}
              {(selectedSteps.length > 0 || stepsLoading) && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Steps Executados
                  </p>
                  {stepsLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
                      <div className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-l)' }}/>
                      <span style={{ fontSize: 12, color: 'var(--faint)' }}>Carregando steps...</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {selectedSteps.map((s, i) => {
                        const hasScreenshot = !!s.screenshot_path
                        const screenshotUrl = hasScreenshot ? api.fileUrl(s.screenshot_path) : null
                        return (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                            borderRadius: 8, background: 'rgba(255,255,255,0.02)',
                            border: `1px solid ${s.status === 'passed' ? 'rgba(52,211,153,0.15)' : s.status === 'failed' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)'}`,
                          }}>
                            <span style={{ fontSize: 13, flexShrink: 0 }}>
                              {s.status === 'passed' ? '✅' : s.status === 'failed' ? '❌' : '⏳'}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, color: s.status === 'passed' ? 'var(--success)' : s.status === 'failed' ? 'var(--danger)' : 'var(--muted)', fontWeight: 600 }} className="truncate">
                                {s.name}
                              </p>
                              {s.error_message && (
                                <p style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2, opacity: 0.85 }} className="line-clamp-2">
                                  {s.error_message}
                                </p>
                              )}
                              {s.duration_ms > 0 && (
                                <p style={{ fontSize: 10, color: 'var(--faint)', marginTop: 1 }}>⏱ {s.duration_ms}ms</p>
                              )}
                            </div>
                            {screenshotUrl && (
                              <button
                                onClick={() => setLightbox(screenshotUrl)}
                                title="Ver screenshot do erro"
                                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                <img
                                  src={screenshotUrl}
                                  alt="screenshot"
                                  style={{ width: 52, height: 36, objectFit: 'cover', borderRadius: 5,
                                           border: '2px solid rgba(248,113,113,0.5)' }}
                                />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Screenshots from findings */}
              {selected.findings.some(f => f.screenshot) && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Screenshots Capturados
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selected.findings.filter(f => f.screenshot).map((f, i) => {
                      const src = f.screenshot.startsWith('/files/') ? api.fileUrl(f.screenshot.replace('/files/', '')) : f.screenshot
                      return (
                        <button key={i} onClick={() => setLightbox(src)}
                          title={f.title}
                          style={{ background: 'none', border: '2px solid rgba(124,58,237,0.3)', borderRadius: 8, cursor: 'pointer', padding: 2 }}>
                          <img src={src} alt={f.title} style={{ width: 80, height: 56, objectFit: 'cover', borderRadius: 6, display: 'block' }}/>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* PDF download */}
              {selected.status !== 'running' && selected.status !== 'pending' && (
                <a href={api.reportPdfUrl(selected.id)} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-full">
                  📥 Baixar PDF desta execução
                </a>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

export default function Projetos() {
  const navigate = useNavigate()
  const { backendOnline } = useContext(TesterContext)
  const [projects, setProjects]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [showCreate, setShowCreate]     = useState(false)
  const [form, setForm]                 = useState({ name: '', description: '', base_url: '' })
  const [saving, setSaving]             = useState(false)
  const [detailProject, setDetailProject] = useState(null)

  useEffect(() => { loadProjects() }, [])

  const loadProjects = async () => {
    if (!backendOnline) { setLoading(false); return }
    setLoading(true)
    try { setProjects(await api.getProjects()) }
    catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const createProject = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      const p = await api.createProject(form)
      setProjects(prev => [p, ...prev])
      setShowCreate(false)
      setForm({ name: '', description: '', base_url: '' })
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  const deleteProject = async (id) => {
    if (!confirm('Excluir este projeto e todos os dados associados?')) return
    try { await api.deleteProject(id); setProjects(prev => prev.filter(p => p.id !== id)) }
    catch (err) { alert(err.message) }
  }

  // Navigate to automação, optionally resuming a running execution
  const handleExecutar = (p, runningExecId = null) => {
    const saved = (() => { try { return JSON.parse(localStorage.getItem(`qatry_lastrun_${p.id}`)) } catch { return null } })()
    navigate('/automacao', { state: {
      url:          saved?.url      || p.base_url || '',
      testName:     saved?.testName || '',
      checks:       saved?.checks   || ['nav', 'a11y', 'seo', 'sec'],
      projectId:    p.id,
      resumeExecId: runningExecId || null,
    }})
  }

  // Repeat an execution with the same URL/name/projectId
  const handleRepeat = (p, exec) => {
    navigate('/automacao', { state: {
      url:       exec.base_url || p.base_url || '',
      testName:  exec.flow_name || '',
      checks:    ['nav', 'a11y', 'seo', 'sec'],
      projectId: p.id,
    }})
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.base_url || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page animate-fade-in">
      <div className="page-hdr" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <h1>Projetos</h1>
          <p>Gerencie seus projetos de automação QA</p>
        </div>
        <button onClick={() => backendOnline ? setShowCreate(true) : alert('Backend offline.')} className="btn btn-primary">
          + Novo Projeto
        </button>
      </div>

      {!backendOnline && (
        <div className="alert-warn mb-6" style={{ borderRadius: 12, padding: 20 }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning)' }}>Backend offline</p>
            <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>
              Execute <code style={{ color: 'var(--primary-l)' }}>npm run dev</code> na pasta{' '}
              <code style={{ color: 'var(--primary-l)' }}>backend/</code> para habilitar projetos reais.
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="search-wrap mb-6">
        <span className="search-icon">🔍</span>
        <input className="input search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar projeto..."/>
      </div>

      {/* Mini stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',     value: projects.length,                                              color: 'var(--bright)'    },
          { label: 'Com flows', value: projects.filter(p => p.flow_count > 0).length,               color: 'var(--primary-l)' },
          { label: 'Execuções', value: projects.reduce((s, p) => s + (p.execution_count || 0), 0),  color: 'var(--cyan)'      },
        ].map(s => (
          <div key={s.label} className="stat-pill">
            <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 13, color: 'var(--faint)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="empty-state">
          <div className="spinner spinner-md" style={{ marginBottom: 12 }}/>
          <p style={{ fontSize: 14, color: 'var(--faint)' }}>Carregando projetos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <p style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 4 }}>
            {search ? 'Nenhum projeto encontrado' : 'Nenhum projeto ainda'}
          </p>
          {!search && <p style={{ fontSize: 14, color: 'var(--faint)' }}>Crie seu primeiro projeto para começar</p>}
        </div>
      ) : (
        <div className="proj-grid">
          {filtered.map(p => (
            <div key={p.id} className="card proj-card">
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--bright)' }} className="truncate">{p.name}</h3>
                    {p.base_url && <p style={{ fontSize: 12, color: 'var(--faint)' }} className="truncate">🔗 {p.base_url}</p>}
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteProject(p.id) }} className="del-btn">✕</button>
                </div>

                {p.description && <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }} className="line-clamp-2">{p.description}</p>}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  <span className="badge badge-primary">{p.flow_count || 0} flow{(p.flow_count || 0) !== 1 ? 's' : ''}</span>
                  {p.execution_count > 0 && <span className="badge badge-cyan">{p.execution_count} exec</span>}
                  {p.running_count > 0 && <span className="badge badge-warning">▶ {p.running_count} rodando</span>}
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <div className="proj-stat"><span className="proj-stat-val c-success">{p.passed_count || 0}</span><span className="proj-stat-lbl">Passou</span></div>
                  <div className="proj-stat"><span className="proj-stat-val c-danger">{p.failed_count || 0}</span><span className="proj-stat-lbl">Falhou</span></div>
                  <div className="proj-stat"><span className="proj-stat-val c-muted">{(p.execution_count || 0) - (p.passed_count || 0) - (p.failed_count || 0)}</span><span className="proj-stat-lbl">Outros</span></div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setDetailProject(p)}
                    style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'rgba(124,58,237,0.2)', color: 'var(--primary-l)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
                    onMouseOver={e => e.target.style.background = 'rgba(124,58,237,0.3)'}
                    onMouseOut={e => e.target.style.background = 'rgba(124,58,237,0.2)'}>
                    Ver detalhes →
                  </button>
                  <button
                    onClick={() => handleExecutar(p)}
                    style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: 'var(--muted)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}
                    onMouseOver={e => e.target.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={e => e.target.style.background = 'rgba(255,255,255,0.05)'}>
                    🚀 Executar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="Novo Projeto" onClose={() => setShowCreate(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Nome do Projeto *</label>
              <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: E-commerce App"/>
            </div>
            <div className="form-group">
              <label className="form-label">URL Base</label>
              <input className="input" value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://minha-app.com"/>
            </div>
            <div className="form-group">
              <label className="form-label">Descrição</label>
              <textarea className="input" style={{ resize: 'none' }} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva o projeto..."/>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={createProject} disabled={!form.name || saving} className="btn btn-primary flex-1">
                {saving ? 'Criando...' : 'Criar Projeto'}
              </button>
              <button onClick={() => setShowCreate(false)} className="btn btn-secondary">Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {detailProject && (
        <ProjectDetail
          project={detailProject}
          onClose={() => setDetailProject(null)}
          onExecutar={handleExecutar}
          onRepeat={handleRepeat}
        />
      )}
    </div>
  )
}
