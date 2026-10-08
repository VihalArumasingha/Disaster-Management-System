import { useCallback, useEffect, useState } from 'react'
import {
    ArrowDownToLine, Building2, CalendarDays, CheckCircle2, ChevronRight, CircleDashed,
    ClipboardCheck, History, Info, MapPin, Package, Plus, Search, Truck, User, X
} from 'lucide-react'
import api from '../../services/api'

const categories = ['Food', 'Water', 'Medical', 'Shelter', 'Clothing', 'Hygiene', 'Equipment', 'Other']
const auditStatuses = ['Pending Verification', 'Verified', 'Rejected', 'Flagged']
const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const today = new Date().toISOString().slice(0, 10)

const emptySupply = {
    organization: '',
    disasterEvent: '',
    category: 'Food',
    supplyName: '',
    unit: '',
    quantityReceived: '',
    receivedDate: today,
    expiryDate: '',
    batchNumber: '',
    storageLocation: '',
    status: 'Available'
}

const emptyDistribution = {
    supply: '',
    destinationType: 'District',
    district: '',
    shelter: '',
    reliefLocation: '',
    quantity: '',
    distributionDate: today,
    recipient: '',
    purpose: '',
    notes: ''
}

const fetchReliefManagementData = async (apiBase, search) => {
    const [supplyResponse, distributionResponse, optionResponse] = await Promise.all([
        api.get(`${apiBase}/relief-supplies`, { params: { q: search || undefined } }),
        api.get(`${apiBase}/relief-distributions`, { params: { q: search || undefined } }),
        api.get(`${apiBase}/relief-supplies/options`)
    ])
    return {
        supplies: supplyResponse.data.supplies,
        distributions: distributionResponse.data.distributions,
        options: optionResponse.data
    }
}

