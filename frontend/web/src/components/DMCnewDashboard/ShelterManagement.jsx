import { useCallback, useEffect, useState } from 'react'
import { Building2, Pencil, Plus, Search, Users, X } from 'lucide-react'
import api from '../../services/api'

const shelterTypes = ['School', 'Community Hall', 'Religious Facility', 'Government Building', 'Temporary Camp', 'Other']
const shelterStatuses = ['Active', 'Inactive', 'Full', 'Closed']

const districts = [
    'Ampara',
    'Anuradhapura',
    'Badulla',
    'Batticaloa',
    'Colombo',
    'Galle',
    'Gampaha',
    'Hambantota',
    'Jaffna',
    'Kalutara',
    'Kandy',
    'Kegalle',
    'Kilinochchi',
    'Kurunegala',
    'Mannar',
    'Matale',
    'Matara',
    'Monaragala',
    'Mullaitivu',
    'Nuwara Eliya',
    'Polonnaruwa',
    'Puttalam',
    'Ratnapura',
    'Trincomalee',
    'Vavuniya'
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

const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

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
        return () => {
            active = false
        }
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
                <button type="button" onClick={() => openForm(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800">
                    <Plus size={17} /> Add shelter
                </button>
            </div>

            {notice && <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
            {error && !modal && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

            <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="grid gap-3 md:grid-cols-[1fr_190px_220px]">
                    <label className="relative">
                        <span className="sr-only">Search shelters</span>
                        <Search size={17} className="absolute left-3 top-3 text-slate-400" />
                        <input className={`${fieldClass} mt-0 pl-9`} placeholder="Search shelter, district or address" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </label>
                    <select aria-label="Filter by status" className={`${fieldClass} mt-0`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">All statuses</option>
                        {shelterStatuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                    <select aria-label="Filter by type" className={`${fieldClass} mt-0`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        <option value="">All shelter types</option>
                        {shelterTypes.map((type) => <option key={type}>{type}</option>)}
                    </select>
                </div>
                {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading shelters…</p> : shelters.length === 0 ? (
                    <div className="py-14 text-center">
                        <Building2 className="mx-auto text-slate-400" size={30} />
                        <p className="mt-3 font-semibold text-slate-800">No shelters found</p>
                        <p className="mt-1 text-sm text-slate-500">Add a shelter or adjust your filters.</p>
                    </div>
                ) : (
                    <div className="mt-5 overflow-x-auto">
                        <table className="w-full min-w-[920px] text-left text-sm">
                            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                                <tr>{['Shelter', 'District', 'Type', 'Occupancy', 'Availability', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>)}</tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {shelters.map((shelter) => (
                                    <tr
                                        key={shelter._id}
                                        onClick={() => openDetails(shelter)}
                                        className="cursor-pointer hover:bg-slate-50"
                                    >
                                        <td className="px-3 py-4"><p className="font-semibold text-slate-900">{shelter.shelterName}</p><p className="mt-1 text-xs text-slate-500">{shelter.shelterId}</p></td>
                                        <td className="px-3 py-4 text-slate-700">{shelter.district}</td>
                                        <td className="px-3 py-4 text-slate-700">{shelter.shelterType}</td>
                                        <td className="px-3 py-4 text-slate-700">{shelter.currentOccupancy} / {shelter.capacity}</td>
                                        <td className="px-3 py-4 font-medium text-slate-700">{shelter.availableCapacity}</td>
                                        <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${shelter.status === 'Active' ? 'bg-green-50 text-green-700' : shelter.status === 'Full' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{shelter.status}</span></td>
                                        <td className="px-3 py-4">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    title="Edit shelter"
                                                    aria-label={`Edit ${shelter.shelterName}`}
                                                    onClick={(e) => { e.stopPropagation(); openForm(shelter) }}
                                                    className="rounded-lg p-2 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                                                >
                                                    <Pencil size={17} />
                                                </button>
                                                <button
                                                    onClick={(e) => changeStatus(shelter, e)}
                                                    className="rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                                >
                                                    {['Active', 'Full'].includes(shelter.status) ? 'Deactivate' : 'Activate'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal('') }}>
                    <section role="dialog" aria-modal="true" aria-labelledby="shelter-modal-title" className="my-6 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Shelter operations</p>
                                <h2 id="shelter-modal-title" className="mt-1 text-xl font-bold text-slate-900">{modal === 'form' ? (selected ? 'Edit shelter' : 'Add shelter') : modal === 'occupancy' ? 'Record occupancy' : 'Shelter details'}</h2>
                            </div>
                            <button type="button" aria-label="Close" onClick={() => setModal('')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
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
                                    <button disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save shelter'}</button>
                                </div>
                            </form>
                        )}
                        {modal === 'details' && selected && (
                            <div className="p-5 sm:p-7">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Metric label="Current occupancy" value={`${selected.currentOccupancy} / ${selected.capacity}`} />
                                    <Metric label="Available capacity" value={selected.availableCapacity} />
                                    <Metric label="Status" value={selected.status} />
                                </div>
                                <div className="mt-5 grid gap-x-6 gap-y-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                                    <Detail label="Shelter ID" value={selected.shelterId} />
                                    <Detail label="Shelter type" value={selected.shelterType} />
                                    <Detail label="District" value={selected.district} />
                                    <Detail label="Address" value={selected.address} />
                                    <Detail label="Contact person" value={selected.contactPerson} />
                                    <Detail label="Contact number" value={selected.contactNumber} />
                                    <Detail label="Facilities" value={selected.facilities?.join(', ') || 'Not specified'} />
                                    <Detail label="Disaster event" value={selected.disasterEvent || 'Not specified'} />
                                </div>
                                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                                    <h3 className="font-semibold text-slate-900">Occupancy history</h3>
                                    <button type="button" onClick={() => { setOccupancy(String(selected.currentOccupancy)); setEvent(selected.disasterEvent || ''); setError(''); setModal('occupancy') }} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Users size={16} /> Record occupancy</button>
                                </div>
                                {history.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">No occupancy records yet.</p> : (
                                    <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full min-w-[570px] text-left text-sm">
                                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Occupancy</th><th className="px-4 py-3">Recorded at</th><th className="px-4 py-3">Recorded by</th><th className="px-4 py-3">Disaster event</th></tr></thead>
                                            <tbody className="divide-y divide-slate-100">{history.map((row) => <tr key={row._id}><td className="px-4 py-3 font-medium">{row.occupancyCount}</td><td className="px-4 py-3">{new Date(row.recordedAt).toLocaleString()}</td><td className="px-4 py-3">{row.recordedBy?.name || 'DMC Officer'}</td><td className="px-4 py-3">{row.disasterEvent || '—'}</td></tr>)}</tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                        {modal === 'occupancy' && selected && (
                            <form onSubmit={saveOccupancy} className="space-y-4 p-5 sm:p-7">
                                <p className="text-sm text-slate-600">Capacity limit: <strong>{selected.capacity}</strong>. The server rejects counts above capacity.</p>
                                <label className="block text-sm font-medium text-slate-700">New occupancy count<input type="number" min="0" max={selected.capacity} required className={fieldClass} value={occupancy} onChange={(e) => setOccupancy(e.target.value)} /></label>
                                <label className="block text-sm font-medium text-slate-700">Disaster event<input className={fieldClass} value={event} onChange={(e) => setEvent(e.target.value)} placeholder="Event associated with this occupancy" /></label>
                                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                                    <button type="button" onClick={() => setModal('details')} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
                                    <button disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Recording…' : 'Record occupancy'}</button>
                                </div>
                            </form>
                        )}
                    </section>
                </div>
            )}
        </main>
    )
}

function Metric({ label, value }) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-slate-900">{value}</p></div>
}

function Detail({ label, value }) {
    return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm text-slate-800">{value}</p></div>
}

export default ShelterManagementPage