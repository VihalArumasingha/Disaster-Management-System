import { useCallback, useEffect, useState } from 'react'
import { Building2, ChevronDown, ChevronUp, Handshake, Pencil, Plus, Search, X } from 'lucide-react'
import api from '../../services/api'

const organizationTypes = ['NGO', 'Donor', 'Government Agency', 'International Organization', 'Private Organization']
const organizationStatuses = ['Pending Verification', 'Active', 'Suspended', 'Inactive']
const contributionTypes = ['Financial', 'Goods', 'Service', 'Other']

const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
    'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara',
    'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar',
    'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya',
    'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
]

const emptyOrganization = {
    organizationName: '',
    organizationType: 'NGO',
    registrationNumber: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    district: '',
    description: ''
}

const emptyContribution = {
    contributionType: 'Financial',
    description: '',
    amount: '',
    currency: 'LKR',
    quantity: '',
    disasterEvent: '',
    contributedAt: new Date().toISOString().slice(0, 10)
}

const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'

// Colour accents per contribution type (used for badges and left border)
const typeStyles = {
    Financial: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'border-l-emerald-400' },
    Goods:     { badge: 'bg-amber-50 text-amber-700 border-amber-200',       bar: 'border-l-amber-400' },
    Service:   { badge: 'bg-violet-50 text-violet-700 border-violet-200',    bar: 'border-l-violet-400' },
    Other:     { badge: 'bg-slate-100 text-slate-700 border-slate-200',      bar: 'border-l-slate-400' }
}

