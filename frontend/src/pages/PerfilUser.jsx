import { useContext, useState } from 'react'
import { TesterContext } from '../context/TesterContext'

export default function PerfilUser() {
  const { tester, mockUser, mockStats, mockHistory, reports } = useContext(TesterContext)
  const user = tester || mockUser
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(user.name)
  const [editRole, setEditRole] = useState(user.role)
  const [activeTab, setActiveTab] = useState('history')

  const completedReports = reports.filter(r => r.status === 'completo')
  const avgScore = completedReports.length
    ? Math.round(completedReports.reduce((a, r) => a + r.score, 0) / completedReports.length)
    : 0

  return (
    <div className="py-8 px-10 max-w-250">

      <div className="animate-fade-in mb-8">
        <h1 className="text-[28px] font-extrabold text-bright mb-1">Meu Perfil</h1>
        <p className="text-[15px] text-muted">Gerencie suas informações e acompanhe seu histórico</p>
      </div>

      {/* Profile card */}
      <div className="card animate-fade-in p-8 mb-6 flex items-start gap-7 flex-wrap">
        <div className="w-21 h-21 rounded-full bg-linear-to-br from-primary to-purple-400 flex items-center justify-center text-[28px] font-extrabold text-white shrink-0"
          style={{ boxShadow: '0 0 24px rgba(124,58,237,0.3)' }}>
          {(user.initials || user.name?.slice(0,2) || 'ZB').toUpperCase()}
        </div>

        <div className="flex-1 min-w-50">
          {editing ? (
            <div className="flex flex-col gap-2.5 max-w-90">
              <input className="input-field text-sm py-2 px-3" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome completo"/>
              <input className="input-field text-sm py-2 px-3" value={editRole} onChange={e => setEditRole(e.target.value)} placeholder="Cargo / Função"/>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setEditing(false)} className="py-1.5 px-4 rounded-lg bg-primary text-white text-[13px] font-semibold border-none cursor-pointer hover:bg-primary-hover transition-all duration-200">Salvar</button>
                <button onClick={() => setEditing(false)} className="py-1.5 px-4 rounded-lg bg-transparent text-muted text-[13px] font-medium border border-white/8 cursor-pointer hover:text-bright transition-all duration-200">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-[22px] font-extrabold text-bright mb-1">{editName}</h2>
              <p className="text-sm font-semibold text-primary-light mb-1.5">{editRole}</p>
              <p className="text-[13px] text-faint mb-3">📧 {user.email} · Membro desde {user.joinDate}</p>
              <button onClick={() => setEditing(true)} className="py-1.5 px-4 rounded-lg bg-transparent text-muted text-[13px] font-medium border border-white/8 cursor-pointer hover:border-primary-light hover:text-primary-light transition-all duration-200">
                ✏️ Editar Perfil
              </button>
            </>
          )}
        </div>

        <div className="flex gap-7 flex-wrap">
          {[
            { label: 'Relatórios', value: reports.length },
            { label: 'Score médio', value: `${avgScore}%` },
            { label: 'Issues resolvidos', value: '47' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-2xl font-extrabold text-primary-light">{s.value}</p>
              <p className="text-xs text-faint mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="animate-fade-in grid grid-cols-3 gap-4 mb-7" style={{ animationDelay: '0.1s' }}>
        {[
          { label: 'Projetos Iniciados', value: mockStats.iniciados,   color: 'text-warning', icon: '🟡' },
          { label: 'Em Andamento',       value: mockStats.emAndamento, color: 'text-cyan',    icon: '⚡' },
          { label: 'Projetos Completos', value: mockStats.completos,   color: 'text-success', icon: '✅' },
        ].map(s => (
          <div key={s.label} className="card p-6 text-center">
            <div className="text-[28px] mb-2.5">{s.icon}</div>
            <p className={`text-4xl font-extrabold leading-none ${s.color}`}>{s.value}</p>
            <p className="text-[13px] text-muted mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
        <div className="flex gap-1 border-b border-white/8 mb-5">
          {[['history', 'Histórico de Atividades'], ['reports', 'Relatórios Completos']].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-5 py-2.5 border-none bg-transparent cursor-pointer text-sm font-semibold transition-all duration-150 -mb-px
                ${activeTab === key
                  ? 'text-primary-light border-b-2 border-primary'
                  : 'text-faint border-b-2 border-transparent hover:text-muted'}`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'history' && (
          <div className="card overflow-hidden">
            {mockHistory.map((item, i) => (
              <div key={item.id}
                className={`flex items-center gap-4 px-5 py-3.5 transition-all duration-150 hover:bg-white/3 ${i < mockHistory.length - 1 ? 'border-b border-white/8' : ''}`}>
                <span className="text-[22px]">{item.type === 'report' ? '📄' : '📁'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-bright">{item.title}</p>
                  <p className="text-xs text-faint mt-0.5">{item.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge badge-purple">Score: {item.score}%</span>
                  <span className="badge badge-green">Completo</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="flex flex-col gap-3">
            {completedReports.map(r => {
              const scoreColor = r.score >= 85 ? 'text-success' : r.score >= 70 ? 'text-warning' : 'text-danger'
              const scoreBg    = r.score >= 85 ? 'bg-success/15' : r.score >= 70 ? 'bg-warning/15' : 'bg-danger/15'
              return (
                <div key={r.id} className="card p-4 flex items-center gap-4">
                  <div className={`w-13 h-13 rounded-xl ${scoreBg} flex items-center justify-center text-base font-extrabold ${scoreColor} shrink-0`}>
                    {r.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-bright truncate">{r.title}</p>
                    <p className="text-xs text-faint mt-0.5">{r.url} · {r.date}</p>
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {r.issues.critical > 0 && <span className="badge badge-red">🔴 {r.issues.critical}</span>}
                    {r.issues.warning  > 0 && <span className="badge badge-yellow">🟡 {r.issues.warning}</span>}
                    {r.issues.info     > 0 && <span className="badge badge-cyan">🔵 {r.issues.info}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
