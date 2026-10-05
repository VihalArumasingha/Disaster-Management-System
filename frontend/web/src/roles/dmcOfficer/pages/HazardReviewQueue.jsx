import { useEffect, useState } from 'react'
import { ArrowLeft, Clock3, MapPin, RefreshCw, TriangleAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import HazardClusterCard from '../components/hazard/HazardClusterCard'
import HazardReviewMap from '../components/hazard/HazardReviewMap'
import useHazardReviews from '../hooks/useHazardReviews'
import { getHazardReviewCluster } from '../services/hazardReviewService'

const titleCase = (value) => String(value || 'Unknown')
	.replaceAll('_', ' ')
	.replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatTime = (value) => {
	if (!value || Number.isNaN(new Date(value).getTime())) return 'Time unavailable'
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const getErrorMessage = (error) => error.response?.data?.message || error.message || 'Could not load this hazard cluster.'
const priorityWeight = { low: 1, medium: 2, high: 3, critical: 4 }

function QueueError({ error, onRetry }) {
	return (
		<div role="alert" className="mt-8 flex flex-col gap-4 rounded-xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<p className="font-semibold text-red-900">Hazard clusters could not be loaded</p>
				<p className="mt-1 text-sm text-red-800">{error}</p>
			</div>
			<button type="button" onClick={onRetry} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100">
				<RefreshCw size={16} /> Retry
			</button>
		</div>
	)
}

function HazardReviewClusterDetail({ clusterId }) {
	const [cluster, setCluster] = useState(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [attempt, setAttempt] = useState(0)

	useEffect(() => {
		const controller = new AbortController()
		getHazardReviewCluster(clusterId, { signal: controller.signal })
			.then((result) => {
				if (!controller.signal.aborted) setCluster(result)
			})
			.catch((requestError) => {
				if (!controller.signal.aborted) setError(getErrorMessage(requestError))
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false)
			})
		return () => controller.abort()
	}, [clusterId, attempt])

	return (
		<main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
			<Link to="/dmcofficer/hazard-reviews" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900">
				<ArrowLeft size={16} /> Back to report clusters
			</Link>
			{loading ? (
				<div role="status" className="mt-8 animate-pulse rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading cluster details…</div>
			) : error ? (
				<QueueError error={error} onRetry={() => {
					setLoading(true)
					setError('')
					setAttempt((value) => value + 1)
				}} />
			) : !cluster ? (
				<div className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center">
					<TriangleAlert className="mx-auto text-slate-400" size={26} />
					<h1 className="mt-3 text-lg font-semibold text-slate-900">Hazard cluster not found</h1>
				</div>
			) : (
				<>
					<header className="mt-6">
						<p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Report cluster</p>
						<h1 className="mt-2 text-3xl font-bold text-slate-900">{titleCase(cluster.hazardType)}</h1>
						<p className="mt-2 text-slate-600">{cluster.district || cluster.locationName || 'Cluster location'}</p>
					</header>
					<section aria-label="Cluster summary" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						{[
							['Reports', cluster.reportCount ?? cluster.reportIds?.length ?? 0],
							['Priority score', cluster.priorityScore ?? '—'],
							['Priority level', titleCase(cluster.priorityLevel)],
							['Status', titleCase(cluster.status)]
						].map(([label, value]) => (
							<div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
								<p className="text-xs font-medium text-slate-500">{label}</p>
								<p className="mt-1 font-semibold text-slate-900">{value}</p>
							</div>
						))}
					</section>
					<section className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
						<div>
							<h2 className="mb-3 text-lg font-semibold text-slate-900">Cluster locations</h2>
							<HazardReviewMap cluster={cluster} />
						</div>
						<div>
							<h2 className="mb-3 text-lg font-semibold text-slate-900">Citizen reports ({cluster.reportIds?.length || 0})</h2>
							{cluster.reportIds?.length ? (
								<div className="max-h-105 space-y-3 overflow-y-auto pr-1">
									{cluster.reportIds.map((report, index) => (
										<article key={report._id || index} className="rounded-xl border border-slate-200 bg-white p-4">
											<div className="flex items-center justify-between gap-3">
												<p className="text-sm font-semibold text-slate-900">Report {index + 1}</p>
												<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{titleCase(report.status)}</span>
											</div>
											<p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-slate-700">{report.description || 'No description provided.'}</p>
											<p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500"><Clock3 size={13} />{formatTime(report.capturedAt || report.submittedAt)}</p>
										</article>
									))}
								</div>
							) : (
								<p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">No individual reports are available for this cluster.</p>
							)}
						</div>
					</section>
				</>
			)}
		</main>
	)
}

function HazardReviewQueueList() {
	const { clusters, loading, error, refresh } = useHazardReviews()
	const orderedClusters = [...clusters].sort((first, second) => {
		const scoreDifference = Number(second.priorityScore || 0) - Number(first.priorityScore || 0)
		if (scoreDifference !== 0) return scoreDifference
		const priorityDifference = (priorityWeight[String(second.priorityLevel || '').toLowerCase()] || 0)
			- (priorityWeight[String(first.priorityLevel || '').toLowerCase()] || 0)
		if (priorityDifference !== 0) return priorityDifference
		return new Date(second.lastReportedAt || 0) - new Date(first.lastReportedAt || 0)
	})

	return (
		<main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
			<header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
				<div>
					<p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Incident management</p>
					<h1 className="mt-2 text-3xl font-bold text-slate-900">Report Clusters</h1>
					<p className="mt-2 max-w-2xl text-slate-600">Citizen hazard reports grouped by location and hazard type, ordered by priority.</p>
				</div>
				<button type="button" onClick={() => refresh()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 sm:self-auto">
					<RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
				</button>
			</header>

			{error ? <QueueError error={error} onRetry={() => refresh()} /> : loading ? (
				<div role="status" aria-label="Loading report clusters" className="mt-8 space-y-3">
					{[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
					<p className="sr-only">Loading report clusters…</p>
				</div>
			) : orderedClusters.length === 0 ? (
				<section className="mt-8 rounded-xl border border-slate-200 bg-white px-6 py-14 text-center">
					<MapPin className="mx-auto text-slate-400" size={28} />
					<h2 className="mt-4 text-lg font-semibold text-slate-900">No hazard clusters require review</h2>
					<p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">New citizen hazard reports will appear here after the system groups nearby reports for DMC review.</p>
				</section>
			) : (
				<section aria-label="Hazard review queue" className="mt-8 space-y-4">
					{orderedClusters.map((cluster) => (
						<HazardClusterCard key={cluster._id || cluster.id} cluster={cluster} />
					))}
				</section>
			)}
		</main>
	)
}

function HazardReviewQueue() {
	const { clusterId } = useParams()
	return clusterId
		? <HazardReviewClusterDetail key={clusterId} clusterId={clusterId} />
		: <HazardReviewQueueList />
}

export default HazardReviewQueue
