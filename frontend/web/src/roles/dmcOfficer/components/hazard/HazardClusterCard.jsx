import { Link } from 'react-router-dom'
import { ArrowUpRight, Clock3, MapPin, ShieldCheck, Signal } from 'lucide-react'

const priorityStyles = {
	low: 'border-slate-200 bg-slate-100 text-slate-700',
	medium: 'border-amber-200 bg-amber-50 text-amber-800',
	high: 'border-orange-200 bg-orange-50 text-orange-800',
	critical: 'border-red-200 bg-red-50 text-red-800'
}

const titleCase = (value) => String(value || 'Unknown')
	.replaceAll('_', ' ')
	.replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatTime = (value) => {
	if (!value || Number.isNaN(new Date(value).getTime())) return 'Time unavailable'
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(new Date(value))
}

const getCenter = (cluster) => {
	const coordinates = cluster.center?.coordinates
	if (!Array.isArray(coordinates) || coordinates.length !== 2) return null
	const [longitude, latitude] = coordinates
	return Number.isFinite(longitude) && Number.isFinite(latitude)
		? { longitude, latitude }
		: null
}

const getLocationName = (cluster) => {
	const district = cluster.district || cluster.locationName || cluster.address
	if (district) return district

	const center = getCenter(cluster)
	return center
		? `${center.latitude.toFixed(4)}, ${center.longitude.toFixed(4)}`
		: 'Location unavailable'
}

function HazardClusterCard({ cluster, escalationEligible = false }) {
	const priority = String(cluster.priorityLevel || 'low').toLowerCase()
	const clusterId = cluster._id || cluster.id
	const status = titleCase(cluster.status || 'active')

	return (
		<article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titleCase(cluster.hazardType)}</p>
					<h2 className="mt-1 wrap-break-word text-lg font-semibold text-slate-900">{getLocationName(cluster)}</h2>
				</div>
				<div className="flex flex-wrap gap-2">
					<span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityStyles[priority] || priorityStyles.low}`}>
						{titleCase(priority)} priority
					</span>
					{escalationEligible && (
						<span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
							<ShieldCheck size={13} /> Eligible for escalation
						</span>
					)}
					<span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
						{status}
					</span>
				</div>
			</div>

			<div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
				<div>
					<p className="text-xs text-slate-500">Reports</p>
					<p className="mt-1 font-semibold text-slate-900">{cluster.reportCount ?? cluster.reportIds?.length ?? 0}</p>
				</div>
				<div>
					<p className="text-xs text-slate-500">Priority score</p>
					<p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-slate-900"><Signal size={15} />{cluster.priorityScore ?? '—'}</p>
				</div>
				{cluster.district && (
					<div>
						<p className="text-xs text-slate-500">District</p>
						<p className="mt-1 truncate font-medium text-slate-800">{cluster.district}</p>
					</div>
				)}
				<div>
					<p className="text-xs text-slate-500">Last reported</p>
					<p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-slate-800"><Clock3 size={14} />{formatTime(cluster.lastReportedAt)}</p>
				</div>
			</div>

			<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
				<p className="inline-flex items-center gap-1.5 text-xs text-slate-500"><MapPin size={14} />{cluster.district ? `${cluster.district} · ` : ''}{getLocationName(cluster)}</p>
				<Link
					to={`/dutyofficer/hazard-reviews/clusters/${encodeURIComponent(clusterId || '')}`}
					className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					Open <ArrowUpRight size={16} />
				</Link>
			</div>
		</article>
	)
}

export default HazardClusterCard
