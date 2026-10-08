import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Activity, Pencil, Plus, Search, X } from 'lucide-react'
import api from '../../services/api'

const populationFields = [
    ['affectedPopulation', 'Affected population'],
    ['evacuatedPopulation', 'Evacuated population'],
    ['peopleInShelters', 'People in shelters'],
    ['injured', 'Injured'],
    ['deaths', 'Deaths'],
    ['housesDamaged', 'Houses damaged'],
    ['schoolsAffected', 'Schools affected'],
    ['roadsBlocked', 'Roads blocked'],
    ['hospitalsAffected', 'Hospitals affected']
]
const emptyRecord = {
    disasterEvent: '',
    district: '',
    affectedPopulation: 0,
    evacuatedPopulation: 0,
    peopleInShelters: 0,
    injured: 0,
    deaths: 0,
    housesDamaged: 0,
    schoolsAffected: 0,
    roadsBlocked: 0,
    hospitalsAffected: 0,
    otherImpact: '',
    recordedDate: new Date().toISOString().slice(0, 10)
}
const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

function ImpactMonitoring({ apiBase, canEdit = false }) {
    const { pathname } = useLocation()

    // Auto-detect the correct apiBase if not explicitly given.
    // This prevents the NGO side from accidentally hitting /dmcofficer endpoints.
    const resolvedApiBase = apiBase
        || (pathname.startsWith('/ngomanager') ? '/ngomanager' : '/dmcofficer')

    const [records, setRecords] = useState([])
    const [districts, setDistricts] = useState([])
    const [search, setSearch] = useState('')
    const [district, setDistrict] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [modal, setModal] = useState(false)
    const [selected, setSelected] = useState(null)
    const [form, setForm] = useState(emptyRecord)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        let active = true
        api.get(`${resolvedApiBase}/impact-records`, {
            params: { q: search || undefined, district: district || undefined }
        })
            .then(({ data }) => {
                if (active) {
                    setRecords(data.records)
                    setDistricts(data.districts)
                    setError('')
                }
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || 'Could not load district impact records.')
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
        }
    }, [resolvedApiBase, search, district])

    const openForm = (record = null) => {
        if (!canEdit) return
        setSelected(record)
        setForm(record
            ? {
                ...record,
                recordedDate: new Date(record.recordedDate).toISOString().slice(0, 10)
            }
            : emptyRecord)
        setError('')
        setModal(true)
    }

    const saveRecord = async (event) => {
        event.preventDefault()
        if (!canEdit) return
        setSaving(true)
        setError('')
        try {
            const payload = {
                ...form,
                ...Object.fromEntries(populationFields.map(([key]) => [key, Number(form[key])]))
            }
            if (selected) {
                await api.put(`${resolvedApiBase}/impact-records/${selected._id}`, payload)
                setNotice('District impact record updated.')
            } else {
                await api.post(`${resolvedApiBase}/impact-records`, payload)
                setNotice('District impact record saved.')
            }
            setModal(false)
            const { data } = await api.get(`${resolvedApiBase}/impact-records`, {
                params: { q: search || undefined, district: district || undefined }
            })
            setRecords(data.records)
            setDistricts(data.districts)
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not save impact record.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Disaster response</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">Impact Monitoring</h1>
                    <p className="mt-2 text-slate-600">Recent district-level impacts, population effects, and infrastructure damage.</p>
                </div>
                {canEdit && (
                    <button
                        type="button"
                        onClick={() => openForm()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                        <Plus size={17} /> Record district impact
                    </button>
                )}
            </div>

            {notice && <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
            {error && !modal && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

            <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="grid gap-3 md:grid-cols-[1fr_240px]">
                    <label className="relative">
                        <span className="sr-only">Search impact records</span>
                        <Search size={17} className="absolute left-3 top-3 text-slate-400" />
                        <input
                            className={`${fieldClass} mt-0 pl-9`}
                            placeholder="Search disaster event, district, or impact"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </label>
                    <select
                        aria-label="Filter by district"
                        className={`${fieldClass} mt-0`}
                        value={district}
                        onChange={(event) => setDistrict(event.target.value)}
                    >
                        <option value="">All districts</option>
                        {districts.map((name) => <option key={name}>{name}</option>)}
                    </select>
                </div>

                {loading ? (
                    <p className="py-12 text-center text-sm text-slate-500">Loading impact records…</p>
                ) : records.length === 0 ? (
                    <div className="py-14 text-center">
                        <Activity className="mx-auto text-slate-400" size={30} />
                        <p className="mt-3 font-semibold text-slate-800">No district impacts recorded</p>
                        <p className="mt-1 text-sm text-slate-500">
                            {canEdit ? 'Adjust the search or add an impact report.' : 'Adjust the search filters.'}
                        </p>
                    </div>
                ) : (
                    <div className="mt-5 overflow-x-auto">
                        <table className="w-full min-w-[1450px] text-left text-sm">
                            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    {[
                                        'Disaster event', 'District', 'Affected', 'Evacuated', 'In shelters',
                                        'Injured', 'Deaths', 'Houses damaged', 'Schools', 'Roads blocked',
                                        'Hospitals', 'Other impact', 'Recorded date', 'Recorded by',
                                        ...(canEdit ? [''] : [])
                                    ].map((heading, index) => (
                                        <th key={heading || index} className="px-3 py-3 font-semibold">{heading}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {records.map((record) => (
                                    <tr key={record._id} className="align-top hover:bg-slate-50">
                                        <td className="px-3 py-4 font-semibold text-slate-900">{record.disasterEvent}</td>
                                        <td className="px-3 py-4 text-slate-700">{record.district}</td>
                                        <td className="px-3 py-4 font-medium">{formatCount(record.affectedPopulation)}</td>
                                        <td className="px-3 py-4">{formatCount(record.evacuatedPopulation)}</td>
                                        <td className="px-3 py-4">{formatCount(record.peopleInShelters)}</td>
                                        <td className="px-3 py-4">{formatCount(record.injured)}</td>
                                        <td className="px-3 py-4">{formatCount(record.deaths)}</td>
                                        <td className="px-3 py-4">{formatCount(record.housesDamaged)}</td>
                                        <td className="px-3 py-4">{formatCount(record.schoolsAffected)}</td>
                                        <td className="px-3 py-4">{formatCount(record.roadsBlocked)}</td>
                                        <td className="px-3 py-4">{formatCount(record.hospitalsAffected)}</td>
                                        <td className="max-w-56 px-3 py-4 text-slate-600">{record.otherImpact || '—'}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-slate-700">{formatDate(record.recordedDate)}</td>
                                        <td className="px-3 py-4 text-slate-700">{record.recordedBy?.name || '—'}</td>
                                        {canEdit && (
                                            <td className="px-3 py-4">
                                                <button
                                                    type="button"
                                                    onClick={() => openForm(record)}
                                                    aria-label={`Edit ${record.disasterEvent} impact in ${record.district}`}
                                                    className="rounded-lg p-2 text-blue-700 hover:bg-blue-50"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {modal && canEdit && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"
                    onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false) }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="impact-modal-title"
                        className="my-6 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                    >
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">District situation report</p>
                                <h2 id="impact-modal-title" className="mt-1 text-xl font-bold text-slate-900">
                                    {selected ? 'Edit impact record' : 'Record district impact'}
                                </h2>
                            </div>
                            <button
                                type="button"
                                aria-label="Close"
                                onClick={() => setModal(false)}
                                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        {error && <p role="alert" className="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:mx-7">{error}</p>}
                        <form onSubmit={saveRecord} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
                            <label className="text-sm font-medium text-slate-700">
                                Disaster event
                                <input required maxLength="200" className={fieldClass} value={form.disasterEvent} onChange={(event) => setForm({ ...form, disasterEvent: event.target.value })} />
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                                District
                                <select required className={fieldClass} value={form.district} onChange={(event) => setForm({ ...form, district: event.target.value })}>
                                    <option value="">Select district</option>
                                    {districts.map((name) => <option key={name}>{name}</option>)}
                                </select>
                            </label>
                            {populationFields.map(([key, label]) => (
                                <label key={key} className="text-sm font-medium text-slate-700">
                                    {label}
                                    <input required type="number" min="0" step="1" className={fieldClass} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
                                </label>
                            ))}
                            <label className="text-sm font-medium text-slate-700">
                                Recorded date
                                <input required type="date" className={fieldClass} value={form.recordedDate} onChange={(event) => setForm({ ...form, recordedDate: event.target.value })} />
                            </label>
                            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                                Other impact
                                <textarea rows="3" maxLength="2000" className={fieldClass} value={form.otherImpact} onChange={(event) => setForm({ ...form, otherImpact: event.target.value })} />
                            </label>
                            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
                                <button type="button" onClick={() => setModal(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
                                <button disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                                    {saving ? 'Saving…' : 'Save impact record'}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </main>
    )
}

function formatCount(value) {
    return Number(value || 0).toLocaleString()
}

function formatDate(value) {
    return value ? new Date(value).toLocaleDateString() : '—'
}

export default ImpactMonitoring