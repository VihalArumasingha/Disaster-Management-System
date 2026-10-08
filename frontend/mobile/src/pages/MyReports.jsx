import {
    AlertCircle,
    CheckCircle2,
    ChevronRight,
    Clock3,
    FileText,
    MapPin,
    RefreshCw,
    XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../authContext'
import { CITIZEN_ROLE } from '../constants/roles'
import api from '../services/api'

const statusConfig = {
    pending: {
        label: 'Pending review',
        icon: Clock3,
        iconBg: 'bg-amber-100 text-amber-700',
        badge: 'bg-amber-100 text-amber-800',
    },
    verified: {
        label: 'Verified',
        icon: CheckCircle2,
        iconBg: 'bg-emerald-100 text-emerald-700',
        badge: 'bg-emerald-100 text-emerald-800',
    },
    rejected: {
        label: 'Rejected',
        icon: XCircle,
        iconBg: 'bg-red-100 text-red-700',
        badge: 'bg-red-100 text-red-800',
    },
}

const hazardLabels = {
    flood: 'Flood',
    landslide: 'Landslide',
    road_blockage: 'Road blockage',
    other: 'Other hazard',
}

const formatHazardType = (type) =>
    hazardLabels[type] || String(type || 'Hazard').replaceAll('_', ' ')

const formatDate = (value) => {
    if (!value) return 'Date unavailable'

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return 'Date unavailable'

    return date.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
    })
}

