import { useState, useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { TesterContext } from '../context/TesterContext'
import { api } from '../services/api'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-200 flex items-center justify-center backdrop-blur-sm" onClick={onClose}>
      <div className="card p-7 w-full max-w-lg mx-4 animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-extrabold text-bright">{title}</h3>
          <button onClick={onClose} className="text-faint hover:text-bright text-xl bg-transparent border-none cursor-pointer">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FlowBadge({ count }) {
  return (
    <span className="badge badge-purple">{count} flow{count !== 1 ? 's' : ''}</span>
  )
}

export default function Projetos() {
  const navigate = useNavigate()
  const { backendOnline } = useContext(TesterContext)

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', base_url: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadProjects() }, [])

  const loadProjects = async () => {
    if (!backendOnline) { setLoading(false); return }
    setLoading(true)
    try {
      const data = await api.getProjects()
      setProjects(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const createProject = async () => {
    if (!form.name) return
    setSaving(true)
    try {
      const p = await api.createProject(form)
      setProjects(prev => [p, ...prev])
      setShowCreate(false)
      setForm({ name: '', description: '', base_url: '' })
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteProject = async (id) => {
    if (!confirm('Excluir este projeto e todos os dados associados?')) return
    try {
      await api.deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      alert(err.message)
    }
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.base_url || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="py-8 px-10 max-w-300 animate-fade-in">
      <div className="mb-7 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] font-extrabold text-bright mb-1">Projetos</h1>
          <p className="text-[15px] text-muted">Gerencie seus projetos de automação QA</p>
        </div>
        <button onClick={() => backendOnline ? setShowCreate(true) : alert('Backend offline. Inicie o servidor backend.')}
          className="btn-primary px-5 py-2.5 text-sm">
          + Novo Projeto
        </button>
      </div>

      {!backendOnline && (
        <div className="card p-5 mb-6 border-warning/30 bg-warning/5 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-warning">Backend offline</p>
            <p className="text-xs text-faint mt-0.5">Execute <code className="text-primary-light">npm run dev</code> na pasta <code className="text-primary-light">backend/</code> para habilitar projetos reais.</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint">🔍</span>
        <input className="input-field pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar projeto..."/>
      </div>

      {/* Stats row */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {[
          { label: 'Total', value: projects.length, color: 'text-bright' },
          { label: 'Com flows', value: projects.filter(p => p.flow_count > 0).length, color: 'text-primary-light' },
          { label: 'Execuções', value: projects.reduce((s, p) => s + (p.execution_count || 0), 0), color: 'text-cyan' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-white/4 border border-white/8">
            <span className={`text-lg font-extrabold ${s.color}`}>{s.value}</span>
            <span className="text-[13px] text-faint">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Project grid */}
      {loading ? (
        <div className="text-center py-16 text-faint">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin-slow mx-auto mb-3"/>
          <p>Carregando projetos...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-faint">
          <p className="text-5xl mb-3">📁</p>
          <p className="text-[15px] mb-1">{search ? 'Nenhum projeto encontrado' : 'Nenhum projeto ainda'}</p>
          {!search && <p className="text-sm">Crie seu primeiro projeto para começar</p>}
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {filtered.map(p => (
            <div key={p.id} className="card p-5 cursor-pointer group hover:border-primary/40"
              onClick={() => navigate(`/projetos/${p.id}`)}>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-linear-to-br from-primary to-cyan flex items-center justify-center text-lg font-extrabold text-white shrink-0">
                  {p.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-bold text-bright truncate">{p.name}</h3>
                  {p.base_url && <p className="text-xs text-faint truncate mt-0.5">🔗 {p.base_url}</p>}
                </div>
                <button onClick={e => { e.stopPropagation(); deleteProject(p.id) }}
                  className="opacity-0 group-hover:opacity-100 text-faint hover:text-danger text-sm bg-transparent border-none cursor-pointer transition-all">✕</button>
              </div>

              {p.description && <p className="text-[13px] text-muted mb-4 line-clamp-2">{p.description}</p>}

              <div className="flex items-center gap-2 flex-wrap mb-4">
                <FlowBadge count={p.flow_count || 0}/>
                {p.execution_count > 0 && (
                  <span className="badge badge-cyan">{p.execution_count} exec</span>
                )}
                {p.running_count > 0 && (
                  <span className="badge badge-yellow">▶ {p.running_count} rodando</span>
                )}
              </div>

              <div className="flex gap-2">
                <div className="flex-1 flex flex-col items-center p-2 rounded-lg bg-white/3">
                  <span className="text-success font-extrabold text-base">{p.passed_count || 0}</span>
                  <span className="text-[10px] text-faint">Passou</span>
                </div>
                <div className="flex-1 flex flex-col items-center p-2 rounded-lg bg-white/3">
                  <span className="text-danger font-extrabold text-base">{p.failed_count || 0}</span>
                  <span className="text-[10px] text-faint">Falhou</span>
                </div>
                <div className="flex-1 flex flex-col items-center p-2 rounded-lg bg-white/3">
                  <span className="text-muted font-extrabold text-base">{(p.execution_count || 0) - (p.passed_count || 0) - (p.failed_count || 0)}</span>
                  <span className="text-[10px] text-faint">Outros</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={e => { e.stopPropagation(); navigate(`/projetos/${p.id}`) }}
                  className="flex-1 py-2 rounded-lg bg-primary/20 text-primary-light text-xs font-semibold border-none cursor-pointer hover:bg-primary/30 transition-all">
                  Ver detalhes →
                </button>
                <button onClick={e => { e.stopPropagation(); navigate('/automacao') }}
                  className="py-2 px-3 rounded-lg bg-white/5 text-muted text-xs font-semibold border-none cursor-pointer hover:bg-white/10 transition-all">
                  🚀 Executar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Novo Projeto" onClose={() => setShowCreate(false)}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-[13px] font-semibold text-muted mb-1.5">Nome do Projeto *</label>
              <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: E-commerce App"/>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-muted mb-1.5">URL Base</label>
              <input className="input-field" value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://minha-app.com"/>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-muted mb-1.5">Descrição</label>
              <textarea className="input-field resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descreva o projeto..."/>
            </div>
            <div className="flex gap-2.5 mt-2">
              <button onClick={createProject} disabled={!form.name || saving}
                className="flex-1 py-3 rounded-[10px] bg-primary text-white text-sm font-semibold border-none cursor-pointer hover:bg-primary-hover disabled:opacity-50 transition-all">
                {saving ? 'Criando...' : 'Criar Projeto'}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="py-3 px-5 rounded-[10px] bg-transparent text-muted text-sm border border-white/8 cursor-pointer hover:border-white/20 transition-all">
                Cancelar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
