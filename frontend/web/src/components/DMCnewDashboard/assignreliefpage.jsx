import { useEffect, useMemo, useState } from 'react'
import ApprovedCard from './reliefPartA.jsx'
import AssignBox from './reliefPartB.jsx'
import DeployBox from './reliefPartC.jsx'
const API = import.meta.env.VITE_API_BASE || 'http://localhost:5000'
const riskOf = (r) => String(r?.clusterId?.priorityLevel || 'medium').toLowerCase()
const toUi = (d) => ({
  id: String(d._id),
  reportKey: String(d.reportId?._id || d.reportId || ''),
  reportId: String(d.reportId?._id || d.reportId || ''),
  team: d.team, teamName: d.teamName, dmoContact: d.dmoContact,
  notes: d.notes, special: d.special, risk: d.risk, urgent: d.urgent,
  status: d.status, lat: d.lat, lng: d.lng,
  createdAt: d.createdAt, updatedAt: d.updatedAt
})
export default function AssignReliefPage() {
  const [recs, setRecs] = useState([])
  const [deps, setDeps] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [risk, setRisk] = useState('')
  const [team, setTeam] = useState('Army')
  const [pick, setPick] = useState(null)
  const [teamPop, setTeamPop] = useState(null)
  const [rk, setRk] = useState(0)
  const [showCompletedOnly, setShowCompletedOnly] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    const c = new AbortController(); setLoading(true); setErr('')
    Promise.all([
      fetch(API + '/api/ngomanager/verified-hazard-reports', { credentials: 'include', signal: c.signal }).then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d?.message || ('Server error ' + r.status)); return Array.isArray(d.reports) ? d.reports : [] }),
      fetch(API + '/api/ngomanager/relief-deployments', { credentials: 'include', signal: c.signal }).then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d?.message || ('Server error ' + r.status)); return Array.isArray(d.deployments) ? d.deployments.map(toUi) : [] })
    ])
      .then(([l, dd]) => { setRecs(l); setDeps(dd); setLoading(false) })
      .catch((e) => { if (e.name !== 'AbortError') { setErr(e.message); setLoading(false) } })
    return () => c.abort()
  }, [rk])
  const byKey = useMemo(() => { const m = {}; deps.forEach((d) => { m[d.reportKey] = d; if (d.reportId) m[String(d.reportId)] = d }); return m }, [deps])
  const keyOf = (r) => String(r?._id || '')
  const list = useMemo(() => {
    let l = recs
    if (risk) l = l.filter((r) => riskOf(r) === risk)
    l = l.filter((r) => {
      const deployment = byKey[keyOf(r)]
      const isDone = deployment && deployment.status === 'Completed'
      return showCompletedOnly ? isDone : !isDone
    })
    const n = q.trim().toLowerCase(); if (!n) return l
    return l.filter((r) => [r?.hazardType, r?.description, r?.district, r?.reporterId?.name, r?.reporterId?.phone].join(' ').toLowerCase().includes(n))
  }, [recs, q, risk, showCompletedOnly, byKey])
  const riskCounts = useMemo(() => {
    const c = { critical: 0, high: 0, medium: 0, low: 0 }
    recs.forEach((r) => { const k = riskOf(r); if (c[k] != null) c[k] += 1 })
    return c
  }, [recs])
  const save = async (f) => {
    setSaving(true)
    try {
      const r = await fetch(API + '/api/ngomanager/relief-deployments', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: String(pick?._id || ''), team: f.team, teamName: f.teamName, urgent: f.urgent, dmoContact: f.dmoContact, notes: f.notes, special: f.special })
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.message || ('Server error ' + r.status))
      setDeps((pp) => [toUi(d.deployment), ...pp]); setPick(null); setTeam(f.team)
    } catch (e) { alert('Assign failed: ' + e.message) } finally { setSaving(false) }
  }
  const handleAssignOrComplete = (item, isComplete = false) => {
    if (isComplete) {
      const existing = byKey[keyOf(item)]
      if (existing) {
        setSt(existing.id, 'Completed')
      }
    } else {
      setPick(item)
    }
  }
  const setSt = async (id, s) => {
    setDeps((pp) => pp.map((d) => d.id === id ? { ...d, status: s, updatedAt: new Date().toISOString() } : d))
    try {
      const r = await fetch(API + '/api/ngomanager/relief-deployments/' + id, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: s })
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d?.message || ('Server error ' + r.status))
      setDeps((pp) => pp.map((x) => x.id === id ? toUi(d.deployment) : x))
    } catch (e) { setRk((v) => v + 0); alert('Status update failed: ' + e.message) }
  }
  const counts = useMemo(() => {
    const g = { Army: [], Police: [], 'Fire Brigade': [] }
    deps.forEach((d) => { if (g[d.team]) g[d.team].push(d) })
    const s = (l) => ({ total: l.length, pending: l.filter((x) => x.status === 'Pending').length, prog: l.filter((x) => x.status === 'In Progress').length, done: l.filter((x) => x.status === 'Completed').length })
    return { g, Army: s(g.Army), Police: s(g.Police), Fire: s(g['Fire Brigade']) }
  }, [deps])
  const cur = counts.g[team] || []
  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">SafeZone operations</p>
      <h1 className="mt-2 text-3xl font-bold">Assign Relief Teams</h1>
      <p className="mt-2 max-w-3xl text-slate-600">Verified hazard reports only (hazardreports • status verified). Assign Army / Police / Fire Brigade teams, then track deployments below.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['Total Verified', recs.length, 'text-slate-900'], ['Critical Risk', riskCounts.critical, 'text-red-600'], ['High Risk', riskCounts.high, 'text-orange-600'], ['Medium / Low', riskCounts.medium + riskCounts.low, 'text-emerald-600']].map(([l, v, c]) => (
          <div key={l} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-medium text-slate-500">{l}</p><p className={`mt-1 text-3xl font-extrabold ${c}`}>{loading ? '—' : v}</p></div>
        ))}
      </div>

      {/* Team Deployment Summary */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {['Army', 'Police', 'Fire Brigade'].map((t) => {
          const s = t === 'Fire Brigade' ? counts.Fire : counts[t]
          const teamColor = t === 'Army' ? 'text-blue-600' : t === 'Police' ? 'text-purple-600' : 'text-orange-600'
          const borderColor = t === 'Army' ? 'border-blue-200' : t === 'Police' ? 'border-purple-200' : 'border-orange-200'
          const ring = s.total === 0 ? '#eef2f7' : `conic-gradient(#fb923c 0 ${(s.pending / s.total) * 100}%, #3b82f6 0 ${((s.pending + s.prog) / s.total) * 100}%, #34d399 0 100%)`
          const isSelected = team === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => { setTeam(t); setTeamPop(t) }}
              title={'View ' + t + ' deployments'}
              className={`rounded-2xl border ${borderColor} bg-white p-4 shadow-sm transition hover:shadow-md ${isSelected ? 'ring-2 ring-offset-2 ' + (t === 'Army' ? 'ring-blue-500' : t === 'Police' ? 'ring-purple-500' : 'ring-orange-500') : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500">{t}{isSelected ? ' ✓' : ''}</p>
                  <p className={`mt-1 text-2xl font-extrabold ${teamColor}`}>{s.total}</p>
                </div>
                <div className="relative h-16 w-16">
                  <div className="h-full w-full rounded-full p-1.5" style={{ background: ring }}>
                    <div className="grid h-full w-full place-items-center rounded-full bg-white">
                      <span className="text-sm font-extrabold text-slate-800">{s.total}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2 text-[10px]">
                <span className="text-slate-500">Pending: <b>{s.pending}</b></span>
                <span className="text-slate-500">In Progress: <b>{s.prog}</b></span>
                <span className="text-slate-500">Done: <b>{s.done}</b></span>
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search verified reports…" className="w-full flex-1 rounded-xl border py-2.5 px-3 text-sm" />
        <select value={risk} onChange={(e) => setRisk(e.target.value)} className="rounded-xl border px-3 py-2.5 text-sm">
          <option value="">All risk levels</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button
          type="button"
          onClick={() => setShowCompletedOnly(!showCompletedOnly)}
          className={'rounded-xl border px-4 py-2.5 text-sm font-semibold ' + (showCompletedOnly ? 'bg-emerald-600 text-white border-emerald-600' : '')}
        >
          {showCompletedOnly ? '📋 Show Active Tasks' : '✅ Completed Tasks'}
        </button>
        <button type="button" onClick={() => setRk((k) => k + 1)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">Refresh</button>
      </div>
      {err && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      <div className="mt-4 space-y-5">
        {loading ? <div className="h-40 animate-pulse rounded-2xl border bg-white" /> : list.length === 0 ? <div className="rounded-xl border bg-white px-6 py-12 text-center text-sm text-slate-500">{showCompletedOnly ? 'No completed tasks found.' : 'No verified hazard reports found.'}</div>
          : list.map((r) => <ApprovedCard key={keyOf(r)} item={r} assigned={byKey[keyOf(r)]} onAssign={handleAssignOrComplete} />)}
      </div>
      <p className="mt-3 text-sm text-slate-500">{showCompletedOnly ? `Showing ${list.length} completed task${list.length !== 1 ? 's' : ''}` : `Showing ${list.length} of ${recs.length} verified reports`}</p>
      <DeployBox counts={counts} team={team} setTeam={setTeam} cur={cur} setSt={setSt} />
      {pick && <AssignBox item={pick} onClose={() => setPick(null)} onSave={save} />}
      {teamPop && (() => {
        const popDeps = deps.filter((d) => d.team === teamPop)
        const popActive = popDeps.filter((d) => d.status !== 'Completed')
        const popDone = popDeps.filter((d) => d.status === 'Completed')
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setTeamPop(null)}>
            <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold">{teamPop} Deployments ({popDeps.length})</h2>
                <button type="button" onClick={() => setTeamPop(null)} className="rounded-lg border border-blue-500 px-4 py-1 text-sm text-blue-600">Close ✕</button>
              </div>
              <div className="mt-3 flex gap-2">
                {['Army', 'Police', 'Fire Brigade'].map((t) => (
                  <button key={t} type="button" onClick={() => { setTeam(t); setTeamPop(t) }} className={'rounded-lg px-4 py-1.5 text-sm font-bold ' + (teamPop === t ? 'bg-blue-700 text-white' : 'border bg-white text-slate-600')}>{t}</button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">Active: {popActive.length} • Completed: {popDone.length}</p>
              <div className="mt-3 space-y-4">
                {popDeps.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">No {teamPop} deployments yet.</div>
                  : popDeps.map((d) => (
                    <article key={d.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-extrabold text-slate-800">{d.team} • {d.teamName}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${d.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : d.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{d.status}</span>
                      </div>
                      <p className="mt-2 break-all font-mono text-[12px] text-slate-600">Report: {d.reportId}</p>
                      <p className="mt-1 text-sm text-slate-700">DMO: {d.dmoContact}</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{d.notes}</p>
                      {d.special ? <p className="mt-1 text-sm italic text-slate-500">Special: {d.special}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {['Pending', 'In Progress', 'Completed'].map((s) => <button key={s} type="button" onClick={() => setSt(d.id, s)} className={'rounded-lg px-3 py-1 text-xs font-bold text-white ' + (d.status === s ? 'bg-blue-700 ring-2 ring-blue-300' : 'bg-blue-600 hover:bg-blue-700')}>{s}</button>)}
                        <button type="button" onClick={() => { if (d.lat != null) window.open(`https://www.google.com/maps?q=${d.lat},${d.lng}`, '_blank'); else alert('No GPS coordinates for this deployment.') }} className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white">📍 Share Live Location</button>
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
