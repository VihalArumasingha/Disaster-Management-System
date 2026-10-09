import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    RefreshCw, RotateCcw, FileText, Search, ChevronDown,
    Edit, Trash2, Plus, AlertTriangle, MapPin, Package
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

/* ── helpers ────────────────────────────────────────────────────── */
const severityColor = (s) =>
    s === 'emergency' ? 'bg-red-100 text-red-700' :
    s === 'warning'   ? 'bg-orange-100 text-orange-700' :
    s === 'watch'     ? 'bg-yellow-100 text-yellow-700' :
    'bg-blue-100 text-blue-700'   // advisory

const severityLabel = (s) => {
    const labels = {
        'emergency': 'Emergency',
        'warning': 'Warning',
        'watch': 'Watch',
        'advisory': 'Advisory'
    }
    return labels[s] || s
}

const hazardTypeLabel = (t) => {
    const labels = {
        'flood': 'Flood',
        'landslide': 'Landslide',
        'tsunami': 'Tsunami',
        'storm': 'Storm',
        'other': 'Other'
    }
    return labels[t] || t
}

const statusColor = (s) =>
    s === 'issued' ? 'bg-green-100 text-green-700' :
    s === 'partially_issued' ? 'bg-yellow-100 text-yellow-700' :
    s === 'draft' ? 'bg-gray-100 text-gray-700' :
    'bg-red-100 text-red-700'

const statusLabel = (s) => {
    const labels = {
        'issued': 'Active',
        'partially_issued': 'Partially Active',
        'draft': 'Draft',
        'delivery_failed': 'Failed'
    }
    return labels[s] || s
}

