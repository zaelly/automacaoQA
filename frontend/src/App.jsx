import './index.css'
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useContext } from 'react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { TesterContext } from './context/TesterContext'
import Sidebar from './components/Sidebar'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PerfilUser from './pages/PerfilUser'
import Relatorios from './pages/Relatorios'
import IniciarAutomacao from './pages/IniciarAutomacao'
import Projetos from './pages/Projetos'

function ProtectedLayout() {
  const { login } = useContext(TesterContext)
  const location = useLocation()

  if (!login) {
    return <Navigate to="/" state={{ from: location }} replace />
  }

  return (
    <div className="min-h-screen bg-app">
      <Sidebar />
      <main className="min-h-screen bg-app overflow-x-hidden" style={{ marginLeft: '260px' }}>
        <Outlet />
      </main>
    </div>
  )
}

function App() {
  const { login } = useContext(TesterContext)

  return (
    <>
      <ToastContainer
        theme="dark"
        position="top-right"
        toastStyle={{
          background: '#1a1535',
          border: '1px solid rgba(124,58,237,0.3)',
          color: '#f1f5f9',
        }}
      />
      <Routes>
        <Route path="/" element={login ? <Navigate to="/dashboard" replace /> : <Login />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/projetos" element={<Projetos />} />
          <Route path="/automacao" element={<IniciarAutomacao />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/perfil" element={<PerfilUser />} />
        </Route>

        <Route path="*" element={<Navigate to={login ? '/dashboard' : '/'} replace />} />
      </Routes>
    </>
  )
}

export default App
