const tc = (v) => String(v ?? '—').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
export const RISK = (lvl) => {
  const l = String(lvl || '').toLowerCase()
  if (l === 'critical') return 'bg-red-100 text-red-700 ring-1 ring-red-300'
  if (l === 'high') return 'bg-orange-100 text-orange-700 ring-1 ring-orange-200'
  if (l === 'medium') return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'
  if (l === 'low') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  return 'bg-slate-100 text-slate-600'
}
const fd = (v) => { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString() }
const cc = (loc) => { const c = loc?.coordinates; if (Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) return { lat: c[1], lng: c[0] }; return null }
const me = (a, b) => `https://maps.google.com/maps?q=${a},${b}&z=14&output=embed`
const ri = (r) => { const u = r?.reporterId && typeof r.reporterId === 'object' ? r.reporterId : {}; return { name: u.name || 'Citizen reporter', phone: u.phone || '', email: u.email || '', nic: u.nic || '—' } }
export default function ApprovedCard({ item, assigned, onAssign, teamMini }) {
  const r = item || {}; const cl = r?.clusterId && typeof r.clusterId === 'object' ? r.clusterId : null
  const risk = cl?.priorityLevel || 'medium'
  const info = ri(r); const pos = cc(r?.location)
  const hz = tc(r?.hazardType)
  const sid = String(r?._id || '').slice(-12) || 'record'
  const photo = typeof r?.photo === 'string' ? r.photo : r?.photo?.url
  const mini = teamMini || (assigned ? { team: assigned.team, status: assigned.status } : null)
  const F = [['NIC', info.nic], ['PHONE', info.phone || '—'], ['EMAIL', info.email || '—'], ['DISASTER TYPE', hz], ['STATUS', 'Verified'], ['RISK LEVEL', tc(risk)], ['HOME ADDRESS', r?.district || '—'], ['OCCURRED AT', fd(r?.capturedAt)], ['REPORTED AT', fd(r?.submittedAt)], ['CURRENT LOCATION', pos ? pos.lat.toFixed(6) + ', ' + pos.lng.toFixed(6) : '—'], ['DESCRIPTION', r?.description || '—'], ['CLUSTER SCORE', cl?.priorityScore ?? '—']]
  return (
    <article className="overflow-hidden rounded-2xl border bg-white shadow">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-slate-50 px-6 py-4">
        <div><h2 className="text-xl font-extrabold">{info.name !== 'Citizen reporter' ? info.name : hz + ' Relief Center'}</h2><p className="pl-10 text-xs text-slate-500">#{sid}</p></div>
        <div className="flex items-start gap-2">
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">✓ VERIFIED</span>
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${RISK(risk)}`}>{tc(risk)}</span>
          {mini && (
            <span className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-sm" title={`${mini.team} — ${mini.status || 'In Progress'}`}>
              <span className="relative grid h-8 w-8 place-items-center">
                <span className="absolute inset-0 rounded-full" style={{ background: mini.status === 'Completed' ? '#34d399' : mini.status === 'Pending' ? '#fb923c' : '#3b82f6' }} />
                <span className="absolute inset-[3px] grid place-items-center rounded-full bg-white text-[8px] font-extrabold text-slate-800">{mini.team === 'Fire Brigade' ? 'FB' : mini.team.slice(0, 1)}</span>
              </span>
              <span className="text-left leading-tight">
                <span className="block text-[9px] font-bold text-slate-700">{mini.team}</span>
                <span className="block text-[8px] font-semibold text-slate-500">{mini.status || 'In Progress'}</span>
              </span>
            </span>
          )}
        </div>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-3">
        <div className="relative rounded-2xl border px-5 py-4">
          <span className="absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-gradient-to-b from-blue-500 via-violet-500 to-pink-500" />
          <dl className="grid grid-cols-2 gap-4 text-center">
            {F.map(([k, v]) => <div key={k} className="border-b border-slate-100 pb-3"><dt className="text-[11px] font-semibold uppercase text-slate-500">{k}</dt><dd className="mt-1 break-words text-[13px] font-semibold">{String(v)}</dd></div>)}
          </dl>
        </div>
        <div className="overflow-hidden rounded-2xl border bg-cyan-100">
          {pos ? <iframe title="m" src={me(pos.lat, pos.lng)} className="h-64 w-full lg:h-full lg:min-h-[280px]" loading="lazy" /> : <div className="grid h-64 place-items-center text-sm text-slate-500">No location</div>}
        </div>
        <div className="rounded-2xl border p-2"><div className="h-40 overflow-hidden rounded-xl bg-slate-50">{photo ? <img src={photo} alt="e" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-slate-400">No photo</div>}</div></div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t bg-slate-50 px-6 py-4">
        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-700">APPROVED</span>
        {assigned ? <span className="text-xs font-semibold text-emerald-700">DEPLOYED — {assigned.team} • {assigned.teamName}</span> : <button type="button" onClick={() => onAssign(item)} className="rounded-xl border-2 border-blue-500 px-5 py-1.5 text-sm font-bold">Assign</button>}
      </div>
    </article>
  )
}
