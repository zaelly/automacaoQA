import './App.css'
import Home from './pages/Home'
import Login from './pages/Login'
import Relatorios from './pages/Relatorios';
import Historico from './pages/Historico';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar';
import PerfilUser from './pages/PerfilUser';



function App() {
  return (
    <>
      <ToastContainer theme="dark" position="top-right" />
      <div className="min-h-screen">
        <div>
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/perfil" element={<PerfilUser />} />
          </Routes>
        </div>
      </div>
    </>
  )
}

export default App
