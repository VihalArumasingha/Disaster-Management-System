import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    ArrowUpRight,
    ClipboardCheck,
    RefreshCw,
    TriangleAlert,
    Clock3,
    CheckCircle2
} from 'lucide-react'

import { getOutgoingEscalations } from '../../dmcOfficer/services/hazardReviewService'

const titleCase = (value) =>
    String(value || 'Unknown')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatDate = (value) => {
    if (!value || Number.isNaN(new Date(value).getTime())) {
        return 'Time unavailable'
    }
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(new Date(value))
}

const escalationStatuses = {
    pending_dmc_review: 'Pending DMC Review',
    approved: 'Approved',
    rejected: 'Rejected'
}

const getStatusLabel = (status) => escalationStatuses[status] || titleCase(status)

const getStatusStyles = (status) => {
    switch (status) {
        case 'pending_dmc_review':
            return 'bg-amber-50 text-amber-700 border-amber-200'
        case 'approved':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200'
        case 'rejected':
            return 'bg-red-50 text-red-700 border-red-200'
        default:
            return 'bg-slate-50 text-slate-700 border-slate-200'
    }
}

function DutyOfficerEscalationsPage() {
    const [escalations, setEscalations] = useState([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')

    const fetchEscalations = useCallback(async ({ isRefresh = false } = {}) => {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)
        
        setError('')
        try {
            const data = await getOutgoingEscalations()
            setEscalations(data || [])
        } catch (err) {
            console.error('Failed to load escalations:', err)
            setError(err?.response?.data?.message || err?.message || 'Failed to load escalations.')
        } finally {
            setLoading(false)
            if (isRefresh) setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        fetchEscalations()
    }, [fetchEscalations])

    const handleRefresh = async () => {
        await fetchEscalations({ isRefresh: true })
    }

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-8 sm:px-8 lg:pt-10">
            {/* Page heading */}
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-indigo-700">
                        Escalations Overview
                    </p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">
                        Escalated Clusters
                    </h1>
                    <p className="mt-2 max-w-2xl text-slate-600">
                        Recent clusters escalated to the DMC for public warning review.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing || loading}
                    className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 sm:self-auto"
                >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </header>

            {/* Error State */}
            {error && (
                <section role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                        <TriangleAlert size={20} className="mt-0.5 shrink-0 text-red-600" />
                        <div>
                            <h2 className="font-semibold text-red-900">
                                Escalations could not be loaded
                            </h2>
                            <p className="mt-1 text-sm text-red-800">
                                {error}
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {/* List */}
            {!error && (
                <div className="mt-8">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-32 w-full animate-pulse rounded-2xl bg-slate-100" />
                            ))}
                        </div>
                    ) : escalations.length === 0 ? (
                        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                <ClipboardCheck size={28} />
                            </div>
                            <h2 className="mt-4 text-lg font-semibold text-slate-900">No Recent Escalations</h2>
                            <p className="mt-2 text-slate-600">You haven't escalated any clusters to the DMC recently.</p>
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {escalations.map((esc) => (
                                <li key={esc._id} className="relative flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:p-6">
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700 ring-1 ring-inset ring-indigo-200">
                                                {titleCase(esc.hazardType)}
                                            </span>
                                            {esc.priorityLevel && (
                                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                                    Priority: {titleCase(esc.priorityLevel)}
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900">
                                            {esc.clusterId?.locationName || 'Cluster Escalation'}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                                            <span className="flex items-center gap-1.5">
                                                <Clock3 size={14} />
                                                Escalated: {formatDate(esc.escalatedAt)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-start gap-4 sm:items-end">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${getStatusStyles(esc.status)}`}>
                                            {esc.status === 'approved' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                                            {getStatusLabel(esc.status)}
                                        </span>
                                        
                                        <Link
                                            to={`/dutyofficer/hazard-reviews/clusters/${esc.clusterId?._id || esc.clusterId}`}
                                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                                        >
                                            View Cluster <ArrowUpRight size={16} />
                                        </Link>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </main>
    )
}

export default DutyOfficerEscalationsPage
