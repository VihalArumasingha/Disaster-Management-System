import { ClipboardList } from 'lucide-react'
import DutyOfficerClusterCard from './DutyOfficerClusterCard'

function DutyOfficerClusterQueue({ clusters, loading }) {
    if (loading) {
        return (
            <div role="status" aria-label="Loading hazard clusters" className="space-y-4">
                {[0, 1, 2].map((item) => (
                    <div key={item} className="h-52 animate-pulse rounded-2xl border border-slate-200 bg-white" />
                ))}
            </div>
        )
    }

    if (clusters.length === 0) {
        return (
            <section className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                    <ClipboardList size={24} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No active hazard clusters</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">New citizen hazard reports will appear here when they are clustered.</p>
            </section>
        )
    }

    return (
        <div className="space-y-4">
            {clusters.map((cluster) => (
                <DutyOfficerClusterCard key={cluster._id || cluster.id} cluster={cluster} />
            ))}
        </div>
    )
}

export default DutyOfficerClusterQueue