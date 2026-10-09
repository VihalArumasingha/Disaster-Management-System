import { Clock3, MapPin, UserRound } from 'lucide-react'
const tc = (v) => String(v || '-').replaceAll('_', ' ')
const fd = (v) => {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString()
}
export default function ReportCard({ record }) {
  const r = (record.verifiedReportIds && record.verifiedReportIds[0]) || {}
  const coords = r?.location?.coordinates
  const loc = Array.isArray(coords) && coords.length === 2 ? `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}` : (record.warningLocation || '-')
  const reporter = r?.reporterId && typeof r.reporterId === 'object' ? (r.reporterId.name || r.reporterId.email) : (record.escalatedBy?.name || '-')
  return (
    <article className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Verified citizen report</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{tc(r?.hazardType || record.hazardType)}</span>
      </div>
      <p className="mt-3 text-base font-medium text-slate-900">{r?.description || record.reviewNote || 'No additional details provided.'}</p>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <span className="flex items-center gap-1"><UserRound size={14} /> {reporter}</span>
        <span className="flex items-center gap-1"><MapPin size={14} /> {loc}</span>
        <span className="flex items-center gap-1"><Clock3 size={14} /> {fd(r?.submittedAt || record.escalatedAt)}</span>
      </p>
      {r?.photo?.url && <a href={r.photo.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-blue-600 underline">View photo</a>}
    </article>
  )
}
