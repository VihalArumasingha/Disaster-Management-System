import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    RefreshCw, RotateCcw, FileText, Users, ExternalLink,
    Search, ChevronDown, MessageCircle, Image, X, Pencil
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

/* ── helpers ────────────────────────────────────────────────────── */
const fmt = (n, cur = 'LKR') => {
    const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : 'Rs'
    return `${sym} ${Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2 })}`
}

const statusColor = (s) =>
    s === 'VERIFIED'  ? 'bg-green-100 text-green-700' :
    s === 'REJECTED'  ? 'bg-red-100 text-red-700'    :
    'bg-blue-100 text-blue-700'   // RECEIVED

const typeColor = (t) =>
    t === 'Organization' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'

function buildWhatsApp(phone, name, amount, currency) {
    if (!phone) return null
    let n = String(phone).replace(/[^\d+]/g, '')
    if (/^0\d/.test(n)) n = '+94' + n.slice(1)
    const digits = n.replace(/\D/g, '')
    if (digits.length < 9) return null
    const msg = `Hello ${name || 'Donor'}, thank you for your generous donation of ${fmt(amount, currency)} to SafeZone Disaster Relief! We truly appreciate your support. 🙏`
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
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
/* ── Slip image URL (Cloudinary absolute URL, or legacy local path) ─ */
const slipUrl = (p) =>
    /^https?:\/\//i.test(p) ? p : `${API_BASE}/${String(p).replace(/\\/g, '/')}`

/* ── Slip thumbnail → opens the lightbox ────────────────────────── */
function SlipCell({ donation, onPreview }) {
    const [failed, setFailed] = useState(false)
    const url = slipUrl(donation.evidencePath)

    // Image didn't load (e.g., legacy local file no longer served) → plain link
    if (failed) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noreferrer"
                title="Open slip"
                className="flex items-center gap-1 rounded-lg bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
            >
                <Image size={12} /> View
            </a>
        )
    }

    return (
        <button
            type="button"
            onClick={() => onPreview({ url, name: donation.donorName || donation.donorEmail || 'Donor' })}
            title="View slip"
            className="group relative block h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
            <img
                src={url}
                alt={`Slip — ${donation.donorName || 'donation'}`}
                loading="lazy"
                onError={() => setFailed(true)}
                className="h-full w-full object-cover transition group-hover:scale-110"
            />
            <span className="absolute inset-0 hidden items-center justify-center bg-slate-900/50 group-hover:flex">
                <Image size={14} className="text-white" />
            </span>
        </button>
    )
}


