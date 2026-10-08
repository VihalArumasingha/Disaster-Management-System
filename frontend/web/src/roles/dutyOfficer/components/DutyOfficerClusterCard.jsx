import { ArrowUpRight, Clock3, MapPin, Signal, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

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
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(value))
}

const getCoordinates = (center) => {
    const coordinates = center?.coordinates
    if (center?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2) return null
    const [longitude, latitude] = coordinates
    return Number.isFinite(longitude) && Number.isFinite(latitude)
        ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        : null
}

function DutyOfficerClusterCard({ cluster }) {
    const clusterId = cluster._id || cluster.id
    const priority = String(cluster.priorityLevel || 'low').toLowerCase()
    const coordinates = getCoordinates(cluster.center)
    const location = cluster.district || cluster.locationName || cluster.address || coordinates || 'Location unavailable'
    const reportCount = cluster.reportCount ?? cluster.reportIds?.length ?? 0

    return (
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{titleCase(cluster.hazardType)}</p>
                    <h3 className="mt-1 wrap-break-word text-lg font-semibold text-slate-900">{location}</h3>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-600">
                        <MapPin size={15} className="shrink-0 text-slate-400" />
                        {coordinates || 'GPS coordinates unavailable'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${priorityStyles[priority] || priorityStyles.low}`}>
                        {titleCase(priority)} priority
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                        {titleCase(cluster.status || 'active')}
                    </span>
                </div>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
                <div>
                    <dt className="text-xs font-medium text-slate-500">Reports</dt>
                    <dd className="mt-1 inline-flex items-center gap-1.5 font-semibold text-slate-900">
                        <TriangleAlert size={15} className="text-slate-400" /> {reportCount}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs font-medium text-slate-500">Priority score</dt>
                    <dd className="mt-1 inline-flex items-center gap-1.5 font-semibold text-slate-900">
                        <Signal size={15} className="text-slate-400" /> {cluster.priorityScore ?? '—'}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs font-medium text-slate-500">Last reported</dt>
                    <dd className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-slate-800">
                        <Clock3 size={14} className="shrink-0 text-slate-400" /> {formatTime(cluster.lastReportedAt)}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs font-medium text-slate-500">Location</dt>
                    <dd className="mt-1 truncate text-sm font-medium text-slate-800" title={location}>{location}</dd>
                </div>
            </dl>

            <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                <Link
                    to={`/dutyofficer/hazard-reviews/clusters/${encodeURIComponent(clusterId || '')}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                    Review cluster <ArrowUpRight size={16} />
                </Link>
            </div>
        </article>
    )
}

export default DutyOfficerClusterCard