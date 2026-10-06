import { useEffect, useMemo, useState } from 'react'
import {
    Search, Plus, Pencil, Trash2, RefreshCw, FileDown, Users, UserCheck,
    MapPin, ChevronRight, RotateCcw
} from 'lucide-react'
import OperationModal from './editoperation.jsx'
import { fetchVolunteers } from './volunteerpage.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

/** Action-timeline steps shown for the selected operation. */
const TIMELINE_STEPS = [
    'Team assigned',
    'Vehicle loaded',
    'En route to site',
    'Checkpoint verified',
    'Distribution start',
    'Return & report'
]

/** Fetch all operations and normalise Mongo `_id` → `id`. */
async function fetchOperations(signal) {
    const res = await fetch(`${API_BASE}/api/operations`, {
        credentials: 'include',
        signal
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || 'Failed to load operations.')
    const list = Array.isArray(data.operations)
        ? data.operations
        : Array.isArray(data.data) ? data.data : []
    return list.map(o => ({ ...o, id: o._id }))
}

const fmtDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Distribution Operations section (top half of the page) ──── */
/* ══════════════════════════════════════════════════════════════ */
export default function OperationsSection() {
    const [operations, setOperations] = useState([])
    const [volunteers, setVolunteers] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadErr, setLoadErr] = useState('')
    const [refreshing, setRefreshing] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)

    /* filters */
    const [q, setQ] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    /* add / edit modal */
    const [modalOpen, setModalOpen] = useState(false)
    const [editing, setEditing] = useState(null)

    /* timeline / map selection */
    const [selectedId, setSelectedId] = useState(null)

    /* ── load operations + volunteers from the API ─────────── */
    useEffect(() => {
        const ctrl = new AbortController()
        Promise.all([
            fetchOperations(ctrl.signal),
            fetchVolunteers(ctrl.signal)
        ])
            .then(([ops, vols]) => {
                setOperations(ops)
                setVolunteers(vols)
                setLoading(false)
            })
            .catch(err => {
                if (err.name === 'AbortError') return
                setLoadErr(err.message || 'Failed to load operations.')
                setLoading(false)
            })
        return () => ctrl.abort()
    }, [reloadKey])

    /* assigned volunteers per operation name */
    const assignedByName = useMemo(() => {
        const map = new Map()
        for (const v of volunteers) {
            if (v.assignment?.status !== 'ASSIGNED') continue
            const key = v.operationName || v.assignment?.operationName || ''
            if (key) map.set(key, (map.get(key) || 0) + 1)
        }
        return map
    }, [volunteers])

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase()
        return operations.filter(op => {
            if (needle) {
                const hay = [op.name, op.location, op.status].join(' ').toLowerCase()
                if (!hay.includes(needle)) return false
            }
            if (statusFilter && op.status !== statusFilter) return false
            return true
        })
    }, [operations, q, statusFilter])

    const overview = useMemo(() => {
        const active = operations.filter(o => o.status === 'ACTIVE').length
        const needed = operations.reduce((sum, o) => sum + (o.requiredVolunteers || 0), 0)
        const assigned = operations.reduce(
            (sum, o) => sum + (assignedByName.get(o.name) || 0),
            0
        )
        const locations = new Set(operations.map(o => o.location).filter(Boolean)).size
        return { active, needed, assigned, locations }
    }, [operations, assignedByName])

    const selected =
        operations.find(o => o.id === selectedId) ||
        filtered[0] ||
        operations[0] ||
        null

    const assignedVolunteers = useMemo(() => {
        if (!selected) return []
        return volunteers.filter(v =>
            v.assignment?.status === 'ASSIGNED' &&
            (v.operationName || v.assignment?.operationName) === selected.name
        )
    }, [volunteers, selected])

    const refresh = () => {
        setRefreshing(true)
        setLoading(true)
        setLoadErr('')
        setReloadKey(k => k + 1)
        setTimeout(() => setRefreshing(false), 400)
    }

    const applySaved = (op) => {
        if (!op) return
        const norm = { ...op, id: op._id }
        setOperations(prev =>
            prev.some(x => x.id === norm.id)
                ? prev.map(x => (x.id === norm.id ? norm : x))
                : [norm, ...prev]
        )
    }

    const removeOperation = async (op) => {
        if (!window.confirm(`Delete "${op.name}"? This cannot be undone.`)) return
        try {
            const res = await fetch(`${API_BASE}/api/operations/${op.id}`, {
                method: 'DELETE',
                credentials: 'include'
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || 'Failed to delete the operation.')
            setOperations(prev => prev.filter(x => x.id !== op.id))
            if (selectedId === op.id) setSelectedId(null)
        } catch (e) {
            window.alert(e.message || 'Failed to delete the operation.')
        }
    }

    /* advance / reset the action timeline (partial PUT — auth required) */
    const setStage = async (op, nextStage) => {
        try {
            const res = await fetch(`${API_BASE}/api/operations/${op.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ stage: nextStage })
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || 'Failed to update the timeline.')
            applySaved(data.operation)
        } catch (e) {
            window.alert(e.message || 'Failed to update the timeline.')
        }
    }

    /* CSV report of the (filtered) operations table */
    const generateReport = () => {
        const rows = [
            ['Operation Name', 'Location', 'Required Volunteers', 'Assigned', 'Status', 'Created'],
            ...filtered.map(o => [
                o.name,
                o.location || '',
                o.requiredVolunteers || 0,
                assignedByName.get(o.name) || 0,
                o.status,
                o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''
            ])
        ]
        const csv = rows
            .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
            .join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `relief-operations-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const stage = selected?.stage || 0
    const mapSrc = selected?.location
        ? `https://maps.google.com/maps?q=${encodeURIComponent(`${selected.location}, Sri Lanka`)}&z=12&output=embed`
        : 'https://maps.google.com/maps?q=Sri%20Lanka&z=7&output=embed'

    return (
        <section className="space-y-6">
            {/* page header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Distribution Operations</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Manage field operations and volunteer needs
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={generateReport}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                    >
                        <FileDown size={16} /> Generate Report
                    </button>
                    <button
                        type="button"
                        onClick={() => { setEditing(null); setModalOpen(true) }}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                        <Plus size={16} /> New Operation
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

            {/* overview cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    { label: 'Active Operations', value: overview.active, cls: 'text-blue-600' },
                    { label: 'Volunteers Needed', value: overview.needed, cls: 'text-amber-600' },
                    { label: 'Volunteers Assigned', value: overview.assigned, cls: 'text-emerald-600' },
                    { label: 'Locations Covered', value: overview.locations, cls: 'text-violet-600' }
                ].map(c => (
                    <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {c.label}
                        </p>
                        <p className={`mt-1 text-2xl font-bold ${c.cls}`}>
                            {loading ? '—' : c.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search operations…"
                        className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                    <option value="">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PENDING">Pending</option>
                </select>
                <button
                    type="button"
                    onClick={refresh}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                    <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
                </button>
            </div>

            {/* operations table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Operation Name</th>
                            <th className="px-4 py-3">Location</th>
                            <th className="px-4 py-3">Required Volunteers</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && (
                            <tr>
                                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                                    Loading operations…
                                </td>
                            </tr>
                        )}
                        {!loading && filtered.map(op => {
                            const assigned = assignedByName.get(op.name) || 0
                            const required = op.requiredVolunteers || 0
                            const remaining = Math.max(required - assigned, 0)
                            return (
                                <tr
                                    key={op.id}
                                    onClick={() => setSelectedId(op.id)}
                                    className={`cursor-pointer hover:bg-slate-50 ${selected?.id === op.id ? 'bg-blue-50/50' : ''}`}
                                >
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-800">{op.name}</p>
                                        <p className="text-xs text-slate-400">Created {fmtDate(op.createdAt)}</p>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{op.location || '—'}</td>
                                    <td className="px-4 py-3">
                                        <span className="font-semibold text-slate-800">{remaining}</span>
                                        <span className="text-xs text-slate-500">
                                            {' '}remaining (of {required} — {assigned} assigned)
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                op.status === 'ACTIVE'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}
                                        >
                                            {op.status === 'ACTIVE' ? 'Active' : 'Pending'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setEditing(op); setModalOpen(true) }}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                            >
                                                <Pencil size={12} /> Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); removeOperation(op) }}
                                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50"
                                            >
                                                <Trash2 size={12} /> Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        {!loading && filtered.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                                    No operations match the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* action timeline + map */}
            <div className="grid gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Action Timeline</h2>
                            <p className="text-xs text-slate-500">
                                {selected ? selected.name : 'Select an operation to track its progress'}
                            </p>
                        </div>
                        {selected && (
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setStage(selected, Math.max(0, stage - 1))}
                                    disabled={stage <= 0}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                >
                                    <RotateCcw size={13} /> Step back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStage(selected, Math.min(TIMELINE_STEPS.length, stage + 1))}
                                    disabled={stage >= TIMELINE_STEPS.length}
                                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                                >
                                    Advance <ChevronRight size={13} />
                                </button>
                            </div>
                        )}
                    </div>
                    {selected ? (
                        <ol className="space-y-3">
                            {TIMELINE_STEPS.map((step, i) => {
                                const done = i < stage
                                const current = i === stage
                                return (
                                    <li key={step} className="flex items-center gap-3">
                                        <span
                                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
                                                done
                                                    ? 'bg-emerald-500 text-white'
                                                    : current
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-slate-200 text-slate-500'
                                            }`}
                                        >
                                            {i + 1}
                                        </span>
                                        <span
                                            className={`text-sm ${
                                                done
                                                    ? 'text-emerald-700'
                                                    : current
                                                        ? 'font-semibold text-slate-800'
                                                        : 'text-slate-400'
                                            }`}
                                        >
                                            {step}
                                        </span>
                                    </li>
                                )
                            })}
                        </ol>
                    ) : (
                        <p className="py-10 text-center text-sm text-slate-500">
                            No operation selected.
                        </p>
                    )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-slate-800">Location / Map</h2>
                        <p className="text-xs text-slate-500">
                            {selected ? (selected.location || 'No location recorded') : 'Select an operation'}
                        </p>
                    </div>
                    <div className="h-[300px] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <iframe
                            src={mapSrc}
                            title="Operation location map"
                            className="h-full w-full border-0"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    </div>
                    {selected?.location && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                            <MapPin size={13} /> {selected.location}
                        </p>
                    )}
                </div>
            </div>

            {/* assigned volunteers */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Assigned Volunteers</h2>
                        <p className="text-xs text-slate-500">
                            {selected
                                ? `${assignedVolunteers.length} assigned to ${selected.name}`
                                : 'Select an operation to see its team'}
                        </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <Users size={13} /> {assignedVolunteers.length}
                    </span>
                </div>
                {assignedVolunteers.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">
                        {loading
                            ? 'Loading volunteers…'
                            : 'No volunteers are assigned to this operation yet. Assign them from the Volunteers & Assignments page.'}
                    </p>
                ) : (
                    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {assignedVolunteers.map(v => (
                            <li
                                key={v.id}
                                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                            >
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">
                                        {v.fullName}
                                    </p>
                                    <p className="truncate text-xs text-slate-500">
                                        {(v.roles || []).join(', ') || 'Volunteer'}
                                        {v.phone ? ` · ${v.phone}` : ''}
                                    </p>
                                </div>
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                                    <UserCheck size={12} /> Assigned
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* add / edit modal (mounted only while open → fresh form state) */}
            {modalOpen && (
                <OperationModal
                    open
                    initial={editing}
                    onClose={() => setModalOpen(false)}
                    onSaved={applySaved}
                />
            )}
        </section>
    )
}
