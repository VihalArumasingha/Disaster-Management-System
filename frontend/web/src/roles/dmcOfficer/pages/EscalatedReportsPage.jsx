import { useEffect, useState } from 'react'
import { AlertTriangle, Clock3, MapPin, RefreshCw, ShieldCheck, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getIncomingHazardEscalations } from '../services/hazardReviewService'

const statuses = {
    pending_dmc_review: {
        label: 'Incoming from Duty Officer',
        style: 'border-blue-200 bg-blue-50 text-blue-900'
    },
    pending_duty_verification: {
        label: 'Historical: Pending Duty Officer Verification',
        style: 'border-amber-200 bg-amber-50 text-amber-900'
    },
    approved: {
        label: 'Approved',
        style: 'border-emerald-200 bg-emerald-50 text-emerald-900'
    },
    rejected: {
        label: 'Rejected',
        style: 'border-red-200 bg-red-50 text-red-900'
    },
    cancelled: {
        label: 'Cancelled',
        style: 'border-slate-200 bg-slate-100 text-slate-700'
    }
}

const priorityStyles = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-amber-100 text-amber-900',
    high: 'bg-orange-100 text-orange-900',
    critical: 'bg-red-100 text-red-900'
}

const titleCase = (value) => String(value || 'Unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatDate = (value) => {
    if (!value || Number.isNaN(new Date(value).getTime())) return 'Time unavailable'
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const getLocation = (cluster) => {
    if (!cluster || typeof cluster !== 'object') return 'Location unavailable'
    if (cluster.district || cluster.locationName || cluster.address) {
        return cluster.district || cluster.locationName || cluster.address
    }
    const coordinates = cluster.center?.coordinates
    if (cluster.center?.type === 'Point' && Array.isArray(coordinates) && coordinates.length === 2) {
        const [longitude, latitude] = coordinates
        if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
            return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        }
    }
    return 'Location unavailable'
}

const getEscalatedBy = (value) => {
    if (value && typeof value === 'object') return value.name || value.email || 'Duty Officer'
    return value ? 'Duty Officer' : 'Not recorded'
}

function EscalationCard({ record }) {
    const status = statuses[record.status] || {
        label: titleCase(record.status),
        style: 'border-slate-200 bg-slate-100 text-slate-700'
    }
    const priority = String(record.priorityLevel || 'unknown').toLowerCase()
    const cluster = record.clusterId && typeof record.clusterId === 'object'
        ? record.clusterId
        : record.cluster
    const reports = Array.isArray(record.verifiedReportIds) ? record.verifiedReportIds : []
    return (
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityStyles[priority] || priorityStyles.low}`}>{titleCase(priority)} priority</span>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.style}`}>{status.label}</span>
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-slate-900">{titleCase(record.hazardType)}</h2>
                    <p className="mt-1 inline-flex items-start gap-1.5 text-sm text-slate-600"><MapPin className="mt-0.5 shrink-0" size={15} />{getLocation(cluster)}</p>
                </div>
                <Link to="/dmcofficer/warnings/create" className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100">
                    Continue to warning management
                </Link>
            </div>

            <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs font-medium text-slate-500">Priority score</p><p className="mt-1 font-semibold text-slate-900">{record.priorityScore ?? '—'} <span className="text-xs font-medium text-slate-500">/ 100</span></p></div>
                <div><p className="text-xs font-medium text-slate-500">Verified reports</p><p className="mt-1 font-semibold text-slate-900">{record.verifiedReportCount ?? '—'}</p></div>
                <div><p className="text-xs font-medium text-slate-500">Escalated by</p><p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-slate-800"><UserRound size={14} />{getEscalatedBy(record.escalatedBy)}</p></div>
                <div><p className="text-xs font-medium text-slate-500">Escalated time</p><p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-slate-800"><Clock3 size={14} />{formatDate(record.escalatedAt)}</p></div>
            </div>

            <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600"><ShieldCheck size={14} /> Verified reports ({reports.length})</p>
                {reports.length ? (
                    <div className="mt-2 space-y-3">
                        {reports.map((report, index) => (
                            <div key={report._id || index} className="border-t border-slate-200 pt-3 first:border-0 first:pt-0">
                                <p className="text-xs font-medium text-slate-500">{titleCase(report.hazardType)} · {titleCase(report.status)}</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.description || 'No description provided.'}</p>
                            </div>
                        ))}
                    </div>
                ) : <p className="mt-2 text-sm text-slate-600">No report details were included with this handoff.</p>}
            </section>
        </article>
    )
}

function EscalatedReportsPage() {
	const [records, setRecords] = useState([])
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [error, setError] = useState('')
	const [reloadKey, setReloadKey] = useState(0)

	useEffect(() => {
        const controller = new AbortController()
        getIncomingHazardEscalations({ signal: controller.signal })
			.then((result) => {
				if (controller.signal.aborted) return
                setRecords(Array.isArray(result) ? result : [])
			})
			.catch((requestError) => {
				if (!controller.signal.aborted) {
					setError(requestError.response?.data?.message || requestError.message || 'Could not load escalation records.')
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setLoading(false)
					setRefreshing(false)
				}
			})
		return () => controller.abort()
	}, [reloadKey])

	const refresh = () => {
		setError('')
		setRefreshing(true)
		setReloadKey((key) => key + 1)
	}
	const orderedRecords = [...records].sort((first, second) => (
		new Date(second.escalatedAt || 0) - new Date(first.escalatedAt || 0)
	))

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Incident management</p>
                        <h1 className="mt-2 text-3xl font-bold text-slate-900">Incoming Hazard Escalations</h1>
                        <p className="mt-2 text-slate-600">Verified and prioritized hazard situations sent by Duty Officers.</p>
                </div>
                <button type="button" onClick={refresh} disabled={loading || refreshing} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 sm:self-auto">
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh
                </button>
            </header>

            {error ? (
                <section role="alert" className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5">
                    <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 text-red-700" size={20} /><div><h2 className="font-semibold text-red-900">Escalation tracking is unavailable</h2><p className="mt-1 text-sm text-red-800">{error}</p></div></div>
                    <button type="button" onClick={refresh} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"><RefreshCw size={15} /> Retry</button>
                </section>
            ) : loading ? (
                <div role="status" aria-label="Loading escalation records" className="mt-8 space-y-3">
                    {[0, 1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
                    <p className="sr-only">Loading escalation records…</p>
                </div>
            ) : (
                <>
                    {orderedRecords.length === 0 ? (
                        <section className="mt-8 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center">
                            <ShieldCheck className="mx-auto text-slate-400" size={28} />
                            <h2 className="mt-4 text-lg font-semibold text-slate-900">No escalation data</h2>
                            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
                                No new hazard escalations are waiting for DMC review.
                            </p>
                        </section>
                    ) : (
                        <section aria-label="Incoming hazard escalations" className="mt-8 space-y-4">
                            {orderedRecords.map((record) => (
                                <EscalationCard key={record._id || `${record.clusterId}-${record.escalatedAt}`} record={record} />
                            ))}
                        </section>
                    )}
                </>
            )}
        </main>
    )
}

export default EscalatedReportsPage
