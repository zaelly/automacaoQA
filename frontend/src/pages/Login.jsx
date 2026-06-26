import { useState, useContext } from 'react'
import { toast } from 'react-toastify'
import { TesterContext } from '../context/TesterContext'
import { api } from '../services/api'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const { handleLogin, backendOnline } = useContext(TesterContext)

  const handle = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const demoLogin = async () => {
    await new Promise(r => setTimeout(r, 700))
    handleLogin({
      id: 'demo',
      name: form.name || 'Zaelly Barbosa',
      email: form.email || 'demo@qatry.com',
      role: 'QA Engineer',
      created_at: new Date().toISOString(),
    })
    toast.success('Modo demo ativo')
  }

  const submit = async (e) => {
    e.preventDefault()

    if (!form.email || !form.password) { toast.error('Preencha todos os campos'); return }
    if (mode === 'register') {
      if (!form.name.trim())            { toast.error('Informe seu nome'); return }
      if (form.password.length < 6)     { toast.error('A senha precisa ter ao menos 6 caracteres'); return }
      if (form.password !== form.confirm){ toast.error('As senhas não coincidem'); return }
    }

    setLoading(true)
    try {
      if (backendOnline) {
        const result = mode === 'register'
          ? await api.register({ name: form.name, email: form.email, password: form.password })
          : await api.login({ email: form.email, password: form.password })

        api.setToken(result.token)
        handleLogin(result.user)
        toast.success(mode === 'login' ? 'Bem-vinda de volta! 🚀' : 'Conta criada com sucesso! 🎉')
      } else {
        await demoLogin()
      }
    } catch (err) {
      // Rota de auth não existe ainda (backend não reiniciado) → modo demo
      if (err.message.includes('404') || err.message.includes('Not Found') || err.message.includes('Erro na requisição')) {
        toast.warning('Rotas de auth não encontradas — entrando em modo demo. Reinicie o backend.')
        await demoLogin()
      } else {
        toast.error(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-app relative overflow-hidden">
      {/* Orbs decorativos */}
      <div className="orb orb-purple" style={{ width: 500, height: 500, top: -100, left: -100, opacity: 0.35 }} />
      <div className="orb orb-cyan"   style={{ width: 300, height: 300, bottom: 40,  right: 160,  opacity: 0.2 }} />

      {/* ── Painel esquerdo ─────────────────────────────────────────── */}
      <div className="flex-1 hidden lg:flex flex-col justify-center px-16 py-16 relative z-10
                      border-r border-white/6
                      bg-[linear-gradient(135deg,rgba(124,58,237,0.09)_0%,transparent_70%)]">
        <div className="max-w-md">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-14">
            <div className="w-10 h-10 rounded-[12px] bg-linear-to-br from-primary to-cyan
                            flex items-center justify-center text-xl font-extrabold text-white"
              style={{ boxShadow: '0 4px 18px rgba(124,58,237,0.35)' }}>
              Q
            </div>
            <span className="text-2xl font-extrabold text-bright tracking-tight">QATry</span>
          </div>

          <h2 className="text-[42px] font-black text-bright leading-[1.15] mb-5">
            Automação de QA<br />
            <span className="gradient-text">inteligente e rápida</span>
          </h2>
          <p className="text-muted text-[15px] leading-[1.75] mb-12">
            Teste suas aplicações como um QA experiente. Cole a URL, selecione os testes e receba um relatório completo em minutos.
          </p>

          <div className="flex flex-col gap-3.5">
            {[
              'Detecta bugs críticos automaticamente',
              'Relatórios detalhados com priorização',
              'Score de qualidade por auditoria',
              'Histórico completo de projetos',
            ].map(item => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-success/15 border border-success/60
                                flex items-center justify-center shrink-0">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-[14px] text-muted">{item}</span>
              </div>
            ))}
          </div>

          {/* Status do servidor */}
          <div className="mt-14 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full shrink-0 ${backendOnline ? 'bg-success' : 'bg-faint'}`}
              style={backendOnline ? { boxShadow: '0 0 6px #34d399' } : {}} />
            <span className="text-[12px] text-faint">
              {backendOnline ? 'Servidor online' : 'Servidor offline — modo demo'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Painel direito — formulário ──────────────────────────────── */}
      <div className="w-full lg:w-[500px] shrink-0 flex flex-col justify-center
                      px-6 sm:px-10 lg:px-0 py-10 relative z-10">

        {/* Container centralizado com espaço interno */}
        <div className="animate-fade-in w-full lg:max-w-[400px] lg:mx-auto px-0 lg:px-0">

          {/* Logo mobile */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-[10px] bg-linear-to-br from-primary to-cyan
                            flex items-center justify-center text-lg font-extrabold text-white">Q</div>
            <span className="text-xl font-extrabold text-bright">QATry</span>
          </div>

          {/* Toggle Entrar / Cadastrar */}
          <div className="flex bg-white/5 rounded-2xl p-1 mb-8 border border-white/6">
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold
                            transition-all duration-200 border-none cursor-pointer
                  ${mode === m
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-transparent text-muted hover:text-bright'}`}>
                {m === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          {/* Título */}
          <h3 className="text-[26px] font-extrabold text-bright mb-1.5">
            {mode === 'login' ? 'Bem-vinda de volta 👋' : 'Crie sua conta'}
          </h3>
          <p className="text-[14px] text-faint mb-7">
            {mode === 'login'
              ? 'Entre na sua conta para continuar'
              : 'Comece a automatizar seus testes hoje'}
          </p>

          {/* Botão Google */}
          <button type="button"
            className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-bright text-[14px]
                       font-medium cursor-pointer flex items-center justify-center gap-3 mb-5
                       transition-all duration-200 hover:bg-white/10 hover:border-white/20">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </button>

          {/* Separador */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-xs text-faint px-1">ou com email</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Formulário */}
          <form onSubmit={submit} className="flex flex-col gap-4">

            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-muted">Nome completo</label>
                <input className="input-field" name="name" value={form.name}
                  onChange={handle} placeholder="Seu nome" autoComplete="name" />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-muted">Email</label>
              <input className="input-field" name="email" type="email" value={form.email}
                onChange={handle} placeholder="tester@exemplo.com" autoComplete="email" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-muted">Senha</label>
              <div className="relative">
                <input className="input-field" style={{ paddingRight: '44px' }}
                  name="password" type={showPass ? 'text' : 'password'}
                  value={form.password} onChange={handle} placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-faint
                             hover:text-muted transition-colors border-none bg-transparent cursor-pointer p-0.5">
                  {showPass
                    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                  }
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-semibold text-muted">Confirmar senha</label>
                <input className="input-field" name="confirm" type="password" value={form.confirm}
                  onChange={handle} placeholder="••••••••" autoComplete="new-password" />
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right -mt-1">
                <span className="text-[13px] text-primary-light cursor-pointer hover:underline">
                  Esqueceu a senha?
                </span>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3.5 mt-1 text-[15px]
                         disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none">
              {loading
                ? <span className="flex items-center justify-center gap-2.5">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                    {mode === 'login' ? 'Entrando...' : 'Criando conta...'}
                  </span>
                : mode === 'login' ? 'Entrar →' : 'Criar conta →'
              }
            </button>
          </form>

          {mode === 'register' && (
            <p className="text-[12px] text-faint text-center mt-5">
              Ao criar uma conta você concorda com os{' '}
              <span className="text-primary-light cursor-pointer hover:underline">Termos de Uso</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