function MyReports() {
    const { user, loading } = useAuth()
    const navigate = useNavigate()
    const [reports, setReports] = useState([])
    const [loadingReports, setLoadingReports] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState('')

    const loadReports = async ({ showRefresh = false } = {}) => {
        if (!user || user.role !== CITIZEN_ROLE) return

        if (showRefresh) {
            setRefreshing(true)
        } else {
            setLoadingReports(true)
        }

        setError('')

        try {
            const { data } = await api.get('/citizen/hazard-reports')
            const nextReports = Array.isArray(data)
                ? data
                : data.reports || data.data || []

            setReports(Array.isArray(nextReports) ? nextReports : [])
        } catch (requestError) {
            setError(
                requestError.response?.data?.message ||
                    'Could not load your hazard reports. Please try again.'
            )
        } finally {
            setLoadingReports(false)
            setRefreshing(false)
        }
    }

    useEffect(() => {
        let active = true

        const load = async () => {
            if (!user || user.role !== CITIZEN_ROLE) return

            try {
                const { data } = await api.get('/citizen/hazard-reports')
                const nextReports = Array.isArray(data)
                    ? data
                    : data.reports || data.data || []

                if (active) {
                    setReports(Array.isArray(nextReports) ? nextReports : [])
                }
            } catch (requestError) {
                if (active) {
                    setError(
                        requestError.response?.data?.message ||
                            'Could not load your hazard reports. Please try again.'
                    )
                }
            } finally {
                if (active) {
                    setLoadingReports(false)
                }
            }
        }

        load()

        return () => {
            active = false
        }
    }, [user])

    const summary = useMemo(
        () => ({
            total: reports.length,
            pending: reports.filter((report) => report.status === 'pending').length,
            verified: reports.filter((report) => report.status === 'verified').length,
            rejected: reports.filter((report) => report.status === 'rejected').length,
        }),
        [reports]
    )

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
                Loading your account…
            </div>
        )
    }

    if (!user || user.role !== CITIZEN_ROLE) {
        return <Navigate to="/login" replace />
    }

    return (
        <div className="mx-auto min-h-screen w-full max-w-md bg-slate-50 pb-8 text-slate-900 shadow-xl">
            <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-slate-100 bg-white/95 px-5 backdrop-blur">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">
                        Citizen services
                    </p>
                    <h1 className="mt-1 text-xl font-extrabold text-slate-950">
                        My Reports
                    </h1>
                </div>

                <button
                    type="button"
                    onClick={() => loadReports({ showRefresh: true })}
                    disabled={refreshing || loadingReports}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Refresh reports"
                >
                    <RefreshCw
                        size={18}
                        className={refreshing ? 'animate-spin' : ''}
                    />
                </button>
            </header>

            <main className="px-5 pb-8 pt-6">
                <section className="rounded-3xl bg-gradient-to-br from-[#0b5273] via-[#087e8b] to-[#0ea5c9] p-5 text-white shadow-[0_12px_30px_rgba(11,31,63,0.16)]">
                    <div className="flex items-start gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                            <FileText size={21} />
                        </span>
                        <div>
                            <p className="text-sm font-extrabold">Your hazard reports</p>
                            <p className="mt-1 text-xs leading-5 text-sky-50/85">
                                Track the review status of reports you have submitted.
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2">
                        <div className="rounded-2xl bg-white/10 px-3 py-3 text-center ring-1 ring-white/10">
                            <p className="text-lg font-black">{summary.total}</p>
                            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-100">
                                Total
                            </p>
                        </div>
                        <div className="rounded-2xl bg-white/10 px-3 py-3 text-center ring-1 ring-white/10">
                            <p className="text-lg font-black">{summary.pending}</p>
                            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-100">
                                Pending
                            </p>
                        </div>
                        <div className="rounded-2xl bg-white/10 px-3 py-3 text-center ring-1 ring-white/10">
                            <p className="text-lg font-black">{summary.verified}</p>
                            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-100">
                                Verified
                            </p>
                        </div>
                    </div>
                </section>

                {error && (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                        <div className="min-w-0">
                            <p className="font-semibold">Could not load reports</p>
                            <p className="mt-1 leading-5">{error}</p>
                            <button
                                type="button"
                                onClick={() => loadReports()}
                                className="mt-3 font-bold underline"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                {loadingReports ? (
                    <div className="mt-5 space-y-3">
                        {[1, 2, 3].map((item) => (
                            <div
                                key={item}
                                className="h-32 animate-pulse rounded-3xl bg-white shadow-sm"
                            />
                        ))}
                    </div>
                ) : reports.length === 0 ? (
                    <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                            <FileText size={25} />
                        </span>
                        <h2 className="mt-4 text-base font-bold text-slate-900">
                            No reports yet
                        </h2>
                        <p className="mt-2 text-sm leading-5 text-slate-600">
                            Hazard reports you submit will appear here so you can follow their review status.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate('/report-hazard')}
                            className="mt-5 rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800"
                        >
                            Report a hazard
                        </button>
                    </section>
                ) : (
                    <section className="mt-5">
                        <div className="mb-3 flex items-center justify-between px-1">
                            <h2 className="text-sm font-extrabold text-slate-900">
                                Submitted reports
                            </h2>
                            <span className="text-xs font-semibold text-slate-500">
                                {summary.total} total
                            </span>
                        </div>

                        <div className="space-y-3">
                            {reports.map((report) => {
                                const config =
                                    statusConfig[report.status] || statusConfig.pending
                                const StatusIcon = config.icon
                                const coordinates = report.location?.coordinates
                                const hasLocation =
                                    Array.isArray(coordinates) && coordinates.length === 2

                                return (
                                    <button
                                        key={report._id}
                                        type="button"
                                        onClick={() => navigate(`/my-reports/${report._id}`)}
                                        className="w-full rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-teal-200 hover:bg-teal-50/30 active:scale-[0.995]"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span
                                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${config.iconBg}`}
                                            >
                                                <StatusIcon size={20} />
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <h3 className="truncate text-sm font-extrabold text-slate-950">
                                                            {formatHazardType(report.hazardType)}
                                                        </h3>
                                                        <p className="mt-1 text-[11px] text-slate-500">
                                                            Submitted {formatDate(report.submittedAt || report.createdAt)}
                                                        </p>
                                                    </div>

                                                    <span
                                                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${config.badge}`}
                                                    >
                                                        {config.label}
                                                    </span>
                                                </div>

                                                <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">
                                                    {report.description || 'No description provided.'}
                                                </p>

                                                <div className="mt-3 flex items-center justify-between gap-3">
                                                    {hasLocation ? (
                                                        <span className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-slate-500">
                                                            <MapPin size={12} className="shrink-0 text-teal-700" />
                                                            <span className="truncate">Location captured</span>
                                                        </span>
                                                    ) : (
                                                        <span />
                                                    )}

                                                    <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-teal-700">
                                                        View details
                                                        <ChevronRight size={15} />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                )}

                {summary.rejected > 0 && (
                    <p className="mt-5 text-center text-[11px] leading-5 text-slate-500">
                        Rejected reports include the Duty Officer's review reason in their details.
                    </p>
                )}
            </main>
        </div>
    )
}

export default MyReports
