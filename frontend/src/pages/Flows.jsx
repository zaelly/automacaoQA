import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { TesterContext } from '../context/TesterContext'
import { api } from '../services/api'

const CATEGORY_COLORS = {
  'Autenticação': '#7c3aed',
  'Clientes':     '#0891b2',
  'Vendas':       '#059669',
  'Fiscal':       '#d97706',
  'Pagamentos':   '#dc2626',
  'Utilitários':  '#6366f1',
}

function TemplateCard({ tpl, onUse }) {
  const color = CATEGORY_COLORS[tpl.category] || '#6366f1'
  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', transition: 'border-color 0.15s' }}
      onMouseOver={e => e.currentTarget.style.borderColor = `${color}55`}
      onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>{tpl.icon}</span>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--bright)' }}>{tpl.name}</p>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: `${color}22`, color, fontWeight: 600 }}>{tpl.category}</span>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>{tpl.description}</p>
      <button onClick={() => onUse(tpl)}
        style={{ padding: '7px 0', borderRadius: 8, background: `${color}22`, color, fontSize: 12, fontWeight: 700, border: `1px solid ${color}44`, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background 0.15s' }}
        onMouseOver={e => e.currentTarget.style.background = `${color}40`}
        onMouseOut={e => e.currentTarget.style.background = `${color}22`}>
        + Usar este template
      </button>
    </div>
  )
}

function FlowEditor({ flow, projects, onSave, onCancel, onRun }) {
  const [name, setName]               = useState(flow?.name || '')
  const [description, setDescription] = useState(flow?.description || '')
  const [projectId, setProjectId]     = useState(flow?.project_id || projects[0]?.id || '')
  const [script, setScript]           = useState(flow?.script || '')
  const [saving, setSaving]           = useState(false)
  const [running, setRunning]         = useState(false)

  const handleSave = async () => {
    if (!name || !projectId) return
    setSaving(true)
    try { await onSave({ name, description, project_id: projectId, script }) }
    finally { setSaving(false) }
  }

  const handleRun = async () => {
    if (!flow?.id) { alert('Salve o flow antes de executar.'); return }
    setRunning(true)
    try { await onRun(flow) }
    finally { setRunning(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div className="form-group flex-1" style={{ marginBottom: 0, minWidth: 200 }}>
          <label className="form-label">Nome do Flow *</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Login, Criar Pedido..."/>
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 180 }}>
          <label className="form-label">Projeto *</label>
          <select className="input" value={projectId} onChange={e => setProjectId(e.target.value)}>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">Descrição <span style={{ fontWeight: 400, color: 'var(--faint)' }}>(opcional)</span></label>
        <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="O que este flow testa?"/>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>Script Playwright</label>
          <span style={{ fontSize: 11, color: 'var(--faint)' }}>Use <code style={{ color: 'var(--primary-l)' }}>step(nome, fn)</code> para cada etapa</span>
        </div>
        <textarea
          className="input"
          value={script}
          onChange={e => setScript(e.target.value)}
          rows={20}
          spellCheck={false}
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace", fontSize: 12.5, lineHeight: 1.6, resize: 'vertical', minHeight: 340, background: '#0d0a1e', color: '#e2e8f0', whiteSpace: 'pre', overflowX: 'auto' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={handleSave} disabled={!name || !projectId || saving} className="btn btn-primary">
          {saving ? 'Salvando...' : '💾 Salvar Flow'}
        </button>
        {flow?.id && (
          <button onClick={handleRun} disabled={running} className="btn btn-secondary">
            {running ? '⏳ Iniciando...' : '▶ Executar Agora'}
          </button>
        )}
        <button onClick={onCancel} className="btn btn-secondary" style={{ marginLeft: 'auto' }}>Cancelar</button>
      </div>
    </div>
  )
}