export default function DonationPage() {
    const nav = useNavigate()

    /* ── state ── */
    const [donations, setDonations]     = useState([])
    const [total, setTotal]             = useState(0)
    const [pages, setPages]             = useState(1)
    const [loading, setLoading]         = useState(false)
    const [error, setError]             = useState('')

    const [search, setSearch]           = useState('')
    const [filterDonor, setFilterDonor] = useState('')   // 'Individual' | 'Organization'
    const [filterChannel, setFilterChannel] = useState('')
    const [filterCurrency, setFilterCurrency] = useState('')
    const [perPage, setPerPage]         = useState('10')
    const [page, setPage]               = useState(1)

    /* slip lightbox: { url, name } or null */
    const [preview, setPreview]         = useState(null)

    // Close slip lightbox on Escape
    useEffect(() => {
        if (!preview) return
        const onKey = e => { if (e.key === 'Escape') setPreview(null) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [preview])

    const searchTimeout = useRef(null)

    /* ── fetch ── */
    const load = useCallback(async (p = page) => {
        setLoading(true)
        setError('')
        try {
            const params = new URLSearchParams({ page: p, limit: perPage })
            if (filterDonor)    params.set('donorType', filterDonor)
            if (filterChannel)  params.set('channel', filterChannel)
            if (filterCurrency) params.set('currency', filterCurrency)
            if (search.trim())  params.set('q', search.trim())

            const res = await fetch(`${API_BASE}/api/donations?${params}`, { credentials: 'include' })
            if (!res.ok) throw new Error(`Server error ${res.status}`)
            const json = await res.json()
            setDonations(json.data || [])
            setTotal(json.pagination?.total || 0)
            setPages(json.pagination?.pages || 1)
        } catch (e) {
            setError(e.message || 'Failed to load donations')
        } finally {
            setLoading(false)
        }
    }, [page, perPage, filterDonor, filterChannel, filterCurrency, search])

    useEffect(() => { load() }, [load])

    /* ── change donation status ── */
    const changeStatus = async (id, newStatus) => {
        try {
            const res = await fetch(`${API_BASE}/api/donations/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
            })
            if (!res.ok) throw new Error(`Server error ${res.status}`)
            // Update locally to avoid a full re-fetch
            setDonations(prev =>
                prev.map(d => d._id === id ? { ...d, status: newStatus } : d)
            )
        } catch (e) {
            setError(e.message || 'Failed to update status')
        }
    }

    const handleSearch = (v) => {
        setSearch(v)
        clearTimeout(searchTimeout.current)
        searchTimeout.current = setTimeout(() => { setPage(1); load(1) }, 400)
    }

    const reset = () => {
        setSearch(''); setFilterDonor(''); setFilterChannel('')
        setFilterCurrency(''); setPerPage('10'); setPage(1)
    }

    /* ── top donors (by amount) ── */
    const topDonors = [...donations]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)

    /* ── export PDF ── */
    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

        // ── Title block ──
        doc.setFontSize(18)
        doc.setTextColor(29, 78, 216)   // blue-700
        doc.text('SafeZone — Donations Report', 14, 18)

        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139) // slate-500
        doc.text(`Generated: ${new Date().toLocaleString('en-LK')}`, 14, 25)
        doc.text(`Total records: ${total}`, 14, 30)

        // Applied filters note
        const filters = []
        if (filterDonor)    filters.push(`Donor: ${filterDonor}`)
        if (filterChannel)  filters.push(`Channel: ${filterChannel}`)
        if (filterCurrency) filters.push(`Currency: ${filterCurrency}`)
        if (search)         filters.push(`Search: "${search}"`)
        if (filters.length) {
            doc.text(`Filters: ${filters.join(' | ')}`, 14, 35)
        }

        // ── Table ──
        const rows = donations.map(d => [
            d.isAnonymous ? 'Anonymous' : (d.donorName || '—'),
            d.donorType || '—',
            d.donorEmail  || '—',
            d.donorPhone  || '—',
            fmt(d.amount, d.currency),
            d.channel     || '—',
            d.referenceNo || '—',
            d.createdAt
                ? new Date(d.createdAt).toLocaleString('en-LK', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })
                : '—',
            d.status      || '—',
            d.isAnonymous ? 'Anonymous' : 'Public',
        ])

        autoTable(doc, {
            startY: filters.length ? 40 : 35,
            head: [[
                'Donor Name', 'Type', 'Email', 'Phone',
                'Amount', 'Channel', 'Ref / Txn', 'Date', 'Status', 'Visibility'
            ]],
            body: rows,
            styles:     { fontSize: 7.5, cellPadding: 2.5, overflow: 'linebreak' },
            headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold', fontSize: 8 },
            alternateRowStyles: { fillColor: [241, 245, 249] },
            columnStyles: {
                0: { cellWidth: 28 },  // Donor Name
                1: { cellWidth: 18 },  // Type
                2: { cellWidth: 38 },  // Email
                3: { cellWidth: 24 },  // Phone
                4: { cellWidth: 22 },  // Amount
                5: { cellWidth: 22 },  // Channel
                6: { cellWidth: 20 },  // Ref
                7: { cellWidth: 30 },  // Date
                8: { cellWidth: 18 },  // Status
                9: { cellWidth: 18 },  // Visibility
            },
            didDrawPage: (data) => {
                // Footer on every page
                doc.setFontSize(7)
                doc.setTextColor(150)
                doc.text(
                    `Page ${data.pageNumber}  •  SafeZone NGO Donations`,
                    doc.internal.pageSize.getWidth() / 2,
                    doc.internal.pageSize.getHeight() - 6,
                    { align: 'center' }
                )
            }
        })

        doc.save(`donations-${new Date().toISOString().slice(0, 10)}.pdf`)
    }

    /* ── channels present in data ── */
    const allChannels = [...new Set(donations.map(d => d.channel).filter(Boolean))]

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            {/* ── Page header ── */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-blue-700">Donations Panel</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => {/* top donors modal placeholder */}}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        <Users size={15} /> Top donors
                    </button>
                    <button
                        onClick={() => nav('/ngomanager/donations/new')}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        <ExternalLink size={15} /> Open Donation Form
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
                        placeholder="Search name / email / phone / reference… (tip: type 'organisation list')"
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                {/* Dropdowns */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Select
                        icon={<Users size={14} />}
                        label="All donors"
                        value={filterDonor}
                        onChange={v => { setFilterDonor(v); setPage(1) }}
                        options={[
                            { value: 'Individual',   label: 'Individual' },
                            { value: 'Organization', label: 'Organization' },
                        ]}
                    />
                    <Select
                        icon={<span className="text-xs">🔗</span>}
                        label="All channels"
                        value={filterChannel}
                        onChange={v => { setFilterChannel(v); setPage(1) }}
                        options={[
                            { value: 'Bank deposit',    label: 'Bank deposit' },
                            { value: 'Online gateway',  label: 'Online gateway' },
                            { value: 'Cash',            label: 'Cash' },
                        ]}
                    />
                    <Select
                        icon={<span className="text-xs">💰</span>}
                        label="All currencies"
                        value={filterCurrency}
                        onChange={v => { setFilterCurrency(v); setPage(1) }}
                        options={[
                            { value: 'LKR', label: 'LKR' },
                            { value: 'USD', label: 'USD' },
                            { value: 'EUR', label: 'EUR' },
                        ]}
                    />
                    <Select
                        icon={<span className="text-xs">📄</span>}
                        label="Per page"
                        value={perPage}
                        onChange={v => { setPerPage(v); setPage(1) }}
                        options={[
                            { value: '10',  label: '10 / page' },
                            { value: '25',  label: '25 / page' },
                            { value: '50',  label: '50 / page' },
                            { value: '100', label: '100 / page' },
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
                        <FileText size={14} /> Export PDF
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
                                {['Donor','Email','Phone','Amount','Channel','Ref / Txn','Date','Slip','Status','Visibility','Action'].map(h => (
                                    <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-slate-600 first:pl-5">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {loading && (
                                <tr>
                                    <td colSpan={11} className="py-16 text-center text-slate-500">
                                        Loading donations…
                                    </td>
                                </tr>
                            )}
                            {!loading && donations.length === 0 && (
                                <tr>
                                    <td colSpan={11} className="py-16 text-center text-slate-400">
                                        No donations found.
                                    </td>
                                </tr>
                            )}
                            {!loading && donations.map(d => {
                                const waUrl = buildWhatsApp(
                                    d.whatsapp || d.donorPhone,
                                    d.donorName,
                                    d.amount,
                                    d.currency
                                )
                                const dateStr = d.createdAt
                                    ? new Date(d.createdAt).toLocaleString('en-LK', {
                                        month: 'short', day: 'numeric', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                      })
                                    : '—'

                                return (
                                    <tr key={d._id} className="hover:bg-slate-50 transition">
                                        {/* Donor */}
                                        <td className="pl-5 pr-4 py-3">
                                            <p className="font-semibold text-slate-800">
                                                {d.isAnonymous ? 'Anonymous' : (d.donorName || '—')}
                                            </p>
                                            <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColor(d.donorType)}`}>
                                                {d.donorType}
                                            </span>
                                            <p className="text-[10px] text-slate-400">Donor</p>
                                        </td>

                                        {/* Email */}
                                        <td className="px-4 py-3 text-slate-600">
                                            {d.donorEmail || <span className="text-slate-300">—</span>}
                                        </td>

                                        {/* Phone */}
                                        <td className="px-4 py-3 text-slate-600">
                                            <p>{d.donorPhone || <span className="text-slate-300">—</span>}</p>
                                            {d.whatsapp && d.whatsapp !== d.donorPhone && (
                                                <p className="text-[11px] text-green-600">WA: {d.whatsapp}</p>
                                            )}
                                        </td>

                                        {/* Amount */}
                                        <td className="px-4 py-3 font-semibold text-green-600 whitespace-nowrap">
                                            {fmt(d.amount, d.currency)}
                                        </td>

                                        {/* Channel */}
                                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                            {d.channel || '—'}
                                        </td>

                                        {/* Ref / Txn */}
                                        <td className="px-4 py-3 text-slate-600">
                                            {d.referenceNo || <span className="text-slate-300">—</span>}
                                        </td>

                                        {/* Date */}
                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">
                                            {dateStr}
                                        </td>

                                        {/* Slip */}
                                        <td className="px-4 py-3">
                                            {d.evidencePath
                                                ? <SlipCell donation={d} onPreview={setPreview} />
                                                : <span className="text-slate-300 text-xs">—</span>}
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3">
                                            <select
                                                value={d.status}
                                                onChange={e => changeStatus(d._id, e.target.value)}
                                                className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-semibold border-0 outline-none focus:ring-2 focus:ring-blue-500/30 ${statusColor(d.status)}`}
                                            >
                                                <option value="RECEIVED">RECEIVED</option>
                                                <option value="VERIFIED">VERIFIED</option>
                                                <option value="REJECTED">REJECTED</option>
                                            </select>
                                        </td>

                                        {/* Visibility */}
                                        <td className="px-4 py-3">
                                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                                d.isAnonymous ? 'bg-slate-100 text-slate-500' : 'bg-green-50 text-green-700'
                                            }`}>
                                                {d.isAnonymous ? 'Anonymous' : 'Public'}
                                            </span>
                                        </td>

                                        {/* Action */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => nav(`/ngomanager/donations/${d._id}/edit`)}
                                                    title="Edit donation"
                                                    className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                                >
                                                    <Pencil size={12} /> Edit
                                                </button>
                                                {waUrl ? (
                                                    <a
                                                        href={waUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="flex items-center gap-1 rounded-lg bg-green-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-600"
                                                    >
                                                        <MessageCircle size={12} /> WhatsApp
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination ── */}
                {pages > 1 && (
                    <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
                        <p className="text-xs text-slate-500">
                            Showing {donations.length} of {total} donations
                        </p>
                        <div className="flex gap-1">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                                ← Prev
                            </button>
                            {Array.from({ length: pages }, (_, i) => i + 1)
                                .filter(n => Math.abs(n - page) <= 2)
                                .map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setPage(n)}
                                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                                            n === page
                                                ? 'bg-blue-600 text-white'
                                                : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            <button
                                disabled={page >= pages}
                                onClick={() => setPage(p => p + 1)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Slip lightbox ── */}
            {preview && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
                    onClick={() => setPreview(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Donation slip preview"
                >
                    <div
                        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-800">Donation slip</p>
                                <p className="text-xs text-slate-500">{preview.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={preview.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                >
                                    Open original
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setPreview(null)}
                                    aria-label="Close preview"
                                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="grid max-h-[75vh] place-items-center overflow-auto bg-slate-100 p-4">
                            <img
                                src={preview.url}
                                alt="Donation slip"
                                className="max-h-[70vh] w-auto rounded-lg object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
