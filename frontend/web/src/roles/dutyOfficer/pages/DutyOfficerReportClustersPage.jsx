import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import DutyOfficerClusterQueue from '../components/DutyOfficerClusterQueue'
import useDutyOfficerClusters from '../hooks/useDutyOfficerClusters'

const PRIORITY_FILTERS = [
    { label: 'All', value: 'all' },
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
]

function DutyOfficerReportClustersPage() {
    const { clusters, loading, error, refresh } = useDutyOfficerClusters()
    const [selectedPriority, setSelectedPriority] = useState('all')

    const priorityCounts = useMemo(() => {
        const counts = { all: clusters.length }

        PRIORITY_FILTERS.forEach(({ value }) => {
            if (value !== 'all') {
                counts[value] = clusters.filter(
                    (cluster) =>
                        String(cluster.priorityLevel ?? cluster.priority ?? '')
                            .toLowerCase() === value
                ).length
            }
        })

        return counts
    }, [clusters])

    const filteredClusters = useMemo(() => {
        if (selectedPriority === 'all') return clusters

        return clusters.filter(
            (cluster) =>
                String(cluster.priorityLevel ?? cluster.priority ?? '')
                    .toLowerCase() === selectedPriority
        )
    }, [clusters, selectedPriority])

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
                        Incident management
                    </p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">
                        Report Clusters
                    </h1>
                    <p className="mt-2 text-slate-600">
                        Prioritized citizen hazard clusters awaiting Duty Officer review.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={refresh}
                    disabled={loading}
                    className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 sm:self-auto"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </header>

            {error ? (
                <section
                    role="alert"
                    className="mt-8 flex flex-col justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center"
                >
                    <div>
                        <h2 className="font-semibold text-red-900">
                            Hazard clusters could not be loaded
                        </h2>
                        <p className="mt-1 text-sm text-red-800">{error}</p>
                    </div>

                    <button
                        type="button"
                        onClick={refresh}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
                    >
                        <RefreshCw size={15} />
                        Retry
                    </button>
                </section>
            ) : (
                <section className="mt-8">
                    <p className="mb-4 text-sm text-slate-600">
                        {loading
                            ? 'Loading clusters…'
                            : `${clusters.length} active ${clusters.length === 1 ? 'cluster' : 'clusters'}`}
                    </p>

                    {!loading && (
                        <div className="mb-6">
                            <div
                                role="group"
                                aria-label="Filter clusters by priority"
                                className="flex gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
                            >
                                {PRIORITY_FILTERS.map(({ label, value }) => {
                                    const isSelected = selectedPriority === value

                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setSelectedPriority(value)}
                                            aria-pressed={isSelected}
                                            className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                                                isSelected
                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                            }`}
                                        >
                                            {label}
                                            <span
                                                className={`rounded-md px-1.5 py-0.5 text-xs ${
                                                    isSelected
                                                        ? 'bg-white/20 text-white'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {priorityCounts[value] ?? 0}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>

                            <p className="mt-3 text-sm text-slate-500" aria-live="polite">
                                Showing {filteredClusters.length}{' '}
                                {filteredClusters.length === 1 ? 'cluster' : 'clusters'}
                                {selectedPriority !== 'all'
                                    ? ` with ${selectedPriority} priority`
                                    : ''}
                            </p>
                        </div>
                    )}

                    <DutyOfficerClusterQueue
                        clusters={filteredClusters}
                        loading={loading}
                        selectedPriority={selectedPriority}
                    />
                </section>
            )}
        </main>
    )
}

export default DutyOfficerReportClustersPage