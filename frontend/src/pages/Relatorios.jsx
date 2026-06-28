import { useContext, useState, useEffect, useCallback } from 'react'
import { TesterContext } from '../context/TesterContext'
import { api } from '../services/api'

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE   = import.meta.env.VITE_API_URL || 'http://localhost:5005/api'
const AGENT_FILES = BASE.replace('/api', '') + '/agent-files'

const issueColors = { critical: '#f87171', warning: '#fbbf24', info: '#22d3ee' }
const issueLabels = { critical: '🔴 Crítico', warning: '🟡 Aviso', info: '🔵 Info' }

const SEV = {
  critical: { label: 'Crítico', color: '#ef4444', bg: 'rgba(239,68,68,0.10)', icon: '🔴' },
  high:     { label: 'Alto',    color: '#f97316', bg: 'rgba(249,115,22,0.10)', icon: '🟠' },
  medium:   { label: 'Médio',   color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', icon: '🟡' },
  low:      { label: 'Baixo',   color: '#22c55e', bg: 'rgba(34,197,94,0.10)', icon: '🟢' },
  info:     { label: 'Info',    color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', icon: '🔵' },
}
const TIMELINE_ICON  = { navigate:'→', found:'🔍', fill:'✏️', click:'🖱️', success:'✅', error:'❌', warning:'⚠️', skipped:'⏭️', info:'ℹ️' }
const TIMELINE_COLOR = { navigate:'#7c3aed', found:'#3b82f6', fill:'#8b5cf6', click:'#6366f1', success:'#22c55e', error:'#ef4444', warning:'#f59e0b', skipped:'#64748b', info:'#94a3b8' }
const FLOW_STATUS_ICON  = { pass:'✅', fail:'❌', skipped:'⏭️' }
const FLOW_STATUS_COLOR = { pass:'#22c55e', fail:'#ef4444', skipped:'#64748b' }

function ssUrl(sessionId, rel) {
  if (!rel) return null
  return `${AGENT_FILES}/${sessionId}/${rel}`
}

// ─── Shared small helpers ─────────────────────────────────────────────────────
function ScoreBadge({ score }) {
  if (score == null) return <span className="badge badge-warning">Em andamento</span>
  const cls = score >= 85 ? 'score-success' : score >= 70 ? 'score-warning' : 'score-danger'
  return <div className={`score-ring ${cls}`}>{score}</div>
}

function Pill({ color, bg, children }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      fontSize:11, fontWeight:700, padding:'2px 8px',
      borderRadius:20, color, background:bg, border:`1px solid ${color}40`,
    }}>{children}</span>
  )
}

