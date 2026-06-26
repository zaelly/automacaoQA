import './index.css'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useContext } from 'react'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { TesterContext } from './context/TesterContext'
import Sidebar from './components/Sidebar'

import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PerfilUser from './pages/PerfilUser'
import Relatorios from './pages/Relatorios'
import IniciarAutomacao from './pages/IniciarAutomacao'

function ProtectedLayout() {
  const { login } = useContext(TesterContext)
  const location = useLocation()

  if (!login) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, marginLeft: 'var(--sidebar-width)', minHeight: '100vh', background: 'var(--bg-base)' }}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/automacao" element={<IniciarAutomacao />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/perfil" element={<PerfilUser />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  const { login } = useContext(TesterContext)

  return (
    <>
      <ToastContainer theme="dark" position="top-right" toastStyle={{ background: '#1a1535', border: '1px solid rgba(124,58,237,0.3)' }} />
      <Routes>
        <Route path="/" element={login ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/login" element={login ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/*" element={<ProtectedLayout />} />
      </Routes>
    </>
  )
}

export default App