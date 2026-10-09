import { useState } from 'react'
import jsPDF from 'jspdf'
const fd = (v) => { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString() }
const TEAMS = ['Army', 'Police', 'Fire Brigade']
export default function DeployBox({ counts, team, setTeam, cur, setSt }) {
  const [showDone, setShowDone] = useState(false)
  const active = (cur || []).filter((d) => d.status !== 'Completed')
  const done = (cur || []).filter((d) => d.status === 'Completed')
  const shown = showDone ? done : active
  const pdf = () => {
    const doc = new jsPDF()
    doc.setFontSize(16); doc.text(team + ' Deployments Report', 14, 16)
    doc.setFontSize(10); doc.text('Total: ' + cur.length, 14, 24)
    let y = 34
    cur.forEach((d, i) => { if (y > 270) { doc.addPage(); y = 16 } doc.text((i + 1) + '. ' + d.team + ' - ' + d.teamName, 14, y); y += 8 })
    doc.save(team + '-deployments.pdf')
  }
  const total = counts.Army.total + counts.Police.total + counts.Fire.total
  return (
    <div className="mt-10 rounded-3xl border bg-slate-50/60 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-end gap-1.5">
        <button type="button" onClick={() => setShowDone(false)} className={'rounded-md px-2.5 py-1 text-[11px] font-bold ' + (!showDone ? 'bg-blue-700 text-white shadow' : 'bg-white border text-slate-600')}>Active Tasks ({active.length})</button>
        <button type="button" onClick={() => setShowDone(true)} className={'rounded-md px-2.5 py-1 text-[11px] font-bold ' + (showDone ? 'bg-emerald-600 text-white shadow' : 'bg-white border text-slate-600')}>✅ Completed Tasks ({done.length})</button>
        <button type="button" onClick={pdf} className="rounded-md bg-green-600 px-2.5 py-1 text-[11px] font-bold text-white">Generate Report</button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['Total Deployments', total], ['Army', counts.Army.total], ['Police', counts.Police.total], ['Fire Brigade', counts.Fire.total]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs text-slate-500">{l}</p><p className="mt-1 text-3xl font-extrabold">{v}</p></div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {TEAMS.map((t) => {
          const s = t === 'Fire Brigade' ? counts.Fire : counts[t]
          const ring = s.total === 0 ? '#eef2f7' : `conic-gradient(#fb923c 0 ${(s.pending / s.total) * 100}%, #3b82f6 0 ${((s.pending + s.prog) / s.total) * 100}%, #34d399 0 100%)`
          return (
            <div key={t} className="rounded-2xl border bg-white p-5 shadow-sm">
              <p className="text-center text-sm font-bold">{t}</p>
              <div className="relative mx-auto mt-3 h-32 w-32">
                <div className="h-full w-full rounded-full p-2" style={{ background: ring }}>
                  <div className="grid h-full w-full place-items-center rounded-full bg-white"><span className="text-2xl font-extrabold">{s.total}</span></div>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t pt-3 text-sm">
                <div className="flex justify-between"><span>Pending</span><b>{s.pending}</b></div>
                <div className="flex justify-between"><span>In Progress</span><b>{s.prog}</b></div>
                <div className="flex justify-between"><span>Completed</span><b>{s.done}</b></div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-6 grid max-w-xs gap-2">
        {TEAMS.map((t) => <button key={t} type="button" onClick={() => setTeam(t)} className={'rounded-xl border bg-white px-4 py-2.5 text-left ' + (team === t ? 'border-blue-600 text-blue-600' : '')}>{t}</button>)}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold">{team} Deployments {showDone ? '(Completed)' : '(Active)'}</h2>
      </div>
      <div className="mt-3 space-y-5">
        {shown.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">{showDone ? `No completed ${team} tasks yet. Mark a deployment Completed to move it here.` : `No active ${team} deployments. Assign a verified report above to create one.`}</div>
          : shown.map((d) => (
            <article key={d.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="text-lg font-extrabold text-slate-800">{d.team} • {d.teamName}</h3>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${d.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : d.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{d.status}</span>
              </div>
              <dl className="mt-4 grid gap-y-4 text-sm md:grid-cols-[170px_minmax(0,1fr)]">
                <dt className="font-semibold text-slate-500">Report ID</dt><dd className="break-all font-mono text-[13px] text-slate-800">{d.reportId}</dd>
                <dt className="font-semibold text-slate-500">DMO Contact</dt><dd className="text-slate-800">{d.dmoContact}</dd>
                <dt className="font-semibold text-slate-500">Notes</dt><dd className="whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-3 text-slate-700">{d.notes}</dd>
                <dt className="font-semibold text-slate-500">Special</dt><dd className="text-slate-700">{d.special || '—'}</dd>
                <dt className="font-semibold text-slate-500">Risk Level</dt><dd><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{String(d.risk || '—').toUpperCase()}</span></dd>
                <dt className="font-semibold text-slate-500">Created</dt><dd className="text-slate-700">{fd(d.createdAt)}</dd>
                <dt className="font-semibold text-slate-500">Updated</dt><dd className="text-slate-700">{fd(d.updatedAt)}</dd>
                <dt className="font-semibold text-slate-500">Status</dt>
                <dd className="flex flex-wrap gap-2">{['Pending', 'In Progress', 'Completed'].map((s) => <button key={s} type="button" onClick={() => setSt(d.id, s)} className={'rounded-lg px-4 py-1.5 text-[13px] font-bold text-white shadow-sm transition ' + (d.status === s ? 'bg-blue-700 ring-2 ring-blue-300' : 'bg-blue-600 hover:bg-blue-700')}>{s}</button>)}</dd>
                <dt className="font-semibold text-slate-500">Actions</dt>
                <dd className="flex flex-wrap gap-2">
                  {d.status !== 'Completed' && (
                    <button
                      type="button"
                      onClick={() => setSt(d.id, 'Completed')}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      ✅ Mark as Completed
                    </button>
                  )}
                </dd>
                <dt className="font-semibold text-slate-500">Location</dt>
                <dd><button type="button" onClick={() => { if (d.lat != null) window.open(`https://www.google.com/maps?q=${d.lat},${d.lng}`, '_blank'); else alert('No GPS coordinates for this deployment.') }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">📍 Share Live Location</button></dd>
              </dl>
            </article>
          ))}
      </div>
    </div>
  )
}

