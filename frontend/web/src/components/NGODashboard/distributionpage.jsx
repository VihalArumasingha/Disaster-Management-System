import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react'
import OperationsSection from './operation.jsx'
import DistributionRecordModal from './distributionquantity.jsx'
import DistributionTrendsChart from './distributionquantitychart.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

/** Fetch all distribution records and normalise Mongo `_id` → `id`. */
async function fetchRecords(signal) {
    const res = await fetch(`${API_BASE}/api/distributionrecords`, {
        credentials: 'include',
        signal
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || 'Failed to load distribution records.')
    const list = Array.isArray(data.records) ? data.records : []
    return list.map(r => ({ ...r, id: r._id }))
}

const fmtDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(`${iso}T00:00:00`)
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Relief Distribution page (/ngomanager/relief-distribution) */
/* ══════════════════════════════════════════════════════════════ */
export default function ReliefDistributionPage() {
    const [records, setRecords] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadErr, setLoadErr] = useState('')
    const [refreshing, setRefreshing] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)

    /* filters + modal */
    const [q, setQ] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)

    /* ── load records from the API ─────────────────────────── */
    useEffect(() => {
        const ctrl = new AbortController()
        fetchRecords(ctrl.signal)
            .then(list => {
                setRecords(list)
                setLoading(false)
            })
            .catch(err => {
                if (err.name === 'AbortError') return
                setLoadErr(err.message || 'Failed to load distribution records.')
                setLoading(false)
            })
        return () => ctrl.abort()
    }, [reloadKey])

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase()
        if (!needle) return records
        return records.filter(r =>
            [r.date, r.familiesAssisted, r.resourcesDistributed]
                .join(' ')
                .toLowerCase()
                .includes(needle)
        )
    }, [records, q])

    const totals = useMemo(() => ({
        families: records.reduce((s, r) => s + (Number(r.familiesAssisted) || 0), 0),
        resources: records.reduce((s, r) => s + (Number(r.resourcesDistributed) || 0), 0)
    }), [records])

    /* ── actions (API) ─────────────────────────────────────── */
    const refresh = () => {
        setRefreshing(true)
        setLoading(true)
        setLoadErr('')
        setReloadKey(k => k + 1)
        setTimeout(() => setRefreshing(false), 400)
    }

    const applySaved = (rec) => {
        if (!rec) return
        const norm = { ...rec, id: rec._id }
        setRecords(prev =>
            prev.some(x => x.id === norm.id)
                ? prev.map(x => (x.id === norm.id ? norm : x))
                : [norm, ...prev]
        )
    }

    const removeRecord = async (rec) => {
        if (!window.confirm(`Delete the record for ${fmtDate(rec.date)}? This cannot be undone.`)) return
        try {
            const res = await fetch(`${API_BASE}/api/distributionrecords/${rec.id}`, {
                method: 'DELETE',
                credentials: 'include'
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || 'Failed to delete the record.')
            setRecords(prev => prev.filter(x => x.id !== rec.id))
        } catch (e) {
            window.alert(e.message || 'Failed to delete the record.')
        }
    }

    return (
        <div className="space-y-8">
            {/* operations (overview, table, timeline, map, volunteers) */}
            <OperationsSection />

            {/* distribution records */}
            <section className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Distribution Records</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Track families assisted and resources distributed over time
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={refresh}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
                        </button>
                        <button
                            type="button"
                            onClick={() => { setEditing(null); setModalOpen(true) }}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                        >
                            <Plus size={16} /> Record Distribution
                        </button>
                    </div>
                </div>

                {loadErr && (
                    <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <span>{loadErr}</span>
                        <button
                            type="button"
                            onClick={refresh}
                            className="ml-4 rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold hover:bg-red-100"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* totals */}
                <div className="grid gap-4 sm:grid-cols-3">
                    {[
                        { label: 'Total Records', value: loading ? '—' : records.length, cls: 'text-slate-800' },
                        { label: 'Families Assisted', value: loading ? '—' : totals.families, cls: 'text-sky-600' },
                        { label: 'Resources Distributed', value: loading ? '—' : totals.resources, cls: 'text-violet-600' }
                    ].map(c => (
                        <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {c.label}
                            </p>
                            <p className={`mt-1 text-2xl font-bold ${c.cls}`}>{c.value}</p>
                        </div>
                    ))}
                </div>

                {/* toolbar */}
                <div className="relative max-w-md">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search distribution records…"
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                {/* records table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Families Assisted</th>
                                <th className="px-4 py-3">Resources Distributed</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                                        Loading distribution records…
                                    </td>
                                </tr>
                            )}
                            {!loading && filtered.map(rec => (
                                <tr key={rec.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-semibold text-slate-800">
                                        {fmtDate(rec.date)}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {Number(rec.familiesAssisted) || 0}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {Number(rec.resourcesDistributed) || 0}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setEditing(rec); setModalOpen(true) }}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                            >
                                                <Pencil size={12} /> Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeRecord(rec)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50"
                                            >
                                                <Trash2 size={12} /> Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                                        No distribution records yet — add one to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* trend chart */}
            <DistributionTrendsChart records={records} loading={loading} />

            {/* add / edit modal (mounted only while open → fresh form state) */}
            {modalOpen && (
                <DistributionRecordModal
                    open
                    initial={editing}
                    onClose={() => setModalOpen(false)}
                    onSaved={applySaved}
                />
            )}
        </div>
    )
}
