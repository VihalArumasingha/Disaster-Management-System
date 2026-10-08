import { useEffect, useState } from 'react'
import { ArrowLeft, Clock3, MapPin, RefreshCw, Signal, TriangleAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import EscalationBanner from '../components/hazard/EscalationBanner'
import HazardReportCard from '../components/hazard/HazardReportCard'
import HazardReviewMap from '../components/hazard/HazardReviewMap'
import {
	escalateClusterToDmcOfficer,
	evaluateEscalation,
	getClusterEscalation,
	getHazardReviewCluster,
	rejectHazardReport,
	verifyHazardReport
} from '../services/hazardReviewService'

const priorityStyles = {
	low: 'bg-slate-100 text-slate-700',
	medium: 'bg-amber-100 text-amber-900',
	high: 'bg-orange-100 text-orange-900',
	critical: 'bg-red-100 text-red-900'
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

function HazardClusterDetails() {
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
					evaluateEscalation(clusterId),
					getClusterEscalation(clusterId)
				])
				if (controller.signal.aborted) return
				setEvaluation(evaluationResult.status === 'fulfilled' ? evaluationResult.value : null)
				setEscalation(escalationResult.status === 'fulfilled' ? escalationResult.value : null)
				if (evaluationResult.status === 'rejected' || escalationResult.status === 'rejected') {
					setEscalationError('Could not confirm escalation eligibility and existing handoff status.')
					setFeedback({ type: 'error', message: 'Cluster loaded, but escalation status could not be refreshed.' })
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
	const locationName = cluster?.district || cluster?.locationName || cluster?.address || getCenterLabel(cluster?.center) || 'Location unavailable'
	const reports = Array.isArray(cluster?.reportIds) ? cluster.reportIds : []

	return (
		<main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Link to="/dutyofficer/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"><ArrowLeft size={16} /> Back to report clusters</Link>
				{cluster && <button type="button" onClick={refreshCluster} disabled={refreshing} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh</button>}
			</div>

			{loading && !cluster ? (
				<div role="status" className="mt-8 space-y-4"><div className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white" /><div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" /><p className="sr-only">Loading hazard cluster details…</p></div>
			) : loadError ? (
				<section role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6">
					<div className="flex items-start gap-3"><TriangleAlert className="mt-0.5 text-red-700" size={20} /><div><h1 className="font-semibold text-red-900">Could not load cluster</h1><p className="mt-1 text-sm text-red-800">{loadError}</p></div></div>
					<button type="button" onClick={() => { setLoading(true); refreshCluster() }} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"><RefreshCw size={15} /> Retry</button>
				</section>
			) : cluster ? (
				<>
					<header className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
						<div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
							<div className="min-w-0">
								<p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Hazard cluster review</p>
								<h1 className="mt-2 wrap-break-word text-2xl font-bold text-slate-900 sm:text-3xl">{locationName}</h1>
								<div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
									<span>{titleCase(cluster.hazardType)}</span>
									<span className="inline-flex items-center gap-1.5"><MapPin size={15} />{getCenterLabel(cluster.center) || 'GPS unavailable'}</span>
									<span className="inline-flex items-center gap-1.5"><Clock3 size={15} />Last reported {formatTime(cluster.lastReportedAt)}</span>
								</div>
							</div>
							<div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 lg:w-64 lg:shrink-0">
								<div className="flex items-center justify-between gap-3">
									<span className={`rounded-full px-3 py-1 text-xs font-bold ${priorityStyles[priority] || priorityStyles.low}`}>{titleCase(priority)} priority</span>
									<span className="text-sm font-semibold text-slate-700">{titleCase(cluster.status)}</span>
								</div>
								<div className="mt-4 flex items-end justify-between">
									<span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500"><Signal size={14} /> Priority score</span>
									<span className="text-2xl font-bold tabular-nums text-slate-900">{score ?? '—'}<span className="text-sm font-medium text-slate-500"> / 100</span></span>
								</div>
								<div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label="Priority score" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
									<div className={`h-full rounded-full transition-all ${priority === 'critical' ? 'bg-red-600' : priority === 'high' ? 'bg-orange-500' : priority === 'medium' ? 'bg-amber-500' : 'bg-slate-500'}`} style={{ width: `${progress}%` }} />
								</div>
							</div>
						</div>
						<div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
							<div><p className="text-xs font-medium text-slate-500">Reports in cluster</p><p className="mt-1 text-lg font-semibold text-slate-900">{cluster.reportCount ?? reports.length}</p></div>
							<div><p className="text-xs font-medium text-slate-500">Cluster status</p><p className="mt-1 text-lg font-semibold text-slate-900">{titleCase(cluster.status)}</p></div>
						</div>
					</header>

					{feedback && <p role={feedback.type === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-lg border px-4 py-3 text-sm ${feedback.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{feedback.message}</p>}

					<EscalationBanner evaluation={evaluation} escalation={escalation} escalationError={escalationError} loading={loading || refreshing} submitting={escalating} onEscalate={handleEscalate} />

					<section className="mt-8">
						<div className="mb-3"><h2 className="text-lg font-semibold text-slate-900">Cluster map</h2><p className="mt-1 text-sm text-slate-600">Cluster center and available citizen report locations.</p></div>
						<HazardReviewMap cluster={cluster} height="380px" />
					</section>

					<section className="mt-8">
						<div className="mb-4 flex flex-wrap items-end justify-between gap-2">
							<div><h2 className="text-lg font-semibold text-slate-900">Citizen reports</h2><p className="mt-1 text-sm text-slate-600">Review each submitted report and its evidence.</p></div>
							<span className="text-sm font-medium text-slate-500">{reports.length} {reports.length === 1 ? 'report' : 'reports'}</span>
						</div>
						{reports.length ? (
							<div className="space-y-4">
								{reports.map((report, index) => (
									<HazardReportCard
										key={report?._id || index}
										report={report || {}}
										onVerify={() => handleReportAction(report._id, 'verify')}
										onReject={(reason) => handleReportAction(report._id, 'reject', reason)}
										actionsDisabled={Boolean(pendingReportId) || refreshing}
										actionBusy={pendingReportId === report?._id}
									/>
								))}
							</div>
						) : (
							<div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No individual reports are available for this cluster.</div>
						)}
					</section>
				</>
			) : (
				<div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center"><TriangleAlert className="mx-auto text-slate-400" size={25} /><h1 className="mt-3 text-lg font-semibold text-slate-900">Hazard cluster not found</h1></div>
			)}
		</main>
	)
}

export default HazardClusterDetails