function ReliefSupplyManagement({ apiBase = '/dmcofficer', initialTab = 'supplies', canAudit = false }) {
    const [tab, setTab] = useState(initialTab)
    const [supplies, setSupplies] = useState([])
    const [distributions, setDistributions] = useState([])
    const [options, setOptions] = useState({ organizations: [], supplies: [], shelters: [], reliefLocations: [], districts: [] })
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [modal, setModal] = useState('')
    const [selectedSupply, setSelectedSupply] = useState(null)
    const [selectedDistribution, setSelectedDistribution] = useState(null)
    const [auditStatus, setAuditStatus] = useState('Pending Verification')
    const [verificationNotes, setVerificationNotes] = useState('')
    const [supplyForm, setSupplyForm] = useState(emptySupply)
    const [distributionForm, setDistributionForm] = useState(emptyDistribution)
    const [saving, setSaving] = useState(false)

    const refresh = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const data = await fetchReliefManagementData(apiBase, search)
            setSupplies(data.supplies)
            setDistributions(data.distributions)
            setOptions(data.options)
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not load relief supply records.')
        } finally {
            setLoading(false)
        }
    }, [apiBase, search])

    useEffect(() => {
        let active = true
        fetchReliefManagementData(apiBase, search)
            .then((data) => {
                if (active) {
                    setSupplies(data.supplies)
                    setDistributions(data.distributions)
                    setOptions(data.options)
                    setError('')
                }
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || 'Could not load relief supply records.')
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
        }
    }, [apiBase, search])

    const submitSupply = async (event) => {
        event.preventDefault()
        setSaving(true)
        setError('')
        try {
            await api.post(`${apiBase}/relief-supplies`, {
                ...supplyForm,
                quantityReceived: Number(supplyForm.quantityReceived),
                expiryDate: supplyForm.expiryDate || null
            })
            setNotice('Relief supply receipt registered.')
            setSupplyForm(emptySupply)
            setModal('')
            await refresh()
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not register relief supply.')
        } finally {
            setSaving(false)
        }
    }

    const submitDistribution = async (event) => {
        event.preventDefault()
        setSaving(true)
        setError('')
        try {
            const payload = {
                ...distributionForm,
                quantity: Number(distributionForm.quantity),
                district: distributionForm.destinationType === 'District' ? distributionForm.district : undefined,
                shelter: distributionForm.destinationType === 'Shelter' ? distributionForm.shelter : undefined,
                reliefLocation: distributionForm.destinationType === 'Relief Location' ? distributionForm.reliefLocation : undefined
            }
            await api.post(`${apiBase}/relief-distributions`, payload)
            setNotice('Distribution recorded. Inventory has been updated.')
            setDistributionForm(emptyDistribution)
            setModal('')
            setTab('distributions')
            await refresh()
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not record distribution.')
        } finally {
            setSaving(false)
        }
    }

    const saveAudit = async (event) => {
        event.preventDefault()
        if (!selectedDistribution) return
        setError('')
        setNotice('')
        setSaving(true)
        try {
            await api.patch(`${apiBase}/relief-distributions/${selectedDistribution._id}/audit`, {
                auditStatus,
                verificationNotes
            })
            setNotice(`Distribution audit status set to ${auditStatus}.`)
            setModal('')
            await refresh()
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not update audit status.')
        } finally {
            setSaving(false)
        }
    }

    const openSupplyDetails = (supply) => {
        setSelectedSupply(supply)
        setError('')
        setModal('supplyDetails')
    }

    const openDistributionDetails = (distribution) => {
        setSelectedDistribution(distribution)
        setAuditStatus(distribution.auditStatus)
        setVerificationNotes(distribution.verificationNotes || '')
        setError('')
        setModal('distributionDetails')
    }

    const selectedFormSupply = options.supplies.find((supply) => supply._id === distributionForm.supply)
    const supplyDistributions = selectedSupply
        ? distributions.filter((distribution) => {
            const distSupplyId = distribution.supply?._id || distribution.supply
            return distSupplyId === selectedSupply._id
        })
        : []

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Relief logistics</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">Relief Supply Management</h1>
                    <p className="mt-2 text-slate-600">Register incoming supplies and distribute from live available inventory.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => { setError(''); setSupplyForm(emptySupply); setModal('supply') }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-700 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                    >
                        <Plus size={17} /> Register Supply
                    </button>
                    <button
                        type="button"
                        onClick={() => { setError(''); setDistributionForm(emptyDistribution); setModal('distribution') }}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                    >
                        <Truck size={17} /> Record Distribution
                    </button>
                </div>
            </div>

            {notice && <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
            {error && !modal && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

            <section className="mt-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center sm:p-5">
                    <div className="inline-flex w-fit rounded-xl bg-slate-100 p-1">
                        <button type="button" onClick={() => setTab('supplies')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === 'supplies' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                            <Package size={16} /> Inventory
                        </button>
                        <button type="button" onClick={() => setTab('distributions')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === 'distributions' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                            <ClipboardCheck size={16} /> Distribution Audit
                        </button>
                    </div>
                    <label className="relative md:w-80">
                        <span className="sr-only">Search records</span>
                        <Search size={17} className="absolute left-3 top-3 text-slate-400" />
                        <input className={`${fieldClass} mt-0 pl-9`} placeholder="Search supply, event, recipient…" value={search} onChange={(event) => setSearch(event.target.value)} />
                    </label>
                </div>

                {loading ? (
                    <p className="py-12 text-center text-sm text-slate-500">Loading relief records…</p>
                ) : tab === 'supplies' ? (
                    supplies.length === 0 ? (
                        <EmptyState icon={Package} title="No supplies registered" message="Register received supplies to begin managing inventory." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1080px] text-left text-sm">
                                <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
                                    <tr>
                                        {['Supply', 'Organization / Event', 'Category', 'Received', 'Distributed', 'Remaining', 'Received date', 'Status', ''].map((heading, index) => (
                                            <th key={heading || index} className="px-3 py-3 font-bold">{heading}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {supplies.map((supply) => (
                                        <tr
                                            key={supply._id}
                                            onClick={() => openSupplyDetails(supply)}
                                            className="cursor-pointer align-top transition hover:bg-blue-50/40"
                                        >
                                            <td className="px-3 py-4">
                                                <p className="font-semibold text-slate-900">{supply.supplyName}</p>
                                                <p className="mt-1 text-xs text-slate-500">{supply.supplyId} · {supply.batchNumber || 'No batch'}</p>
                                                <p className="mt-1 text-xs text-slate-500">{supply.storageLocation}</p>
                                            </td>
                                            <td className="px-3 py-4">
                                                <p className="text-slate-800">{supply.organizationName}</p>
                                                <p className="mt-1 text-xs text-slate-500">{supply.disasterEvent}</p>
                                            </td>
                                            <td className="px-3 py-4 text-slate-700">{supply.category}</td>
                                            <td className="px-3 py-4 text-slate-700">{formatQuantity(supply.quantityReceived)} {supply.unit}</td>
                                            <td className="px-3 py-4 text-slate-700">{formatQuantity(supply.totalDistributed)} {supply.unit}</td>
                                            <td className="px-3 py-4 font-semibold text-slate-900">{formatQuantity(supply.remainingQuantity)} {supply.unit}</td>
                                            <td className="px-3 py-4 text-slate-700">
                                                {formatDate(supply.receivedDate)}
                                                {supply.expiryDate && <span className="mt-1 block text-xs text-slate-500">Expires {formatDate(supply.expiryDate)}</span>}
                                            </td>
                                            <td className="px-3 py-4"><StatusBadge status={supply.status} /></td>
                                            <td className="px-3 py-4 text-right text-slate-400"><ChevronRight size={16} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : distributions.length === 0 ? (
                    <EmptyState icon={Truck} title="No distributions recorded" message="Create a distribution to record a supply movement." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[900px] text-left text-sm">
                            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
                                <tr>
                                    {['Distribution', 'Supply / Organization', 'Destination', 'Quantity', 'Date', 'Recipient / Purpose', 'Responsible officer', 'Audit status', ''].map((heading, index) => (
                                        <th key={heading || index} className="px-3 py-3 font-bold">{heading}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {distributions.map((distribution) => (
                                    <tr
                                        key={distribution._id}
                                        onClick={() => openDistributionDetails(distribution)}
                                        className="cursor-pointer align-top transition hover:bg-blue-50/40"
                                    >
                                        <td className="px-3 py-4">
                                            <p className="font-semibold text-slate-900">{distribution.distributionId}</p>
                                            <p className="mt-1 text-xs text-slate-500">{distribution.disasterEvent}</p>
                                        </td>
                                        <td className="px-3 py-4">
                                            <p className="text-slate-800">{distribution.supply?.supplyName}</p>
                                            <p className="mt-1 text-xs text-slate-500">{distribution.organization?.organizationName}</p>
                                        </td>
                                        <td className="px-3 py-4 text-slate-700">{destinationLabel(distribution)}</td>
                                        <td className="px-3 py-4 font-semibold text-slate-900">{formatQuantity(distribution.quantity)} {distribution.supply?.unit}</td>
                                        <td className="px-3 py-4 text-slate-700">{formatDate(distribution.distributionDate)}</td>
                                        <td className="px-3 py-4">
                                            <p className="text-slate-800">{distribution.recipient}</p>
                                            <p className="mt-1 max-w-56 text-xs text-slate-500">{distribution.purpose}</p>
                                        </td>
                                        <td className="px-3 py-4 text-slate-700">{distribution.responsibleOfficer?.name || '—'}</td>
                                        <td className="px-3 py-4">
                                            <AuditBadge status={distribution.auditStatus} />
                                        </td>
                                        <td className="px-3 py-4 text-right text-slate-400"><ChevronRight size={16} /></td>
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
                    onMouseDown={(event) => { if (event.target === event.currentTarget) setModal('') }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="relief-modal-title"
                        className="my-6 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
                    >
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Relief logistics</p>
                                <h2 id="relief-modal-title" className="mt-1 text-lg font-bold text-slate-900">{modalTitle(modal)}</h2>
                            </div>
                            <button type="button" aria-label="Close" onClick={() => setModal('')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
                        </div>

                        {error && <p role="alert" className="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:mx-7">{error}</p>}

                        {modal === 'supply' && (
                            <form onSubmit={submitSupply} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
                                <label className="text-sm font-semibold text-slate-800">Organization<select required className={fieldClass} value={supplyForm.organization} onChange={(event) => setSupplyForm({ ...supplyForm, organization: event.target.value })}><option value="">Select organization</option>{options.organizations.map((organization) => <option key={organization._id} value={organization._id}>{organization.organizationName}</option>)}</select></label>
                                <label className="text-sm font-semibold text-slate-800">Disaster event<input required maxLength="200" className={fieldClass} value={supplyForm.disasterEvent} onChange={(event) => setSupplyForm({ ...supplyForm, disasterEvent: event.target.value })} /></label>
                                <label className="text-sm font-semibold text-slate-800">Category<select className={fieldClass} value={supplyForm.category} onChange={(event) => setSupplyForm({ ...supplyForm, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                                <label className="text-sm font-semibold text-slate-800">Supply name<input required maxLength="200" className={fieldClass} value={supplyForm.supplyName} onChange={(event) => setSupplyForm({ ...supplyForm, supplyName: event.target.value })} /></label>
                                <label className="text-sm font-semibold text-slate-800">Unit<input required maxLength="50" placeholder="e.g. kits, boxes, kg" className={fieldClass} value={supplyForm.unit} onChange={(event) => setSupplyForm({ ...supplyForm, unit: event.target.value })} /></label>
                                <label className="text-sm font-semibold text-slate-800">Quantity received<input required type="number" min="0.001" step="any" className={fieldClass} value={supplyForm.quantityReceived} onChange={(event) => setSupplyForm({ ...supplyForm, quantityReceived: event.target.value })} /></label>
                                <label className="text-sm font-semibold text-slate-800">Received date<input required type="date" className={fieldClass} value={supplyForm.receivedDate} onChange={(event) => setSupplyForm({ ...supplyForm, receivedDate: event.target.value })} /></label>
                                <label className="text-sm font-semibold text-slate-800">Expiry date (optional)<input type="date" className={fieldClass} value={supplyForm.expiryDate} onChange={(event) => setSupplyForm({ ...supplyForm, expiryDate: event.target.value })} /></label>
                                <label className="text-sm font-semibold text-slate-800">Batch number<input maxLength="100" className={fieldClass} value={supplyForm.batchNumber} onChange={(event) => setSupplyForm({ ...supplyForm, batchNumber: event.target.value })} /></label>
                                <label className="text-sm font-semibold text-slate-800">Storage location<input required maxLength="300" className={fieldClass} value={supplyForm.storageLocation} onChange={(event) => setSupplyForm({ ...supplyForm, storageLocation: event.target.value })} /></label>
                                <label className="text-sm font-semibold text-slate-800">Status<select className={fieldClass} value={supplyForm.status} onChange={(event) => setSupplyForm({ ...supplyForm, status: event.target.value })}><option>Available</option><option>On Hold</option></select></label>
                                <FormActions saving={saving} label="Register supply" onCancel={() => setModal('')} />
                            </form>
                        )}

                        {modal === 'distribution' && (
                            <form onSubmit={submitDistribution} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
                                <label className="text-sm font-semibold text-slate-800 sm:col-span-2">Supply and available quantity<select required className={fieldClass} value={distributionForm.supply} onChange={(event) => setDistributionForm({ ...distributionForm, supply: event.target.value })}><option value="">Select available supply</option>{options.supplies.map((supply) => <option key={supply._id} value={supply._id}>{supply.supplyName} · {supply.organization?.organizationName} · {formatQuantity(supply.remainingQuantity)} {supply.unit} available</option>)}</select></label>
                                {selectedFormSupply && <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-900 sm:col-span-2">Organization: <strong>{selectedFormSupply.organization?.organizationName}</strong> · Event: <strong>{selectedFormSupply.disasterEvent}</strong> · Remaining: <strong>{formatQuantity(selectedFormSupply.remainingQuantity)} {selectedFormSupply.unit}</strong></div>}
                                <label className="text-sm font-semibold text-slate-800">Distribute to<select className={fieldClass} value={distributionForm.destinationType} onChange={(event) => setDistributionForm({ ...distributionForm, destinationType: event.target.value, district: '', shelter: '', reliefLocation: '' })}><option>District</option><option>Shelter</option><option>Relief Location</option></select></label>
                                {distributionForm.destinationType === 'District' && <label className="text-sm font-semibold text-slate-800">District<select required className={fieldClass} value={distributionForm.district} onChange={(event) => setDistributionForm({ ...distributionForm, district: event.target.value })}><option value="">Select district</option>{options.districts.map((district) => <option key={district}>{district}</option>)}</select></label>}
                                {distributionForm.destinationType === 'Shelter' && <label className="text-sm font-semibold text-slate-800">Shelter<select required className={fieldClass} value={distributionForm.shelter} onChange={(event) => setDistributionForm({ ...distributionForm, shelter: event.target.value })}><option value="">Select active shelter</option>{options.shelters.map((shelter) => <option key={shelter._id} value={shelter._id}>{shelter.shelterName} · {shelter.district}</option>)}</select></label>}
                                {distributionForm.destinationType === 'Relief Location' && <label className="text-sm font-semibold text-slate-800">Approved relief location<select required className={fieldClass} value={distributionForm.reliefLocation} onChange={(event) => setDistributionForm({ ...distributionForm, reliefLocation: event.target.value })}><option value="">Select approved location</option>{options.reliefLocations.map((location) => <option key={location._id} value={location._id}>{location.name}</option>)}</select></label>}
                                <label className="text-sm font-semibold text-slate-800">Quantity<input required type="number" min="0.001" step="any" max={selectedFormSupply?.remainingQuantity} className={fieldClass} value={distributionForm.quantity} onChange={(event) => setDistributionForm({ ...distributionForm, quantity: event.target.value })} /></label>
                                <label className="text-sm font-semibold text-slate-800">Distribution date<input required type="date" className={fieldClass} value={distributionForm.distributionDate} onChange={(event) => setDistributionForm({ ...distributionForm, distributionDate: event.target.value })} /></label>
                                <label className="text-sm font-semibold text-slate-800">Recipient<input required maxLength="200" className={fieldClass} value={distributionForm.recipient} onChange={(event) => setDistributionForm({ ...distributionForm, recipient: event.target.value })} /></label>
                                <label className="text-sm font-semibold text-slate-800">Purpose<input required maxLength="500" className={fieldClass} value={distributionForm.purpose} onChange={(event) => setDistributionForm({ ...distributionForm, purpose: event.target.value })} /></label>
                                <label className="text-sm font-semibold text-slate-800 sm:col-span-2">Notes<textarea rows="3" maxLength="2000" className={fieldClass} value={distributionForm.notes} onChange={(event) => setDistributionForm({ ...distributionForm, notes: event.target.value })} /></label>
                                <FormActions saving={saving} label="Record distribution" onCancel={() => setModal('')} />
                            </form>
                        )}

                        {modal === 'supplyDetails' && selectedSupply && (
                            <div className="p-5 sm:p-7">
                                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                                    <div className="min-w-0">
                                        <h3 className="text-xl font-bold text-slate-900">{selectedSupply.supplyName}</h3>
                                        <p className="mt-1 text-sm text-slate-500">{selectedSupply.supplyId} · {selectedSupply.category} · {selectedSupply.unit}</p>
                                    </div>
                                    <StatusBadge status={selectedSupply.status} />
                                </div>

                                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                    <Metric label="Received" value={`${formatQuantity(selectedSupply.quantityReceived)} ${selectedSupply.unit}`} tone="blue" />
                                    <Metric label="Distributed" value={`${formatQuantity(selectedSupply.totalDistributed)} ${selectedSupply.unit}`} tone="amber" />
                                    <Metric label="Remaining" value={`${formatQuantity(selectedSupply.remainingQuantity)} ${selectedSupply.unit}`} tone="green" />
                                </div>

                                <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                                    <header className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
                                        <Info size={16} className="text-slate-600" />
                                        <h4 className="text-sm font-bold text-slate-900">Supply details</h4>
                                    </header>
                                    <div className="grid gap-x-6 gap-y-4 bg-white p-4 sm:grid-cols-2">
                                        <Detail icon={Building2} label="Organization" value={selectedSupply.organizationName} />
                                        <Detail icon={History} label="Disaster event" value={selectedSupply.disasterEvent} />
                                        <Detail icon={Package} label="Batch number" value={selectedSupply.batchNumber || 'Not provided'} />
                                        <Detail icon={MapPin} label="Storage location" value={selectedSupply.storageLocation} />
                                        <Detail icon={CalendarDays} label="Received date" value={formatDate(selectedSupply.receivedDate)} />
                                        <Detail icon={CalendarDays} label="Expiry date" value={selectedSupply.expiryDate ? formatDate(selectedSupply.expiryDate) : 'Not provided'} />
                                    </div>
                                </section>

                                <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                                    <header className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
                                        <Truck size={16} className="text-blue-700" />
                                        <h4 className="text-sm font-bold text-slate-900">Distribution history for this supply</h4>
                                        <span className="ml-auto rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                            {supplyDistributions.length} record{supplyDistributions.length === 1 ? '' : 's'}
                                        </span>
                                    </header>
                                    <div className="bg-white p-4">
                                        {supplyDistributions.length === 0 ? (
                                            <p className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">This supply has not been distributed yet.</p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {supplyDistributions.map((distribution) => (
                                                    <li key={distribution._id} className="rounded-lg border border-slate-200 border-l-4 border-l-blue-400 bg-white p-3">
                                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                                            <div>
                                                                <p className="text-sm font-medium text-slate-900">
                                                                    {formatQuantity(distribution.quantity)} {selectedSupply.unit} → {destinationLabel(distribution)}
                                                                </p>
                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    {distribution.recipient} · {distribution.purpose}
                                                                </p>
                                                            </div>
                                                            <p className="shrink-0 text-xs text-slate-500">{formatDate(distribution.distributionDate)}</p>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}

                        {modal === 'distributionDetails' && selectedDistribution && (
                            <div className="p-5 sm:p-7">
                                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                                    <div className="min-w-0">
                                        <h3 className="text-xl font-bold text-slate-900">{selectedDistribution.distributionId}</h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            {selectedDistribution.supply?.supplyName} · {selectedDistribution.organization?.organizationName}
                                        </p>
                                    </div>
                                    <AuditBadge status={selectedDistribution.auditStatus} />
                                </div>

                                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                    <Metric label="Quantity distributed" value={`${formatQuantity(selectedDistribution.quantity)} ${selectedDistribution.supply?.unit || ''}`} tone="blue" />
                                    <Metric label="Distribution date" value={formatDate(selectedDistribution.distributionDate)} tone="slate" />
                                    <Metric label="Destination" value={selectedDistribution.destinationType} tone="slate" />
                                </div>

                                <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                                    <header className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
                                        <Info size={16} className="text-slate-600" />
                                        <h4 className="text-sm font-bold text-slate-900">Distribution details</h4>
                                    </header>
                                    <div className="grid gap-x-6 gap-y-4 bg-white p-4 sm:grid-cols-2">
                                        <Detail icon={Package} label="Supply" value={`${selectedDistribution.supply?.supplyName} (${selectedDistribution.supply?.supplyId || '—'})`} />
                                        <Detail icon={Building2} label="Organization" value={selectedDistribution.organization?.organizationName || '—'} />
                                        <Detail icon={History} label="Disaster event" value={selectedDistribution.disasterEvent || '—'} />
                                        <Detail icon={MapPin} label="Destination" value={destinationLabel(selectedDistribution)} />
                                        <Detail icon={User} label="Recipient" value={selectedDistribution.recipient} />
                                        <Detail icon={User} label="Responsible officer" value={selectedDistribution.responsibleOfficer?.name || '—'} />
                                        <Detail icon={Info} label="Purpose" value={selectedDistribution.purpose} />
                                        <Detail icon={Info} label="Notes" value={selectedDistribution.notes || 'Not provided'} />
                                    </div>
                                </section>

                                <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                                    <header className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-2.5">
                                        {selectedDistribution.auditStatus === 'Verified'
                                            ? <CheckCircle2 size={16} className="text-green-600" />
                                            : <CircleDashed size={16} className="text-amber-600" />}
                                        <h4 className="text-sm font-bold text-slate-900">Audit status</h4>
                                    </header>
                                    <div className="grid gap-4 bg-white p-4 sm:grid-cols-2">
                                        <Detail icon={User} label="Verified by" value={selectedDistribution.verifiedBy?.name || 'Not verified'} />
                                        <Detail icon={CalendarDays} label="Verification timestamp" value={formatDateTime(selectedDistribution.verifiedAt)} />
                                        <div className="sm:col-span-2"><Detail icon={Info} label="Verification notes" value={selectedDistribution.verificationNotes || 'No verification notes'} /></div>
                                    </div>
                                    {canAudit && (
                                        <form onSubmit={saveAudit} className="border-t border-slate-200 bg-slate-50 p-4">
                                            <h5 className="text-sm font-bold text-slate-900">Verify distribution</h5>
                                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-700">
                                                    Audit status
                                                    <select aria-label="Audit status" className={fieldClass} value={auditStatus} onChange={(event) => setAuditStatus(event.target.value)}>
                                                        {auditStatuses.map((status) => <option key={status}>{status}</option>)}
                                                    </select>
                                                </label>
                                                <label className="text-[11px] font-bold uppercase tracking-wide text-slate-700 sm:col-span-2">
                                                    Verification notes
                                                    <textarea maxLength="2000" rows="3" className={fieldClass} value={verificationNotes} onChange={(event) => setVerificationNotes(event.target.value)} placeholder="Enter findings or reason for this audit status." />
                                                </label>
                                            </div>
                                            <div className="mt-3 flex justify-end">
                                                <button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save verification'}</button>
                                            </div>
                                        </form>
                                    )}
                                    {selectedDistribution.auditHistory?.length > 0 && (
                                        <div className="border-t border-slate-200 bg-white p-4">
                                            <h5 className="text-sm font-bold text-slate-900">Audit history</h5>
                                            <ol className="mt-3 space-y-3">
                                                {[...selectedDistribution.auditHistory].reverse().map((entry, index) => (
                                                    <li key={`${entry._id || entry.changedAt}-${index}`} className="border-l-2 border-slate-200 pl-3">
                                                        <div className="flex flex-wrap items-center gap-2"><AuditBadge status={entry.auditStatus} /><span className="text-xs text-slate-500">{entry.changedBy?.name || 'User'} · {formatDateTime(entry.changedAt)}</span></div>
                                                        {entry.notes && <p className="mt-1 text-sm text-slate-700">{entry.notes}</p>}
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}
                    </section>
                </div>
            )}
        </main>
    )
}

function modalTitle(modal) {
    switch (modal) {
        case 'supply': return 'Register received supplies'
        case 'distribution': return 'Record relief distribution'
        case 'supplyDetails': return 'Supply details'
        case 'distributionDetails': return 'Distribution details'
        default: return ''
    }
}

function FormActions({ saving, label, onCancel }) {
    return (
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
            <button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {label === 'Register supply' ? <ArrowDownToLine size={16} /> : <Truck size={16} />}
                {saving ? 'Saving…' : label}
            </button>
        </div>
    )
}

function EmptyState({ icon: Icon, title, message }) {
    return <div className="py-14 text-center"><Icon className="mx-auto text-slate-400" size={30} /><p className="mt-3 font-semibold text-slate-800">{title}</p><p className="mt-1 text-sm text-slate-500">{message}</p></div>
}

function StatusBadge({ status }) {
    const style = status === 'Available' || status === 'Verified'
        ? 'bg-green-50 text-green-700'
        : status === 'Pending Verification' || status === 'On Hold'
            ? 'bg-amber-50 text-amber-700'
            : status === 'Flagged'
                ? 'bg-orange-50 text-orange-700'
                : 'bg-slate-100 text-slate-600'
    return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{status}</span>
}

function AuditBadge({ status }) {
    const map = {
        Verified: 'bg-green-50 text-green-700 ring-green-200',
        'Pending Verification': 'bg-amber-50 text-amber-700 ring-amber-200',
        Flagged: 'bg-orange-50 text-orange-700 ring-orange-200',
        Rejected: 'bg-red-50 text-red-700 ring-red-200'
    }
    return <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ring-1 ${map[status] || 'bg-slate-100 text-slate-600 ring-slate-200'}`}>{status}</span>
}

function Metric({ label, value, tone = 'slate' }) {
    const tones = {
        blue: 'from-blue-50 to-white border-blue-100 text-blue-700',
        amber: 'from-amber-50 to-white border-amber-100 text-amber-700',
        green: 'from-emerald-50 to-white border-emerald-100 text-emerald-700',
        slate: 'from-slate-50 to-white border-slate-200 text-slate-700'
    }
    return (
        <div className={`rounded-xl border bg-gradient-to-b p-4 ${tones[tone]}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{label}</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
        </div>
    )
}

function Detail({ icon: Icon, label, value }) {
    return (
        <div className="flex gap-3">
            {Icon && <Icon size={16} className="mt-1 shrink-0 text-slate-500" />}
            <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-700">{label}</p>
                <p className="mt-1 break-words text-[13px] text-slate-700">{value}</p>
            </div>
        </div>
    )
}

function destinationLabel(distribution) {
    if (distribution.destinationType === 'Shelter') return distribution.shelter?.shelterName || 'Shelter'
    if (distribution.destinationType === 'Relief Location') return distribution.reliefLocation?.name || 'Relief location'
    return distribution.district
}

function formatQuantity(value) {
    return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })
}

function formatDate(value) {
    return value ? new Date(value).toLocaleDateString() : '—'
}

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString() : '—'
}

export default ReliefSupplyManagement