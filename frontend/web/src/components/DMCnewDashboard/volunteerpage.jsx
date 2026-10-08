import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Search, ChevronDown, X, Pencil, Trash2, RefreshCw,
    MessageCircle, Plus
} from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────
 * API-backed volunteer store (MongoDB via Express).
 * GET/POST /api/volunteers are public; PUT/PATCH/DELETE require an
 * NGO manager session (credentials: 'include').
 * ───────────────────────────────────────────────────────────────── */
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

/** Fetch all volunteers and normalise Mongo `_id` → `id`. */
export async function fetchVolunteers(signal) {
    const res = await fetch(`${API_BASE}/api/volunteers`, {
        credentials: 'include',
        signal
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.message || 'Failed to load volunteers.')
    const list = Array.isArray(data.volunteers) ? data.volunteers : []
    return list.map(v => ({ ...v, id: v._id }))
}

export const PRESET_ROLES = ['Driver', 'Medic', 'Logistics', 'Cooking', 'Translator']
export const PRESET_LANGS = ['Sinhala', 'Tamil', 'English']

/* ── shared display helpers ───────────────────────────────────── */
export const timeLabel = (t) =>
    t === 'daytime' ? 'Daytime' : t === 'night' ? 'Night' : 'Both (24h)'

export const fmtDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(`${iso}T00:00:00`)
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
}

const waHref = (phone, name) => {
    if (!phone) return null
    let n = String(phone).replace(/[^\d+]/g, '')
    if (/^0\d/.test(n)) n = `+94${n.slice(1)}`
    const digits = n.replace(/\D/g, '')
    if (digits.length < 9) return null
    const msg = `Hello ${name || 'there'}, SafeZone would like to connect with you about your volunteer assignment.`
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
}

