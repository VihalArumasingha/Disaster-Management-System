import { useState } from 'react'
import { ChevronDown, Clock3, MapPin, ShieldCheck, UserRound } from 'lucide-react'

const priorityStyle = (level) => {
    switch (String(level || '').toLowerCase()) {
        case 'critical': return 'bg-red-100 text-red-700 ring-1 ring-red-300'
        case 'high': return 'bg-orange-100 text-orange-700'
        case 'medium': return 'bg-amber-100 text-amber-700'
        default: return 'bg-slate-100 text-slate-700'
    }
}
const titleCase = (v) => String(v || '-').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const fmtDate = (v) => {
    if (!v) return '-'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return String(v)
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
const personName = (p) => p?.name || p?.email || '-'
const reportLoc = (r) => {
    const c = r?.location?.coordinates
    if (Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) return `${c[1].toFixed(4)}, ${c[0].toFixed(4)}`
    return ''
}
const getLoc = (row) => {
    if (row.source === 'dmc_warning') return row.warningLocation || row.city || '-'
    const cl = row.clusterId && typeof row.clusterId === 'object' ? row.clusterId : row.cluster
    if (!cl || typeof cl !== 'object') return '-'
    if (cl.district || cl.locationName || cl.address) return cl.district || cl.locationName || cl.address
    const c = cl?.center?.coordinates
    if (Array.isArray(c) && c.length === 2 && Number.isFinite(c[0]) && Number.isFinite(c[1])) return `${c[1].toFixed(4)}, ${c[0].toFixed(4)}`
    return '-'
}

export default function EscalationCard({ record }) {
    const [open, setOpen] = useState(true)
    const priority = String(record.priorityLevel || record.severity || 'unknown').toLowerCase()
    const reports = Array.isArray(record.verifiedReportIds) ? record.verifiedReportIds : []
    const count = record.verifiedReportCount ?? reports.length
    const emergency = record.source === 'dmc_warning' ? Boolean(record.isEmergency) : priority === 'critical'
    return (
        <article className={`rounded-xl border bg-white p-5 shadow-sm ${emergency ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyle(priority)}`}>{titleCase(priority)} priority</span>
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">Escalated from Duty Officer</span>
                {emergency && <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-bold text-white">EMERGENCY</span>}
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-900">{titleCase(record.hazardType)}</h2>
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-600"><MapPin size={14} /> {getLoc(record)}</p>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm lg:grid-cols-4">
                <div><dt className="text-xs text-slate-500">Priority score</dt><dd className="mt-1 text-base font-bold text-slate-900">{record.priorityScore ?? '-'}</dd></div>
                <div><dt className="text-xs text-slate-500">Verified reports</dt><dd className="mt-1 text-base font-bold text-slate-900">{count}</dd></div>
                <div><dt className="text-xs text-slate-500">Escalated by</dt><dd className="mt-1 flex items-center gap-1.5 font-semibold text-slate-800"><UserRound size={14} /> {personName(record.escalatedBy)}</dd></div>
                <div><dt className="text-xs text-slate-500">Escalated time</dt><dd className="mt-1 flex items-center gap-1.5 text-slate-700"><Clock3 size={14} /> {fmtDate(record.escalatedAt)}</dd></div>
            </dl>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-600">
                    <span className="flex items-center gap-1.5"><ShieldCheck size={14} /> Verified reports ({reports.length}) - citizen details</span>
                    <ChevronDown size={16} className={open ? 'rotate-180' : ''} />
                </button>
                {open && (
                    <div className="mt-3 space-y-3">
                        {reports.map((r, i) => (
                            <div key={r?._id || i} className="rounded-lg border border-slate-200 bg-white p-3">
                                <p className="text-xs font-semibold text-slate-500">{titleCase(r?.hazardType || record.hazardType)} - {titleCase(r?.status || 'Verified')}</p>
                                <p className="mt-1 text-sm text-slate-800">{r?.description || 'No additional details provided.'}</p>
                            </div>
                        ))}
                        {reports.length === 0 && <p className="rounded-lg border bg-white p-3 text-sm text-slate-600">{record.reviewNote || 'No additional details provided.'}</p>}
                    </div>
                )}
            </div>
        </article>
    )
}