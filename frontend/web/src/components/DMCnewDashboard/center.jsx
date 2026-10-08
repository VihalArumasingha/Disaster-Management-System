import { useCallback, useEffect, useRef, useState } from 'react'
import {
    MapPin, Phone, Clock, Search, Plus, Navigation,
    Edit, Trash2, Loader2, MapPinned
} from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import CenterForm from './centerpage.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

/* Google Maps deep-link for the "Get Directions" buttons */
const directionsUrl = (c) =>
    `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`

/* Simple red pin that works under Vite (bypasses Leaflet's default icon URLs) */
const pinIcon = L.divIcon({
    className: '',
    html: `<svg width="28" height="40" viewBox="0 0 28 40" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 1C6.8 1 1 6.8 1 14c0 9.6 12 24.4 12.4 24.8.3.4.9.4 1.2 0C17 38.4 28 23.6 28 14 28 6.8 21.2 1 14 1z" fill="#ef4444" stroke="#b91c1c" stroke-width="1.5"/>
        <circle cx="14" cy="14" r="5" fill="#fff"/>
    </svg>`,
    iconSize: [28, 40],
    iconAnchor: [14, 40]
})

/* ── Leaflet map that follows the selected center ─────────────────────────── */
function CenterMap({ selected }) {
    const containerRef = useRef(null)
    const mapRef = useRef(null)
    const markerRef = useRef(null)

    useEffect(() => {
        if (!containerRef.current) return undefined

        const map = L.map(containerRef.current, { scrollWheelZoom: true })
            .setView([7.8731, 80.7718], 7)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map)
        mapRef.current = map

        const resizeObserver = new ResizeObserver(() => map.invalidateSize())
        resizeObserver.observe(containerRef.current)

        return () => {
            resizeObserver.disconnect()
            map.remove()
            mapRef.current = null
            markerRef.current = null
        }
    }, [])

    useEffect(() => {
        const map = mapRef.current
        if (!map) return

        if (markerRef.current) {
            map.removeLayer(markerRef.current)
            markerRef.current = null
        }
        if (!selected) return

        const latlng = [selected.latitude, selected.longitude]
        markerRef.current = L.marker(latlng, { icon: pinIcon })
            .addTo(map)
            .bindPopup(`<strong>${selected.name}</strong><br/>${selected.city}`)
        map.setView(latlng, 14)
        markerRef.current.openPopup()
    }, [selected])

    return <div ref={containerRef} className="h-[430px] w-full" />
}

