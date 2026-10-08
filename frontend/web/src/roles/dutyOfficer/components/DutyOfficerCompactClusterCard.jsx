import { Link } from 'react-router-dom'
import { AlertCircle, Clock, MapPin, Activity } from 'lucide-react'

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

const getReportCount = (cluster) => cluster.reportCount ?? cluster.reportIds?.length ?? 0

function DutyOfficerCompactClusterCard({ cluster }) {
    const isCritical = cluster.priorityLevel === 'critical'
    
    // Light backgrounds with corresponding borders
    const cardStyle = isCritical 
        ? 'bg-red-50 border-l-4 border-l-red-500 border-red-100 border-y border-r'
        : 'bg-orange-50 border-l-4 border-l-orange-500 border-orange-100 border-y border-r'

    const badgeColor = isCritical 
        ? 'bg-red-100 text-red-800 border-red-200' 
        : 'bg-orange-100 text-orange-800 border-orange-200'

    return (
        <article className={`flex flex-col gap-4 rounded-xl p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${cardStyle}`}>
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${badgeColor}`}>
                        {cluster.priorityLevel}
                    </span>
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-500">
                        {titleCase(cluster.hazardType)}
                    </span>
                </div>
                
                <h3 className="text-base font-bold text-slate-900 line-clamp-1 mb-2">
                    {cluster.locationName || 'Unknown Location'}
                </h3>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-slate-400" />
                        <span>{getReportCount(cluster)} Reports</span>
                    </div>
                    {cluster.priorityScore !== undefined && (
                        <div className="flex items-center gap-1.5">
                            <Activity size={14} className="text-slate-400" />
                            <span>Score: {cluster.priorityScore.toFixed(1)}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-slate-400" />
                        <span>{formatTime(cluster.lastReportedAt)}</span>
                    </div>
                </div>
            </div>
            
            <div className="shrink-0 pt-2 sm:pt-0">
                <Link
                    to={`/dutyofficer/hazard-reviews/clusters/${cluster._id}`}
                    className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:w-auto"
                >
                    Review
                </Link>
            </div>
        </article>
    )
}

export default DutyOfficerCompactClusterCard
