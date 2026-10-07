import { useCallback, useEffect, useState } from 'react'
import { Plus, FileText, Edit, Trash2, Loader2, RefreshCw } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import AddInventoryItem from './inventry.jsx'
import EditInventoryItem from './editinventry.jsx'
import SetInventoryTargets from './targetinventry.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

/* Item metadata — labels/units mirror the mobile donation page */
const ITEM_META = [
    { key: 'dry_rations', label: 'Dry rations', unit: 'packs' },
    { key: 'water', label: 'Water', unit: 'liters' },
    { key: 'bedding', label: 'Bedding', unit: 'sets' },
    { key: 'medical', label: 'Medical kits', unit: 'kits' },
    { key: 'clothing', label: 'Clothing', unit: 'sets' },
    { key: 'hygiene', label: 'Hygiene packs', unit: 'packs' }
]
const META_BY_KEY = Object.fromEntries(ITEM_META.map((m) => [m.key, m]))

/* 10/6/2025-style date used across the tables */
const fmtDate = (value) => {
    if (!value) return '—'
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US')
}

const coverageClass = (coverage) => {
    if (coverage >= 100) return 'bg-emerald-100 text-emerald-700'
    if (coverage >= 60) return 'bg-amber-100 text-amber-700'
    if (coverage >= 30) return 'bg-orange-100 text-orange-700'
    return 'bg-red-100 text-red-700'
}

