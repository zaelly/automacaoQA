import { useContext } from 'react'
import { NavLink } from 'react-router-dom'
import { TesterContext } from '../context/TesterContext'

const IconDashboard = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
  </svg>
)

const IconRocket = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>
)

const IconDocument = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
)

const IconUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const IconLogout = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

const IconFolder = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
)

const navItems = [
  { to: '/dashboard',  label: 'Dashboard',         icon: <IconDashboard /> },
  { to: '/projetos',   label: 'Projetos',           icon: <IconFolder /> },
  { to: '/automacao',  label: 'Iniciar Automação',  icon: <IconRocket /> },
  { to: '/relatorios', label: 'Relatórios',          icon: <IconDocument /> },
  { to: '/perfil',     label: 'Meu Perfil',          icon: <IconUser /> },
]

export default function Sidebar() {
  const { tester, handleLogout, mockUser } = useContext(TesterContext)
  const user = tester || mockUser

  return (
    <aside className="fixed top-0 left-0 h-screen bg-sidebar border-r border-white/6 flex flex-col overflow-hidden" style={{ width: '260px', zIndex: 100 }}>

      {/* Logo */}
      <div className="px-6 py-7 border-b border-white/6">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[10px] bg-linear-to-br from-primary to-cyan flex items-center justify-center text-lg font-extrabold text-white shrink-0"
            style={{ boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}>
            Q
          </div>
          <span className="text-xl font-extrabold text-bright tracking-tight">QATry</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[11px] font-bold text-faint uppercase tracking-[1px] px-2 mb-2">Menu</p>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              'flex items-center gap-3 rounded-[10px] text-sm font-medium transition-all duration-150 mb-0.5 ' +
              (isActive
                ? 'bg-primary/20 text-primary-light border-l-[3px] border-primary py-2.75 pr-4 pl-3.25'
                : 'text-muted py-2.75 px-4 hover:bg-white/5 hover:text-bright')
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User card + logout */}
      <div className="p-3 border-t border-white/6">
        <div className="flex items-center gap-2.5 p-3 rounded-[10px] bg-white/3 mb-2">
          <div className="w-9 h-9 rounded-full bg-linear-to-br from-primary to-purple-400 flex items-center justify-center text-[13px] font-bold text-white shrink-0">
            {(user?.initials || user?.name?.slice(0, 2) || 'ZB').toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-bright truncate">{user?.name || 'Usuário'}</p>
            <p className="text-[11px] text-faint truncate">{user?.role || 'QA Engineer'}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-[10px] text-[13px] font-medium text-faint cursor-pointer transition-all duration-150 hover:bg-danger/10 hover:text-danger bg-transparent border-none"
        >
          <IconLogout /> Sair
        </button>
      </div>
    </aside>
  )
}