// ─── Automation detail (existing) ─────────────────────────────────────────────
function ComparePanel({ left, right, onClose }) {
  const cols = [left, right]
  const scoreColor = s => s >= 85 ? 'var(--success)' : s >= 70 ? 'var(--warning)' : 'var(--danger)'
  const types = ['critical', 'warning', 'info']
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:880, width:'95vw', maxHeight:'88vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div className="modal-hdr">
          <h3 className="modal-title">⚖️ Comparação de Execuções</h3>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
          {cols.map((r, i) => (
            <div key={i} className="card" style={{ padding:20, textAlign:'center' }}>
              <p style={{ fontSize:11, color:'var(--faint)', marginBottom:8 }}>{i===0 ? '① Execução A' : '② Execução B'}</p>
              <p style={{ fontSize:32, fontWeight:900, color:scoreColor(r.score||0) }}>{r.score ?? '—'}</p>
              <p style={{ fontSize:14, fontWeight:700, color:'var(--bright)', marginTop:4 }} className="truncate">{r.title}</p>
              <p style={{ fontSize:11, color:'var(--faint)', marginTop:4 }}>{r.date}{r.duration ? ` · ⏱ ${r.duration}` : ''}</p>
              <div style={{ display:'flex', justifyContent:'center', gap:16, marginTop:12 }}>
                {types.map(t => (
                  <div key={t}>
                    <p style={{ fontSize:18, fontWeight:800, color:issueColors[t] }}>{(r.findings||[]).filter(f=>f.type===t).length}</p>
                    <p style={{ fontSize:10, color:'var(--faint)' }}>{t}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {left.score != null && right.score != null && (
          <div className="card" style={{ padding:16, marginBottom:20, display:'flex', gap:28, alignItems:'center', flexWrap:'wrap' }}>
            <div>
              <p style={{ fontSize:11, color:'var(--faint)', marginBottom:4 }}>VARIAÇÃO DE SCORE</p>
              <p style={{ fontSize:24, fontWeight:900, color:right.score>=left.score ? 'var(--success)':'var(--danger)' }}>
                {right.score>=left.score ? '+':''}{right.score-left.score} pts
              </p>
            </div>
            {types.map(t => {
              const a=(left.findings||[]).filter(f=>f.type===t).length
              const b=(right.findings||[]).filter(f=>f.type===t).length
              const d=b-a
              return (
                <div key={t}>
                  <p style={{ fontSize:11, color:'var(--faint)', marginBottom:4 }}>{t.toUpperCase()}</p>
                  <p style={{ fontSize:20, fontWeight:800, color:d===0?'var(--muted)':d>0?'var(--danger)':'var(--success)' }}>{d>0?'+':''}{d}</p>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {cols.map((r, i) => (
            <div key={i}>
              <p style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:10 }}>{i===0?'Issues A':'Issues B'}</p>
              {(r.findings||[]).length===0
                ? <p style={{ fontSize:13, color:'var(--faint)' }}>Sem issues.</p>
                : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {(r.findings||[]).map((f,fi) => (
                      <div key={fi} className={`finding ${f.type}`}>
                        <span className={`finding-type ${f.type}`}>{issueLabels[f.type]}</span>
                        <p className="finding-title" style={{ fontSize:12 }}>{f.title}</p>
                      </div>
                    ))}
                  </div>
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AutoReportDetail({ report, onClose, onUpdate, onCompare, compareWith }) {
  const [editMode, setEditMode]       = useState(false)
  const [title, setTitle]             = useState(report.title)
  const [suggestions, setSuggestions] = useState([...(report.suggestions||[])])
  const [findings, setFindings]       = useState([...(report.findings||[])])
  const [newSug, setNewSug]           = useState('')
  const [newFinding, setNewFinding]   = useState({ type:'warning', title:'', desc:'' })
  const [showAddFinding, setShowAddFinding] = useState(false)
  const [steps, setSteps]             = useState([])
  const [lightbox, setLightbox]       = useState(null)

  useEffect(() => {
    api.getExecution(report.id).then(d => setSteps(d.steps||[])).catch(()=>{})
  }, [report.id])

  const handleSave = () => { onUpdate({...report,title,suggestions,findings}); setEditMode(false) }

  return (
    <>
    {lightbox && (
      <div onClick={()=>setLightbox(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <img src={lightbox} alt="screenshot" style={{ maxWidth:'90vw', maxHeight:'85vh', borderRadius:10 }} onClick={e=>e.stopPropagation()}/>
      </div>
    )}
    <div className="modal-overlay" style={{ alignItems:'flex-start', justifyContent:'flex-end' }} onClick={onClose}>
      <div className="side-panel" onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
          <div className="flex-1 min-w-0">
            {editMode
              ? <input className="input" style={{ fontSize:15, fontWeight:700, marginBottom:8 }} value={title} onChange={e=>setTitle(e.target.value)}/>
              : <h2 style={{ fontSize:17, fontWeight:800, color:'var(--bright)', marginBottom:4 }}>{title}</h2>
            }
            <p style={{ fontSize:12, color:'var(--faint)' }}>🔗 {report.url} · {report.date}{report.duration ? ` · ⏱ ${report.duration}` : ''}</p>
          </div>
          <button onClick={onClose} style={{ color:'var(--faint)', background:'transparent', border:'none', cursor:'pointer', fontSize:20, padding:4, flexShrink:0 }}>✕</button>
        </div>
        {report.score != null && (
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <div className="card flex-1 p-4" style={{ display:'flex', alignItems:'center', gap:12 }}>
              <ScoreBadge score={report.score}/>
              <div>
                <p style={{ fontSize:11, color:'var(--faint)' }}>Score</p>
                <p style={{ fontSize:22, fontWeight:800, color:report.score>=85?'var(--success)':report.score>=70?'var(--warning)':'var(--danger)' }}>{report.score}/100</p>
              </div>
            </div>
            {['critical','warning','info'].map(type => (
              <div key={type} className="card px-4 py-3" style={{ textAlign:'center', minWidth:68 }}>
                <p style={{ fontSize:18, fontWeight:800, color:issueColors[type] }}>{findings.filter(f=>f.type===type).length}</p>
                <p style={{ fontSize:10, color:'var(--faint)', marginTop:2 }}>{type}</p>
              </div>
            ))}
          </div>
        )}
        <button onClick={()=>onCompare(report)} style={{ padding:'8px 14px', borderRadius:8, background:compareWith&&compareWith.id!==report.id?'rgba(34,211,238,0.2)':'rgba(34,211,238,0.08)', color:'var(--cyan)', fontSize:12, fontWeight:700, border:'1px solid rgba(34,211,238,0.25)', cursor:'pointer', fontFamily:'var(--font)', textAlign:'left' }}>
          {compareWith&&compareWith.id!==report.id?`⚖️ Comparar com "${compareWith.title.slice(0,25)}..."` : '⚖️ Marcar para comparação'}
        </button>
        {steps.length > 0 && (
          <div>
            <p style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:8 }}>Steps Executados</p>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              {steps.map((s,i) => {
                const su = s.screenshot_path ? api.fileUrl(s.screenshot_path) : null
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:8, background:'rgba(255,255,255,0.02)', border:`1px solid ${s.status==='passed'?'rgba(52,211,153,0.12)':s.status==='failed'?'rgba(248,113,113,0.12)':'rgba(255,255,255,0.04)'}` }}>
                    <span style={{ flexShrink:0 }}>{s.status==='passed'?'✅':s.status==='failed'?'❌':'⏳'}</span>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize:12, fontWeight:600, color:s.status==='passed'?'var(--success)':s.status==='failed'?'var(--danger)':'var(--muted)' }} className="truncate">{s.name}</p>
                      {s.error_message && <p style={{ fontSize:11, color:'var(--danger)', marginTop:1 }}>{s.error_message}</p>}
                      {s.duration_ms>0 && <p style={{ fontSize:10, color:'var(--faint)', marginTop:1 }}>⏱ {s.duration_ms}ms</p>}
                    </div>
                    {su && <button onClick={()=>setLightbox(su)} style={{ background:'none', border:'none', cursor:'pointer', padding:2, flexShrink:0 }}><img src={su} alt="ss" style={{ width:48, height:32, objectFit:'cover', borderRadius:4, border:'1px solid rgba(248,113,113,0.4)' }}/></button>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <p style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase' }}>Issues</p>
            {editMode && <button onClick={()=>setShowAddFinding(v=>!v)} style={{ fontSize:12, padding:'4px 10px', borderRadius:6, background:'rgba(124,58,237,0.25)', color:'var(--primary-l)', border:'none', cursor:'pointer', fontWeight:600 }}>+ Add</button>}
          </div>
          {editMode && showAddFinding && (
            <div className="card" style={{ padding:12, marginBottom:10, display:'flex', flexDirection:'column', gap:8 }}>
              <select className="input" style={{ fontSize:12 }} value={newFinding.type} onChange={e=>setNewFinding(f=>({...f,type:e.target.value}))}>
                <option value="critical">🔴 Crítico</option><option value="warning">🟡 Aviso</option><option value="info">🔵 Info</option>
              </select>
              <input className="input" style={{ fontSize:13 }} placeholder="Título" value={newFinding.title} onChange={e=>setNewFinding(f=>({...f,title:e.target.value}))}/>
              <input className="input" style={{ fontSize:13 }} placeholder="Descrição" value={newFinding.desc} onChange={e=>setNewFinding(f=>({...f,desc:e.target.value}))}/>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>{ if(!newFinding.title)return; setFindings(p=>[...p,{...newFinding}]); setNewFinding({type:'warning',title:'',desc:''}); setShowAddFinding(false) }} className="btn btn-primary btn-sm flex-1">Adicionar</button>
                <button onClick={()=>setShowAddFinding(false)} className="btn btn-secondary btn-sm">Cancelar</button>
              </div>
            </div>
          )}
          {findings.length===0&&!editMode ? <p style={{ fontSize:13, color:'var(--faint)' }}>Sem issues.</p> : null}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {findings.map((f,i) => (
              <div key={i} className={`finding ${f.type}`} style={{ position:'relative' }}>
                <span className={`finding-type ${f.type}`}>{issueLabels[f.type]}</span>
                {editMode && <button onClick={()=>setFindings(p=>p.filter((_,idx)=>idx!==i))} style={{ position:'absolute', top:10, right:10, background:'rgba(248,113,113,0.15)', color:'var(--danger)', border:'none', borderRadius:6, width:24, height:24, cursor:'pointer', fontWeight:700 }}>✕</button>}
                {editMode ? <input className="input" style={{ fontSize:13, marginTop:4 }} value={f.title} onChange={e=>setFindings(p=>p.map((item,idx)=>idx===i?{...item,title:e.target.value}:item))}/> : <p className="finding-title">{f.title}</p>}
                {!editMode && f.desc && <p className="finding-desc">{f.desc}</p>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <p style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:8 }}>Sugestões</p>
          {editMode && (
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <input className="input flex-1" style={{ fontSize:13 }} placeholder="Nova sugestão..." value={newSug} onChange={e=>setNewSug(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&newSug.trim()){setSuggestions(p=>[...p,newSug.trim()]);setNewSug('')} }}/>
              <button onClick={()=>{ if(newSug.trim()){setSuggestions(p=>[...p,newSug.trim()]);setNewSug('')} }} className="btn btn-primary btn-sm">+</button>
            </div>
          )}
          {suggestions.length===0&&!editMode ? <p style={{ fontSize:13, color:'var(--faint)' }}>Sem sugestões.</p> : null}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {suggestions.map((s,i) => (
              <div key={i} className="suggestion-row">
                <span style={{ color:'var(--success)', fontWeight:700, flexShrink:0 }}>→</span>
                {editMode ? <input className="input flex-1" style={{ fontSize:13 }} value={s} onChange={e=>setSuggestions(p=>p.map((item,idx)=>idx===i?e.target.value:item))}/> : <p style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6 }}>{s}</p>}
                {editMode && <button onClick={()=>setSuggestions(p=>p.filter((_,idx)=>idx!==i))} style={{ background:'rgba(248,113,113,0.15)', color:'var(--danger)', border:'none', borderRadius:6, width:22, height:22, cursor:'pointer', fontWeight:700, flexShrink:0 }}>✕</button>}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:10, paddingTop:8, marginTop:'auto' }}>
          {editMode ? (
            <>
              <button onClick={handleSave} className="btn btn-primary flex-1">💾 Salvar</button>
              <button onClick={()=>{ setTitle(report.title); setSuggestions([...(report.suggestions||[])]); setFindings([...(report.findings||[])]); setEditMode(false) }} className="btn btn-secondary">Cancelar</button>
            </>
          ) : (
            <>
              <button onClick={()=>setEditMode(true)} className="btn btn-primary flex-1">✏️ Editar</button>
              {report.pdfUrl && <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">📥 PDF</a>}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

// ─── Agent report detail panel ────────────────────────────────────────────────
function AgentFlowCard({ flow, sessionId }) {
  const [open, setOpen] = useState(false)
  const color = FLOW_STATUS_COLOR[flow.status] || '#64748b'
  const icon  = FLOW_STATUS_ICON[flow.status]  || '?'
  return (
    <div style={{ border:`1px solid ${color}30`, borderRadius:10, overflow:'hidden', marginBottom:8 }}>
      <button onClick={()=>setOpen(v=>!v)} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:`${color}08`, border:'none', cursor:'pointer', textAlign:'left' }}>
        <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
        <span style={{ flex:1, fontWeight:600, color:'#e2e8f0', fontSize:14 }}>{flow.name}</span>
        {flow.status==='skipped' && flow.blockedBy && <Pill color="#64748b" bg="rgba(100,116,139,0.12)">Bloqueado por: {flow.blockedBy}</Pill>}
        {flow.status==='fail' && flow.errorMessage && <span style={{ fontSize:12, color:'#ef4444', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{flow.errorMessage}</span>}
        <span style={{ color:'#64748b', fontSize:12, flexShrink:0 }}>{open?'▲':'▼'}</span>
      </button>
      {open && flow.events && flow.events.length > 0 && (
        <div style={{ padding:'8px 14px 12px', background:'rgba(0,0,0,0.2)' }}>
          {flow.reason && <div style={{ fontSize:12, color:'#94a3b8', marginBottom:8 }}>{flow.status==='skipped'?`Motivo: ${flow.reason}`:flow.reason}</div>}
          {flow.events.map((ev,i) => (
            <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'4px 0', borderBottom:i<flow.events.length-1?'1px solid rgba(255,255,255,0.04)':'none' }}>
              <span style={{ fontSize:13, flexShrink:0, width:18 }}>{TIMELINE_ICON[ev.type]||'•'}</span>
              <div style={{ flex:1 }}>
                <span style={{ fontSize:12, color:TIMELINE_COLOR[ev.type]||'#94a3b8' }}>{ev.description}</span>
                {ev.detail && <span style={{ fontSize:11, color:'#64748b', marginLeft:6 }}>— {ev.detail}</span>}
              </div>
              <span style={{ fontSize:10, color:'#475569', flexShrink:0 }}>{new Date(ev.timestamp).toLocaleTimeString('pt-BR')}</span>
            </div>
          ))}
          {flow.screenshots && flow.screenshots.length > 0 && (
            <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
              {flow.screenshots.map((ss,i) => {
                const url = ssUrl(sessionId, ss)
                if (!url) return null
                return <a key={i} href={url} target="_blank" rel="noreferrer"><span style={{ fontSize:11, color:'#7c3aed', textDecoration:'underline' }}>📸 Screenshot {i+1}</span></a>
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AgentFindingCard({ f }) {
  const [open, setOpen] = useState(false)
  const s = SEV[f.severity] || SEV.info
  return (
    <div style={{ border:`1px solid ${s.color}30`, borderRadius:10, overflow:'hidden', marginBottom:8 }}>
      <button onClick={()=>setOpen(v=>!v)} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:s.bg, border:'none', cursor:'pointer', textAlign:'left' }}>
        <span style={{ fontSize:16, flexShrink:0 }}>{s.icon}</span>
        <span style={{ flex:1, fontWeight:600, color:'#e2e8f0', fontSize:14 }}>{f.title}</span>
        {f.affectedFlow && <Pill color="#7c3aed" bg="rgba(124,58,237,0.1)">{f.affectedFlow}</Pill>}
        <Pill color={s.color} bg={s.bg}>{s.label}</Pill>
        <span style={{ color:'#64748b', fontSize:12, flexShrink:0 }}>{open?'▲':'▼'}</span>
      </button>
      {open && (
        <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8, background:'rgba(0,0,0,0.2)' }}>
          {f.affectedUrl && <div><span style={{ fontSize:11, color:'#475569', fontWeight:700 }}>URL AFETADA</span><div style={{ fontSize:12, color:'#7c3aed', marginTop:2 }}>{f.affectedUrl}</div></div>}
          {f.description && <div><span style={{ fontSize:11, color:'#475569', fontWeight:700 }}>DESCRIÇÃO</span><div style={{ fontSize:13, color:'#cbd5e1', marginTop:2 }}>{f.description}</div></div>}
          {f.possibleCause && <div><span style={{ fontSize:11, color:'#475569', fontWeight:700 }}>CAUSA PROVÁVEL</span><div style={{ fontSize:13, color:'#94a3b8', marginTop:2 }}>{f.possibleCause}</div></div>}
          {f.howToReproduce && <div><span style={{ fontSize:11, color:'#475569', fontWeight:700 }}>COMO REPRODUZIR</span><div style={{ fontSize:12, color:'#94a3b8', marginTop:2, fontFamily:'monospace' }}>{f.howToReproduce}</div></div>}
          {f.suggestion && <div style={{ background:'rgba(34,197,94,0.06)', borderRadius:6, padding:'8px 10px', borderLeft:'3px solid #22c55e40' }}><span style={{ fontSize:11, color:'#475569', fontWeight:700 }}>SUGESTÃO DE CORREÇÃO</span><div style={{ fontSize:13, color:'#86efac', marginTop:2 }}>{f.suggestion}</div></div>}
        </div>
      )}
    </div>
  )
}

function AgentReportDetail({ session, onClose }) {
  const [tab, setTab] = useState('flows')
  const { testSummary: ts, report } = session

  const scoreColor = (s) => !s ? '#64748b' : s >= 80 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444'
  const loginIsPass = ts?.loginStatus === 'pass'
  const loginIsFail = ts?.loginStatus === 'fail'

  const tabs = [
    { id:'flows',    label:'Fluxos',   count:ts?.flows?.length },
    { id:'findings', label:'Achados',  count:report?.findings?.length },
    { id:'timeline', label:'Timeline', count:ts?.timeline?.length },
    { id:'network',  label:'Rede',     count:ts?.networkErrors?.length },
    { id:'links',    label:'Links',    count:ts?.brokenLinks?.length },
    { id:'console',  label:'Console',  count:ts?.consoleErrors?.length },
  ]

  return (
    <div className="modal-overlay" style={{ alignItems:'flex-start', justifyContent:'flex-end' }} onClick={onClose}>
      <div className="side-panel" style={{ maxWidth:640, width:'95vw' }} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:14 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:'rgba(124,58,237,0.2)', color:'#a78bfa' }}>AGENTE IA</span>
            </div>
            <h2 style={{ fontSize:15, fontWeight:800, color:'var(--bright)', marginBottom:4 }} className="truncate">{session.goal}</h2>
            <p style={{ fontSize:12, color:'var(--faint)' }}>🔗 {session.baseUrl} · {new Date(session.startedAt).toLocaleString('pt-BR')}</p>
          </div>
          {report && (
            <div style={{ textAlign:'center', flexShrink:0 }}>
              <div style={{ fontSize:26, fontWeight:800, color:scoreColor(report.overallScore), lineHeight:1 }}>{report.overallScore}</div>
              <div style={{ fontSize:10, color:'#64748b' }}>/100</div>
            </div>
          )}
          <button onClick={onClose} style={{ color:'var(--faint)', background:'transparent', border:'none', cursor:'pointer', fontSize:20, padding:4, flexShrink:0 }}>✕</button>
        </div>

        {/* Login banner */}
        {ts && ts.loginStatus !== 'not_detected' && (
          <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', borderRadius:10, marginBottom:12, background:loginIsPass?'rgba(34,197,94,0.08)':'rgba(239,68,68,0.10)', border:`1px solid ${loginIsPass?'#22c55e40':'#ef444440'}` }}>
            <span style={{ fontSize:18, flexShrink:0 }}>{loginIsPass?'🔓':'🔒'}</span>
            <div>
              <div style={{ fontWeight:700, color:loginIsPass?'#22c55e':'#ef4444', fontSize:13 }}>Login {loginIsPass?'realizado com sucesso':'falhou'}</div>
              {ts.loginError && <div style={{ fontSize:12, color:'#94a3b8' }}>{ts.loginError}</div>}
              {loginIsFail && <div style={{ fontSize:11, color:'#f97316', marginTop:3 }}>Fluxos dependentes foram cancelados.</div>}
            </div>
          </div>
        )}

        {/* Groq summary */}
        {report?.summary && (
          <div style={{ background:'rgba(15,10,40,0.5)', border:'1px solid rgba(124,58,237,0.15)', borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
            <p style={{ fontSize:13, color:'#94a3b8', margin:0 }}>{report.summary}</p>
          </div>
        )}

        {/* Stats strip */}
        {ts && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:6, marginBottom:14 }}>
            {[
              { l:'Passou',   v:ts.passed,                      c:'#22c55e' },
              { l:'Falhou',   v:ts.failed,                      c:'#ef4444' },
              { l:'Avisos',   v:ts.warnings,                    c:'#f59e0b' },
              { l:'Links ❌', v:ts.brokenLinks?.length??0,      c:'#f97316' },
              { l:'Rede',     v:ts.networkErrors?.length??0,    c:'#ef4444' },
              { l:'Console',  v:ts.consoleErrors?.length??0,    c:'#64748b' },
            ].map(({l,v,c}) => (
              <div key={l} style={{ background:'rgba(15,10,40,0.6)', border:'1px solid rgba(124,58,237,0.12)', borderRadius:8, padding:'8px 4px', textAlign:'center' }}>
                <div style={{ fontSize:17, fontWeight:700, color:c }}>{v}</div>
                <div style={{ fontSize:9, color:'#64748b', marginTop:1 }}>{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:12, flexWrap:'wrap' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:'5px 12px', borderRadius:20, fontSize:11, cursor:'pointer',
              border:tab===t.id?'1px solid rgba(124,58,237,0.5)':'1px solid rgba(255,255,255,0.06)',
              background:tab===t.id?'rgba(124,58,237,0.2)':'rgba(15,10,40,0.4)',
              color:tab===t.id?'#a78bfa':'#64748b', fontWeight:tab===t.id?700:400,
            }}>
              {t.label}{t.count>0?` (${t.count})`:''}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ background:'rgba(15,10,40,0.6)', border:'1px solid rgba(124,58,237,0.15)', borderRadius:12, padding:16, overflowY:'auto', maxHeight:'calc(100vh - 420px)' }}>
          {tab==='flows' && (
            <div>
              {!ts?.flows?.length
                ? <div style={{ color:'#64748b', fontSize:13 }}>Nenhum fluxo.</div>
                : ts.flows.map((f,i) => <AgentFlowCard key={i} flow={f} sessionId={session.id} />)
              }
            </div>
          )}
          {tab==='findings' && (
            <div>
              {!report?.findings?.length
                ? <div style={{ color:'#22c55e', fontSize:13 }}>Nenhum problema encontrado.</div>
                : report.findings.map((f,i) => <AgentFindingCard key={i} f={f} />)
              }
              {report?.recommendations?.length > 0 && (
                <div style={{ marginTop:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:8 }}>RECOMENDAÇÕES</div>
                  {report.recommendations.map((r,i) => (
                    <div key={i} style={{ fontSize:13, color:'#94a3b8', padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{i+1}. {r}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          {tab==='timeline' && (
            <div>
              {!ts?.timeline?.length
                ? <div style={{ color:'#64748b', fontSize:13 }}>Nenhum evento.</div>
                : ts.timeline.map((ev,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'5px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize:12, flexShrink:0, width:16 }}>{TIMELINE_ICON[ev.type]||'•'}</span>
                      <span style={{ fontSize:10, color:'#475569', flexShrink:0, width:58, fontFamily:'monospace' }}>{new Date(ev.timestamp).toLocaleTimeString('pt-BR')}</span>
                      <span style={{ fontSize:11, color:'#475569', flexShrink:0, width:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>[{ev.flowName}]</span>
                      <div style={{ flex:1 }}>
                        <span style={{ fontSize:12, color:TIMELINE_COLOR[ev.type]||'#e2e8f0' }}>{ev.description}</span>
                        {ev.detail && <span style={{ fontSize:10, color:'#64748b', marginLeft:5 }}>— {ev.detail}</span>}
                      </div>
                    </div>
                  ))
              }
            </div>
          )}
          {tab==='network' && (
            <div>
              {!ts?.networkErrors?.length
                ? <div style={{ color:'#22c55e', fontSize:13 }}>Nenhum erro de rede.</div>
                : <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                      <thead><tr style={{ color:'#64748b', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                        <th style={{ textAlign:'left', padding:'5px 6px' }}>Método</th>
                        <th style={{ textAlign:'left', padding:'5px 6px' }}>URL</th>
                        <th style={{ textAlign:'left', padding:'5px 6px' }}>Status</th>
                        <th style={{ textAlign:'left', padding:'5px 6px' }}>Tempo</th>
                        <th style={{ textAlign:'left', padding:'5px 6px' }}>Detalhe</th>
                      </tr></thead>
                      <tbody>
                        {ts.networkErrors.map((e,i) => (
                          <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding:'5px 6px', color:'#f97316', fontFamily:'monospace', fontWeight:700 }}>{e.method}</td>
                            <td style={{ padding:'5px 6px', color:'#94a3b8', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={e.url}>{e.url}</td>
                            <td style={{ padding:'5px 6px', color:e.status>=500?'#ef4444':'#f59e0b', fontFamily:'monospace', fontWeight:700 }}>{e.status||'ERR'}</td>
                            <td style={{ padding:'5px 6px', color:'#64748b', fontFamily:'monospace' }}>{e.duration?`${e.duration}ms`:'—'}</td>
                            <td style={{ padding:'5px 6px', color:'#64748b', maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.responseBody||e.error||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          )}
          {tab==='links' && (
            <div>
              {!ts?.brokenLinks?.length
                ? <div style={{ color:'#22c55e', fontSize:13 }}>Nenhum link quebrado.</div>
                : ts.brokenLinks.map((link,i) => (
                    <div key={i} style={{ background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'8px 12px', marginBottom:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontFamily:'monospace', fontWeight:700, fontSize:11, padding:'1px 5px', borderRadius:4, background:'rgba(239,68,68,0.2)', color:'#ef4444' }}>HTTP {link.status||'Timeout'}</span>
                        <span style={{ fontSize:13, color:'#e2e8f0', fontWeight:600 }}>{link.text||'(sem texto)'}</span>
                      </div>
                      <div style={{ fontSize:11, color:'#64748b', marginBottom:link.elementHtml?3:0 }}>🔗 {link.href}</div>
                      {link.elementHtml && <pre style={{ fontSize:10, color:'#475569', background:'rgba(0,0,0,0.3)', borderRadius:4, padding:'3px 7px', margin:0, fontFamily:'monospace', whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{link.elementHtml}</pre>}
                    </div>
                  ))
              }
            </div>
          )}
          {tab==='console' && (
            <div>
              {!ts?.consoleErrors?.length
                ? <div style={{ color:'#22c55e', fontSize:13 }}>Nenhum erro de console.</div>
                : ts.consoleErrors.map((e,i) => (
                    <div key={i} style={{ fontFamily:'monospace', fontSize:11, color:'#ef4444', background:'rgba(239,68,68,0.06)', borderRadius:4, padding:'5px 8px', borderLeft:'3px solid #ef4444', marginBottom:4 }}>{e}</div>
                  ))
              }
            </div>
          )}
        </div>

        {/* Video */}
        {ts?.videoPath && (
          <div style={{ marginTop:10, textAlign:'center' }}>
            <a href={ssUrl(session.id, ts.videoPath)||'#'} target="_blank" rel="noreferrer" style={{ color:'#7c3aed', fontSize:12, textDecoration:'underline' }}>
              📹 Assistir vídeo da execução
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Relatorios() {
  const { reports, setReports, backendOnline } = useContext(TesterContext)

  const [sourceTab, setSourceTab] = useState('automacao')
  const [search, setSearch]       = useState('')
  const [groupByProject, setGroupByProject] = useState(false)

  // Automation state
  const [dbReports, setDbReports] = useState([])
  const [loadingAuto, setLoadingAuto] = useState(false)
  const [selectedAuto, setSelectedAuto] = useState(null)
  const [compareA, setCompareA]   = useState(null)
  const [compareB, setCompareB]   = useState(null)
  const [showCompare, setShowCompare] = useState(false)

  // Agent IA state
  const [agentSessions, setAgentSessions] = useState([])
  const [loadingAgent, setLoadingAgent]   = useState(false)
  const [selectedAgent, setSelectedAgent] = useState(null)

  // ── Fetch automation reports ────────────────────────────────────────────
  useEffect(() => {
    if (!backendOnline || sourceTab === 'agente') return
    setLoadingAuto(true)
    fetch(`${BASE}/reports`)
      .then(r => r.json())
      .then(data => {
        const mapped = (data||[]).map(e => ({
          id:          e.id,
          title:       e.flow_name || e.project_name || 'Auditoria',
          url:         e.base_url || '',
          projectName: e.project_name || 'Sem Projeto',
          date:        e.started_at ? new Date(e.started_at).toLocaleDateString('pt-BR') : '—',
          duration:    e.duration_ms ? `${(e.duration_ms/1000).toFixed(0)}s` : null,
          status:      (e.status==='passed'||e.status==='failed') ? 'completo' : 'em_andamento',
          score:       e.score,
          findings:    Array.isArray(e.findings) ? e.findings : (JSON.parse(e.findings||'[]')),
          suggestions: Array.isArray(e.suggestions) ? e.suggestions : (JSON.parse(e.suggestions||'[]')),
          pdfUrl:      api.reportPdfUrl(e.id),
          issues: {
            critical:(Array.isArray(e.findings)?e.findings:[]).filter(f=>f.type==='critical').length,
            warning: (Array.isArray(e.findings)?e.findings:[]).filter(f=>f.type==='warning').length,
            info:    (Array.isArray(e.findings)?e.findings:[]).filter(f=>f.type==='info').length,
          },
        }))
        setDbReports(mapped)
      })
      .catch(()=>{})
      .finally(()=>setLoadingAuto(false))
  }, [backendOnline, sourceTab])

  // ── Fetch agent sessions ────────────────────────────────────────────────
  const fetchAgentSessions = useCallback(() => {
    setLoadingAgent(true)
    fetch(`${BASE}/agent/sessions`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAgentSessions(data.reverse()) })
      .catch(()=>{})
      .finally(()=>setLoadingAgent(false))
  }, [])

  useEffect(() => {
    if (sourceTab === 'automacao') return
    fetchAgentSessions()
  }, [sourceTab, fetchAgentSessions])

  const openAgentSession = async (id) => {
    const full = await fetch(`${BASE}/agent/sessions/${id}`).then(r=>r.json())
    setSelectedAgent(full)
  }

  const deleteAgentSession = async (id, e) => {
    e.stopPropagation()
    await fetch(`${BASE}/agent/sessions/${id}`, { method:'DELETE' })
    setAgentSessions(prev => prev.filter(s => s.id !== id))
    if (selectedAgent?.id === id) setSelectedAgent(null)
  }

  // ── Automation helpers ──────────────────────────────────────────────────
  const allAuto = (() => {
    const map = new Map()
    ;[...reports, ...dbReports].forEach(r => map.set(r.id, r))
    return [...map.values()].sort((a,b)=>(b.date||'').localeCompare(a.date||''))
  })()

  const filteredAuto = allAuto.filter(r => {
    const s = search.toLowerCase()
    return (!s || (r.title||'').toLowerCase().includes(s) || (r.url||'').toLowerCase().includes(s) || (r.projectName||'').toLowerCase().includes(s))
  })

  const filteredAgent = agentSessions.filter(s => {
    const q = search.toLowerCase()
    return !q || (s.goal||'').toLowerCase().includes(q) || (s.baseUrl||'').toLowerCase().includes(q)
  })

  const handleUpdate = (updated) => {
    setReports(prev => prev.map(r => r.id===updated.id ? updated : r))
    setDbReports(prev => prev.map(r => r.id===updated.id ? updated : r))
    setSelectedAuto(updated)
  }

  const handleCompare = (report) => {
    if (!compareA || (compareA && compareB)) { setCompareA(report); setCompareB(null); setShowCompare(false) }
    else if (compareA.id !== report.id) { setCompareB(report); setShowCompare(true) }
    setSelectedAuto(null)
  }

  const groupedAuto = groupByProject
    ? filteredAuto.reduce((acc,r)=>{ const k=r.projectName||'Sem Projeto'; if(!acc[k]) acc[k]=[]; acc[k].push(r); return acc },{})
    : { all: filteredAuto }

  const scoreColor = s => !s ? '#64748b' : s>=80 ? '#22c55e' : s>=50 ? '#f59e0b' : '#ef4444'

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="page">
      {/* Title */}
      <div className="page-hdr animate-fade-in">
        <h1>Relatórios</h1>
        <p>Histórico unificado de automações e auditorias de IA</p>
      </div>

      {/* Source tabs */}
      <div className="animate-fade-in" style={{ display:'flex', gap:8, marginBottom:20 }}>
        {[
          { id:'automacao', label:'⚙️ Automação de Flows' },
          { id:'agente',    label:'🤖 Agente IA (QA)' },
        ].map(t => (
          <button key={t.id} onClick={()=>setSourceTab(t.id)} style={{
            padding:'9px 20px', borderRadius:10, fontSize:13, cursor:'pointer', fontWeight:700,
            border:sourceTab===t.id?'1px solid rgba(124,58,237,0.5)':'1px solid rgba(255,255,255,0.08)',
            background:sourceTab===t.id?'rgba(124,58,237,0.2)':'rgba(15,10,40,0.4)',
            color:sourceTab===t.id?'#a78bfa':'#64748b',
          }}>{t.label}</button>
        ))}

        {/* Search */}
        <div className="search-wrap" style={{ flex:1, minWidth:180 }}>
          <span className="search-icon">🔍</span>
          <input className="input search-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..."/>
        </div>

        {sourceTab === 'automacao' && (
          <button onClick={()=>setGroupByProject(v=>!v)} style={{ padding:'8px 14px', borderRadius:8, background:groupByProject?'rgba(124,58,237,0.3)':'rgba(255,255,255,0.06)', color:groupByProject?'var(--primary-l)':'var(--muted)', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'var(--font)' }}>
            📁 Por Projeto
          </button>
        )}

        {sourceTab === 'agente' && (
          <button onClick={fetchAgentSessions} style={{ padding:'8px 14px', borderRadius:8, background:'rgba(124,58,237,0.12)', color:'#a78bfa', fontSize:12, fontWeight:600, border:'1px solid rgba(124,58,237,0.25)', cursor:'pointer' }}>
            ↻ Atualizar
          </button>
        )}
      </div>

      {/* ── AUTOMAÇÃO TAB ─────────────────────────────────────────────── */}
      {sourceTab === 'automacao' && (
        <>
          <div className="animate-fade-in" style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
            {[
              { label:'Total',        value:allAuto.length,                                        color:'var(--bright)' },
              { label:'Completos',    value:allAuto.filter(r=>r.status==='completo').length,       color:'var(--success)' },
              { label:'Em andamento', value:allAuto.filter(r=>r.status==='em_andamento').length,   color:'var(--warning)' },
            ].map(s => (
              <div key={s.label} className="stat-pill">
                <span style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.value}</span>
                <span style={{ fontSize:13, color:'var(--faint)' }}>{s.label}</span>
              </div>
            ))}
            {compareA && (
              <div className="stat-pill" style={{ borderColor:'var(--cyan)', background:'rgba(34,211,238,0.06)', gap:8 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'var(--cyan)' }}>⚖️ {compareA.title.slice(0,22)}</span>
                <button onClick={()=>{ setCompareA(null); setCompareB(null); setShowCompare(false) }} style={{ background:'none', border:'none', color:'var(--faint)', cursor:'pointer', fontSize:12 }}>✕</button>
              </div>
            )}
          </div>

          {loadingAuto && (
            <div style={{ marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <div className="spinner" style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.1)', borderTopColor:'var(--primary-l)' }}/>
              <span style={{ fontSize:12, color:'var(--faint)' }}>Carregando...</span>
            </div>
          )}

          <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:24 }}>
            {Object.entries(groupedAuto).map(([key, items]) => (
              <div key={key}>
                {groupByProject && <p style={{ fontSize:13, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:12 }}>📁 {key} <span style={{ fontSize:12, fontWeight:400, color:'var(--faint)' }}>({items.length})</span></p>}
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {items.length === 0
                    ? <div className="empty-state"><div className="empty-state-icon">📭</div><p style={{ color:'var(--muted)' }}>Nenhum relatório</p></div>
                    : items.map(r => (
                        <div key={r.id} className="card" style={{ padding:18, display:'flex', alignItems:'center', gap:14, cursor:'pointer', border:`1px solid ${compareA?.id===r.id?'rgba(34,211,238,0.4)':'rgba(255,255,255,0.06)'}` }} onClick={()=>setSelectedAuto(r)}>
                          <ScoreBadge score={r.score}/>
                          <div className="flex-1 min-w-0">
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                              <p style={{ fontSize:14, fontWeight:700, color:'var(--bright)' }}>{r.title}</p>
                              <span className={`badge ${r.status==='completo'?'badge-success':'badge-warning'}`}>{r.status==='completo'?'✓ Completo':'⏳ Em andamento'}</span>
                              {compareA?.id===r.id && <span className="badge badge-cyan">⚖️ A</span>}
                            </div>
                            <p style={{ fontSize:12, color:'var(--faint)' }}>
                              {r.projectName&&r.projectName!=='Sem Projeto' && <span style={{ marginRight:8 }}>📁 {r.projectName} ·</span>}
                              🔗 {r.url} · {r.date}{r.duration ? ` · ⏱ ${r.duration}` : ''}
                            </p>
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                            <div style={{ display:'flex', gap:6 }}>
                              {r.issues?.critical>0 && <span className="badge badge-danger">🔴 {r.issues.critical}</span>}
                              {r.issues?.warning>0  && <span className="badge badge-warning">🟡 {r.issues.warning}</span>}
                              {r.issues?.info>0     && <span className="badge badge-cyan">🔵 {r.issues.info}</span>}
                            </div>
                            <div style={{ display:'flex', gap:6 }}>
                              <button onClick={e=>{e.stopPropagation();setSelectedAuto(r)}} style={{ padding:'5px 12px', borderRadius:8, background:'rgba(124,58,237,0.2)', color:'var(--primary-l)', fontSize:12, fontWeight:600, border:'none', cursor:'pointer' }}>Ver →</button>
                              <button onClick={e=>{e.stopPropagation();handleCompare(r)}} title="Comparar" style={{ padding:'5px 10px', borderRadius:8, background:'rgba(34,211,238,0.1)', color:'var(--cyan)', fontSize:12, fontWeight:600, border:'none', cursor:'pointer' }}>⚖️</button>
                              {r.pdfUrl && <a href={r.pdfUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ padding:'5px 10px', borderRadius:8, background:'rgba(52,211,153,0.12)', color:'var(--success)', fontSize:12, fontWeight:600, textDecoration:'none' }}>📥</a>}
                            </div>
                          </div>
                        </div>
                      ))
                  }
                </div>
              </div>
            ))}
            {filteredAuto.length===0 && !loadingAuto && (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <p style={{ fontSize:15, color:'var(--muted)' }}>{search ? 'Nenhum relatório encontrado' : 'Nenhum relatório gerado ainda'}</p>
                {!search && <p style={{ fontSize:13, color:'var(--faint)' }}>Execute uma automação em Iniciar Automação</p>}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── AGENTE IA TAB ─────────────────────────────────────────────── */}
      {sourceTab === 'agente' && (
        <>
          <div className="animate-fade-in" style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
            {[
              { label:'Total',      value:agentSessions.length,                                      color:'var(--bright)' },
              { label:'Completos',  value:agentSessions.filter(s=>s.status==='completed').length,    color:'var(--success)' },
              { label:'Falharam',   value:agentSessions.filter(s=>s.status==='failed').length,       color:'var(--danger)' },
            ].map(s => (
              <div key={s.label} className="stat-pill">
                <span style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.value}</span>
                <span style={{ fontSize:13, color:'var(--faint)' }}>{s.label}</span>
              </div>
            ))}
          </div>

          {loadingAgent && (
            <div style={{ marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <div className="spinner" style={{ width:14, height:14, border:'2px solid rgba(255,255,255,0.1)', borderTopColor:'var(--primary-l)' }}/>
              <span style={{ fontSize:12, color:'var(--faint)' }}>Carregando sessões...</span>
            </div>
          )}

          <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {filteredAgent.length === 0 && !loadingAgent ? (
              <div className="empty-state">
                <div className="empty-state-icon">🤖</div>
                <p style={{ fontSize:15, color:'var(--muted)' }}>{search ? 'Nenhuma sessão encontrada' : 'Nenhuma auditoria de IA executada ainda'}</p>
                {!search && <p style={{ fontSize:13, color:'var(--faint)' }}>Execute uma auditoria no Agente IA</p>}
              </div>
            ) : filteredAgent.map(s => {
              const statusColor = { completed:'#22c55e', failed:'#ef4444', running:'#7c3aed', analyzing:'#3b82f6' }[s.status] || '#64748b'
              const sc = s.overallScore
              return (
                <div key={s.id} className="card" style={{ padding:16, display:'flex', alignItems:'center', gap:14, cursor:s.status==='completed'?'pointer':'default' }} onClick={()=>s.status==='completed'&&openAgentSession(s.id)}>
                  {/* Score */}
                  <div style={{ fontSize:22, fontWeight:800, color:scoreColor(sc), width:44, textAlign:'center', flexShrink:0 }}>
                    {sc != null ? sc : <span style={{ fontSize:13, color:'#64748b' }}>—</span>}
                  </div>
                  {/* Source badge + info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:'1px 7px', borderRadius:10, background:'rgba(124,58,237,0.2)', color:'#a78bfa', flexShrink:0 }}>AGENTE IA</span>
                      <span style={{ fontSize:14, fontWeight:700, color:'var(--bright)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.goal}</span>
                    </div>
                    <p style={{ fontSize:12, color:'var(--faint)' }}>
                      🔗 {s.baseUrl} · {new Date(s.startedAt).toLocaleString('pt-BR')}
                      {s.passed != null && <span style={{ marginLeft:10 }}>✅ {s.passed} · ❌ {s.failed} · ⚠️ {s.warnings}</span>}
                    </p>
                    {s.error && <p style={{ fontSize:11, color:'#ef4444', marginTop:2 }}>{s.error}</p>}
                  </div>
                  {/* Status + actions */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:10, color:statusColor, background:`${statusColor}18`, border:`1px solid ${statusColor}40` }}>{s.status}</span>
                    {s.status === 'completed' && (
                      <button onClick={e=>{e.stopPropagation();openAgentSession(s.id)}} style={{ padding:'5px 12px', borderRadius:8, background:'rgba(124,58,237,0.2)', color:'#a78bfa', fontSize:12, fontWeight:600, border:'none', cursor:'pointer' }}>Ver →</button>
                    )}
                    <button onClick={e=>deleteAgentSession(s.id,e)} style={{ padding:'5px 10px', borderRadius:8, background:'rgba(239,68,68,0.1)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.2)', fontSize:12, cursor:'pointer' }}>✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── Panels ────────────────────────────────────────────────────── */}
      {selectedAuto && (
        <AutoReportDetail
          report={selectedAuto}
          onClose={()=>setSelectedAuto(null)}
          onUpdate={handleUpdate}
          onCompare={handleCompare}
          compareWith={compareA}
        />
      )}

      {selectedAgent && (
        <AgentReportDetail session={selectedAgent} onClose={()=>setSelectedAgent(null)} />
      )}

      {showCompare && compareA && compareB && (
        <ComparePanel left={compareA} right={compareB} onClose={()=>setShowCompare(false)}/>
      )}
    </div>
  )
}
