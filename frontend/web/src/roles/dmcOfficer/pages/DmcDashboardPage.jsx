import { useEffect, useState } from 'react'
import { ArrowRight, Bell, Map, TriangleAlert, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '../../../services/api'

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
