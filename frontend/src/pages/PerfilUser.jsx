import { useContext, useState } from 'react'
import { TesterContext } from '../context/TesterContext'

export default function PerfilUser() {
  const { tester, stats, reports, updateProfile } = useContext(TesterContext)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(tester?.name || '')
  const [editRole, setEditRole] = useState(tester?.role || 'QA Engineer')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('history')

  if (!tester) return null

  const completedReports = reports.filter(r => r.score)
  const avgScore = completedReports.length
    ? Math.round(completedReports.reduce((a, r) => a + r.score, 0) / completedReports.length) : 0
  const recentHistory = reports.slice(0, 5)

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({ name: editName, role: editRole })
    setSaving(false)
    setEditing(false)
  }

  const handleCancel = () => {
    setEditName(tester.name)
    setEditRole(tester.role || 'QA Engineer')
    setEditing(false)
  }

  return (
    <div className="page animate-fade-in" style={{ maxWidth: 1000 }}>
      <div className="page-hdr">
        <h1>Meu Perfil</h1>
        <p>Gerencie suas informações e acompanhe seu histórico</p>
      </div>

      {/* Profile card */}
      <div className="card profile-hdr">
        <div className="profile-avatar">
          {(tester.initials || tester.name?.slice(0, 2) || 'QA').toUpperCase()}
        </div>

        <div className="flex-1" style={{ minWidth: 192 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 384 }}>
              <input className="input" style={{ padding: '8px 12px', fontSize: 13 }} value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome completo"/>
              <input className="input" style={{ padding: '8px 12px', fontSize: 13 }} value={editRole} onChange={e => setEditRole(e.target.value)} placeholder="Cargo / Função"/>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button onClick={handleCancel} className="btn btn-secondary btn-sm">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--bright)', marginBottom: 2 }}>{tester.name}</h2>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--primary-l)', marginBottom: 4 }}>{tester.role || 'QA Engineer'}</p>
              <p style={{ fontSize: 13, color: 'var(--faint)', marginBottom: 12 }}>{tester.email} · Desde {tester.joinDate}</p>
              <button onClick={() => { setEditName(tester.name); setEditRole(tester.role || 'QA Engineer'); setEditing(true) }} className="btn btn-secondary btn-sm">✏️ Editar Perfil</button>
            </>
          )}
        </div>

        <div className="profile-stats">
          {[
            { label: 'Relatórios',  value: reports.length },
            { label: 'Score médio', value: avgScore ? `${avgScore}%` : '—' },
            { label: 'Completos',   value: stats.completos },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p className="profile-stat-val">{s.value}</p>
              <p className="profile-stat-lbl">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="profile-grid animate-fade-in" style={{ animationDelay: '0.1s' }}>
        {[
          { label: 'Pendentes',    value: stats.iniciados,   color: 'var(--warning)', accent: 'rgba(251,191,36,0.1)',  icon: '🟡' },
          { label: 'Em Andamento', value: stats.emAndamento, color: 'var(--cyan)',    accent: 'rgba(34,211,238,0.1)',  icon: '⚡' },
          { label: 'Completos',    value: stats.completos,   color: 'var(--success)', accent: 'rgba(52,211,153,0.1)',  icon: '✅' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 24, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${s.accent}, transparent)`, pointerEvents: 'none', borderRadius: 16 }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
              <p style={{ fontSize: 36, fontWeight: 800, lineHeight: 1, color: s.color }}>{s.value}</p>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
        <div className="tabs">
          {[['history', 'Histórico'], ['reports', 'Relatórios Completos']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)} className={`tab-btn${activeTab === key ? ' active' : ''}`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'history' && (
          <div className="card overflow-hidden">
            {recentHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhuma atividade ainda</p>
              </div>
            ) : (
              recentHistory.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', transition: 'background 0.15s', borderBottom: i < recentHistory.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div className="flex-1 min-w-0">
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--bright)' }} className="truncate">{item.title}</p>
                    <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{item.date} · {item.url}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {item.score && <span className="badge badge-primary">Score: {item.score}%</span>}
                    <span className={`badge ${item.status === 'completo' ? 'badge-success' : 'badge-warning'}`}>
                      {item.status === 'completo' ? 'Completo' : 'Em andamento'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {completedReports.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum relatório completo ainda</p>
              </div>
            ) : (
              completedReports.map(r => {
                const scoreColor = r.score >= 85 ? 'var(--success)' : r.score >= 70 ? 'var(--warning)' : 'var(--danger)'
                const scoreBg    = r.score >= 85 ? 'rgba(52,211,153,0.12)' : r.score >= 70 ? 'rgba(251,191,36,0.12)' : 'rgba(248,113,113,0.12)'
                return (
                  <div key={r.id} className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: scoreBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: scoreColor, flexShrink: 0 }}>
                      {r.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--bright)' }} className="truncate">{r.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{r.url} · {r.date}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0, alignItems: 'center' }}>
                      {r.issues.critical > 0 && <span className="badge badge-danger">🔴 {r.issues.critical}</span>}
                      {r.issues.warning  > 0 && <span className="badge badge-warning">🟡 {r.issues.warning}</span>}
                      {r.issues.info     > 0 && <span className="badge badge-cyan">🔵 {r.issues.info}</span>}
                      {r.pdfUrl && (
                        <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer"
                          style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(124,58,237,0.2)', color: 'var(--primary-l)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                          📥 PDF
                        </a>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
