import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
    Bell,
    BellRing,
    CalendarDays,
    Check,
    ChevronRight,
    CircleCheck,
    Clock3,
    MapPin,
    Megaphone,
    Plus,
    RefreshCw,
    Search,
    ShieldAlert,
    Users
} from 'lucide-react'
import api from '../../../services/api'

const severityStyles = {
    advisory: 'bg-sky-50 text-sky-800',
    watch: 'bg-amber-50 text-amber-800',
    warning: 'bg-orange-50 text-orange-800',
    emergency: 'bg-red-50 text-red-800'
}

const severityCardStyles = {
    advisory: 'border-l-sky-500',
    watch: 'border-l-amber-500',
    warning: 'border-l-orange-500',
    emergency: 'border-l-red-500'
}

const activeStatuses = ['issuing', 'issued', 'partially_issued', 'delivery_failed']

function WarningsPage() {
    const location = useLocation()
    const [warnings, setWarnings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [resolvingWarningId, setResolvingWarningId] = useState('')
    const [search, setSearch] = useState('')
    const [hazardFilter, setHazardFilter] = useState('all')
    const [severityFilter, setSeverityFilter] = useState('all')
    const [statusFilter, setStatusFilter] = useState('all')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    useEffect(() => {
        let active = true
        let requestPending = false
        const loadWarnings = async (initial = false) => {
            if (requestPending) return
            requestPending = true
            try {
                const { data } = await api.get('/dmcofficer/warnings')
                if (active) {
                    setWarnings(data.warnings)
                    setError('')
                }
            } catch (requestError) {
                if (active) {
                    setError(
                        requestError.response?.data?.message
                        || 'Could not load warnings.'
                    )
                }
            } finally {
                requestPending = false
                if (active && initial) setLoading(false)
            }
        }
        loadWarnings(true)
        const refreshTimer = setInterval(() => loadWarnings(), 10000)
        return () => {
            active = false
            clearInterval(refreshTimer)
        }
    }, [])

    const issuedWarning = warnings.find((warning) => (
        warning._id === location.state?.warningId
    ))
    const deliverySummary = issuedWarning?.deliverySummary || location.state?.deliverySummary
    const issuanceInProgress = Boolean(
        location.state?.issuanceStarted
        && (!issuedWarning || issuedWarning.status === 'issuing')
    )
    const markResolved = async (warningId) => {
        setError('')
        setResolvingWarningId(warningId)
        try {
            const { data } = await api.patch(`/dmcofficer/warnings/${warningId}/resolve`)
            setWarnings((current) => current.map((warning) => (
                warning._id === warningId ? data.warning : warning
            )))
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not resolve this warning.')
        } finally {
            setResolvingWarningId('')
        }
    }

    const activeWarnings = warnings.filter((warning) => (
        !warning.resolvedAt && activeStatuses.includes(warning.status)
    )).length
    const resolvedWarnings = warnings.filter((warning) => warning.resolvedAt).length
    const hazardTypes = [...new Set(warnings.map((warning) => warning.hazardType).filter(Boolean))]
    const filteredWarnings = warnings.filter((warning) => {
        const normalizedSearch = search.trim().toLowerCase()
        const searchableText = [
            warning.title,
            warning.message,
            warning.hazardType,
            ...(warning.targetAreaIds || []).map((area) => area.name)
        ].join(' ').toLowerCase()
        const createdDate = new Date(warning.createdAt)
        const statusMatches = statusFilter === 'all'
            || (statusFilter === 'resolved' ? Boolean(warning.resolvedAt) : warning.status === statusFilter)
        const dateMatches = (!startDate || createdDate >= new Date(`${startDate}T00:00:00`))
            && (!endDate || createdDate <= new Date(`${endDate}T23:59:59.999`))

        return (!normalizedSearch || searchableText.includes(normalizedSearch))
            && (hazardFilter === 'all' || warning.hazardType === hazardFilter)
            && (severityFilter === 'all' || warning.severity === severityFilter)
            && statusMatches
            && dateMatches
    })

    const resetFilters = () => {
        setSearch('')
        setHazardFilter('all')
        setSeverityFilter('all')
        setStatusFilter('all')
        setStartDate('')
        setEndDate('')
    }

    return (
        <main className="mx-auto max-w-7xl px-4 pb-12 pt-20 sm:px-8 lg:pt-10">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Public safety</p>
                    <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-950">Warnings</h1>
                    <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
                        Manage and monitor disaster warnings, delivery status, target areas and citizen reach.
                    </p>
                </div>
                <Link
                    to="/dmcofficer/warnings/create"
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200"
                >
                    <Plus size={17} /> Create Warning
                </Link>
            </div>

            {(location.state?.created || location.state?.updated) && (
                <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    {location.state.created ? 'Warning created as a draft.' : 'Draft changes saved.'} No notification has been sent.
                </p>
            )}
            {location.state?.warningUpdated && (
                <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    Warning update posted. Newly affected citizens are being notified.
                </p>
            )}
            {(location.state?.issuanceStarted || location.state?.issued) && (
                <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                    <p className="font-semibold">
                        {issuanceInProgress
                            ? 'Warning issuance started.'
                            : 'Warning issuance completed.'}
                    </p>
                    {issuanceInProgress ? (
                        <p className="mt-1">Notifications are being sent. Delivery results will update automatically.</p>
                    ) : deliverySummary && (
                        <p className="mt-1">
                            In-app: {deliverySummary.inAppSent}/{deliverySummary.recipients} ·
                            SMS: {deliverySummary.smsQueued || 0} queued, {deliverySummary.smsDispatched || 0} dispatched to device, {deliverySummary.smsSent} carrier accepted, {deliverySummary.smsDelivered || 0} delivery-confirmed, {deliverySummary.smsFailed} failed ·
                            Email fallback: {deliverySummary.emailFallbackSent} sent, {deliverySummary.emailFallbackFailed} failed.
                        </p>
                    )}
                    <p className="mt-1 text-xs">TextBee delivery updates refresh automatically.</p>
                </div>
            )}
            {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}

            {!loading && (
                <>
                    <section aria-label="Warning summary" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <article className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                                <Megaphone size={25} aria-hidden="true" />
                            </span>
                            <div>
                                <p className="text-sm font-medium text-slate-600">Total warnings</p>
                                <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-950">{warnings.length}</p>
                            </div>
                        </article>
                        <article className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                                <ShieldAlert size={25} aria-hidden="true" />
                            </span>
                            <div>
                                <p className="text-sm font-medium text-slate-600">Active warnings</p>
                                <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-950">{activeWarnings}</p>
                            </div>
                        </article>
                        <article className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                                <CircleCheck size={25} aria-hidden="true" />
                            </span>
                            <div>
                                <p className="text-sm font-medium text-slate-600">Resolved warnings</p>
                                <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-950">{resolvedWarnings}</p>
                            </div>
                        </article>
                    </section>

                    <section aria-label="Filter warnings" className="mt-4 grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-7">
                        <label className="relative block lg:col-span-2">
                            <span className="sr-only">Search warnings</span>
                            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search warnings..."
                                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
                            />
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-600">Hazard type</span>
                            <select value={hazardFilter} onChange={(event) => setHazardFilter(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                                <option value="all">All types</option>
                                {hazardTypes.map((hazardType) => <option key={hazardType} value={hazardType}>{hazardType}</option>)}
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-600">Severity</span>
                            <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                                <option value="all">All severities</option>
                                {Object.keys(severityStyles).map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-600">Status</span>
                            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
                                <option value="all">All statuses</option>
                                <option value="draft">Draft</option>
                                <option value="issuing">Issuing</option>
                                <option value="issued">Issued</option>
                                <option value="partially_issued">Partially issued</option>
                                <option value="delivery_failed">Delivery failed</option>
                                <option value="resolved">Resolved</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-600">From</span>
                            <span className="relative block">
                                <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                                <input type="date" aria-label="Start date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                            </span>
                        </label>
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-slate-600">To</span>
                            <span className="relative block">
                                <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                                <input type="date" aria-label="End date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-2 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
                            </span>
                        </label>
                        <button type="button" onClick={resetFilters} className="inline-flex h-11 items-center justify-center gap-2 self-end rounded-xl border border-blue-200 px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus:outline-none focus:ring-4 focus:ring-blue-100">
                            <RefreshCw size={15} aria-hidden="true" /> Reset
                        </button>
                    </section>
                </>
            )}

            {loading ? (
                <p className="mt-8 text-sm text-slate-600">Loading warnings…</p>
            ) : warnings.length === 0 ? (
                <section className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                        <Bell className="mx-auto" size={27} />
                    </span>
                    <h2 className="mt-4 font-semibold text-slate-900">No warnings created yet</h2>
                    <p className="mt-2 text-sm text-slate-600">Create a warning and its selected target areas will determine the citizen audience.</p>
                </section>
            ) : filteredWarnings.length === 0 ? (
                <section className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <Search className="mx-auto text-slate-400" size={28} aria-hidden="true" />
                    <h2 className="mt-3 font-semibold text-slate-900">No matching warnings</h2>
                    <p className="mt-1 text-sm text-slate-600">Try changing your search or filters.</p>
                </section>
            ) : (
                <section className="mt-5 space-y-4">
                    <p className="px-1 text-xs font-medium text-slate-500">
                        Showing {filteredWarnings.length} of {warnings.length} warnings
                    </p>
                    {filteredWarnings.map((warning) => {
                        const areas = warning.targetAreaIds || []
                        const delivery = warning.deliverySummary
                        const status = warning.resolvedAt ? 'resolved' : warning.status
                        const statusColor = warning.resolvedAt
                            ? 'bg-emerald-500'
                            : status === 'draft'
                                ? 'bg-slate-400'
                                : status === 'delivery_failed'
                                    ? 'bg-red-500'
                                    : status === 'partially_issued'
                                        ? 'bg-amber-500'
                                        : 'bg-blue-500'

                        return (
                            <article key={warning._id} className={`overflow-hidden rounded-2xl border border-slate-200 border-l-4 ${severityCardStyles[warning.severity] || 'border-l-slate-400'} bg-white shadow-sm transition hover:shadow-md`}>
                                <div className="p-4 sm:p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${severityStyles[warning.severity] || 'bg-slate-100 text-slate-700'}`}>
                                                    <ShieldAlert size={13} aria-hidden="true" />
                                                    {warning.severity}
                                                </span>
                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-slate-600">
                                                    <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                                                    {status.replaceAll('_', ' ')}
                                                </span>
                                            </div>
                                            <h2 className="mt-2 text-lg font-bold text-slate-950">{warning.title}</h2>
                                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-slate-600">
                                                <span className="inline-flex items-center gap-1.5 capitalize"><BellRing size={14} className="text-blue-600" aria-hidden="true" />{warning.hazardType}</span>
                                                <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-slate-500" aria-hidden="true" />{areas.map((area) => area.name).join(', ') || 'No areas selected'}</span>
                                                <span className="inline-flex items-center gap-1.5"><Users size={14} className="text-slate-500" aria-hidden="true" />{warning.recipientCount ?? 0} citizens selected</span>
                                            </div>
                                            {warning.message && <p className="mt-2 max-w-4xl whitespace-pre-wrap text-sm leading-5 text-slate-600">{warning.message}</p>}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 lg:justify-end">
                                            <span className="inline-flex items-center gap-1.5"><Clock3 size={14} aria-hidden="true" />{new Date(warning.createdAt).toLocaleString()}</span>
                                            <span>Created by <strong className="font-semibold text-slate-700">{warning.createdBy?.name || 'Unknown officer'}</strong></span>
                                        </div>
                                    </div>

                                    {warning.resolvedAt && (
                                        <p className="mt-3 text-xs font-semibold text-emerald-700">
                                            Resolved {new Date(warning.resolvedAt).toLocaleString()}
                                            {warning.resolvedBy?.name && ` by ${warning.resolvedBy.name}`}
                                        </p>
                                    )}

                                    {delivery && (
                                        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                                                <p className="text-xs font-semibold text-slate-700">In-app</p>
                                                <p className="mt-1 text-xs text-slate-500">{delivery.inAppSent}/{delivery.recipients} sent</p>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                                                <p className="text-xs font-semibold text-slate-700">SMS</p>
                                                <p className="mt-1 text-xs text-slate-500">{delivery.smsSent} accepted · {delivery.smsFailed} failed · {delivery.smsUnknown || 0} unknown</p>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                                                <p className="text-xs font-semibold text-slate-700">Email fallback</p>
                                                <p className="mt-1 text-xs text-slate-500">{delivery.emailFallbackSent} sent · {delivery.emailFallbackFailed} failed</p>
                                            </div>
                                        </div>
                                    )}
                                    {delivery?.failureDetails?.length > 0 && (
                                        <ul className="mt-2 space-y-1 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                                            {delivery.failureDetails.map(({ channel, count, reason }) => (
                                                <li key={`${channel}-${reason}`}>{channel}: {count} failure(s) — {reason}</li>
                                            ))}
                                        </ul>
                                    )}

                                    <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                        <Link to="/dmcofficer/target-areas" className="group inline-flex min-h-10 items-center justify-between gap-3 rounded-xl bg-blue-50 px-3.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-100 sm:min-w-48">
                                            <span>View target areas</span>
                                            <ChevronRight size={16} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
                                        </Link>
                                        <div className="flex flex-wrap gap-2">
                                            {warning.status === 'draft' && (
                                                <>
                                                    <Link to={`/dmcofficer/warnings/${warning._id}/edit`} className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                                                        Edit draft
                                                    </Link>
                                                    <Link to={`/dmcofficer/warnings/${warning._id}/review`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white transition hover:bg-blue-800">
                                                        <BellRing size={15} aria-hidden="true" /> Issue warning
                                                    </Link>
                                                </>
                                            )}
                                            {!warning.resolvedAt && ['partially_issued', 'delivery_failed'].includes(warning.status) && (
                                                <Link to={`/dmcofficer/warnings/${warning._id}/review`} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-700 px-3 text-sm font-semibold text-white transition hover:bg-amber-800">
                                                    <BellRing size={15} aria-hidden="true" /> Retry failed deliveries
                                                </Link>
                                            )}
                                            {!warning.resolvedAt && ['issued', 'partially_issued', 'delivery_failed'].includes(warning.status) && (
                                                <>
                                                    <Link to={`/dmcofficer/warnings/${warning._id}/update`} className="inline-flex min-h-10 items-center rounded-lg border border-blue-300 px-3 text-sm font-semibold text-blue-800 transition hover:bg-blue-50">
                                                        Post update
                                                    </Link>
                                                    <button type="button" onClick={() => markResolved(warning._id)} disabled={resolvingWarningId === warning._id} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">
                                                        <Check size={16} aria-hidden="true" />
                                                        {resolvingWarningId === warning._id ? 'Resolving…' : 'Mark as resolved'}
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        )
                    })}
                </section>
            )}
        </main>
    )
}

export default WarningsPage
