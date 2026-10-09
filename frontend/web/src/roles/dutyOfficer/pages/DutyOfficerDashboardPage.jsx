import { useEffect, useState } from 'react'
import { Activity, RefreshCw, ShieldAlert, TriangleAlert, ArrowUpRight, ClipboardCheck, MapPin } from 'lucide-react'
import { useLocation, Link } from 'react-router-dom'
import DutyOfficerCompactClusterCard from '../components/DutyOfficerCompactClusterCard'
import DutyOfficerHazardMap from '../components/DutyOfficerHazardMap'
import useDutyOfficerClusters from '../hooks/useDutyOfficerClusters'
import { getOutgoingEscalations } from '../../dmcOfficer/services/hazardReviewService'

const getReportCount = (cluster) => cluster.reportCount ?? cluster.reportIds?.length ?? 0
const getPendingReportCount = (cluster) => cluster.reportIds?.filter(r => r.status === 'pending').length ?? 0

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

function DutyOfficerDashboardPage() {
    const { clusters, loading, error, refresh } = useDutyOfficerClusters()
    const { hash } = useLocation()
    const [escalations, setEscalations] = useState([])
    const [loadingEscalations, setLoadingEscalations] = useState(true)

    useEffect(() => {
        if (hash === '#hazard-map') {
            document.getElementById('hazard-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [hash])

    const fetchEscalations = async () => {
        setLoadingEscalations(true)
        try {
            const data = await getOutgoingEscalations()
            setEscalations(data)
        } catch (err) {
            console.error('Failed to load escalations', err)
        } finally {
            setLoadingEscalations(false)
        }
    }

    useEffect(() => {
        fetchEscalations()
    }, [])

    const handleRefresh = () => {
        refresh()
        fetchEscalations()
    }

    const pendingReportsCount = clusters.reduce((total, cluster) => total + getPendingReportCount(cluster), 0)
    
    // Filter and Sort clusters: Critical first, then High
    const urgentClusters = clusters.filter(c => c.priorityLevel === 'critical' || c.priorityLevel === 'high')
    const sortedClusters = [...urgentClusters].sort((a, b) => {
        const priorityRank = { critical: 4, high: 3 }
        const rankA = priorityRank[a.priorityLevel] || 0
        const rankB = priorityRank[b.priorityLevel] || 0
        if (rankA !== rankB) return rankB - rankA
        const scoreA = a.priorityScore || 0
        const scoreB = b.priorityScore || 0
        if (scoreA !== scoreB) return scoreB - scoreA
        return new Date(b.lastReportedAt || 0) - new Date(a.lastReportedAt || 0)
    })
    
    const displayClusters = sortedClusters.slice(0, 5)
    const hasMoreClusters = sortedClusters.length > 5

    // Calculate District Activity
    const districtCounts = {}
    clusters.forEach(cluster => {
        const reports = cluster.reportIds || []
        reports.forEach(report => {
            const district = report.district || 'Unknown District'
            districtCounts[district] = (districtCounts[district] || 0) + 1
        })
    })

    const districtList = Object.entries(districtCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10) // top 10

    const stats = [
        { label: 'Pending reports', value: pendingReportsCount, icon: Activity, color: 'text-blue-700', bg: 'bg-blue-50' },
        { label: 'Critical priority', value: clusters.filter((c) => c.priorityLevel === 'critical').length, icon: ShieldAlert, color: 'text-red-700', bg: 'bg-red-50' },
        { label: 'High priority', value: clusters.filter((c) => c.priorityLevel === 'high').length, icon: TriangleAlert, color: 'text-orange-700', bg: 'bg-orange-50' },
        { label: 'Escalated to DMC', value: escalations.length, icon: ClipboardCheck, color: 'text-amber-700', bg: 'bg-amber-50' }
    ]

    return (
        <main className="mx-auto max-w-[1400px] px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Operational Overview</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">Duty Officer Dashboard</h1>
                    <p className="mt-2 max-w-2xl text-slate-600">Monitor priority citizen reports, verify hazards, and escalate to DMC.</p>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={loading}
                    className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 sm:self-auto"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </header>

            {error ? (
                <section role="alert" className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="font-semibold text-red-900">Hazard clusters could not be loaded</h2>
                        <p className="mt-1 text-sm text-red-800">{error}</p>
                    </div>
                    <button type="button" onClick={handleRefresh} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100">
                        <RefreshCw size={15} /> Retry
                    </button>
                </section>
            ) : (
                <>
                    <section aria-label="Operational summary" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {stats.map(({ label, value, icon: Icon, color, bg }) => (
                            <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-semibold text-slate-600">{label}</p>
                                    <span className={`rounded-xl ${bg} p-2.5 ${color}`}><Icon size={19} /></span>
                                </div>
                                <p className="mt-5 text-3xl font-bold tabular-nums text-slate-900">
                                    {loading && label !== 'Escalated to DMC' ? '—' : (loadingEscalations && label === 'Escalated to DMC' ? '—' : value)}
                                </p>
                            </article>
                        ))}
                    </section>

                    <div className="mt-10 space-y-10">
                        {/* Hazard Map */}
                        <section id="hazard-map" aria-label="Hazard situation map" className="scroll-mt-6 mb-10">
                            <div className="mb-4">
                                <h2 className="text-xl font-bold text-slate-900">Active Hazard Map</h2>
                                <p className="mt-1 text-sm text-slate-600">Current active hazard reports and clusters</p>
                            </div>
                            <div className="relative h-[400px] w-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                                <DutyOfficerHazardMap clusters={clusters} loading={loading} />
                            </div>
                        </section>
                        
                        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
                            {/* Needs Attention */}
                            <section aria-label="Needs Attention">
                                <div className="mb-4">
                                    <h2 className="text-xl font-bold text-slate-900">Needs Attention</h2>
                                    <p className="mt-1 text-sm text-slate-600">Critical and high-priority clusters requiring review.</p>
                                </div>
                                
                                <div className="space-y-4">
                                    {displayClusters.length === 0 ? (
                                        <p className="text-sm text-slate-500 italic py-4">No critical or high-priority clusters require attention right now.</p>
                                    ) : (
                                        displayClusters.map(cluster => (
                                            <DutyOfficerCompactClusterCard key={cluster._id} cluster={cluster} />
                                        ))
                                    )}
                                </div>
                                {hasMoreClusters && (
                                    <div className="mt-6 text-center">
                                        <Link to="/dutyofficer/hazard-reviews" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-800">
                                            View all clusters →
                                        </Link>
                                    </div>
                                )}
                            </section>

                            {/* Sidebar: District Activity & Escalations */}
                            <aside className="space-y-8">
                                <section className="rounded-2xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="bg-blue-50/50 px-5 py-4 border-b border-slate-100">
                                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                            <div className="flex items-center justify-center rounded-lg bg-blue-100 p-1.5 text-blue-700">
                                                <MapPin size={18} />
                                            </div>
                                            District Activity
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500 ml-9">Active reports per district</p>
                                    </div>
                                    <div className="p-5">
                                        {districtList.length === 0 ? (
                                            <p className="text-sm text-slate-500 italic py-2">No district activity reported.</p>
                                        ) : (
                                            <ul className="space-y-3">
                                                {districtList.map((district) => (
                                                    <li key={district.name} className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                                        <span className="text-sm font-medium text-slate-700">{district.name}</span>
                                                        <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md bg-blue-50 px-2 text-xs font-semibold text-blue-700 border border-blue-100">
                                                            {district.count}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </section>

                                <section className="rounded-2xl border-2 border-slate-200 bg-white shadow-sm overflow-hidden">
                                    <div className="bg-indigo-50/50 px-5 py-4 border-b border-slate-100">
                                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                            <div className="flex items-center justify-center rounded-lg bg-indigo-100 p-1.5 text-indigo-700">
                                                <ClipboardCheck size={18} />
                                            </div>
                                            Escalated to DMC
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500 ml-9">Your recent escalations</p>
                                    </div>
                                    <div className="p-5">
                                        {loadingEscalations ? (
                                            <div className="space-y-3">
                                                {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
                                            </div>
                                        ) : escalations.length === 0 ? (
                                            <p className="text-sm text-slate-500 italic py-2">No recent escalations.</p>
                                        ) : (
                                            <ul className="space-y-3">
                                                {escalations.slice(0, 5).map((esc) => (
                                                    <li key={esc._id} className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3 hover:bg-indigo-50/60 transition-colors">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                                                                {titleCase(esc.hazardType)}
                                                            </span>
                                                            <span className="text-[10px] font-semibold text-slate-400">
                                                                {formatTime(esc.escalatedAt)}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 text-sm font-semibold text-slate-800 line-clamp-1">
                                                            {esc.clusterId?.locationName || 'Cluster Escalation'}
                                                        </p>
                                                        <div className="mt-2 text-right">
                                                            <Link
                                                                to={`/dutyofficer/hazard-reviews/clusters/${esc.clusterId?._id}`}
                                                                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                                                            >
                                                                View <ArrowUpRight size={12} />
                                                            </Link>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
                                        <Link
                                            to="/dutyofficer/escalations"
                                            className="block text-center text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                                        >
                                            View All Escalations &rarr;
                                        </Link>
                                    </div>
                                </section>
                            </aside>
                        </div>
                    </div>
                </>
            )}
        </main>
    )
}

export default DutyOfficerDashboardPage