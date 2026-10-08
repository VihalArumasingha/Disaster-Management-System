import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, CircleCheck, Clock3, MapPin, RefreshCw, ShieldAlert, Signal, TriangleAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import HazardReportCard from '../../dmcOfficer/components/hazard/HazardReportCard'
import HazardReviewMap from '../../dmcOfficer/components/hazard/HazardReviewMap'
import {
    escalateClusterToDmcOfficer,
    evaluateEscalation,
    getClusterEscalation,
    getHazardReviewCluster,
    rejectHazardReport,
    verifyHazardReport
} from '../../dmcOfficer/services/hazardReviewService'

const priorityStyles = {
    critical: 'border-red-200 bg-red-50 text-red-700',
    high: 'border-orange-200 bg-orange-50 text-orange-700',
    medium: 'border-yellow-200 bg-yellow-50 text-yellow-700',
    low: 'border-green-200 bg-green-50 text-green-700'
}

const titleCase = (value) => String(value || 'Unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatTime = (value) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return 'Time unavailable'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const getErrorMessage = (error) => error.response?.data?.message || error.message || 'Could not load hazard cluster details.'

const getCenterLabel = (center) => {
    const coordinates = center?.coordinates
    if (center?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2) return ''
    const [longitude, latitude] = coordinates
    return Number.isFinite(longitude) && Number.isFinite(latitude)
        ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        : ''
}

function DutyOfficerClusterDetailsPage() {
    const { clusterId } = useParams()
    const [cluster, setCluster] = useState(null)
    const [evaluation, setEvaluation] = useState(null)
    const [escalation, setEscalation] = useState(null)
    const [escalationError, setEscalationError] = useState('')
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [loadError, setLoadError] = useState('')
    const [feedback, setFeedback] = useState(null)
    const [pendingReportId, setPendingReportId] = useState('')
    const [escalating, setEscalating] = useState(false)
    const [reloadVersion, setReloadVersion] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        getHazardReviewCluster(clusterId, { signal: controller.signal })
            .then(async (result) => {
                if (controller.signal.aborted) return
                setCluster(result)
                const [evaluationResult, escalationResult] = await Promise.allSettled([
                    evaluateEscalation(clusterId, { signal: controller.signal }),
                    getClusterEscalation(clusterId, { signal: controller.signal })
                ])
                if (controller.signal.aborted) return
                setEvaluation(evaluationResult.status === 'fulfilled' ? evaluationResult.value : null)
                setEscalation(escalationResult.status === 'fulfilled' ? escalationResult.value : null)
                if (evaluationResult.status === 'rejected' || escalationResult.status === 'rejected') {
                    setEscalationError('Could not confirm escalation eligibility and existing handoff status.')
                } else {
                    setEscalationError('')
                }
            })
            .catch((requestError) => {
                if (!controller.signal.aborted) setLoadError(getErrorMessage(requestError))
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false)
                    setRefreshing(false)
                }
            })
        return () => controller.abort()
    }, [clusterId, reloadVersion])

    const refreshCluster = () => {
        setLoadError('')
        setRefreshing(true)
        setReloadVersion((version) => version + 1)
    }

    const handleReportAction = async (reportId, action, reason = '') => {
        setPendingReportId(reportId)
        setFeedback(null)
        try {
            const result = action === 'verify'
                ? await verifyHazardReport(reportId)
                : await rejectHazardReport(reportId, reason)
            if (result.escalation) setEvaluation(result.escalation)
            setFeedback({ type: 'success', message: action === 'verify' ? 'Hazard report verified.' : 'Hazard report rejected.' })
            setRefreshing(true)
            setReloadVersion((version) => version + 1)
        } catch (actionError) {
            setFeedback({ type: 'error', message: getErrorMessage(actionError) })
            throw actionError
        } finally {
            setPendingReportId('')
        }
    }

    const handleEscalate = async () => {
        setEscalating(true)
        setFeedback(null)
        try {
            const result = await escalateClusterToDmcOfficer(clusterId)
            setEscalation(result.data || null)
            setFeedback({ type: 'success', message: 'Escalation sent to DMC Officer.' })
            setRefreshing(true)
            setReloadVersion((version) => version + 1)
        } catch (actionError) {
            setFeedback({ type: 'error', message: getErrorMessage(actionError) })
        } finally {
            setEscalating(false)
        }
    }

    const priority = String(cluster?.priorityLevel || 'low').toLowerCase()
    const score = Number.isFinite(Number(cluster?.priorityScore)) ? Number(cluster.priorityScore) : null
    const progress = score == null ? 0 : Math.max(0, Math.min(100, score))
    const coordinates = getCenterLabel(cluster?.center)
    const locationName = cluster?.district || cluster?.locationName || cluster?.address || coordinates || 'Location unavailable'
    const reports = Array.isArray(cluster?.reportIds) ? cluster.reportIds : []

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link to="/dutyofficer/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
                    <ArrowLeft size={16} /> Back to review queue
                </Link>
                {cluster && (
                    <button type="button" onClick={refreshCluster} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
                    </button>
                )}
            </div>

            {loading && !cluster ? (
                <div role="status" aria-label="Loading cluster details" className="mt-8 space-y-4">
                    <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />
                    <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
                </div>
            ) : loadError ? (
                <section role="alert" className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="font-semibold text-red-900">Could not load cluster</h1>
                        <p className="mt-1 text-sm text-red-800">{loadError}</p>
                    </div>
                    <button type="button" onClick={() => { setLoading(true); refreshCluster() }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100">
                        <RefreshCw size={15} /> Retry
                    </button>
                </section>
            ) : cluster ? (
                <>
                    <header className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Incident management</p>
                                <h1 className="mt-2 wrap-break-word text-2xl font-bold text-slate-900 sm:text-3xl">Hazard Cluster Review</h1>
                                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                                    <span className="font-semibold text-slate-800">{titleCase(cluster.hazardType)}</span>
                                    <span>{locationName}</span>
                                    <span className="inline-flex items-center gap-1.5"><MapPin size={15} />{coordinates || 'GPS unavailable'}</span>
                                    <span className="inline-flex items-center gap-1.5"><Clock3 size={15} />Last reported {formatTime(cluster.lastReportedAt)}</span>
                                </div>
                            </div>
                            <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 lg:w-72 lg:shrink-0">
                                <div className="flex items-center justify-between gap-3">
                                    <span className={`rounded-full border px-3 py-1 text-xs font-bold ${priorityStyles[priority] || priorityStyles.low}`}>{titleCase(priority)} priority</span>
                                    <span className="text-sm font-semibold text-slate-700">{titleCase(cluster.status)}</span>
                                </div>
                                <div className="mt-4 flex items-end justify-between">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"><Signal size={14} /> Priority score</span>
                                    <span className="text-2xl font-bold tabular-nums text-slate-900">{score ?? '—'}<span className="text-sm font-medium text-slate-500"> / 100</span></span>
                                </div>
                                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Priority score" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
                                    <div className={`h-full rounded-full transition-all ${priority === 'critical' ? 'bg-red-600' : priority === 'high' ? 'bg-orange-600' : priority === 'medium' ? 'bg-yellow-500' : 'bg-green-600'}`} style={{ width: `${progress}%` }} />
                                </div>
                            </div>
                        </div>
                        <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
                            <div><dt className="text-xs font-medium text-slate-500">Reports in cluster</dt><dd className="mt-1 text-lg font-semibold text-slate-900">{cluster.reportCount ?? reports.length}</dd></div>
                            <div><dt className="text-xs font-medium text-slate-500">Cluster status</dt><dd className="mt-1 text-lg font-semibold text-slate-900">{titleCase(cluster.status)}</dd></div>
                            <div><dt className="text-xs font-medium text-slate-500">Last reported</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{formatTime(cluster.lastReportedAt)}</dd></div>
                        </dl>
                    </header>

                    {feedback && <p role={feedback.type === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-xl border px-4 py-3 text-sm ${feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`}>{feedback.message}</p>}

                    {loading || refreshing ? (
                        <section role="status" className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">Checking escalation status…</section>
                    ) : escalation ? (
                        <section aria-label="Escalation status" className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800">
                                    {escalation.status === 'pending_dmc_review' ? <CircleCheck size={20} /> : <Clock3 size={20} />}
                                </span>
                                <div>
                                    <h2 className="font-semibold text-slate-900">{escalation.status === 'pending_dmc_review' ? 'Sent to DMC Officer' : titleCase(escalation.status)}</h2>
                                    <p className="mt-1 text-sm leading-6 text-slate-700">
                                        {escalation.status === 'pending_dmc_review'
                                            ? 'This verified cluster has been handed off to the DMC Officer.'
                                            : 'An escalation has already been recorded for this cluster.'}
                                    </p>
                                    {escalation.escalatedAt && <p className="mt-2 text-xs text-slate-600">Sent {formatTime(escalation.escalatedAt)}</p>}
                                </div>
                            </div>
                        </section>
                    ) : escalationError ? (
                        <section role="alert" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                            <h2 className="font-semibold text-amber-900">Escalation status unavailable</h2>
                            <p className="mt-1 text-sm leading-6 text-amber-800">{escalationError} Escalation is disabled until the current status can be confirmed.</p>
                        </section>
                    ) : evaluation?.shouldEscalate ? (
                        <section aria-label="Escalation eligibility" className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800"><ShieldAlert size={21} /></span>
                                    <div>
                                        <h2 className="font-bold text-slate-900">Escalation threshold reached</h2>
                                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-700">This verified hazard cluster meets the criteria for DMC review.</p>
                                        {evaluation.reason && <p className="mt-2 text-xs text-slate-600">{evaluation.reason}</p>}
                                    </div>
                                </div>
                                <button type="button" onClick={handleEscalate} disabled={escalating} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
                                    {escalating ? <Clock3 className="animate-pulse" size={16} /> : <ArrowUpRight size={16} />}
                                    {escalating ? 'Sending…' : 'Escalate to DMC Officer'}
                                </button>
                            </div>
                            {evaluation.verifiedReportCount != null && (
                                <p className="mt-4 border-t border-blue-200 pt-3 text-xs text-slate-700">
                                    {evaluation.verifiedReportCount} verified {evaluation.verifiedReportCount === 1 ? 'report' : 'reports'}
                                    {evaluation.escalationCriteria?.minimumVerifiedReports != null && ` · Minimum ${evaluation.escalationCriteria.minimumVerifiedReports}`}
                                    {evaluation.escalationCriteria?.minimumPriorityLevel && ` · Priority ${titleCase(evaluation.escalationCriteria.minimumPriorityLevel)} or above`}
                                </p>
                            )}
                        </section>
                    ) : (
                        <section aria-label="Escalation eligibility" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <h2 className="font-semibold text-slate-900">Not yet eligible for escalation</h2>
                            <p className="mt-1 text-sm leading-6 text-slate-600">{evaluation?.reason || 'The cluster does not currently meet the verified-report and priority criteria for DMC review.'}</p>
                            {evaluation?.verifiedReportCount != null && <p className="mt-2 text-xs text-slate-500">{evaluation.verifiedReportCount} verified {evaluation.verifiedReportCount === 1 ? 'report' : 'reports'}</p>}
                        </section>
                    )}

                    <section className="mt-8">
                        <div className="mb-3">
                            <h2 className="text-lg font-semibold text-slate-900">Cluster map</h2>
                            <p className="mt-1 text-sm text-slate-600">Cluster center and citizen report locations.</p>
                        </div>
                        <HazardReviewMap cluster={cluster} height="380px" />
                    </section>

                    <section className="mt-8">
                        <div className="mb-4">
                            <h2 className="text-lg font-semibold text-slate-900">Verification review</h2>
                            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Inspect each citizen report and its evidence before verifying or rejecting it. Cluster priority is recalculated after review actions.</p>
                        </div>
                        {reports.length ? (
                            <div className="space-y-4">
                                {reports.map((report, index) => (
                                    <HazardReportCard
                                        key={report?._id || index}
                                        report={report || {}}
                                        detailsUrl={`/dutyofficer/reports/${report?._id}`}
                                        onVerify={() => handleReportAction(report._id, 'verify')}
                                        onReject={(reason) => handleReportAction(report._id, 'reject', reason)}
                                        actionsDisabled={Boolean(pendingReportId) || refreshing}
                                        actionBusy={pendingReportId === report?._id}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">No individual reports are available for this cluster.</div>
                        )}
                    </section>
                </>
            ) : (
                <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                    <TriangleAlert className="mx-auto text-slate-400" size={25} />
                    <h1 className="mt-3 text-lg font-semibold text-slate-900">Hazard cluster not found</h1>
                </section>
            )}
        </main>
    )
}

export default DutyOfficerClusterDetailsPage