import { ArrowUpRight, Clock3, MapPin, Signal, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

const priorityStyles = {
    critical: {
        card: 'border-red-200 bg-red-50',
        accent: 'border-l-red-500',
        badge: 'border-red-300 bg-red-100 text-red-800',
        icon: 'bg-red-100 text-red-700',
        hover: 'hover:border-red-300 hover:shadow-red-100/60'
    },
    high: {
        card: 'border-orange-200 bg-orange-50',
        accent: 'border-l-orange-500',
        badge: 'border-orange-300 bg-orange-100 text-orange-800',
        icon: 'bg-orange-100 text-orange-700',
        hover: 'hover:border-orange-300 hover:shadow-orange-100/60'
    },
    medium: {
        card: 'border-yellow-200 bg-yellow-50',
        accent: 'border-l-yellow-500',
        badge: 'border-yellow-300 bg-yellow-100 text-yellow-800',
        icon: 'bg-yellow-100 text-yellow-700',
        hover: 'hover:border-yellow-300 hover:shadow-yellow-100/60'
    },
    low: {
        card: 'border-green-200 bg-green-50',
        accent: 'border-l-green-500',
        badge: 'border-green-300 bg-green-100 text-green-800',
        icon: 'bg-green-100 text-green-700',
        hover: 'hover:border-green-300 hover:shadow-green-100/60'
    }
}

const titleCase = (value) => String(value || 'Unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatTime = (value) => {
    if (!value || Number.isNaN(new Date(value).getTime())) {
        return 'Time unavailable'
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(value))
}

const getCoordinates = (center) => {
    const coordinates = center?.coordinates

    if (
        center?.type !== 'Point'
        || !Array.isArray(coordinates)
        || coordinates.length !== 2
    ) {
        return null
    }

    const [longitude, latitude] = coordinates

    return Number.isFinite(longitude) && Number.isFinite(latitude)
        ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        : null
}

function DutyOfficerClusterCard({ cluster }) {
    const clusterId = cluster._id || cluster.id
    const priority = String(cluster.priorityLevel || 'low').toLowerCase()

    const styles = priorityStyles[priority] || priorityStyles.low

    const coordinates = getCoordinates(cluster.center)

    const location =
        cluster.district
        || cluster.locationName
        || cluster.address
        || coordinates
        || 'Location unavailable'

    const reportCount = cluster.reportCount ?? cluster.reportIds?.length ?? 0

    return (
        <article
            className={`
                overflow-hidden
                rounded-2xl
                border
                border-l-4
                ${styles.card}
                ${styles.accent}
                p-5
                shadow-sm
                transition-all
                duration-200
                hover:-translate-y-0.5
                hover:shadow-md
                ${styles.hover}
                sm:p-6
            `}
        >
            {/* Header */}
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span
                            className={`
                                inline-flex
                                items-center
                                rounded-md
                                px-2.5
                                py-1
                                text-xs
                                font-bold
                                uppercase
                                tracking-wide
                                ${styles.badge}
                            `}
                        >
                            {titleCase(priority)}
                        </span>

                        <span className="rounded-md border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {titleCase(cluster.status || 'active')}
                        </span>
                    </div>

                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                        {titleCase(cluster.hazardType)}
                    </p>

                    <h3 className="mt-1 wrap-break-word text-lg font-bold text-slate-900 sm:text-xl">
                        {location}
                    </h3>

                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-600">
                        <MapPin
                            size={15}
                            className="shrink-0 text-slate-500"
                            aria-hidden="true"
                        />
                        {coordinates || 'GPS coordinates unavailable'}
                    </p>
                </div>

                {/* Priority Indicator */}
                <div
                    className={`
                        flex
                        shrink-0
                        items-center
                        gap-3
                        rounded-xl
                        border
                        bg-white/70
                        px-4
                        py-3
                        ${styles.badge}
                    `}
                    aria-label={`${titleCase(priority)} priority`}
                >
                    <span
                        className={`
                            grid
                            h-9
                            w-9
                            place-items-center
                            rounded-lg
                            ${styles.icon}
                        `}
                    >
                        <TriangleAlert
                            size={19}
                            aria-hidden="true"
                        />
                    </span>

                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-75">
                            Priority
                        </p>

                        <p className="text-sm font-bold">
                            {titleCase(priority)}
                        </p>
                    </div>
                </div>
            </div>

            {/* Cluster Information */}
            <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-black/5 pt-5 sm:grid-cols-4">
                {/* Reports */}
                <div className="rounded-xl border border-black/5 bg-white/65 p-3">
                    <dt className="text-xs font-medium text-slate-500">
                        Reports
                    </dt>

                    <dd className="mt-1.5 inline-flex items-center gap-1.5 text-lg font-bold text-slate-900">
                        <TriangleAlert
                            size={15}
                            className="text-slate-500"
                            aria-hidden="true"
                        />

                        {reportCount}
                    </dd>
                </div>

                {/* Priority Score */}
                <div className="rounded-xl border border-black/5 bg-white/65 p-3">
                    <dt className="text-xs font-medium text-slate-500">
                        Priority score
                    </dt>

                    <dd className="mt-1.5 inline-flex items-center gap-1.5 text-lg font-bold text-slate-900">
                        <Signal
                            size={15}
                            className="text-slate-500"
                            aria-hidden="true"
                        />

                        {cluster.priorityScore ?? '—'}
                    </dd>
                </div>

                {/* Last Reported */}
                <div className="rounded-xl border border-black/5 bg-white/65 p-3">
                    <dt className="text-xs font-medium text-slate-500">
                        Last reported
                    </dt>

                    <dd className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                        <Clock3
                            size={14}
                            className="shrink-0 text-slate-500"
                            aria-hidden="true"
                        />

                        {formatTime(cluster.lastReportedAt)}
                    </dd>
                </div>

                {/* Location */}
                <div className="rounded-xl border border-black/5 bg-white/65 p-3">
                    <dt className="text-xs font-medium text-slate-500">
                        Location
                    </dt>

                    <dd
                        className="mt-1.5 truncate text-sm font-semibold text-slate-800"
                        title={location}
                    >
                        {location}
                    </dd>
                </div>
            </dl>

            {/* Review Action */}
            <div className="mt-5 flex justify-end border-t border-black/5 pt-4">
                <Link
                    to={`/dutyofficer/hazard-reviews/clusters/${encodeURIComponent(clusterId || '')}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                    Review cluster
                    <ArrowUpRight
                        size={16}
                        aria-hidden="true"
                    />
                </Link>
            </div>
        </article>
    )
}

export default DutyOfficerClusterCard