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

  const submit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { toast.error('Preencha todos os campos'); return }
    if (mode === 'register') {
      if (!form.name.trim())             { toast.error('Informe seu nome'); return }
      if (form.password.length < 6)      { toast.error('A senha precisa ter ao menos 6 caracteres'); return }
      if (form.password !== form.confirm) { toast.error('As senhas não coincidem'); return }
    }
    setLoading(true)
    try {
      const result = mode === 'register'
        ? await api.register({ name: form.name, email: form.email, password: form.password })
        : await api.login({ email: form.email, password: form.password })
      api.setToken(result.token)
      handleLogin(result.user)
      toast.success(mode === 'login' ? 'Bem-vinda de volta!' : 'Conta criada com sucesso!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Orbs */}
      <div style={{ position: 'absolute', width: 640, height: 640, top: -180, left: -180, borderRadius: '50%', background: 'rgba(124,58,237,0.2)', filter: 'blur(100px)', zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 380, height: 380, bottom: 0, right: 100, borderRadius: '50%', background: 'rgba(34,211,238,0.08)', filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none' }} />

      {/* ── Left panel ── */}
      <div className="login-left">
        <div style={{ maxWidth: 440 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 80 }}>
            <div className="login-logo-icon" style={{ width: 40, height: 40, fontSize: 20, boxShadow: '0 4px 20px rgba(124,58,237,0.45)' }}>Q</div>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--bright)', letterSpacing: '-0.3px' }}>QATry</span>
          </div>

          <h2 className="login-hl">
            Automação de QA<br />
            <span>inteligente</span>
          </h2>
          <p className="login-desc">
            Teste suas aplicações como um QA experiente. Cole a URL, execute a auditoria e receba um relatório completo em minutos.
          </p>

          <div className="login-features">
            {[
              'Detecta bugs críticos automaticamente',
              'Relatórios detalhados com priorização',
              'Score de qualidade por auditoria',
              'Histórico completo de projetos',
            ].map(item => (
              <div key={item} className="login-feat">
                <div className="login-feat-dot">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="login-feat-text">{item}</span>
              </div>
            ))}
          </div>

          <div className="login-status-row">
            <span className="login-status-dot" style={{
              background: backendOnline ? 'var(--success)' : 'var(--faint)',
              boxShadow: backendOnline ? '0 0 6px #34d399' : 'none',
            }} />
            <span style={{ fontSize: 12, color: 'var(--faint)' }}>
              {backendOnline ? 'Backend conectado' : 'Backend offline'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="login-right">
        <div className="login-inner">
          {/* Mobile logo */}
          <div className="login-logo-mobile">
            <div className="login-logo-icon" style={{ width: 36, height: 36, fontSize: 18 }}>Q</div>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--bright)' }}>QATry</span>
          </div>

          {/* Toggle */}
          <div className="login-toggle">
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => setMode(m)} className={'login-toggle-btn' + (mode === m ? ' active' : '')}>
                {m === 'login' ? 'Entrar' : 'Cadastrar'}
              </button>
            ))}
          </div>

          <h3 className="login-title">
            {mode === 'login' ? 'Bem-vinda de volta' : 'Crie sua conta'}
          </h3>
          <p className="login-sub">
            {mode === 'login' ? 'Entre na sua conta para continuar' : 'Comece a automatizar seus testes hoje'}
          </p>

          <form onSubmit={submit} className="login-form">
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Nome completo</label>
                <input className="input" name="name" value={form.name} onChange={handle} placeholder="Seu nome" autoComplete="name" />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="input" name="email" type="email" value={form.email} onChange={handle} placeholder="tester@exemplo.com" autoComplete="email" />
            </div>

            <div className="form-group">
              <label className="form-label">Senha</label>
              <div className="pw-wrap">
                <input className="input" style={{ paddingRight: 44 }}
                  name="password" type={showPass ? 'text' : 'password'}
                  value={form.password} onChange={handle} placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" onClick={() => setShowPass(v => !v)} className="pw-toggle">
                  {showPass
                    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                      </svg>
                  }
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Confirmar senha</label>
                <input className="input" name="confirm" type="password" value={form.confirm} onChange={handle} placeholder="••••••••" autoComplete="new-password" />
              </div>
            )}

            {mode === 'login' && (
              <span className="login-forgot">Esqueceu a senha?</span>
            )}

            {!backendOnline && (
              <div className="login-offline">
                <span style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }}>⚠</span>
                <p>Backend offline — inicie o servidor para fazer login</p>
              </div>
            )}

            <button type="submit" disabled={loading || !backendOnline} className="login-submit">
              {loading
                ? <><span className="spinner spinner-inline" />
                    {mode === 'login' ? 'Entrando...' : 'Criando conta...'}
                  </>
                : mode === 'login' ? 'Entrar →' : 'Criar conta →'
              }
            </button>
          </form>

          {mode === 'register' && (
            <p className="login-terms">
              Ao criar uma conta você concorda com os{' '}
              <span>Termos de Uso</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
