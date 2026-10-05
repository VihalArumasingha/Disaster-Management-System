import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, BellRing, Check, Plus, Users } from 'lucide-react'
import api from '../../../services/api'

const severityStyles = {
    advisory: 'bg-sky-50 text-sky-800',
    watch: 'bg-amber-50 text-amber-800',
    warning: 'bg-orange-50 text-orange-800',
    emergency: 'bg-red-50 text-red-800'
}

function WarningsPage() {
    const location = useLocation()
    const [warnings, setWarnings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [resolvingWarningId, setResolvingWarningId] = useState('')

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

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Public safety</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">Warnings</h1>
                    <p className="mt-2 text-slate-600">Shared warning register for all DMC officers, including delivery status and citizen audience.</p>
                </div>
                <Link
                    to="/dmcofficer/warnings/create"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                >
                    <Plus size={17} /> Create Warning
                </Link>
            </div>

            {(location.state?.created || location.state?.updated) && (
                <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                    {location.state.created ? 'Warning created as a draft.' : 'Draft changes saved.'} No notification has been sent.
                </p>
            )}
            {location.state?.warningUpdated && (
                <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                    Warning update posted. Newly affected citizens are being notified.
                </p>
            )}
            {(location.state?.issuanceStarted || location.state?.issued) && (
                <div role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">
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
            {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
            {loading ? (
                <p className="mt-8 text-sm text-slate-600">Loading warnings…</p>
            ) : warnings.length === 0 ? (
                <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <Bell className="mx-auto text-slate-400" size={30} />
                    <h2 className="mt-4 font-semibold text-slate-900">No warnings created yet</h2>
                    <p className="mt-2 text-sm text-slate-600">Create a warning and its selected target areas will determine the citizen audience.</p>
                </section>
            ) : (
                <section className="mt-8 space-y-4">
                    {warnings.map((warning) => (
                        <article key={warning._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">{warning.title}</h2>
                                    <p className="mt-1 text-sm capitalize text-slate-600">{warning.hazardType} · {warning.resolvedAt ? 'resolved' : warning.status}</p>
                                    {warning.resolvedAt && (
                                        <p className="mt-1 text-xs font-semibold text-emerald-800">
                                            Resolved {new Date(warning.resolvedAt).toLocaleString()}
                                            {warning.resolvedBy?.name && ` by ${warning.resolvedBy.name}`}
                                        </p>
                                    )}
                                </div>
                                <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${severityStyles[warning.severity] || 'bg-slate-100 text-slate-700'}`}>
                                    {warning.severity}
                                </span>
                            </div>
                            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{warning.message}</p>
                            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1.5"><Users size={14} /> {warning.recipientCount} citizens selected</span>
                                <span>Areas: {warning.targetAreaIds.map((area) => area.name).join(', ') || '—'}</span>
                                <span>{new Date(warning.createdAt).toLocaleString()}</span>
                                <span>Created by {warning.createdBy?.name || 'Unknown officer'}</span>
                                {warning.issuedAt && (
                                    <span>
                                        Issued by {warning.issuedBy?.name || 'Officer not recorded'}
                                    </span>
                                )}
                            </div>
                            {warning.deliverySummary && (
                                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                                    <p>
                                        In-app {warning.deliverySummary.inAppSent}/{warning.deliverySummary.recipients} ·
                                        SMS {warning.deliverySummary.smsQueued || 0} queued / {warning.deliverySummary.smsDispatched || 0} dispatched to device / {warning.deliverySummary.smsSent} carrier accepted / {warning.deliverySummary.smsDelivered || 0} delivery-confirmed / {warning.deliverySummary.smsFailed} failed / {warning.deliverySummary.smsUnknown || 0} unknown ·
                                        Email fallback {warning.deliverySummary.emailFallbackSent} sent / {warning.deliverySummary.emailFallbackFailed} failed
                                    </p>
                                    {warning.deliverySummary.failureDetails?.length > 0 && (
                                        <ul className="mt-2 space-y-1 text-red-700">
                                            {warning.deliverySummary.failureDetails.map(({ channel, count, reason }) => (
                                                <li key={`${channel}-${reason}`}>{channel}: {count} failure(s) — {reason}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                                {warning.status === 'draft' && (
                                    <>
                                        <Link
                                            to={`/dmcofficer/warnings/${warning._id}/edit`}
                                            className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                        >
                                            Edit Draft
                                        </Link>
                                        <Link
                                            to={`/dmcofficer/warnings/${warning._id}/review`}
                                            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-3 text-sm font-semibold text-white hover:bg-blue-800"
                                        >
                                            <BellRing size={15} /> Issue Warning
                                        </Link>
                                    </>
                                )}
                                {!warning.resolvedAt && ['partially_issued', 'delivery_failed'].includes(warning.status) && (
                                    <Link
                                        to={`/dmcofficer/warnings/${warning._id}/review`}
                                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-amber-700 px-3 text-sm font-semibold text-white hover:bg-amber-800"
                                    >
                                        <BellRing size={15} /> Retry Failed Deliveries
                                    </Link>
                                )}
                                {!warning.resolvedAt && ['issued', 'partially_issued', 'delivery_failed'].includes(warning.status) && (
                                    <>
                                        <Link
                                            to={`/dmcofficer/warnings/${warning._id}/update`}
                                            className="inline-flex min-h-10 items-center rounded-lg border border-blue-300 px-3 text-sm font-semibold text-blue-800 hover:bg-blue-50"
                                        >
                                            Post Update
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => markResolved(warning._id)}
                                            disabled={resolvingWarningId === warning._id}
                                            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
                                        >
                                            <Check size={16} aria-hidden="true" />
                                            {resolvingWarningId === warning._id ? 'Resolving…' : 'Mark resolved'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </article>
                    ))}
                </section>
            )}
        </main>
    )
}

export default WarningsPage