function OrganizationManagementPage({ apiBase = '/dmcofficer' }) {
    const organizationsApi = `${apiBase}/organizations`
    const [organizations, setOrganizations] = useState([])
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [modal, setModal] = useState('')
    const [selected, setSelected] = useState(null)
    const [contributions, setContributions] = useState([])
    const [form, setForm] = useState(emptyOrganization)
    const [contribution, setContribution] = useState(emptyContribution)
    const [saving, setSaving] = useState(false)
    const [showContributionForm, setShowContributionForm] = useState(false)

    const loadOrganizations = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const { data } = await api.get(organizationsApi, {
                params: { q: search || undefined, type: typeFilter || undefined }
            })
            setOrganizations(data.organizations)
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not load organizations.')
        } finally {
            setLoading(false)
        }
    }, [search, typeFilter, organizationsApi])

    useEffect(() => {
        let active = true
        api.get(organizationsApi, {
            params: { q: search || undefined, type: typeFilter || undefined }
        })
            .then(({ data }) => {
                if (active) {
                    setOrganizations(data.organizations)
                    setError('')
                }
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || 'Could not load organizations.')
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
        }
    }, [search, typeFilter, organizationsApi])

    const openForm = (organization) => {
        setError('')
        setSelected(organization)
        setForm(organization ? { ...organization } : emptyOrganization)
        setModal('form')
    }

    const openDetails = async (organization) => {
        setSelected(organization)
        setError('')
        setContribution(emptyContribution)
        setShowContributionForm(false)
        setModal('details')
        try {
            const { data } = await api.get(`${organizationsApi}/${organization._id}`)
            setSelected(data.organization)
            setContributions(data.contributions)
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not load organization details.')
        }
    }

    const saveOrganization = async (submitEvent) => {
        submitEvent.preventDefault()
        setSaving(true)
        setError('')
        try {
            const payload = {
                organizationName: form.organizationName,
                organizationType: form.organizationType,
                registrationNumber: form.registrationNumber || '',
                contactPerson: form.contactPerson,
                email: form.email,
                phone: form.phone,
                address: form.address,
                district: form.district,
                description: form.description || ''
            }
            if (selected) {
                await api.put(`${organizationsApi}/${selected._id}`, payload)
                setNotice('Organization details updated.')
            } else {
                await api.post(organizationsApi, payload)
                setNotice('Organization registered and marked pending verification.')
            }
            setModal('')
            await loadOrganizations()
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not save organization.')
        } finally {
            setSaving(false)
        }
    }

    const updateStatus = async (organization, status, event) => {
        if (event) event.stopPropagation()
        setError('')
        setNotice('')
        try {
            const { data } = await api.patch(`${organizationsApi}/${organization._id}/status`, { status })
            setSelected(data.organization)
            setNotice(`Organization status changed to ${status}.`)
            await loadOrganizations()
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not update organization status.')
        }
    }

    const addContribution = async (submitEvent) => {
        submitEvent.preventDefault()
        setSaving(true)
        setError('')
        try {
            const payload = {
                contributionType: contribution.contributionType,
                description: contribution.description,
                currency: contribution.currency || 'LKR',
                disasterEvent: contribution.disasterEvent || '',
                contributedAt: contribution.contributedAt
                    ? new Date(contribution.contributedAt).toISOString()
                    : undefined,
                amount: contribution.amount === '' ? undefined : Number(contribution.amount),
                quantity: contribution.quantity === '' ? undefined : Number(contribution.quantity)
            }
            const { data } = await api.post(`${organizationsApi}/${selected._id}/contributions`, payload)
            setContributions((existing) => [data.contribution, ...existing])
            setContribution(emptyContribution)
            setShowContributionForm(false)
            setNotice('Contribution recorded.')
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not record contribution.')
        } finally {
            setSaving(false)
        }
    }

    // Format a history row into a compact summary line
    const contributionSummary = (item) => {
        switch (item.contributionType) {
            case 'Financial':
                return item.amount != null
                    ? `${item.currency || 'LKR'} ${Number(item.amount).toLocaleString()}`
                    : 'Financial contribution'
            case 'Goods':
                return item.quantity != null ? `Quantity: ${item.quantity}` : 'Goods contribution'
            case 'Service':
                return 'Service contribution'
            case 'Other': {
                const parts = []
                if (item.amount != null) parts.push(`${item.currency || 'LKR'} ${Number(item.amount).toLocaleString()}`)
                if (item.quantity != null) parts.push(`Quantity: ${item.quantity}`)
                return parts.length ? parts.join(' · ') : 'Other contribution'
            }
            default:
                return ''
        }
    }

    const renderContributionFields = () => {
        const type = contribution.contributionType
        return (
            <>
                <label className="text-sm font-medium text-slate-700">
                    Contribution type
                    <select
                        className={fieldClass}
                        value={type}
                        onChange={(e) => setContribution({ ...emptyContribution, contributionType: e.target.value, contributedAt: contribution.contributedAt })}
                    >
                        {contributionTypes.map((t) => <option key={t}>{t}</option>)}
                    </select>
                </label>

                <label className="text-sm font-medium text-slate-700">
                    Contribution date
                    <input
                        type="date"
                        required
                        className={fieldClass}
                        value={contribution.contributedAt}
                        onChange={(e) => setContribution({ ...contribution, contributedAt: e.target.value })}
                    />
                </label>

                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                    Description
                    <input
                        required
                        maxLength="1000"
                        placeholder={
                            type === 'Financial' ? 'e.g. Cash donation for flood relief'
                                : type === 'Goods' ? 'e.g. 200 dry ration packs'
                                    : type === 'Service' ? 'e.g. Free medical camp for 3 days'
                                        : 'Describe the contribution'
                        }
                        className={fieldClass}
                        value={contribution.description}
                        onChange={(e) => setContribution({ ...contribution, description: e.target.value })}
                    />
                </label>

                {type === 'Financial' && (
                    <>
                        <label className="text-sm font-medium text-slate-700">
                            Amount
                            <input
                                type="number" min="0" step="0.01" required
                                className={fieldClass}
                                value={contribution.amount}
                                onChange={(e) => setContribution({ ...contribution, amount: e.target.value })}
                            />
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                            Currency
                            <input
                                maxLength="10"
                                className={fieldClass}
                                value={contribution.currency}
                                onChange={(e) => setContribution({ ...contribution, currency: e.target.value })}
                            />
                        </label>
                    </>
                )}

                {type === 'Goods' && (
                    <label className="text-sm font-medium text-slate-700">
                        Quantity
                        <input
                            type="number" min="0" step="any" required
                            className={fieldClass}
                            value={contribution.quantity}
                            onChange={(e) => setContribution({ ...contribution, quantity: e.target.value })}
                        />
                    </label>
                )}

                {type === 'Other' && (
                    <>
                        <label className="text-sm font-medium text-slate-700">
                            Amount (optional)
                            <input
                                type="number" min="0" step="0.01"
                                className={fieldClass}
                                value={contribution.amount}
                                onChange={(e) => setContribution({ ...contribution, amount: e.target.value })}
                            />
                        </label>
                        <label className="text-sm font-medium text-slate-700">
                            Quantity (optional)
                            <input
                                type="number" min="0" step="any"
                                className={fieldClass}
                                value={contribution.quantity}
                                onChange={(e) => setContribution({ ...contribution, quantity: e.target.value })}
                            />
                        </label>
                    </>
                )}

                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                    Disaster event (optional)
                    <input
                        className={fieldClass}
                        placeholder="e.g. 2025 Colombo floods"
                        value={contribution.disasterEvent}
                        onChange={(e) => setContribution({ ...contribution, disasterEvent: e.target.value })}
                    />
                </label>
            </>
        )
    }

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">DMC operations</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">Organization Management</h1>
                    <p className="mt-2 text-slate-600">Register response partners and track their contributions.</p>
                </div>
                <button type="button" onClick={() => openForm(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"><Plus size={17} /> Add organization</button>
            </div>

            {notice && <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
            {error && !modal && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}

            <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="grid gap-3 md:grid-cols-[1fr_270px]">
                    <label className="relative">
                        <span className="sr-only">Search organizations</span>
                        <Search size={17} className="absolute left-3 top-3 text-slate-400" />
                        <input className={`${fieldClass} mt-0 pl-9`} placeholder="Search name, registration, contact or district" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </label>
                    <select aria-label="Filter by organization type" className={`${fieldClass} mt-0`} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                        <option value="">All organization types</option>
                        {organizationTypes.map((type) => <option key={type}>{type}</option>)}
                    </select>
                </div>
                {loading ? <p className="py-12 text-center text-sm text-slate-500">Loading organizations…</p> : organizations.length === 0 ? (
                    <div className="py-14 text-center">
                        <Building2 className="mx-auto text-slate-400" size={30} />
                        <p className="mt-3 font-semibold text-slate-800">No organizations found</p>
                        <p className="mt-1 text-sm text-slate-500">Add an organization or adjust your search.</p>
                    </div>
                ) : (
                    <div className="mt-5 overflow-x-auto">
                        <table className="w-full min-w-[900px] text-left text-sm">
                            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr>{['Organization', 'Type', 'Contact', 'District', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-3 py-3 font-semibold">{heading}</th>)}</tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {organizations.map((organization) => (
                                    <tr
                                        key={organization._id}
                                        onClick={() => openDetails(organization)}
                                        className="cursor-pointer hover:bg-slate-50"
                                    >
                                        <td className="px-3 py-4"><p className="font-semibold text-slate-900">{organization.organizationName}</p><p className="mt-1 text-xs text-slate-500">{organization.organizationId}</p></td>
                                        <td className="px-3 py-4 text-slate-700">{organization.organizationType}</td>
                                        <td className="px-3 py-4"><p className="text-slate-800">{organization.contactPerson}</p><p className="mt-1 text-xs text-slate-500">{organization.email}</p></td>
                                        <td className="px-3 py-4 text-slate-700">{organization.district}</td>
                                        <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${organization.status === 'Active' ? 'bg-green-50 text-green-700' : organization.status === 'Pending Verification' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{organization.status}</span></td>
                                        <td className="px-3 py-4"><div className="flex items-center gap-1">
                                            <button
                                                title="Edit organization"
                                                aria-label={`Edit ${organization.organizationName}`}
                                                onClick={(e) => { e.stopPropagation(); openForm(organization) }}
                                                className="rounded-lg p-2 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                                            >
                                                <Pencil size={17} />
                                            </button>
                                            <button
                                                onClick={(e) => updateStatus(organization, organization.status === 'Active' ? 'Inactive' : 'Active', e)}
                                                className="rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                                            >
                                                {organization.status === 'Active' ? 'Deactivate' : 'Activate'}
                                            </button>
                                        </div></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal('') }}>
                    <section role="dialog" aria-modal="true" aria-labelledby="organization-modal-title" className="my-6 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
                            <div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">DMC partners</p><h2 id="organization-modal-title" className="mt-1 text-xl font-bold text-slate-900">{modal === 'form' ? (selected ? 'Edit organization' : 'Add organization') : 'Organization details'}</h2></div>
                            <button type="button" aria-label="Close" onClick={() => setModal('')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
                        </div>
                        {error && <p role="alert" className="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 sm:mx-7">{error}</p>}
                        {modal === 'form' && (
                            <form onSubmit={saveOrganization} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7">
                                <label className="text-sm font-medium text-slate-700">
                                    Organization name
                                    <input required className={fieldClass} value={form.organizationName} onChange={(e) => setForm({ ...form, organizationName: e.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                    Organization type
                                    <select className={fieldClass} value={form.organizationType} onChange={(e) => setForm({ ...form, organizationType: e.target.value })}>{organizationTypes.map((type) => <option key={type}>{type}</option>)}</select>
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                    Registration number
                                    <input type="text" className={fieldClass} value={form.registrationNumber || ''} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                    Contact person
                                    <input required type="text" className={fieldClass} value={form.contactPerson || ''} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                    Email
                                    <input required type="email" className={fieldClass} value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                    Phone
                                    <input required type="tel" className={fieldClass} value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                                    Address
                                    <input required type="text" className={fieldClass} value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                                </label>
                                <label className="text-sm font-medium text-slate-700">
                                    District
                                    <select required className={fieldClass} value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })}>
                                        <option value="">Select district</option>
                                        {districts.map((district) => <option key={district} value={district}>{district}</option>)}
                                    </select>
                                </label>
                                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                                    Description
                                    <textarea rows="3" className={fieldClass} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                                </label>
                                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
                                    <button type="button" onClick={() => setModal('')} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
                                    <button disabled={saving} className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save organization'}</button>
                                </div>
                            </form>
                        )}
                        {modal === 'details' && selected && (
                            <div className="p-5 sm:p-7">
                                {/* --- Organization header --- */}
                                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-900">{selected.organizationName}</h3>
                                        <p className="mt-1 text-sm text-slate-500">{selected.organizationId} · {selected.organizationType}</p>
                                    </div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Status
                                        <select aria-label="Organization status" className={`${fieldClass} mt-1 min-w-48`} value={selected.status} onChange={(e) => updateStatus(selected, e.target.value)}>
                                            {organizationStatuses.map((status) => <option key={status}>{status}</option>)}
                                        </select>
                                    </label>
                                </div>

                                {/* --- Organization details --- */}
                                <div className="mt-5 grid gap-x-6 gap-y-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                                    <Detail label="Registration number" value={selected.registrationNumber || 'Not provided'} />
                                    <Detail label="Contact person" value={selected.contactPerson} />
                                    <Detail label="Email" value={selected.email} />
                                    <Detail label="Phone" value={selected.phone} />
                                    <Detail label="Address" value={selected.address} />
                                    <Detail label="District" value={selected.district} />
                                    <Detail label="Description" value={selected.description || 'Not provided'} />
                                </div>

                                {/* --- Unified Contributions section --- */}
                                <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                    {/* Single header for both list + form */}
                                    <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
                                        <Handshake size={18} className="text-blue-700" />
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-slate-900">Contributions</h3>
                                            <p className="text-xs text-slate-500">History and new records for this organization</p>
                                        </div>
                                        <span className="ml-auto rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                            {contributions.length} recorded
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setShowContributionForm((v) => !v)}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                                        >
                                            {showContributionForm ? <ChevronUp size={14} /> : <Plus size={14} />}
                                            {showContributionForm ? 'Hide form' : 'Record a contribution'}
                                        </button>
                                    </header>

                                    {/* History list */}
                                    <div className="p-4">
                                        {contributions.length === 0 ? (
                                            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                                                No contributions recorded yet.
                                            </p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {contributions.map((item) => {
                                                    const style = typeStyles[item.contributionType] || typeStyles.Other
                                                    return (
                                                        <li
                                                            key={item._id}
                                                            className={`rounded-r-lg rounded-l-sm border border-slate-200 border-l-4 bg-white p-3 shadow-sm ${style.bar}`}
                                                        >
                                                            <div className="flex flex-wrap items-start justify-between gap-2">
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style.badge}`}>
                                                                            {item.contributionType}
                                                                        </span>
                                                                        <p className="truncate font-medium text-slate-900">{item.description}</p>
                                                                    </div>
                                                                    <p className="mt-1 text-xs text-slate-500">
                                                                        {contributionSummary(item)}
                                                                        {item.disasterEvent ? ` · ${item.disasterEvent}` : ''}
                                                                    </p>
                                                                </div>
                                                                <p className="shrink-0 text-xs font-medium text-slate-500">
                                                                    {new Date(item.contributedAt).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        )}
                                    </div>

                                    {/* Divider between history and form, only when form is open */}
                                    {showContributionForm && (
                                        <>
                                            <div className="h-px bg-slate-200" />
                                            <div className="bg-blue-50/40 p-4">
                                                <div className="mb-3 flex items-center gap-2">
                                                    <Plus size={16} className="text-blue-700" />
                                                    <h4 className="text-sm font-semibold text-slate-900">New contribution</h4>
                                                </div>
                                                <form onSubmit={addContribution}>
                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        {renderContributionFields()}
                                                    </div>
                                                    <div className="mt-4 flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => { setShowContributionForm(false); setContribution(emptyContribution) }}
                                                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                                                            {saving ? 'Recording…' : 'Save contribution'}
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        </>
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

function Detail({ label, value }) {
    return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm text-slate-800">{value}</p></div>
}

export default OrganizationManagementPage