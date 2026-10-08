import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const priorityStyle = (level) => {
    switch (String(level || '').toLowerCase()) {
        case 'critical': return 'bg-red-100 text-red-700'
        case 'high': return 'bg-orange-100 text-orange-700'
        case 'medium': return 'bg-amber-100 text-amber-700'
        default: return 'bg-slate-100 text-slate-700'
    }
}

const titleCase = (value) => String(value || '—')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const fmtDate = (value) => {
    if (!value) return '—'
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()
}

const clusterLocation = (cluster) => {
    if (!cluster || typeof cluster !== 'object') return '—'
    const coords = cluster?.center?.coordinates
    if (Array.isArray(coords) && coords.length === 2) {
        const [lng, lat] = coords
        if (Number.isFinite(lng) && Number.isFinite(lat)) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    }
    return '—'
}

const personName = (person) => person?.name || person?.email || '—'

export default function AssignReliefPage() {
    const [escalations, setEscalations] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [refreshing, setRefreshing] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)

    useEffect(() => {
        const ctrl = new AbortController()
        setLoading(true)
        setError('')
        fetch(`${API_BASE}/api/ngomanager/approved-disasters`, {
            credentials: 'include',
            signal: ctrl.signal
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data?.message || `Server error ${res.status}`)
                return Array.isArray(data.escalations) ? data.escalations : []
            })
            .then((list) => {
                setEscalations(list)
                setLoading(false)
            })
            .catch((err) => {
                if (err.name === 'AbortError') return
                setError(err.message || 'Failed to load approved disasters.')
                setLoading(false)
            })
        return () => ctrl.abort()
    }, [reloadKey])

    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase()
        if (!needle) return escalations
        return escalations.filter((e) => [
            e.hazardType,
            e.priorityLevel,
            e.escalatedBy?.name,
            e.escalatedBy?.email,
            e.dutyOfficer?.name,
            e.dutyOfficer?.email,
            e.reviewNote
        ].join(' ').toLowerCase().includes(needle))
    }, [escalations, search])

    const refresh = () => {
        setRefreshing(true)
        setReloadKey((k) => k + 1)
        setTimeout(() => setRefreshing(false), 400)
    }

    return (
        <div className="mx-auto max-w-7xl px-5 py-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">
                SafeZone operations
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Assign Relief Teams</h1>
            <p className="mt-2 max-w-3xl text-slate-600">
                Approved disasters (duty-officer approved escalations) available for relief-team assignment.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative flex-1">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by hazard type, priority, officer, note…"
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </label>
                <button
                    type="button"
                    onClick={refresh}
                    disabled={loading || refreshing}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                    <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>
            {error && (
                <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </p>
            )}
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Hazard Type</th>
                            <th className="px-4 py-3">Priority</th>
                            <th className="px-4 py-3">Score</th>
                            <th className="px-4 py-3">Location</th>
                            <th className="px-4 py-3">Reports</th>
                            <th className="px-4 py-3">Escalated By</th>
                            <th className="px-4 py-3">Duty Officer</th>
                            <th className="px-4 py-3">Review Note</th>
                            <th className="px-4 py-3">Reviewed At</th>
                            <th className="px-4 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && (
                            <tr>
                                <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                                    Loading approved disasters…
                                </td>
                            </tr>
                        )}
                        {!loading && filtered.map((e) => (
                            <tr key={e._id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-semibold text-slate-800">{titleCase(e.hazardType)}</td>
                                <td className="px-4 py-3">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyle(e.priorityLevel)}`}>
                                        {titleCase(e.priorityLevel)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">{e.priorityScore ?? '—'}</td>
                                <td className="px-4 py-3 text-slate-600">{clusterLocation(e.clusterId)}</td>
                                <td className="px-4 py-3 text-slate-600">{e.verifiedReportCount ?? (e.verifiedReportIds?.length ?? '—')}</td>
                                <td className="px-4 py-3 text-slate-600">{personName(e.escalatedBy)}</td>
                                <td className="px-4 py-3 text-slate-600">{personName(e.dutyOfficer)}</td>
                                <td className="max-w-xs truncate px-4 py-3 text-slate-600" title={e.reviewNote || ''}>{e.reviewNote || '—'}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fmtDate(e.reviewedAt)}</td>
                                <td className="px-4 py-3">
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                        Approved
                                    </span>
                                </td>
                            </tr>
                        ))}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td colSpan={10} className="px-4 py-10 text-center text-sm text-slate-500">
                                    No approved disasters found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <p className="mt-3 text-sm text-slate-500">
                Showing {filtered.length} of {escalations.length} approved disasters.
            </p>
        </div>
    )
}