/* ══════════════════════════════════════════════════════════════ */
/* ── Volunteers list page ─────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════ */
export default function VolunteerPage() {
    const navigate = useNavigate()
    const [volunteers, setVolunteers] = useState([])
    const [loading, setLoading] = useState(true)
    const [loadErr, setLoadErr] = useState('')
    const [refreshing, setRefreshing] = useState(false)
    const [reloadKey, setReloadKey] = useState(0)

    /* ── load from the API ──────────────────────────────────── */
    useEffect(() => {
        const ctrl = new AbortController()
        setLoading(true)
        setLoadErr('')
        fetchVolunteers(ctrl.signal)
            .then(list => { setVolunteers(list); setLoading(false) })
            .catch(err => {
                if (err.name === 'AbortError') return
                setLoadErr(err.message || 'Failed to load volunteers.')
                setLoading(false)
            })
        return () => ctrl.abort()
    }, [reloadKey])

    /* filters */
    const [q, setQ]           = useState('')
    const [type, setType]     = useState('')   // '' | 'individual' | 'team'
    const [assign, setAssign] = useState('')   // '' | 'ASSIGNED' | 'UNASSIGNED'
    const [opFilter, setOpFilter] = useState('')
    const [langs, setLangs]   = useState([])   // must-have-ALL
    const [roles, setRoles]   = useState([])   // must-have-ALL
    const [time, setTime]     = useState('')   // '' | 'daytime' | 'night' | 'both'
    const [dateFrom, setDateFrom] = useState('')

    const operationOptions = useMemo(() => {
        const names = [...new Set(volunteers.map(v => v.operationName).filter(Boolean))]
        return names.map(n => ({ value: n, label: n }))
    }, [volunteers])

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase()
        return volunteers.filter(v => {
            if (needle) {
                const hay = [
                    v.fullName, v.email, v.phone, v.whatsapp, v.livingArea,
                    v.group, v.operationName, v.notes,
                    ...(v.roles || []), ...(v.languages || [])
                ].join(' ').toLowerCase()
                if (!hay.includes(needle)) return false
            }
            if (type && v.volunteerType !== type) return false
            if (assign && (v.assignment?.status || 'UNASSIGNED') !== assign) return false
            if (opFilter && v.operationName !== opFilter) return false
            if (langs.length && !langs.every(l => (v.languages || []).includes(l))) return false
            if (roles.length && !roles.every(r => (v.roles || []).includes(r))) return false
            if (time && v.availableTime !== time) return false
            if (dateFrom && (!v.availableDate || v.availableDate < dateFrom)) return false
            return true
        })
    }, [volunteers, q, type, assign, opFilter, langs, roles, time, dateFrom])

    const activeFilters = [
        type && { key: 'type', label: `Type: ${type === 'team' ? 'Team' : 'Individual'}`, clear: () => setType('') },
        assign && { key: 'assign', label: `Status: ${assign === 'ASSIGNED' ? 'Assigned' : 'Unassigned'}`, clear: () => setAssign('') },
        opFilter && { key: 'op', label: `Operation: ${opFilter}`, clear: () => setOpFilter('') },
        ...langs.map(l => ({ key: `l-${l}`, label: `Language: ${l}`, clear: () => setLangs(p => p.filter(x => x !== l)) })),
        ...roles.map(r => ({ key: `r-${r}`, label: `Role: ${r}`, clear: () => setRoles(p => p.filter(x => x !== r)) })),
        time && { key: 'time', label: `Time: ${timeLabel(time)}`, clear: () => setTime('') },
        dateFrom && { key: 'date', label: `From: ${fmtDate(dateFrom)}`, clear: () => setDateFrom('') }
    ].filter(Boolean)

    const clearAdvanced = () => {
        setType(''); setAssign(''); setOpFilter('')
        setLangs([]); setRoles([]); setTime(''); setDateFrom('')
    }

    const toggleIn = (setter, value) =>
        setter(prev => prev.includes(value) ? prev.filter(x => x !== value) : [...prev, value])

    const refresh = () => {
        setRefreshing(true)
        setReloadKey(k => k + 1)
        setTimeout(() => setRefreshing(false), 400)
    }

    /* ── row actions (API) ──────────────────────────────────── */
    const setAssignment = async (v, status) => {
        try {
            const res = await fetch(`${API_BASE}/api/volunteers/${v.id}/assignment`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status })
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || 'Failed to update assignment.')
            const updated = data.volunteer
            setVolunteers(prev => prev.map(x => x.id !== v.id ? x : { ...updated, id: updated._id }))
        } catch (err) {
            window.alert(err.message || 'Failed to update assignment.')
        }
    }

    const removeVolunteer = async (v) => {
        if (!window.confirm(`Delete ${v.fullName}? This cannot be undone.`)) return
        try {
            const res = await fetch(`${API_BASE}/api/volunteers/${v.id}`, {
                method: 'DELETE',
                credentials: 'include'
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || 'Failed to delete volunteer.')
            setVolunteers(prev => prev.filter(x => x.id !== v.id))
        } catch (err) {
            window.alert(err.message || 'Failed to delete volunteer.')
        }
    }

    /* ── render ─────────────────────────────────────────────── */
    return (
        <div className="px-4 py-6 lg:px-8">
            {/* Header */}
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
                        SafeZone operations
                    </p>
                    <h1 className="mt-1 text-2xl font-bold text-slate-900">
                        Volunteers &amp; Assignments
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Search, filter and assign volunteers to active operations.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/ngomanager/volunteers/new')}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                    >
                        <Plus size={16} /> Add volunteer
                    </button>
                    <button
                        type="button"
                        onClick={refresh}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {/* Search */}
                <div className="relative">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={q}
                        onChange={e => setQ(e.target.value)}
                        placeholder="Search name, phone, email, living area, operation, roles, languages, notes..."
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                {/* Type / Assignment / Operation */}
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {[
                        { icon: '👤', label: 'Type', value: type, set: setType, options: [
                            { value: '', label: 'All types' },
                            { value: 'individual', label: 'Individual' },
                            { value: 'team', label: 'Team' }
                        ]},
                        { icon: '📋', label: 'Assignment', value: assign, set: setAssign, options: [
                            { value: '', label: 'All assignments' },
                            { value: 'ASSIGNED', label: 'Assigned' },
                            { value: 'UNASSIGNED', label: 'Unassigned' }
                        ]},
                        { icon: '🎯', label: 'Operation', value: opFilter, set: setOpFilter, options: [
                            { value: '', label: 'All operations' },
                            ...operationOptions
                        ]}
                    ].map(({ icon, label, value, set, options }) => (
                        <div key={label}>
                            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                <span>{icon}</span> {label}
                            </p>
                            <div className="relative">
                                <select
                                    value={value}
                                    onChange={e => set(e.target.value)}
                                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                >
                                    {options.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Language / Role chips (must have ALL selected) */}
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                        <p className="mb-2 text-center text-xs font-semibold text-slate-500">
                            Language (must have ALL selected)
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_LANGS.map(l => (
                                <button
                                    key={l}
                                    type="button"
                                    onClick={() => toggleIn(setLangs, l)}
                                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                                        langs.includes(l)
                                            ? 'border-slate-500 bg-slate-100 text-slate-900'
                                            : 'border-slate-300 text-slate-600 hover:border-slate-400'
                                    }`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="mb-2 text-center text-xs font-semibold text-slate-500">
                            Role (must have ALL selected)
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_ROLES.map(r => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => toggleIn(setRoles, r)}
                                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                                        roles.includes(r)
                                            ? 'border-slate-500 bg-slate-100 text-slate-900'
                                            : 'border-slate-300 text-slate-600 hover:border-slate-400'
                                    }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Available time / Date from / Clear advanced */}
                <div className="mt-4 grid items-end gap-3 md:grid-cols-3">
                    <div>
                        <p className="mb-1 text-center text-xs font-semibold text-slate-500">Available time</p>
                        <div className="relative">
                            <select
                                value={time}
                                onChange={e => setTime(e.target.value)}
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-8 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="">Any</option>
                                <option value="daytime">Daytime</option>
                                <option value="night">Night</option>
                                <option value="both">Both (24h)</option>
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>
                    <div>
                        <p className="mb-1 text-center text-xs font-semibold text-slate-500">Date from</p>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={clearAdvanced}
                        className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-100"
                    >
                        Clear advanced
                    </button>
                </div>
            </div>

            {/* Active filters */}
            {activeFilters.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <span className="text-xs font-semibold text-slate-500">Active filters:</span>
                    {activeFilters.map(f => (
                        <span
                            key={f.key}
                            className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white"
                        >
                            {f.label}
                            <button
                                type="button"
                                onClick={f.clear}
                                aria-label={`Remove filter ${f.label}`}
                                className="rounded-full p-0.5 hover:bg-blue-700"
                            >
                                <X size={12} />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* Loading / error */}
            {loading && (
                <p className="mt-6 text-center text-sm font-medium text-slate-500">
                    Loading volunteers…
                </p>
            )}
            {loadErr && !loading && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
                    <p className="text-sm font-medium text-red-700">{loadErr}</p>
                    <button
                        type="button"
                        onClick={() => setReloadKey(k => k + 1)}
                        className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                    >
                        Try again
                    </button>
                </div>
            )}
            {!loading && !loadErr && (
                <>
            {/* Count */}
            <p className="mt-5 text-center text-sm font-medium text-slate-600">
                Showing {filtered.length} of {volunteers.length} volunteers
            </p>

            {/* Table */}
            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full min-w-[1150px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Roles</th>
                            <th className="px-4 py-3">Languages</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Available time</th>
                            <th className="px-4 py-3">Living area</th>
                            <th className="px-4 py-3">Operation</th>
                            <th className="px-4 py-3">Assignment</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                        {filtered.map(v => {
                            const assigned = v.assignment?.status === 'ASSIGNED'
                            const wa = waHref(v.whatsapp || v.phone, v.fullName)
                            return (
                                <tr key={v.id} className="align-top hover:bg-slate-50">
                                    {/* Name */}
                                    <td className="px-4 py-3">
                                        <p className="font-semibold text-slate-900">{v.fullName}</p>
                                        <p className="text-xs text-slate-500">{v.email}</p>
                                        {v.group && <p className="text-xs text-slate-400">{v.group}</p>}
                                    </td>
                                    {/* Phone */}
                                    <td className="px-4 py-3">
                                        <a href={`tel:${v.phone}`} className="font-medium text-blue-600 hover:underline">
                                            {v.phone}
                                        </a>
                                        {v.whatsapp && (
                                            <p className="text-xs text-slate-500">WA: {v.whatsapp}</p>
                                        )}
                                    </td>
                                    {/* Type */}
                                    <td className="px-4 py-3">
                                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                            v.volunteerType === 'team'
                                                ? 'bg-amber-100 text-amber-700'
                                                : 'bg-green-100 text-green-700'
                                        }`}>
                                            {v.volunteerType === 'team' ? `TEAM (${v.members})` : 'INDIVIDUAL'}
                                        </span>
                                    </td>
                                    {/* Roles */}
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {(v.roles || []).map(r => (
                                                <span key={r} className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                                                    {r}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    {/* Languages */}
                                    <td className="px-4 py-3 text-xs">
                                        {(v.languages || []).join(', ') || '—'}
                                    </td>
                                    {/* Date */}
                                    <td className="px-4 py-3 text-xs">{fmtDate(v.availableDate)}</td>
                                    {/* Available time */}
                                    <td className="px-4 py-3 text-xs">{timeLabel(v.availableTime)}</td>
                                    {/* Living area */}
                                    <td className="px-4 py-3 text-xs">{v.livingArea || '—'}</td>
                                    {/* Operation */}
                                    <td className="px-4 py-3 text-xs">{v.operationName || '—'}</td>
                                    {/* Assignment */}
                                    <td className="px-4 py-3">
                                        {assigned ? (
                                            <div>
                                                <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700">
                                                    ASSIGNED
                                                </span>
                                                <p className="mt-1 text-xs text-slate-500">
                                                    To: {v.assignment.operationName}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Date: {fmtDate(v.assignment.date)}
                                                </p>
                                            </div>
                                        ) : (
                                            <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-600">
                                                UNASSIGNED
                                            </span>
                                        )}
                                    </td>
                                    {/* Actions */}
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap justify-end gap-2">
                                            {assigned ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setAssignment(v, 'UNASSIGNED')}
                                                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                                >
                                                    Unassign
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setAssignment(v, 'ASSIGNED')}
                                                    className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                                                >
                                                    Assign
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => navigate(`/ngomanager/volunteers/${v.id}/edit`)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                            >
                                                <Pencil size={12} /> Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeVolunteer(v)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50"
                                            >
                                                <Trash2 size={12} /> Delete
                                            </button>
                                            {wa && (
                                                <a
                                                    href={wa}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-600 hover:bg-emerald-50"
                                                >
                                                    <MessageCircle size={12} /> WhatsApp
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-500">
                                    No volunteers match the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
                </>
            )}
        </div>
    )
}







