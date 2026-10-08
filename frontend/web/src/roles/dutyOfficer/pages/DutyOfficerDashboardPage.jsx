import { useEffect } from 'react'
import { Activity, ClipboardList, RefreshCw, ShieldAlert, TriangleAlert } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import DutyOfficerClusterQueue from '../components/DutyOfficerClusterQueue'
import DutyOfficerHazardMap from '../components/DutyOfficerHazardMap'
import useDutyOfficerClusters from '../hooks/useDutyOfficerClusters'

const getReportCount = (cluster) => cluster.reportCount ?? cluster.reportIds?.length ?? 0

function DutyOfficerDashboardPage() {
    const { clusters, loading, error, refresh } = useDutyOfficerClusters()
    const { hash } = useLocation()
    useEffect(() => {
        if (hash === '#hazard-map') {
            document.getElementById('hazard-map')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }, [hash])

    const totalReports = clusters.reduce((total, cluster) => total + getReportCount(cluster), 0)
    const stats = [
        { label: 'Total clusters', value: clusters.length, icon: ClipboardList },
        { label: 'Critical priority', value: clusters.filter((cluster) => cluster.priorityLevel === 'critical').length, icon: ShieldAlert },
        { label: 'High priority', value: clusters.filter((cluster) => cluster.priorityLevel === 'high').length, icon: TriangleAlert },
        { label: 'Citizen reports', value: totalReports, icon: Activity }
    ]

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Incident management</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">Duty Officer Dashboard</h1>
                    <p className="mt-2 max-w-2xl text-slate-600">Monitor, verify, and escalate prioritized citizen hazard clusters.</p>
                </div>
                <button
                    type="button"
                    onClick={refresh}
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
                    <button type="button" onClick={refresh} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100">
                        <RefreshCw size={15} /> Retry
                    </button>
                </section>
            ) : (
                <>
                    <section aria-label="Hazard review summary" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {stats.map(({ label, value, icon: Icon }) => (
                            <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-slate-600">{label}</p>
                                    <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Icon size={19} /></span>
                                </div>
                                <p className="mt-5 text-3xl font-bold tabular-nums text-slate-900">{loading ? '—' : value}</p>
                            </article>
                        ))}
                    </section>

                    <section id="hazard-map" aria-label="Hazard situation map" className="mt-10 scroll-mt-6">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-slate-900">Hazard Situation Map</h2>
                            <p className="mt-1 text-sm text-slate-600">Active citizen hazard clusters by location.</p>
                        </div>
                        <DutyOfficerHazardMap clusters={clusters} loading={loading} />
                    </section>

                    <section aria-label="Priority review queue" className="mt-10">
                        <div className="mb-4">
                            <h2 className="text-xl font-semibold text-slate-900">Priority Review Queue</h2>
                            <p className="mt-1 text-sm text-slate-600">Active citizen hazard clusters, ordered by the existing priority ranking.</p>
                        </div>

                        <DutyOfficerClusterQueue clusters={clusters} loading={loading} />
                    </section>
                </>
            )}
        </main>
    )
}

export default DutyOfficerDashboardPage