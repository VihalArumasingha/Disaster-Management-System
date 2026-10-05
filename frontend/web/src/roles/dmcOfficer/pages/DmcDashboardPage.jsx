import { useEffect, useState } from 'react'
import { ArrowRight, Bell, Map, RefreshCw, TriangleAlert, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../../../services/api'
import HazardClusterCard from '../components/hazard/HazardClusterCard'
import useHazardReviews from '../hooks/useHazardReviews'
import { evaluateEscalation } from '../services/hazardReviewService'

const dashboardLinks = [
    {
        to: '/dmcofficer/escalated-reports',
        title: 'Escalated Reports',
        description: 'Review incident reports that need DMC attention.',
        icon: TriangleAlert
    },
    {
        to: '/dmcofficer/warnings',
        title: 'Warnings',
        description: 'Review warnings and prepare new public notices.',
        icon: Bell
    },
    {
        to: '/dmcofficer/target-areas',
        title: 'Target Areas',
        description: 'Define risk boundaries and see matched citizens.',
        icon: Map
    }
]

function DmcDashboardPage() {
    const [overview, setOverview] = useState(null)
    const [error, setError] = useState('')
    const { clusters, loading: clustersLoading, error: clustersError, refresh: refreshClusters } = useHazardReviews()
    const [escalationEvaluations, setEscalationEvaluations] = useState({})
    const [evaluationError, setEvaluationError] = useState(false)

    const priorityClusters = clusters.slice(0, 4)
    const priorityClusterKey = JSON.stringify(priorityClusters.map((cluster) => ({
        id: cluster._id || cluster.id,
        score: cluster.priorityScore,
        reportCount: cluster.reportCount,
        lastReportedAt: cluster.lastReportedAt
    })))

    useEffect(() => {
        let active = true
        api.get('/dmcofficer/overview')
            .then(({ data }) => {
                if (active) setOverview(data.overview)
            })
            .catch((requestError) => {
                if (active) {
                    setError(
                        requestError.response?.data?.message
                        || 'Could not load the DMC overview.'
                    )
                }
            })
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        const visibleClusters = JSON.parse(priorityClusterKey)
            .filter((cluster) => cluster.id)

        Promise.allSettled(visibleClusters.map(({ id }) => (
            evaluateEscalation(id, { signal: controller.signal })
        ))).then((results) => {
            if (controller.signal.aborted) return
            const evaluations = {}
            let hasFailure = false
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') evaluations[visibleClusters[index].id] = result.value
                else hasFailure = true
            })
            setEscalationEvaluations(evaluations)
            setEvaluationError(hasFailure)
        })

        return () => controller.abort()
    }, [priorityClusterKey])

    const statistics = [
        { label: 'Escalated reports', value: overview?.escalatedReports ?? '—', icon: TriangleAlert },
        { label: 'Active target areas', value: overview?.targetAreas ?? '—', icon: Map },
        { label: 'Warnings created', value: overview?.warnings ?? '—', icon: Bell },
        { label: 'Registered citizens', value: overview?.citizens ?? '—', icon: Users }
    ]

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">DMC operations</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Dashboard</h1>
                <p className="mt-2 text-slate-600">Shared DMC workspace for warnings, response areas, and citizen coverage.</p>
            </div>
            {error && (
                <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    {error}
                </p>
            )}
            <section aria-label="DMC overview" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {statistics.map(({ label, value, icon: Icon }) => (
                    <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-slate-600">{label}</p>
                            <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon size={19} /></span>
                        </div>
                        <p className="mt-5 text-3xl font-bold text-slate-900">{value}</p>
                    </article>
                ))}
            </section>
            <section aria-label="Report clusters" className="mt-10">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Report clusters</h2>
                        <p className="mt-1 max-w-2xl text-sm text-slate-600">Citizen hazard reports grouped by location and hazard type, ordered by priority.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Link to="/dmcofficer/hazard-reviews" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-900">View all clusters <ArrowRight size={15} /></Link>
                        <button type="button" onClick={refreshClusters} disabled={clustersLoading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60">
                            <RefreshCw size={15} className={clustersLoading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </div>

                {clustersError ? (
                    <div role="alert" className="mt-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div><p className="font-semibold text-red-900">Could not load report clusters</p><p className="mt-1 text-sm text-red-800">{clustersError}</p></div>
                        <button type="button" onClick={refreshClusters} className="min-h-9 shrink-0 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100">Retry</button>
                    </div>
                ) : clustersLoading ? (
                    <div role="status" aria-label="Loading report clusters" className="mt-4 grid gap-3">
                        {[0, 1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
                        <span className="sr-only">Loading report clusters…</span>
                    </div>
                ) : priorityClusters.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-8 text-center">
                        <TriangleAlert className="mx-auto text-slate-400" size={24} />
                        <p className="mt-3 font-semibold text-slate-900">No hazard clusters require review</p>
                        <p className="mt-1 text-sm text-slate-600">New citizen reports will appear here after the system groups nearby reports.</p>
                    </div>
                ) : (
                    <div className="mt-4 space-y-3">
                        {evaluationError && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Escalation eligibility could not be checked for some clusters.</p>}
                        {priorityClusters.map((cluster) => {
                            const clusterId = cluster._id || cluster.id
                            return (
                                <HazardClusterCard
                                    key={clusterId}
                                    cluster={cluster}
                                    escalationEligible={escalationEvaluations[clusterId]?.shouldEscalate === true}
                                />
                            )
                        })}
                    </div>
                )}
            </section>
            <section className="mt-10">
                <h2 className="text-lg font-semibold text-slate-900">Quick access</h2>
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    {dashboardLinks.map(({ to, title, description, icon: Icon }) => (
                        <Link
                            key={to}
                            to={to}
                            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                        >
                            <div className="flex items-center justify-between">
                                <span className="rounded-xl bg-slate-100 p-3 text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-700">
                                    <Icon size={20} />
                                </span>
                                <ArrowRight size={18} className="text-slate-400 group-hover:text-blue-700" />
                            </div>
                            <h3 className="mt-5 font-semibold text-slate-900">{title}</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                        </Link>
                    ))}
                </div>
            </section>
        </main>
    )
}

export default DmcDashboardPage
