import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { RefreshCw } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function OverviewPage() {
    const [metrics, setMetrics] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [httpStatus, setHttpStatus] = useState(null)

    const loadMetrics = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`${API_BASE}/api/ngomanager/overview/metrics`, {
                credentials: 'include'
            })
            setHttpStatus(res.status)
            if (res.status === 401 || res.status === 403) {
                throw new Error('Your session expired or you lack NGO-manager access. Please sign in again.')
            }
            if (!res.ok) throw new Error(`Failed to load metrics (server responded ${res.status})`)
            const data = await res.json()
            if (!data?.metrics) throw new Error('Metrics response was empty')
            setMetrics(data.metrics)
        } catch (err) {
            setError(err.message || 'Failed to load metrics')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadMetrics()
    }, [])

    if (loading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-600" />
                    <p className="mt-2 text-sm text-slate-600">Loading overview metrics...</p>
                </div>
            </div>
        )
    }

    if (error) {
        const isAuthError = httpStatus === 401 || httpStatus === 403
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                <p className="text-sm text-red-800">{error}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button
                        onClick={loadMetrics}
                        className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                        Retry
                    </button>
                    {isAuthError && (
                        <a
                            href="/login"
                            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
                        >
                            Go to login
                        </a>
                    )}
                </div>
            </div>
        )
    }

    if (!metrics) {
        return <p className="text-sm text-slate-600">No metrics available</p>
    }

    const volunteerTypeData = [
        { name: 'Individuals', value: metrics.volunteerTypeBreakdown?.individuals ?? 0 },
        { name: 'Team Leads', value: metrics.volunteerTypeBreakdown?.teamLeads ?? 0 }
    ]

    const categoryData = Object.entries(metrics.categoryDistribution || {}).map(([name, value]) => ({
        name,
        value
    }))

    const operationsData = (metrics.topOperations || []).map(op => ({
        name: (op?.name || 'Unnamed').substring(0, 15) + ((op?.name || '').length > 15 ? '...' : ''),
        volunteers: op?.requiredVolunteers ?? 0,
        status: op?.status || '—'
    }))

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Operational Dashboard Summary</h1>
                    <p className="mt-1 text-sm text-slate-600">Overview of NGO operations and resources</p>
                </div>
                <button
                    onClick={loadMetrics}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                    <RefreshCw size={16} />
                    Refresh
                </button>
            </div>

            {/* Core Operations Metrics */}
            <section>
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900">
                    <span className="inline-block h-6 w-1 rounded-full bg-blue-600" />
                    Core Operations Metrics
                </h2>
                <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                        emoji="📦"
                        label="TOTAL COLLECTION CENTERS"
                        value={metrics.totalCollectionCenters}
                        valueColor="text-blue-600"
                    />
                    <MetricCard
                        emoji="🚧"
                        label="OPERATIONS IN PROGRESS"
                        value={metrics.operationsInProgress}
                        valueColor="text-amber-500"
                    />
                    <MetricCard
                        emoji="✅"
                        label="OPERATIONS COMPLETED"
                        value={metrics.operationsCompleted}
                        valueColor="text-emerald-500"
                    />
                </div>
            </section>

            {/* Volunteer and Capacity Analysis */}
            <section>
                <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-900">
                    <span className="inline-block h-6 w-1 rounded-full bg-blue-600" />
                    Volunteer and Capacity Analysis
                </h2>
                <div className="grid gap-4 md:grid-cols-2">
                    <MetricCard
                        emoji="👥"
                        label="TOTAL REGISTERED VOLUNTEER CAPACITY"
                        value={metrics.totalRegisteredVolunteers}
                        valueColor="text-cyan-500"
                    />
                    <MetricCard
                        emoji="👷"
                        label="TOTAL ASSIGNED CAPACITY"
                        value={metrics.totalAssignedVolunteers}
                        valueColor="text-cyan-500"
                    />
                </div>
            </section>

            {/* Operational Deep Dive */}
            <section>
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Operational Deep Dive</h2>
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Volunteer Needs Chart */}
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-sm font-semibold text-slate-900">Top 5 Operations by Volunteer Need</h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={operationsData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="volunteers" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Volunteer Type Breakdown */}
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="mb-4 text-sm font-semibold text-slate-900">
                            Volunteer Type Breakdown: {(metrics.volunteerTypeBreakdown?.total || 0) > 0
                                ? Math.round(((metrics.volunteerTypeBreakdown?.teamLeads || 0) / metrics.volunteerTypeBreakdown.total) * 100)
                                : 0}% Team Leads
                        </h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={volunteerTypeData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {volunteerTypeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Collection Center Categories */}
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                        <h3 className="mb-4 text-sm font-semibold text-slate-900">Top 5 Collection Center Tags</h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}

function MetricCard({ emoji, label, value, valueColor = 'text-blue-600' }) {
    return (
        <div className="rounded-xl border border-slate-100 border-l-4 border-l-blue-600 bg-white p-6 text-center shadow-[0_2px_12px_rgba(15,23,42,0.06)]">
            <div className="text-3xl leading-none" aria-hidden="true">{emoji}</div>
            <p className={`mt-2 text-3xl font-extrabold ${valueColor}`}>{value ?? '—'}</p>
            <p className="mt-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        </div>
    )
}
