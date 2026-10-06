import { useMemo } from 'react'
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend
} from 'recharts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "Distribution Trends" grouped bar chart — families assisted vs resources
 * distributed per calendar month, aggregated from the distribution records.
 */
export default function DistributionTrendsChart({ records = [], loading = false }) {
    const data = useMemo(() => {
        const buckets = MONTHS.map(month => ({ month, families: 0, resources: 0 }))
        for (const r of records) {
            const d = new Date(`${r.date}T00:00:00`)
            if (Number.isNaN(d.getTime())) continue
            const bucket = buckets[d.getMonth()]
            bucket.families += Number(r.familiesAssisted) || 0
            bucket.resources += Number(r.resourcesDistributed) || 0
        }
        return buckets
    }, [records])

    const hasData = data.some(d => d.families > 0 || d.resources > 0)

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Distribution Trends</h2>
                    <p className="text-xs text-slate-500">
                        Families assisted vs resources distributed, by month
                    </p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                        Families Assisted
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
                        Resources Distributed
                    </span>
                </div>
            </header>

            {!hasData ? (
                <p className="py-16 text-center text-sm text-slate-500">
                    {loading
                        ? 'Loading distribution data…'
                        : 'No distribution records yet — add one to see the trend chart.'}
                </p>
            ) : (
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 12, fill: '#64748b' }}
                                axisLine={false}
                                tickLine={false}
                                width={44}
                            />
                            <Tooltip cursor={{ fill: '#f1f5f9' }} />
                            <Legend
                                align="right"
                                verticalAlign="top"
                                iconType="circle"
                                wrapperStyle={{ fontSize: 12 }}
                            />
                            <Bar
                                dataKey="families"
                                name="Families Assisted"
                                fill="#38bdf8"
                                radius={[6, 6, 0, 0]}
                                maxBarSize={26}
                            />
                            <Bar
                                dataKey="resources"
                                name="Resources Distributed"
                                fill="#7c3aed"
                                radius={[6, 6, 0, 0]}
                                maxBarSize={26}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </section>
    )
}