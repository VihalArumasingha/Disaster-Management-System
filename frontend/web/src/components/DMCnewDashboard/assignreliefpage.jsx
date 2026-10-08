import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, RefreshCw, Search, Siren } from 'lucide-react'
import ReportCard from './ReportCard.jsx'
import EscalationCard from './EscalationCard.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const PRIORITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 }

const priorityStyle = (level) => {
    switch (String(level || '').toLowerCase()) {
        case 'critical': return 'bg-red-100 text-red-700 ring-1 ring-red-300'
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
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const getLocation = (row) => {
    if (row.source === 'dmc_warning') return row.warningLocation || row.city || '—'
    const cluster = row.clusterId && typeof row.clusterId === 'object' ? row.clusterId : row.cluster
    if (!cluster || typeof cluster !== 'object') return '—'
    if (cluster.district || cluster.locationName || cluster.address) return cluster.district || cluster.locationName || cluster.address
    const coords = cluster?.center?.coordinates
    if (Array.isArray(coords) && coords.length === 2) {
        const [lng, lat] = coords
        if (Number.isFinite(lng) && Number.isFinite(lat)) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    }
    return '—'
}

const personName = (person) => person?.name || person?.email || '—'

const reportLocation = (report) => {
    const coords = report?.location?.coordinates
    if (Array.isArray(coords) && coords.length === 2) {
        const [lng, lat] = coords
        if (Number.isFinite(lng) && Number.isFinite(lat)) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    }
    return ''
}

const isEmergencyRow = (row) => {
    if (row.source === 'dmc_warning') return Boolean(row.isEmergency)
    return String(row.priorityLevel || '').toLowerCase() === 'critical'
}

export default function AssignReliefPage() {
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [showEmergencyOnly, setShowEmergencyOnly] = useState(false)
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
                const esc = (Array.isArray(data.escalations) ? data.escalations : [])
                    .map((e) => ({ ...e, source: 'escalation', sourceLabel: 'Duty Officer Verified' }))
                const warn = Array.isArray(data.warnings) ? data.warnings : []
                const reps = Array.isArray(data.verifiedReports) ? data.verifiedReports : []
                const combined = [...esc, ...warn, ...reps].sort((a, b) => {
                    const ea = isEmergencyRow(a) ? 1 : 0
                    const eb = isEmergencyRow(b) ? 1 : 0
                    if (ea !== eb) return eb - ea
                    return new Date(b.escalatedAt || 0) - new Date(a.escalatedAt || 0)
                })
                return combined
            })
            .then((list) => {
                setRows(list)
                setLoading(false)
            })
            .catch((err) => {
                if (err.name === 'AbortError') return
                setError(err.message || 'Failed to load approved disasters.')
                setLoading(false)
            })
        return () => ctrl.abort()
    }, [reloadKey])

    const emergencyCount = useMemo(() => rows.filter(isEmergencyRow).length, [rows])

    const filtered = useMemo(() => {
        let list = rows
        if (showEmergencyOnly) list = list.filter(isEmergencyRow)
        const needle = search.trim().toLowerCase()
        if (!needle) return list
        return list.filter((e) => [
            e.hazardType,
            e.title,
            e.city,
            e.priorityLevel,
            e.severity,
            e.sourceLabel,
            e.escalatedBy?.name,
            e.escalatedBy?.email,
            e.dutyOfficer?.name,
            e.dutyOfficer?.email,
            e.reviewNote
        ].join(' ').toLowerCase().includes(needle))
    }, [rows, search, showEmergencyOnly])

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
                All verified hazard escalations + DMC officer warnings/disasters (already approved) available for relief-team assignment. Emergency records are highlighted and pinned to the top.
            </p>
            {emergencyCount > 0 && (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-600 text-white">
                        <Siren size={18} />
                    </span>
                    <p className="text-sm font-semibold text-red-800">
                        🚨 {emergencyCount} emergency / critical record{emergencyCount === 1 ? '' : 's'} need{emergencyCount === 1 ? 's' : ''} immediate relief-team assignment
                    </p>
                </div>
            )}
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
                    onClick={() => setShowEmergencyOnly((v) => !v)}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${showEmergencyOnly ? 'border-red-400 bg-red-600 text-white' : 'border-red-300 bg-white text-red-700 hover:bg-red-50'}`}
                >
                    <AlertTriangle size={15} /> {showEmergencyOnly ? 'Showing Emergency Only' : 'Emergency Only'}
                </button>
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
            <div className="mt-4 space-y-4">
                {loading ? (
                    <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white" />)}</div>
                ) : filtered.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
                        No approved disasters found. Backend returned {rows.length} rows.
                    </div>
                ) : (
                    filtered.map((record) => record.source === 'verified_report'
                        ? <ReportCard key={record._id} record={record} />
                        : <EscalationCard key={record._id} record={record} />)
                )}
            </div>
            <p className="mt-3 text-sm text-slate-500">
                Showing {filtered.length} of {rows.length} records ({emergencyCount} emergency).
            </p>
        </div>
    )
}
