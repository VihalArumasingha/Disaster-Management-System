import { useCallback, useEffect, useState } from 'react'
import {
    Building2, ChevronRight, Home, Info, MapPin, Pencil, Phone,
    Plus, Search, UserRound, Users, X
} from 'lucide-react'
import api from '../../services/api'

const shelterTypes = ['School', 'Community Hall', 'Religious Facility', 'Government Building', 'Temporary Camp', 'Other']
const shelterStatuses = ['Active', 'Inactive', 'Full', 'Closed']

const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
    'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara',
    'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar',
    'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya',
    'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
]

const emptyShelter = {
    shelterName: '',
    district: '',
    address: '',
    shelterType: 'School',
    capacity: '',
    currentOccupancy: 0,
    contactPerson: '',
    contactNumber: '',
    facilities: '',
    disasterEvent: ''
}

const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

function ShelterManagementPage({ apiBase = '/dmcofficer' }) {
    const sheltersApi = `${apiBase}/shelters`
    const [shelters, setShelters] = useState([])
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [modal, setModal] = useState('')
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState(emptyShelter)
    const [history, setHistory] = useState([])
    const [occupancy, setOccupancy] = useState('')
    const [event, setEvent] = useState('')
    const [saving, setSaving] = useState(false)

    const loadShelters = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const { data } = await api.get(sheltersApi, {
                params: { q: search || undefined, status: statusFilter || undefined, type: typeFilter || undefined }
            })
            setShelters(data.shelters)
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not load shelters.')
        } finally {
            setLoading(false)
        }
    }, [search, statusFilter, typeFilter, sheltersApi])

    useEffect(() => {
        let active = true
        api.get(sheltersApi, {
            params: { q: search || undefined, status: statusFilter || undefined, type: typeFilter || undefined }
        })
            .then(({ data }) => {
                if (active) {
                    setShelters(data.shelters)
                    setError('')
                }
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || 'Could not load shelters.')
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => { active = false }
    }, [search, statusFilter, typeFilter, sheltersApi])

    const openForm = (shelter) => {
        setError('')
        setSelected(shelter)
        setForm(shelter
            ? { ...shelter, facilities: (shelter.facilities || []).join(', ') }
            : emptyShelter)
        setModal('form')
    }

    const openDetails = async (shelter) => {
        setSelected(shelter)
        setError('')
        setModal('details')
        try {
            const { data } = await api.get(`${sheltersApi}/${shelter._id}`)
            setSelected(data.shelter)
            setHistory(data.occupancyHistory)
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not load shelter details.')
        }
    }

    const saveShelter = async (submitEvent) => {
        submitEvent.preventDefault()
        setSaving(true)
        setError('')
        try {
            const payload = {
                shelterName: form.shelterName,
                district: form.district,
                address: form.address,
                shelterType: form.shelterType,
                capacity: Number(form.capacity),
                contactPerson: form.contactPerson,
                contactNumber: form.contactNumber,
                facilities: Array.isArray(form.facilities)
                    ? form.facilities
                    : String(form.facilities || '')
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                disasterEvent: form.disasterEvent || ''
            }
            if (!selected) {
                payload.currentOccupancy = Number(form.currentOccupancy) || 0
            }
            if (selected) {
                await api.put(`${sheltersApi}/${selected._id}`, payload)
                setNotice('Shelter details updated.')
            } else {
                await api.post(sheltersApi, payload)
                setNotice('Shelter added.')
            }
            setModal('')
            await loadShelters()
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not save shelter.')
        } finally {
            setSaving(false)
        }
    }

    const changeStatus = async (shelter, event) => {
        if (event) event.stopPropagation()
        setError('')
        setNotice('')
        const status = ['Active', 'Full'].includes(shelter.status) ? 'Inactive' : 'Active'
        try {
            await api.patch(`${sheltersApi}/${shelter._id}/status`, { status })
            setNotice(`Shelter ${status === 'Active' ? 'activated' : 'deactivated'}.`)
            await loadShelters()
            if (selected?._id === shelter._id) {
                const { data } = await api.get(`${sheltersApi}/${shelter._id}`)
                setSelected(data.shelter)
                setHistory(data.occupancyHistory)
            }
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not update shelter status.')
        }
    }

    const saveOccupancy = async (submitEvent) => {
        submitEvent.preventDefault()
        setSaving(true)
        setError('')
        try {
            const { data } = await api.post(`${sheltersApi}/${selected._id}/occupancy`, {
                occupancyCount: Number(occupancy),
                disasterEvent: event
            })
            setSelected(data.shelter)
            setNotice('Occupancy recorded.')
            setModal('details')
            const details = await api.get(`${sheltersApi}/${selected._id}`)
            setHistory(details.data.occupancyHistory)
            await loadShelters()
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not record occupancy.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">DMC operations</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">Shelter Management</h1>
                    <p className="mt-2 text-slate-600">Manage shelter readiness, capacity, and occupancy records.</p>
                </div>
                <button
                    type="button"
                    onClick={() => openForm(null)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                >
                    <Plus size={17} /> Add shelter
                </button>
            </div>

            {notice && <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
            {error && !modal && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

            <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-3 border-b border-slate-200 p-4 md:grid-cols-[1fr_190px_220px] sm:p-5">
                    <label className="relative">
                        <span className="sr-only">Search shelters</span>
                        <Search size={17} className="absolute left-3 top-3 text-slate-400" />
                        <input
                            className={`${fieldClass} mt-0 pl-9`}
                            placeholder="Search shelter, district or address"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </label>
                    <select
                        aria-label="Filter by status"
                        className={`${fieldClass} mt-0`}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All statuses</option>
                        {shelterStatuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <select
                        aria-label="Filter by type"
                        className={`${fieldClass} mt-0`}
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="">All shelter types</option>
                        {shelterTypes.map((type) => <option key={type}>{type}</option>)}
                    </select>
                </div>

                {loading ? (
                    <p className="py-12 text-center text-sm text-slate-500">Loading shelters…</p>
                ) : shelters.length === 0 ? (
                    <div className="py-14 text-center">
                        <Building2 className="mx-auto text-slate-400" size={30} />
                        <p className="mt-3 font-semibold text-slate-800">No shelters found</p>
                        <p className="mt-1 text-sm text-slate-500">Add a shelter or adjust your filters.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[920px] text-left text-sm">
                            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                                <tr>
                                    {['Shelter', 'District', 'Type', 'Occupancy', 'Availability', 'Status', ''].map((heading, index) => (
                                        <th key={heading || index} className="px-3 py-3 font-semibold">{heading}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {shelters.map((shelter) => (
                                    <tr
                                        key={shelter._id}
                                        onClick={() => openDetails(shelter)}
                                        className="cursor-pointer align-top transition hover:bg-blue-50/40"
                                    >
                                        <td className="px-3 py-4">
                                            <p className="font-semibold text-slate-900">{shelter.shelterName}</p>
                                            <p className="mt-1 text-xs text-slate-500">{shelter.shelterId}</p>
                                        </td>
                                        <td className="px-3 py-4 text-slate-700">{shelter.district}</td>
                                        <td className="px-3 py-4 text-slate-700">{shelter.shelterType}</td>
                                        <td className="px-3 py-4 text-slate-700">
                                            {shelter.currentOccupancy} / {shelter.capacity}
                                        </td>
                                        <td className="px-3 py-4 font-semibold text-slate-900">{shelter.availableCapacity}</td>
                                        <td className="px-3 py-4">
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${shelter.status === 'Active' ? 'bg-green-50 text-green-700' : shelter.status === 'Full' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {shelter.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-4 text-right text-slate-400">
                                            <ChevronRight size={16} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {modal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
                    onMouseDown={(e) => { if (e.target === e.currentTarget) setModal('') }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="shelter-modal-title"
                        className="my-6 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                    >
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Shelter operations</p>
                                <h2 id="shelter-modal-title" className="mt-1 text-xl font-bold text-slate-900">
                                    {modal === 'form' ? (selected ? 'Edit shelter' : 'Add shelter')
                                        : modal === 'occupancy' ? 'Record occupancy'
                                        : 'Shelter details'}
                                </h2>
                            </div>
                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() => setModal('')}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {error && <p role="alert" className="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:mx-7">{error}</p>}

                        {modal === 'form' && (
                            <form onSubmit={saveShelter} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
                                <label className="text-sm font-medium text-slate-700">
                                    Shelter name
                                    <input required type="text" className={fieldClass} value={form.shelterName ?? ''} onChange={(e) => setForm({ ...form, shelterName: e.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                    District
                                    <select required className={fieldClass} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
                                        <option value="">Select district</option>
                                        {districts.map((district) => <option key={district} value={district}>{district}</option>)}
                                    </select>
                                </label>
                                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                                    Address
                                    <input required type="text" className={fieldClass} value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                    Capacity
                                    <input required min="1" type="number" className={fieldClass} value={form.capacity ?? ''} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                    Contact person
                                    <input required type="text" className={fieldClass} value={form.contactPerson ?? ''} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                    Contact number
                                    <input required type="tel" className={fieldClass} value={form.contactNumber ?? ''} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                    Shelter type
                                    <select className={fieldClass} value={form.shelterType} onChange={(e) => setForm({ ...form, shelterType: e.target.value })}>
                                        {shelterTypes.map((type) => <option key={type}>{type}</option>)}
                                    </select>
                                </label>
                                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                                    Facilities (comma separated)
                                    <input type="text" className={fieldClass} value={form.facilities ?? ''} onChange={(e) => setForm({ ...form, facilities: e.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                    Disaster event
                                    <input type="text" className={fieldClass} value={form.disasterEvent ?? ''} onChange={(e) => setForm({ ...form, disasterEvent: e.target.value })} />
                                </label>
                                {!selected && (
                                    <label className="text-sm font-medium text-slate-700">
                                        Current occupancy
                                        <input type="number" min="0" required className={fieldClass} value={form.currentOccupancy} onChange={(e) => setForm({ ...form, currentOccupancy: e.target.value })} />
                                    </label>
                                )}
                                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
                                    <button type="button" onClick={() => setModal('')} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                                    <button disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
                                        {saving ? 'Saving…' : 'Save shelter'}
                                    </button>
                                </div>
                            </form>
                        )}

                        {modal === 'details' && selected && (
                            <div className="p-5 sm:p-7">
                                {/* Header — name + ID + status */}
                                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                                    <div className="min-w-0">
                                        <h3 className="text-xl font-bold text-slate-900">{selected.shelterName}</h3>
                                        <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500">
                                            <MapPin size={13} /> {selected.district} · {selected.shelterId}
                                        </p>
                                    </div>
                                    <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ${selected.status === 'Active' ? 'bg-green-50 text-green-700 ring-green-200' : selected.status === 'Full' ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                                        {selected.status}
                                    </span>
                                </div>

                                {/* Metrics */}
                                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                    <Metric label="Current occupancy" value={`${selected.currentOccupancy} / ${selected.capacity}`} tone="blue" />
                                    <Metric label="Available capacity" value={selected.availableCapacity} tone="green" />
                                    <Metric label="Shelter type" value={selected.shelterType} tone="slate" />
                                </div>

                                {/* Details sections */}
                                <Section title="Contact information" icon={UserRound}>
                                    <Detail icon={UserRound} label="Contact person" value={selected.contactPerson} />
                                    <Detail icon={Phone} label="Contact number" value={selected.contactNumber} />
                                </Section>

                                <Section title="Location and facilities" icon={Home}>
                                    <Detail icon={MapPin} label="Address" value={selected.address} className="sm:col-span-2" />
                                    <Detail icon={Info} label="Facilities" value={selected.facilities?.length ? selected.facilities.join(', ') : 'Not specified'} className="sm:col-span-2" />
                                    <Detail icon={Info} label="Disaster event" value={selected.disasterEvent || 'Not specified'} className="sm:col-span-2" />
                                </Section>

                                {/* Occupancy history section */}
                                <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                                    <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
                                        <Users size={16} className="text-blue-700" />
                                        <h4 className="text-sm font-semibold text-slate-900">Occupancy history</h4>
                                        <span className="ml-auto rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                                            {history.length} record{history.length === 1 ? '' : 's'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOccupancy(String(selected.currentOccupancy))
                                                setEvent(selected.disasterEvent || '')
                                                setError('')
                                                setModal('occupancy')
                                            }}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                                        >
                                            <Plus size={14} /> Record occupancy
                                        </button>
                                    </header>
                                    <div className="bg-white p-4">
                                        {history.length === 0 ? (
                                            <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                                                No occupancy records yet.
                                            </p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {history.map((row) => (
                                                    <li key={row._id} className="rounded-lg border border-slate-200 border-l-4 border-l-blue-400 bg-white p-3">
                                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                                            <div>
                                                                <p className="text-sm font-semibold text-slate-900">
                                                                    Occupancy {row.occupancyCount}
                                                                </p>
                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    {row.disasterEvent || 'No event'} · Recorded by {row.recordedBy?.name || 'DMC Officer'}
                                                                </p>
                                                            </div>
                                                            <p className="shrink-0 text-xs text-slate-500">
                                                                {new Date(row.recordedAt).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </section>

                                {/* Edit action */}
                                <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setModal('')}
                                        className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Close
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openForm(selected)}
                                        className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                                    >
                                        <Pencil size={16} /> Edit shelter
                                    </button>
                                </div>
                            </div>
                        )}

                        {modal === 'occupancy' && selected && (
                            <form onSubmit={saveOccupancy} className="space-y-4 p-5 sm:p-7">
                                <p className="text-sm text-slate-600">
                                    Capacity limit: <span className="font-semibold text-slate-900">{selected.capacity}</span>. The server rejects counts above capacity.
                                </p>
                                <label className="block text-sm font-medium text-slate-700">
                                    New occupancy count
                                    <input
                                        type="number"
                                        min="0"
                                        max={selected.capacity}
                                        required
                                        className={fieldClass}
                                        value={occupancy}
                                        onChange={(e) => setOccupancy(e.target.value)}
                                    />
                                </label>
                                <label className="block text-sm font-medium text-slate-700">
                                    Disaster event
                                    <input
                                        className={fieldClass}
                                        value={event}
                                        onChange={(e) => setEvent(e.target.value)}
                                        placeholder="Event associated with this occupancy"
                                    />
                                </label>
                                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setModal('details')}
                                        className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                                    >
                                        Cancel
                                    </button>
                                    <button disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                                        {saving ? 'Recording…' : 'Record occupancy'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </section>
                </div>
            )}
        </main>
    )
}

/* ---------- UI helpers ---------- */

function Metric({ label, value, tone = 'slate' }) {
    const tones = {
        blue: 'from-blue-50 to-white border-blue-100',
        green: 'from-emerald-50 to-white border-emerald-100',
        slate: 'from-slate-50 to-white border-slate-200'
    }
    return (
        <div className={`rounded-xl border bg-gradient-to-b p-4 ${tones[tone]}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
        </div>
    )
}

function Section({ title, icon: Icon, children }) {
    return (
        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <header className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
                <Icon size={16} className="text-slate-600" />
                <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
            </header>
            <div className="grid gap-x-6 gap-y-4 bg-white p-4 sm:grid-cols-2">
                {children}
            </div>
        </section>
    )
}

function Detail({ icon: Icon, label, value, className = '' }) {
    return (
        <div className={`flex gap-3 ${className}`}>
            {Icon && <Icon size={16} className="mt-1 shrink-0 text-slate-500" />}
            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 break-words text-[13px] text-slate-800">{value}</p>
            </div>
        </div>
    )
}

export default ShelterManagementPage