export default function Flows() {
  const navigate = useNavigate()
  const { backendOnline } = useContext(TesterContext)

  const [projects, setProjects]     = useState([])
  const [flows, setFlows]           = useState([])
  const [templates, setTemplates]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [selectedProject, setSelectedProject] = useState('all')
  const [view, setView]             = useState('list') // list | editor | templates
  const [editingFlow, setEditingFlow]         = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [search, setSearch]         = useState('')
  const [templateSearch, setTemplateSearch] = useState('')

  useEffect(() => {
    if (!backendOnline) { setLoading(false); return }
    Promise.all([
      api.getProjects(),
      api.getFlows ? api.getFlows() : fetch('/api/flows').then(r => r.json()),
      fetch(`${(import.meta.env.VITE_API_URL || 'http://localhost:5005/api')}/flows/templates`).then(r => r.json()),
    ]).then(([projs, fls, tpls]) => {
      setProjects(projs || [])
      setFlows(fls || [])
      setTemplates(tpls || [])
      if (projs?.length > 0) setSelectedProject('all')
    }).catch(console.error).finally(() => setLoading(false))
  }, [backendOnline])

  const loadFlows = async () => {
    try {
      const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5005/api'}/flows`
      const fls = await fetch(url).then(r => r.json())
      setFlows(fls || [])
    } catch (e) { console.error(e) }
  }

  const handleSaveFlow = async (data) => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5005/api'
    try {
      if (editingFlow?.id) {
        await fetch(`${apiBase}/flows/${editingFlow.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      } else {
        const body = { ...data, ...(selectedTemplate ? { template_id: selectedTemplate.id } : {}) }
        await fetch(`${apiBase}/flows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      }
      await loadFlows()
      setView('list')
      setEditingFlow(null)
      setSelectedTemplate(null)
    } catch (err) { alert('Erro ao salvar: ' + err.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Excluir este flow?')) return
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5005/api'
    try {
      await fetch(`${apiBase}/flows/${id}`, { method: 'DELETE' })
      setFlows(prev => prev.filter(f => f.id !== id))
    } catch (err) { alert('Erro ao excluir: ' + err.message) }
  }

  const handleRun = (flow) => {
    const project = projects.find(p => p.id === flow.project_id)
    navigate('/automacao', {
      state: {
        url:       project?.base_url || '',
        flowId:    flow.id,
        testName:  flow.name,
        projectId: flow.project_id,
      }
    })
  }

  const useTemplate = (tpl) => {
    setSelectedTemplate(tpl)
    setEditingFlow({ name: tpl.name, description: tpl.description, script: tpl.script, project_id: projects[0]?.id || '' })
    setView('editor')
  }

  const filteredFlows = flows.filter(f => {
    const matchProject = selectedProject === 'all' || f.project_id === selectedProject
    const matchSearch  = !search || f.name.toLowerCase().includes(search.toLowerCase()) || (f.description || '').toLowerCase().includes(search.toLowerCase())
    return matchProject && matchSearch
  })

  const groupedTemplates = templates.reduce((acc, tpl) => {
    if (!acc[tpl.category]) acc[tpl.category] = []
    acc[tpl.category].push(tpl)
    return acc
  }, {})

  const filteredTemplates = templateSearch
    ? templates.filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()) || t.description.toLowerCase().includes(templateSearch.toLowerCase()) || t.category.toLowerCase().includes(templateSearch.toLowerCase()))
    : null

  if (!backendOnline) {
    return (
      <div className="page animate-fade-in">
        <div className="page-hdr"><h1>Flows</h1><p>Gerencie seus scripts de automação Playwright</p></div>
        <div className="alert-warn" style={{ borderRadius: 12, padding: 20 }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning)' }}>Backend offline</p>
            <p style={{ fontSize: 12, color: 'rgba(251,191,36,0.7)', marginTop: 2 }}>Execute <code>npm run dev</code> na pasta backend/ para gerenciar flows.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page animate-fade-in">
      <div className="page-hdr" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>Flows de Automação</h1>
          <p>Scripts Playwright para testar fluxos completos da sua aplicação</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => { setView('templates'); setEditingFlow(null); setSelectedTemplate(null) }}
            className="btn btn-secondary" style={{ gap: 6 }}>
            📋 Templates
          </button>
          <button onClick={() => { setView('editor'); setEditingFlow(null); setSelectedTemplate(null) }}
            className="btn btn-primary">
            + Novo Flow
          </button>
        </div>
      </div>

      {/* ── Templates view ─────────────────────────────────────────────────── */}
      {view === 'templates' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              ← Voltar
            </button>
            <div className="search-wrap flex-1" style={{ maxWidth: 400 }}>
              <span className="search-icon">🔍</span>
              <input className="input search-input" value={templateSearch} onChange={e => setTemplateSearch(e.target.value)} placeholder="Buscar template..."/>
            </div>
          </div>

          {filteredTemplates ? (
            <div className="proj-grid">
              {filteredTemplates.map(tpl => <TemplateCard key={tpl.id} tpl={tpl} onUse={useTemplate}/>)}
            </div>
          ) : (
            Object.entries(groupedTemplates).map(([cat, tpls]) => (
              <div key={cat} style={{ marginBottom: 28 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                  <span style={{ marginRight: 6 }}>●</span>{cat}
                </p>
                <div className="proj-grid">
                  {tpls.map(tpl => <TemplateCard key={tpl.id} tpl={tpl} onUse={useTemplate}/>)}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Editor view ────────────────────────────────────────────────────── */}
      {view === 'editor' && (
        <div className="card p-8">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <button onClick={() => { setView('list'); setEditingFlow(null); setSelectedTemplate(null) }}
              style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 13 }}>
              ← Voltar
            </button>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--bright)' }}>
              {editingFlow?.id ? `Editando: ${editingFlow.name}` : selectedTemplate ? `Novo Flow — ${selectedTemplate.name}` : 'Novo Flow'}
            </h2>
            {selectedTemplate && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: 'rgba(124,58,237,0.2)', color: 'var(--primary-l)', fontWeight: 600 }}>
                {selectedTemplate.icon} {selectedTemplate.category}
              </span>
            )}
          </div>
          {projects.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📁</div>
              <p style={{ color: 'var(--muted)' }}>Crie um projeto primeiro para adicionar flows</p>
              <button onClick={() => navigate('/projetos')} className="btn btn-primary" style={{ marginTop: 12 }}>Ir para Projetos</button>
            </div>
          ) : (
            <FlowEditor
              flow={editingFlow}
              projects={projects}
              onSave={handleSaveFlow}
              onCancel={() => { setView('list'); setEditingFlow(null); setSelectedTemplate(null) }}
              onRun={handleRun}
            />
          )}
        </div>
      )}

      {/* ── List view ──────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div className="search-wrap" style={{ flex: 1, minWidth: 200 }}>
              <span className="search-icon">🔍</span>
              <input className="input search-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar flow..."/>
            </div>
            <select className="input" style={{ maxWidth: 240 }} value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
              <option value="all">Todos os projetos</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Total de Flows',  value: flows.length,    color: 'var(--bright)'    },
              { label: 'Projetos',        value: projects.length, color: 'var(--primary-l)' },
              { label: 'Templates disp.', value: templates.length, color: 'var(--cyan)'     },
            ].map(s => (
              <div key={s.label} className="stat-pill">
                <span style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 13, color: 'var(--faint)' }}>{s.label}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="empty-state"><div className="spinner spinner-md" style={{ marginBottom: 12 }}/><p style={{ color: 'var(--faint)' }}>Carregando flows...</p></div>
          ) : filteredFlows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚡</div>
              <p style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 4 }}>
                {search ? 'Nenhum flow encontrado' : 'Nenhum flow ainda'}
              </p>
              {!search && (
                <>
                  <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 16 }}>Comece com um template pronto ou crie do zero</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setView('templates')} className="btn btn-primary">📋 Ver Templates</button>
                    <button onClick={() => { setView('editor'); setEditingFlow(null) }} className="btn btn-secondary">+ Novo Flow</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredFlows.map(f => {
                const project = projects.find(p => p.id === f.project_id)
                return (
                  <div key={f.id} className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary), var(--cyan))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      ⚡
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--bright)' }}>{f.name}</p>
                        {project && <span className="badge badge-primary">{project.name}</span>}
                      </div>
                      {f.description && <p style={{ fontSize: 12, color: 'var(--faint)' }} className="truncate">{f.description}</p>}
                      {f.updated_at && <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>Atualizado: {new Date(f.updated_at).toLocaleString('pt-BR')}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                      <button onClick={() => handleRun(f)}
                        style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(52,211,153,0.15)', color: 'var(--success)', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        ▶ Executar
                      </button>
                      <button onClick={() => { setEditingFlow(f); setView('editor') }}
                        style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(124,58,237,0.2)', color: 'var(--primary-l)', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        ✏️ Editar
                      </button>
                      <button onClick={() => handleDelete(f.id)}
                        style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.12)', color: 'var(--danger)', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'var(--font)' }}>
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