/* ── Select dropdown ────────────────────────────────────────────── */
function Select({ icon, label, value, onChange, options }) {
    return (
        <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                {icon}
            </div>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
                <option value="">{label}</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════ */
export default function NGODisasterPage() {
    const nav = useNavigate()

    /* ── state ── */
    const [disasters, setDisasters]     = useState([])
    const [total, setTotal]             = useState(0)
    const [loading, setLoading]         = useState(false)
    const [error, setError]             = useState('')

    const [search, setSearch]           = useState('')
    const [filterSeverity, setFilterSeverity]   = useState('')
    const [filterActive, setFilterActive]       = useState('')
    const [filterStatus, setFilterStatus]       = useState('')

    const searchTimeout = useRef(null)

    /* ── fetch ── */
    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const params = new URLSearchParams()
            if (filterSeverity)    params.set('severity', filterSeverity)
            if (filterActive)      params.set('active', filterActive)
            if (filterStatus)      params.set('status', filterStatus)
            if (search.trim())     params.set('q', search.trim())

            const res = await fetch(`${API_BASE}/api/ngomanager/disasters?${params}`, {
                credentials: 'include'
            })
            if (!res.ok) throw new Error(`Server error ${res.status}`)
            const json = await res.json()
            
            const allDisasters = json.warnings || []
            
            setDisasters(allDisasters)
            setTotal(allDisasters.length)
        } catch (e) {
            setError(e.message || 'Failed to load disasters')
        } finally {
            setLoading(false)
        }
    }, [filterSeverity, filterActive, filterStatus, search])

    useEffect(() => { load() }, [load])

    /* ── delete disaster ── */
    const deleteDisaster = async (disasterId) => {
        if (!confirm('Are you sure you want to delete this disaster?')) return
        
        try {
            const res = await fetch(`${API_BASE}/api/ngomanager/disasters/${disasterId}`, {
                method: 'DELETE',
                credentials: 'include'
            })
            const json = await res.json().catch(() => null)
            if (!res.ok) throw new Error(json?.message || `Server error ${res.status}`)
            // Remove from local state
            setDisasters(prev => prev.filter(d => d._id !== disasterId))
            setTotal(prev => prev - 1)
        } catch (e) {
            setError(e.message || 'Failed to delete disaster')
        }
    }

    const handleSearch = (v) => {
        setSearch(v)
        clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => load(), 400)
    }

    const reset = () => {
        setSearch('')
        setFilterSeverity('')
        setFilterActive('')
        setFilterStatus('')
    }

    /* ── export PDF ── */
    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

        // ── Title block ──
        doc.setFontSize(18)
        doc.setTextColor(220, 38, 38)   // red-700
        doc.text('SafeZone — Active Disasters Report', 14, 18)

        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139) // slate-500
        doc.text(`Generated: ${new Date().toLocaleString('en-LK')}`, 14, 25)
        doc.text(`Total records: ${total}`, 14, 30)

        // Applied filters note
        const filters = []
        if (filterSeverity)   filters.push(`Severity: ${filterSeverity}`)
        if (filterActive) filters.push(`Active: ${filterActive}`)
        if (filterStatus)     filters.push(`Status: ${filterStatus}`)
        if (search)           filters.push(`Search: "${search}"`)
        if (filters.length) {
            doc.text(`Filters: ${filters.join(' | ')}`, 14, 35)
        }

        // ── Table ──
        const rows = disasters.map(d => [
            d.title || '—',
            d.city || '—',
            d.severity || 'Medium',
            d.active ? 'Yes' : 'No',
            d.showOnDonationPage ? 'Yes' : 'No',
            d.images?.length || 0,
        ])

        autoTable(doc, {
            startY: filters.length ? 40 : 35,
            head: [[
                'Disaster Name', 'City', 'Severity', 'Active', 'Show on Donation', 'Images'
            ]],
            body: rows,
            styles:     { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
            headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            alternateRowStyles: { fillColor: [241, 245, 249] },
            columnStyles: {
                0: { cellWidth: 40 },  // Name
                1: { cellWidth: 25 },  // City
                2: { cellWidth: 20 },  // Severity
                3: { cellWidth: 15 },  // Active
                4: { cellWidth: 20 },  // Show on Donation
                5: { cellWidth: 15 },  // Images
            },
            didDrawPage: (data) => {
                doc.setFontSize(7)
                doc.setTextColor(150)
                doc.text(
                    `Page ${data.pageNumber}  •  SafeZone NGO Active Disasters`,
                    doc.internal.pageSize.getWidth() / 2,
                    doc.internal.pageSize.getHeight() - 6,
                    { align: 'center' }
                )
            }
        })

        doc.save(`active-disasters-${new Date().toISOString().slice(0, 10)}.pdf`)
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            {/* ── Page header ── */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-red-700">Active Disasters</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => nav('/ngomanager/disaster/new')}
                        className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                    >
                        <Plus size={15} /> New Disaster
                    </button>
                </div>
            </div>

            {/* ── Filters card ── */}
            <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">

                {/* Search */}
                <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search disaster name or city…"
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-4 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                </div>

                {/* Dropdowns */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Select
                        icon={<AlertTriangle size={14} />}
                        label="All severities"
                        value={filterSeverity}
                        onChange={v => setFilterSeverity(v)}
                        options={[
                            { value: 'Low', label: 'Low' },
                            { value: 'Medium', label: 'Medium' },
                            { value: 'High', label: 'High' },
                            { value: 'Critical', label: 'Critical' },
                        ]}
                    />
                    <Select
                        icon={<span className="text-xs">📊</span>}
                        label="All statuses"
                        value={filterStatus}
                        onChange={v => setFilterStatus(v)}
                        options={[
                            { value: 'draft', label: 'Draft' },
                            { value: 'issued', label: 'Issued' },
                            { value: 'partially_issued', label: 'Partially issued' },
                            { value: 'delivery_failed', label: 'Failed' },
                        ]}
                    />
                    <Select
                        icon={<span className="text-xs">◈</span>}
                        label="Active / Inactive"
                        value={filterActive}
                        onChange={v => setFilterActive(v)}
                        options={[
                            { value: 'true', label: 'Active' },
                            { value: 'false', label: 'Inactive' },
                        ]}
                    />
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                    <button
                        onClick={() => load()}
                        className="flex items-center gap-1.5 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button
                        onClick={reset}
                        className="flex items-center gap-1.5 rounded-lg bg-orange-400 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
                    >
                        <RotateCcw size={14} /> Reset
                    </button>
                    <button
                        onClick={exportPDF}
                        className="flex items-center gap-1.5 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
                    >
                        <FileText size={14} /> Generate Report
                    </button>
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
            )}

            {/* ── Table ── */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <p className="border-b border-slate-100 py-2 text-center text-xs text-amber-600">
                    🔥 Table is scrollable horizontally and vertically
                </p>

                <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
                    <table className="min-w-[1000px] w-full text-sm">
                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                            <tr>
                                {['Name','City','Severity','Active','Show on Donation','Images','Actions'].map(h => (
                                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-600 first:pl-5">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {loading && (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-slate-500">
                                        Loading disasters…
                                    </td>
                                </tr>
                            )}
                            {!loading && disasters.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center text-slate-400">
                                        No active disasters found.
                                    </td>
                                </tr>
                            )}
                            {!loading && disasters.map(d => {
                                const dateStr = d.issuedAt
                                    ? new Date(d.issuedAt).toLocaleString('en-LK', {
                                        month: 'short', day: 'numeric', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                      })
                                    : '—'

                                return (
                                    <tr key={d._id} className="hover:bg-slate-50 transition">
                                        {/* Name */}
                                        <td className="pl-5 pr-4 py-3">
                                            <p className="font-semibold text-slate-800">
                                                {d.title || '—'}
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                                                {d.summary || 'No description'}
                                            </p>
                                        </td>

                                        {/* City */}
                                        <td className="px-4 py-3 text-slate-600">
                                            {d.city || '—'}
                                        </td>

                                        {/* Severity */}
                                        <td className="px-4 py-3">
                                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${severityColor(d.severity)}`}>
                                                {d.severity || 'Medium'}
                                            </span>
                                        </td>

                                        {/* Active */}
                                        <td className="px-4 py-3">
                                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${d.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                {d.active ? 'Yes' : 'No'}
                                            </span>
                                        </td>

                                        {/* Show on Donation Page */}
                                        <td className="px-4 py-3">
                                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${d.showOnDonationPage ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                {d.showOnDonationPage ? 'Yes' : 'No'}
                                            </span>
                                        </td>

                                        {/* Images */}
                                        <td className="px-4 py-3">
                                            {d.images && d.images.length > 0 ? (
                                                <div className="flex gap-1">
                                                    {d.images.slice(0, 3).map((img, idx) => {
                                                        const imgSrc = /^https?:\/\//i.test(img.url)
                                                            ? img.url
                                                            : `${API_BASE}${img.url}`
                                                        return (
                                                            <img
                                                                key={idx}
                                                                src={imgSrc}
                                                                alt="Disaster"
                                                                className="w-10 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer hover:scale-110 transition"
                                                                onClick={() => window.open(imgSrc, '_blank')}
                                                            />
                                                        )
                                                    })}
                                                    {d.images.length > 3 && (
                                                        <span className="flex items-center justify-center w-10 h-10 text-xs text-slate-500 bg-slate-100 rounded-lg">
                                                            +{d.images.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400">—</span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => nav(`/ngomanager/disaster/${d._id}/edit`)}
                                                    className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition"
                                                    title="Edit"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    onClick={() => deleteDisaster(d._id)}
                                                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 hover:text-red-700 transition"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Summary stats ── */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Total Active</p>
                    <p className="text-2xl font-bold text-slate-800">{total}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Emergencies</p>
                    <p className="text-2xl font-bold text-red-600">
                        {disasters.filter(d => d.severity === 'emergency').length}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Warnings</p>
                    <p className="text-2xl font-bold text-orange-600">
                        {disasters.filter(d => d.severity === 'warning').length}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs text-slate-500">Total Areas Affected</p>
                    <p className="text-2xl font-bold text-slate-800">
                        {disasters.reduce((sum, d) => sum + (d.targetAreaIds?.length || 0) + (d.manualTargetAreas?.length || 0), 0)}
                    </p>
                </div>
            </div>
        </div>
    )
}
