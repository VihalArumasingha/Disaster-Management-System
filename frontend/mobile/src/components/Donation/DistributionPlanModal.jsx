import { MapPin, Navigation, X } from 'lucide-react'

/* Timeline matches NGO dashboard operation.jsx (6 steps). */
export const PLAN_TIMELINE_STEPS = [
  'Team assigned',
  'Vehicle loaded',
  'En route to sector 7',
  'Checkpoint verified',
  'Distribution start',
  'Return & report'
]

export const planStageFor = (op) => {
  if (!op) return 0
  const n = Number(op.stage)
  if (Number.isFinite(n)) return Math.max(0, Math.min(PLAN_TIMELINE_STEPS.length, n))
  const s = String(op.status || '').toUpperCase()
  if (s === 'COMPLETED') return PLAN_TIMELINE_STEPS.length
  if (s === 'ACTIVE') return 4
  return 1
}

/* Parse "7.164945, 79.82714" out of a location string, if present. */
export const parseLatLng = (text) => {
  const m = String(text || '').match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/* Free embed (no API key): Google Maps embed + OSM fallback link. */
export const mapEmbedUrl = (op) => {
  const q = encodeURIComponent(op?.location || op?.name || 'Sri Lanka')
  const coords = parseLatLng(op?.location)
  if (coords) return `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=13&output=embed`
  return `https://maps.google.com/maps?q=${q}&z=12&output=embed`
}

export const mapLinkUrl = (op) => {
  const coords = parseLatLng(op?.location)
  if (coords) return `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=13/${coords.lat}/${coords.lng}`
  const qq = encodeURIComponent(op?.location || op?.name || 'Sri Lanka')
  return `https://www.openstreetmap.org/search?query=${qq}`
}

export const statusStyle = (status) => {
  if (status === 'ACTIVE') return 'bg-emerald-100 text-emerald-700'
  if (status === 'COMPLETED') return 'bg-blue-100 text-blue-700'
  return 'bg-amber-100 text-amber-700'
}

/* Full-screen Distribution Plan popup (citizen view of live operation data). */
export default function DistributionPlanModal({ operation, operations, inventoryByKey, volunteers, volunteersLoading, onSelect, onClose }) {
  if (!operation) return null
  const stage = planStageFor(operation)
  const coords = parseLatLng(operation.location)
  const team = volunteers.filter((v) => {
    const opName = v.operationName || v.assignment?.operationName || ''
    return opName === operation.name && (v.assignment?.status || 'UNASSIGNED') === 'ASSIGNED'
  })
  const status = String(operation.status || 'PENDING').toUpperCase()
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Distribution plan" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-[#f4f6fb] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative bg-white px-5 pb-4 pt-5 shadow-sm">
          <button type="button" onClick={onClose} aria-label="Close distribution plan" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600">
            <X size={16} />
          </button>
          {operations.length > 1 && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {operations.map((op) => (
                <button
                  key={op._id || op.name}
                  type="button"
                  onClick={() => onSelect(op)}
                  className={'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ' + ((op._id || op.name) === (operation._id || operation.name) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600')}
                >
                  {op.name}
                </button>
              ))}
            </div>
          )}
          <h2 className="text-center text-2xl font-extrabold text-blue-700">Distribution Plan</h2>
          <p className="mt-1 text-center text-sm text-slate-500">
            {operation.name} • Status:{' '}
            <span className={'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ' + statusStyle(status)}>
              {status}
            </span>
          </p>
        </div>
        <div className="grid flex-1 gap-4 overflow-y-auto p-4 sm:grid-cols-2">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">Timeline</h3>
            <p className="text-xs text-slate-500">Active operation: <span className="font-semibold text-blue-700">{operation.name}</span></p>
            <ol className="mt-4">
              {PLAN_TIMELINE_STEPS.map((step, i) => {
                const done = i < stage
                return (
                  <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < PLAN_TIMELINE_STEPS.length - 1 && <span className={'absolute left-[9px] top-5 h-full w-0.5 ' + (i < stage - 1 ? 'bg-emerald-500' : 'bg-slate-200')} />}
                    <span className={'z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ' + (done ? 'border-emerald-500 bg-emerald-500' : 'border-slate-200 bg-slate-200')}>
                      {done && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span className={'text-sm ' + (done ? 'font-medium text-slate-700' : 'text-slate-500')}>{step}</span>
                  </li>
                )
              })}
            </ol>
            {operation.location && <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><MapPin size={12} /> {operation.location}</p>}
          </section>
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">Distribution area Map</h3>
            <p className="text-xs text-slate-500">Location: <span className="font-semibold text-blue-700">{coords ? `${coords.lat}, ${coords.lng}` : (operation.location || '—')}</span></p>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <iframe title={'Map for ' + operation.name} src={mapEmbedUrl(operation)} className="h-64 w-full border-0" loading="lazy" />
            </div>
            <a href={mapLinkUrl(operation)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600 underline">
              <Navigation size={12} /> Open full map
            </a>
          </section>
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:col-span-2">
            <h3 className="text-base font-bold text-slate-900">Emergency resources available</h3>
            <p className="text-xs text-slate-500">Live from inventory <span className="font-semibold text-emerald-600">✓ Live Data</span></p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {['medical', 'clothing', 'water', 'dry_rations'].map((key) => (
                <div key={key} className="rounded-xl bg-slate-100 p-3 text-center">
                  <p className="text-xl font-extrabold text-slate-900">{Number(inventoryByKey[key] ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{key === 'dry_rations' ? 'Dry rations' : key === 'medical' ? 'Medical kits' : key.slice(0, 1).toUpperCase() + key.slice(1)}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Have</th>
                    <th className="px-3 py-2">Unit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100"><td className="px-3 py-2 text-slate-700">Dry rations</td><td className="px-3 py-2 font-semibold text-slate-900">{inventoryByKey.dry_rations ?? 0}</td><td className="px-3 py-2 text-slate-600">packs</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-3 py-2 text-slate-700">Water</td><td className="px-3 py-2 font-semibold text-slate-900">{inventoryByKey.water ?? 0}</td><td className="px-3 py-2 text-slate-600">liters</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-3 py-2 text-slate-700">Bedding</td><td className="px-3 py-2 font-semibold text-slate-900">{inventoryByKey.bedding ?? 0}</td><td className="px-3 py-2 text-slate-600">sets</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-3 py-2 text-slate-700">Medical kits</td><td className="px-3 py-2 font-semibold text-slate-900">{inventoryByKey.medical ?? 0}</td><td className="px-3 py-2 text-slate-600">kits</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-3 py-2 text-slate-700">Clothing</td><td className="px-3 py-2 font-semibold text-slate-900">{inventoryByKey.clothing ?? 0}</td><td className="px-3 py-2 text-slate-600">sets</td></tr>
                  <tr className="border-t border-slate-100"><td className="px-3 py-2 text-slate-700">Hygiene packs</td><td className="px-3 py-2 font-semibold text-slate-900">{inventoryByKey.hygiene ?? 0}</td><td className="px-3 py-2 text-slate-600">packs</td></tr>
                </tbody>
              </table>
            </div>
          </section>
          <section className="rounded-2xl bg-white p-4 shadow-sm sm:col-span-2">
            <h3 className="text-base font-bold text-slate-900">Team</h3>
            <p className="text-xs text-slate-500">Active operation: <span className="font-semibold text-blue-700">{operation.name}</span></p>
            <p className="mt-3 rounded-lg bg-blue-100 px-3 py-2 text-center text-xs font-extrabold uppercase tracking-wide text-blue-700">
              {volunteersLoading ? 'Loading team…' : `${team.length} volunteer${team.length === 1 ? '' : 's'} assigned`}
            </p>
            {team.length === 0 && !volunteersLoading ? (
              <p className="py-4 text-center text-sm text-slate-500">No volunteers assigned to this operation yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {team.map((v) => (
                  <li key={v._id || v.fullName} className="flex items-center gap-3 rounded-xl bg-slate-100 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                      {String(v.fullName || '?').slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900">{v.fullName}</span>
                      <span className="block text-xs capitalize text-slate-500">{v.volunteerType === 'team' ? 'Team Lead' : 'Individual'}</span>
                    </span>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