/* ── one center card in the left column ───────────────────────────────────── */
function CenterCard({ center, active, onSelect, onEdit, onDelete }) {
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelect() }}
            className={`cursor-pointer rounded-xl border bg-white p-5 shadow-sm transition ${
                active
                    ? 'border-blue-500 ring-2 ring-blue-500/25'
                    : 'border-slate-200 hover:border-slate-300'
            }`}
        >
            <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-slate-900">{center.name}</h3>
                <span className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">
                    {center.city}
                </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">{center.address}</p>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <a
                    href={`tel:${center.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 font-semibold text-blue-600 hover:underline"
                >
                    <Phone size={13} /> {center.phone}
                </a>
                {center.openingHours && (
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                        <Clock size={13} /> {center.openingHours}
                    </span>
                )}
            </div>

            {center.categories?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                    {center.categories.map((category) => (
                        <span
                            key={category}
                            className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                        >
                            {category}
                        </span>
                    ))}
                </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                <a
                    href={directionsUrl(center)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                    <Navigation size={14} /> Get Directions
                </a>
                <button
                    type="button"
                    onClick={() => onEdit(center)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                    <Edit size={14} /> Edit
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(center)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                    <Trash2 size={14} /> Delete
                </button>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function CollectingCentersPage() {
    const [centers, setCenters] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [selectedId, setSelectedId] = useState(null)
    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState(null) // null = create mode

    const load = useCallback(() => (
        fetch(`${API_BASE}/api/collectingcenters`, { credentials: 'include' })
            .then((res) => {
                if (!res.ok) throw new Error(`Server error ${res.status}`)
                return res.json()
            })
            .then((data) => {
                const list = data.centers || []
                setCenters(list)
                setSelectedId((prev) =>
                    prev && list.some((c) => c._id === prev) ? prev : (list[0]?._id ?? null)
                )
                setError('')
            })
            .catch((err) => setError(err.message || 'Could not load collecting centers'))
            .finally(() => setLoading(false))
    ), [])

    useEffect(() => { load() }, [load])

    const selected = centers.find((c) => c._id === selectedId) || null

    const filtered = centers.filter((c) => {
        const q = search.trim().toLowerCase()
        if (!q) return true
        return (
            c.name.toLowerCase().includes(q) ||
            c.city.toLowerCase().includes(q) ||
            c.address.toLowerCase().includes(q)
        )
    })

    const openCreate = () => { setEditing(null); setFormOpen(true) }
    const openEdit = (center) => { setEditing(center); setFormOpen(true) }

    const handleSaved = (center) => {
        setFormOpen(false)
        setEditing(null)
        setSelectedId(center._id)
        load()
    }

    const handleDelete = async (center) => {
        if (!confirm(`Delete "${center.name}"? This cannot be undone.`)) return
        try {
            const res = await fetch(`${API_BASE}/api/collectingcenters/${center._id}`, {
                method: 'DELETE',
                credentials: 'include'
            })
            if (!res.ok) throw new Error(`Server error ${res.status}`)
            if (selectedId === center._id) setSelectedId(null)
            load()
        } catch (err) {
            alert(err.message || 'Could not delete the center')
        }
    }

    return (
        <div className="px-4 py-6 sm:px-6 lg:px-8">
            {/* ── Header ── */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Collecting Centers</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Locations where the public drops off relief supplies.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                    <Plus size={16} /> New Center
                </button>
            </div>

            {error && (
                <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                    {error}
                </p>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                {/* ── Left: center list ── */}
                <div>
                    {/* Search */}
                    <div className="relative mb-4">
                        <MapPin size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, city or address…"
                            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                        <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>

                    {loading ? (
                        <div className="grid place-items-center rounded-xl border border-slate-200 bg-white py-16 text-slate-500">
                            <Loader2 size={22} className="mb-2 animate-spin" />
                            Loading centers…
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
                            <MapPinned size={30} className="mx-auto mb-2 text-slate-300" />
                            <p className="text-sm font-medium text-slate-600">
                                {centers.length === 0 ? 'No collecting centers yet' : 'No centers match your search'}
                            </p>
                            {centers.length === 0 && (
                                <button
                                    type="button"
                                    onClick={openCreate}
                                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                                >
                                    <Plus size={15} /> Add your first center
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="max-h-[640px] space-y-4 overflow-y-auto pr-1">
                            {filtered.map((center) => (
                                <CenterCard
                                    key={center._id}
                                    center={center}
                                    active={center._id === selectedId}
                                    onSelect={() => setSelectedId(center._id)}
                                    onEdit={openEdit}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Right: detail + map ── */}
                <div className="lg:sticky lg:top-6 lg:self-start">
                    {selected ? (
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                            {/* Title bar */}
                            <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900">{selected.name}</h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {selected.address}
                                        {' · '}
                                        <a
                                            href={`tel:${selected.phone}`}
                                            className="font-medium text-blue-600 hover:underline"
                                        >
                                            {selected.phone}
                                        </a>
                                    </p>
                                    {selected.openingHours && (
                                        <p className="mt-0.5 text-sm text-slate-500">
                                            <Clock size={13} className="mr-1 inline-block align-[-2px]" />
                                            {selected.openingHours}
                                        </p>
                                    )}
                                </div>
                                <a
                                    href={directionsUrl(selected)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                                >
                                    <Navigation size={15} /> Get Directions
                                </a>
                            </div>

                            {/* Map */}
                            <CenterMap selected={selected} />
                        </div>
                    ) : (
                        <div className="grid place-items-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center text-slate-500">
                            <MapPinned size={30} className="mb-2 text-slate-300" />
                            <p className="text-sm">Select a center to see it on the map</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Create / edit form ── */}
            {formOpen && (
                <CenterForm
                    center={editing}
                    onClose={() => { setFormOpen(false); setEditing(null) }}
                    onSaved={handleSaved}
                />
            )}
        </div>
    )

}