/* Section heading used across the page */
function SectionTitle({ icon, title, subtitle }) {
    return (
        <div className="mb-4">
            <h2 className="text-2xl font-bold text-slate-900">{icon} {title}</h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function InventoryPage() {
    const [items, setItems] = useState([])
    const [targets, setTargets] = useState({})
    const [centers, setCenters] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Modal visibility
    const [addOpen, setAddOpen] = useState(false)
    const [editing, setEditing] = useState(null)
    const [targetOpen, setTargetOpen] = useState(false)

    const load = useCallback(() => (
        Promise.all([
            fetch(`${API_BASE}/api/inventory`, { credentials: 'include' }),
            fetch(`${API_BASE}/api/targetinventories`, { credentials: 'include' }),
            fetch(`${API_BASE}/api/collectingcenters`, { credentials: 'include' })
        ])
            .then(([invRes, targetRes, centersRes]) => {
                if (!invRes.ok || !targetRes.ok) {
                    throw new Error(`Inventory service unreachable (${invRes.status}/${targetRes.status})`)
                }
                return Promise.all([
                    invRes.json().catch(() => ({})),
                    targetRes.json().catch(() => ({})),
                    centersRes.ok ? centersRes.json().catch(() => ({})) : Promise.resolve({})
                ])
            })
            .then(([invData, targetData, centersData]) => {
                setItems(Array.isArray(invData.items) ? invData.items : [])

                const cleanTargets = { ...targetData }
                delete cleanTargets._id
                delete cleanTargets.__v
                delete cleanTargets.createdAt
                delete cleanTargets.updatedAt
                setTargets(cleanTargets)

                setCenters(Array.isArray(centersData.centers) ? centersData.centers : [])
                setError('')
            })
            .catch((err) => {
                setError(err.message || 'Could not load inventory data.')
            })
            .finally(() => {
                setLoading(false)
            })
    ), [])

    useEffect(() => {
        load()
    }, [load])

    /* ── derived: totals held per item type ── */
    const haveByKey = Object.fromEntries(ITEM_META.map((m) => [m.key, 0]))
    for (const row of items) {
        if (row.item in haveByKey) haveByKey[row.item] += Number(row.quantity) || 0
    }

    /* ── derived: Needs & Targets rows, lowest coverage first ── */
    const needsRows = ITEM_META.map(({ key, label, unit }) => {
        const have = haveByKey[key]
        const target = Number(targets[key]) || 0
        const need = Math.max(target - have, 0)
        const coverage = target > 0 ? Math.min(Math.round((have / target) * 100), 100) : 0
        return { key, label, unit, have, target, need, coverage }
    }).sort((a, b) => a.coverage - b.coverage)

    /* ── derived: Center Totals matrix columns + cell totals ── */
    const centerColumns = centers.map((c) => c.name).filter(Boolean)
    const totalFor = (key, centerName) => items.reduce((sum, row) => (
        row.item === key && (!centerName || row.center === centerName)
            ? sum + (Number(row.quantity) || 0)
            : sum
    ), 0)

    /* ── delete a row ── */
    const handleDelete = async (row) => {
        const name = META_BY_KEY[row.item]?.label || row.item
        if (!window.confirm(`Delete "${name} × ${row.quantity}"? This cannot be undone.`)) return
        try {
            const res = await fetch(`${API_BASE}/api/inventory/${row._id}`, {
                method: 'DELETE',
                credentials: 'include'
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.message || `Server error ${res.status}`)
            setItems((prev) => prev.filter((i) => i._id !== row._id))
        } catch (err) {
            window.alert(err.message || 'Could not delete the item.')
        }
    }

    /* ── export PDF (same pattern as Donationpage / ngodisaster) ── */
    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

        // ── Title block ──
        doc.setFontSize(18)
        doc.setTextColor(29, 78, 216)   // blue-700
        doc.text('SafeZone — Inventory Report', 14, 18)

        doc.setFontSize(9)
        doc.setTextColor(100, 116, 139) // slate-500
        doc.text(`Generated: ${new Date().toLocaleString('en-LK')}`, 14, 25)
        doc.text(`Inventory items: ${items.length}`, 14, 30)

        // ── Inventory table ──
        autoTable(doc, {
            startY: 36,
            head: [['Item', 'Quantity', 'Unit', 'Center/Branch', 'Date', 'Notes']],
            body: items.map((row) => [
                META_BY_KEY[row.item]?.label || row.item,
                String(row.quantity ?? 0),
                row.unit || META_BY_KEY[row.item]?.unit || '—',
                row.center || '—',
                fmtDate(row.date || row.createdAt),
                row.notes || '—'
            ]),
            styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
            headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [241, 245, 249] }
        })

        // ── Needs & Targets table ──
        autoTable(doc, {
            startY: (doc.lastAutoTable?.finalY || 36) + 10,
            head: [['Item', 'Have', 'Target', 'Need', 'Unit', 'Coverage']],
            body: needsRows.map((r) => [
                r.label, String(r.have), String(r.target), String(r.need), r.unit, `${r.coverage}%`
            ]),
            styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
            headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [241, 245, 249] },
            didDrawPage: (data) => {
                doc.setFontSize(7)
                doc.setTextColor(150)
                doc.text(
                    `Page ${data.pageNumber}  •  SafeZone NGO Inventory`,
                    doc.internal.pageSize.getWidth() / 2,
                    doc.internal.pageSize.getHeight() - 6,
                    { align: 'center' }
                )
            }
        })

        doc.save(`inventory-${new Date().toISOString().slice(0, 10)}.pdf`)
    }

    /* ── loading state ── */
    if (loading) {
        return (
            <div className="grid min-h-[60vh] place-items-center px-5 py-20 text-slate-600">
                <span className="inline-flex items-center gap-2">
                    <Loader2 size={20} className="animate-spin" /> Loading inventory…
                </span>
            </div>
        )
    }

    return (
        <div className="px-5 py-8 lg:px-10">
            {/* ── Page header ── */}
            <h1 className="text-3xl font-extrabold text-slate-900 md:text-4xl">📦 Inventory Management</h1>
            <p className="mt-2 text-sm text-slate-500 md:text-base">
                Manage relief items, track quantities, and monitor center totals
            </p>

            {/* ── Action buttons ── */}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={() => setAddOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                    >
                        <Plus size={16} /> Add Items
                    </button>
                    <button
                        type="button"
                        onClick={() => setTargetOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                        🎯 Set Target
                    </button>
                </div>
                <button
                    type="button"
                    onClick={exportPDF}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                    <FileText size={16} /> Generate PDF
                </button>
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-700">⚠️ {error}</p>
                    <button
                        type="button"
                        onClick={() => { setLoading(true); load() }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
                    >
                        <RefreshCw size={13} /> Retry
                    </button>
                </div>
            )}

            {/* ── Inventory Table ── */}
            <section className="mt-8">
                <SectionTitle
                    icon="📋"
                    title="Inventory Table"
                    subtitle="Current inventory items across all centers"
                />
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                            <tr className="border-b-2 border-slate-200 text-slate-700">
                                <th className="px-5 py-3.5 font-bold">Item</th>
                                <th className="px-5 py-3.5 font-bold">Quantity</th>
                                <th className="px-5 py-3.5 font-bold">Unit</th>
                                <th className="px-5 py-3.5 font-bold">Center/Branch</th>
                                <th className="px-5 py-3.5 font-bold">Date</th>
                                <th className="px-5 py-3.5 font-bold">Notes</th>
                                <th className="px-5 py-3.5 font-bold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                                        No inventory items yet. Use “Add Items” to create the first one.
                                    </td>
                                </tr>
                            ) : (
                                items.map((row) => {
                                    const meta = META_BY_KEY[row.item]
                                    return (
                                        <tr key={row._id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                            <td className="px-5 py-3.5 font-medium text-slate-900">
                                                {meta?.label || row.item}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-700">{row.quantity}</td>
                                            <td className="px-5 py-3.5 text-slate-700">{row.unit || meta?.unit || '—'}</td>
                                            <td className="px-5 py-3.5 text-slate-700">{row.center || '—'}</td>
                                            <td className="px-5 py-3.5 text-slate-700">
                                                {fmtDate(row.date || row.createdAt)}
                                            </td>
                                            <td className="max-w-56 px-5 py-3.5 text-slate-600">{row.notes || '—'}</td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditing(row)}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
                                                    >
                                                        <Edit size={13} /> Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(row)}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600"
                                                    >
                                                        <Trash2 size={13} /> Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ── Center Totals ── */}
            <section className="mt-10">
                <SectionTitle
                    icon="🏢"
                    title="Center Totals"
                    subtitle="Inventory distribution across all collection centers"
                />
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                            <tr className="border-b-2 border-slate-200 text-slate-700">
                                <th className="px-5 py-3.5 font-bold">Item</th>
                                {centerColumns.map((name) => (
                                    <th key={name} className="px-5 py-3.5 font-bold">{name}</th>
                                ))}
                                <th className="px-5 py-3.5 font-bold">All Centers*</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ITEM_META.map(({ key, label }) => (
                                <tr key={key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <td className="px-5 py-3.5 font-medium text-slate-900">{label}</td>
                                    {centerColumns.map((name) => (
                                        <td key={name} className="px-5 py-3.5 text-slate-700">
                                            {totalFor(key, name)}
                                        </td>
                                    ))}
                                    <td className="px-5 py-3.5 font-semibold text-slate-900">{haveByKey[key]}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ── Needs & Targets ── */}
            <section className="mt-10">
                <SectionTitle
                    icon="🎯"
                    title="Needs & Targets"
                    subtitle="Track progress towards inventory targets"
                />
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                            <tr className="border-b-2 border-slate-200 text-slate-700">
                                <th className="px-5 py-3.5 font-bold">Item</th>
                                <th className="px-5 py-3.5 font-bold">Have</th>
                                <th className="px-5 py-3.5 font-bold">Target</th>
                                <th className="px-5 py-3.5 font-bold">Need</th>
                                <th className="px-5 py-3.5 font-bold">Unit</th>
                                <th className="px-5 py-3.5 font-bold">Coverage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {needsRows.map((row) => (
                                <tr key={row.key} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                    <td className="px-5 py-3.5 font-medium text-slate-900">{row.label}</td>
                                    <td className="px-5 py-3.5 text-slate-700">{row.have}</td>
                                    <td className="px-5 py-3.5 text-slate-700">{row.target}</td>
                                    <td className="px-5 py-3.5 text-slate-700">{row.need}</td>
                                    <td className="px-5 py-3.5 text-slate-700">{row.unit}</td>
                                    <td className="px-5 py-3.5">
                                        <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${coverageClass(row.coverage)}`}>
                                            {row.coverage}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* ── Most Needed Now (coverage chart) ── */}
            <section className="mt-10">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-900">📊 Most Needed Now</h2>
                    <p className="mt-1 text-sm text-slate-500">Priority items requiring immediate attention</p>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex gap-2">
                        {/* Y axis title + numbers */}
                        <div className="flex items-center">
                            <span className="-rotate-90 whitespace-nowrap text-xs font-medium text-slate-500">
                                Coverage %
                            </span>
                        </div>
                        <div className="flex h-60 flex-col justify-between pr-1 text-right text-xs text-slate-500">
                            {[100, 75, 50, 25, 0].map((v) => <span key={v}>{v}</span>)}
                        </div>

                        {/* Plot area */}
                        <div className="min-w-0 flex-1">
                            <div className="relative h-60">
                                {[0, 25, 50, 75, 100].map((v) => (
                                    <div
                                        key={v}
                                        className="absolute inset-x-0 border-t border-slate-200"
                                        style={{ bottom: `${v}%` }}
                                    />
                                ))}
                                <div className="absolute inset-0 flex items-end gap-3 px-2 md:gap-6">
                                    {needsRows.map((row) => (
                                        <div
                                            key={row.key}
                                            className="group relative flex h-full flex-1 items-end justify-center"
                                        >
                                            {/* Tooltip */}
                                            <div className="pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-lg group-hover:block">
                                                <p className="text-sm font-semibold text-slate-800">Item: {row.label}</p>
                                                <p className="text-sm text-blue-500">Coverage : {row.coverage}%</p>
                                            </div>
                                            <div
                                                className="w-full max-w-16 rounded-t-md bg-blue-500 transition-colors group-hover:bg-slate-400"
                                                style={{ height: `${Math.max(row.coverage, 2)}%` }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* X axis labels (aligned with the bars) */}
                            <div className="mt-2 flex gap-3 px-2 md:gap-6">
                                {needsRows.map((row) => (
                                    <div key={row.key} className="flex-1 text-center">
                                        <span className="inline-block rotate-[-30deg] whitespace-nowrap text-xs text-slate-500">
                                            {row.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Add / Edit / Set Target modals ── */}
            {addOpen && (
                <AddInventoryItem
                    centers={centers}
                    onClose={() => setAddOpen(false)}
                    onSaved={(created) => {
                        setAddOpen(false)
                        setItems((prev) => [created, ...prev])
                    }}
                />
            )}

            {editing && (
                <EditInventoryItem
                    item={editing}
                    centers={centers}
                    onClose={() => setEditing(null)}
                    onSaved={(updated) => {
                        setEditing(null)
                        setItems((prev) => prev.map((i) => (i._id === updated._id ? updated : i)))
                    }}
                />
            )}

            {targetOpen && (
                <SetInventoryTargets
                    targets={targets}
                    onClose={() => setTargetOpen(false)}
                    onSaved={(doc) => {
                        setTargetOpen(false)
                        const clean = { ...doc }
                        delete clean._id
                        delete clean.__v
                        delete clean.createdAt
                        delete clean.updatedAt
                        setTargets(clean)
                    }}
                />
            )}
        </div>
    )
}

