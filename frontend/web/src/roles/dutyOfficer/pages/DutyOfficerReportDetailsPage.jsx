import { useEffect, useState } from 'react'
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    Clock3,
    FileText,
    Mail,
    MapPin,
    User,
    XCircle,
    AlertTriangle,
    ExternalLink
} from 'lucide-react'

import { useNavigate, useParams } from 'react-router-dom'

import {
    getDutyOfficerReportById
} from '../services/dutyOfficerReportService'

const titleCase = (value) =>
    String(value || 'Unknown')
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) =>
            letter.toUpperCase()
        )

const formatDate = (value) => {
    if (
        !value
        || Number.isNaN(
            new Date(value).getTime()
        )
    ) {
        return 'Not available'
    }

    return new Intl.DateTimeFormat(
        undefined,
        {
            dateStyle: 'medium',
            timeStyle: 'short'
        }
    ).format(new Date(value))
}

const getCoordinates = (location) => {
    const coordinates =
        location?.coordinates

    if (
        location?.type !== 'Point'
        || !Array.isArray(coordinates)
        || coordinates.length !== 2
    ) {
        return null
    }

    const [
        longitude,
        latitude
    ] = coordinates

    if (
        !Number.isFinite(longitude)
        || !Number.isFinite(latitude)
    ) {
        return null
    }

    return {
        latitude,
        longitude
    }
}

const getReporterName = (report) => {
    if (!report?.reporterId) {
        return 'Unknown reporter'
    }

    if (
        typeof report.reporterId === 'string'
    ) {
        return report.reporterId
    }

    return (
        report.reporterId.name
        || report.reporterId.fullName
        || report.reporterId.email
        || 'Unknown reporter'
    )
}

const getReporterEmail = (report) => {
    if (
        !report?.reporterId
        || typeof report.reporterId === 'string'
    ) {
        return null
    }

    return report.reporterId.email || null
}

const getPhotoUrl = (report) => (
    report?.photo?.url
    || report?.photoUrl
    || null
)

const getStatusConfig = (status) => {
    switch (
        String(status || '').toLowerCase()
    ) {
        case 'verified':
            return {
                label: 'Verified',
                classes:
                    'border-emerald-200 bg-emerald-50 text-emerald-700',
                icon: CheckCircle2
            }

        case 'rejected':
            return {
                label: 'Rejected',
                classes:
                    'border-red-200 bg-red-50 text-red-700',
                icon: XCircle
            }

        default:
            return {
                label: 'Pending',
                classes:
                    'border-amber-200 bg-amber-50 text-amber-700',
                icon: Clock3
            }
    }
}

function InfoRow({
    icon: Icon,
    label,
    children
}) {
    return (
        <div className="flex gap-3">
            <div className="mt-0.5 shrink-0 text-slate-400">
                <Icon size={17} />
            </div>

            <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {label}
                </p>

                <div className="mt-1 text-sm font-medium text-slate-800">
                    {children}
                </div>
            </div>
        </div>
    )
}

function DutyOfficerReportDetailsPage() {
    const navigate = useNavigate()
    const { reportId } = useParams()

    const [report, setReport] =
        useState(null)

    const [loading, setLoading] =
        useState(true)

    const [error, setError] =
        useState('')

    useEffect(() => {
        let cancelled = false

        const loadReport = async () => {
            try {
                const result =
                    await getDutyOfficerReportById(
                        reportId
                    )

                if (cancelled) {
                    return
                }

                if (!result) {
                    setError('Report not found.')
                    setReport(null)
                    return
                }

                setReport(result)
            } catch (requestError) {
                if (cancelled) {
                    return
                }

                console.error(
                    'Failed to load duty officer report:',
                    requestError
                )

                setError(
                    requestError?.response?.data?.message
                    || requestError?.message
                    || 'Failed to load report.'
                )
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        if (reportId) {
            loadReport()
        }

        return () => {
            cancelled = true
        }
    }, [reportId])

    if (loading) {
        return (
            <main className="mx-auto max-w-6xl px-5 pb-12 pt-8 sm:px-8">
                <div className="animate-pulse space-y-5">
                    <div className="h-5 w-32 rounded bg-slate-200" />
                    <div className="h-10 w-72 rounded bg-slate-200" />
                    <div className="h-64 rounded-2xl bg-white shadow-sm" />
                </div>
            </main>
        )
    }

    if (error || !report) {
        return (
            <main className="mx-auto max-w-6xl px-5 pb-12 pt-8 sm:px-8">
                <button
                    type="button"
                    onClick={() =>
                        navigate(
                            '/dutyofficer/reports'
                        )
                    }
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
                >
                    <ArrowLeft size={16} />
                    Back to Reports
                </button>

                <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
                    <div className="flex items-start gap-3">
                        <AlertTriangle
                            size={22}
                            className="mt-0.5 shrink-0 text-red-600"
                        />

                        <div>
                            <h1 className="font-semibold text-red-900">
                                Report could not be loaded
                            </h1>

                            <p className="mt-1 text-sm text-red-800">
                                {error
                                    || 'Report not found.'}
                            </p>
                        </div>
                    </div>
                </section>
            </main>
        )
    }

    const status =
        String(
            report?.status || 'pending'
        ).toLowerCase()

    const statusConfig =
        getStatusConfig(status)

    const StatusIcon =
        statusConfig.icon

    const coordinates =
        getCoordinates(report?.location)

    const photoUrl =
        getPhotoUrl(report)

    const reporterName =
        getReporterName(report)

    const reporterEmail =
        getReporterEmail(report)

    const clusterId =
        typeof report?.clusterId === 'object'
            ? report.clusterId?._id
            : report?.clusterId

    const verification =
        report?.verification

    return (
        <main className="mx-auto max-w-6xl px-5 pb-12 pt-8 sm:px-8 lg:pt-10">

            {/* Back */}
            <button
                type="button"
                onClick={() =>
                    navigate(
                        '/dutyofficer/reports'
                    )
                }
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 transition hover:text-blue-900"
            >
                <ArrowLeft size={17} />
                Back to Reports
            </button>

            {/* Header */}
            <header className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">
                        Report Management
                    </p>

                    <h1 className="mt-2 text-3xl font-bold text-slate-900">
                        Hazard Report
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        Report #
                        {' '}
                        {String(
                            report?._id || reportId
                        ).slice(-8)}
                    </p>
                </div>

                <span
                    className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${statusConfig.classes}`}
                >
                    <StatusIcon size={16} />
                    {statusConfig.label}
                </span>
            </header>

            {/* Main grid */}
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">

                {/* Left */}
                <div className="space-y-6">

                    {/* Evidence */}
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 px-6 py-4">
                            <div className="flex items-center gap-2">
                                <FileText
                                    size={18}
                                    className="text-blue-700"
                                />

                                <h2 className="font-semibold text-slate-900">
                                    Report Evidence
                                </h2>
                            </div>
                        </div>

                        <div className="p-6">
                            {photoUrl ? (
                                <img
                                    src={photoUrl}
                                    alt="Hazard report evidence"
                                    className="max-h-[520px] w-full rounded-xl object-cover"
                                />
                            ) : (
                                <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                                    <div className="text-center">
                                        <FileText
                                            size={36}
                                            className="mx-auto text-slate-400"
                                        />

                                        <p className="mt-3 text-sm font-medium text-slate-600">
                                            No photo evidence attached
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Description */}
                    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="font-semibold text-slate-900">
                            Description
                        </h2>

                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                            {report?.description
                                || 'No description provided.'}
                        </p>
                    </section>

                    {/* Location */}
                    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="font-semibold text-slate-900">
                            Location
                        </h2>

                        <div className="mt-5 space-y-5">
                            <InfoRow
                                icon={MapPin}
                                label="Coordinates"
                            >
                                {coordinates
                                    ? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`
                                    : 'Location unavailable'}
                            </InfoRow>

                            {coordinates && (
                                <a
                                    href={`https://www.openstreetmap.org/?mlat=${coordinates.latitude}&mlon=${coordinates.longitude}#map=16/${coordinates.latitude}/${coordinates.longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                                >
                                    <MapPin size={15} />
                                    View on OpenStreetMap
                                    <ExternalLink size={14} />
                                </a>
                            )}
                        </div>
                    </section>
                </div>

                {/* Right */}
                <div className="space-y-6">

                    {/* Report information */}
                    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="font-semibold text-slate-900">
                            Report Information
                        </h2>

                        <div className="mt-5 space-y-5">

                            <InfoRow
                                icon={AlertTriangle}
                                label="Hazard Type"
                            >
                                {titleCase(
                                    report?.hazardType
                                )}
                            </InfoRow>

                            <InfoRow
                                icon={CalendarDays}
                                label="Submitted"
                            >
                                {formatDate(
                                    report?.submittedAt
                                    || report?.createdAt
                                )}
                            </InfoRow>

                            <InfoRow
                                icon={Clock3}
                                label="Captured"
                            >
                                {formatDate(
                                    report?.capturedAt
                                )}
                            </InfoRow>

                            <InfoRow
                                icon={FileText}
                                label="Report ID"
                            >
                                <span className="break-all font-mono text-xs">
                                    {report?._id}
                                </span>
                            </InfoRow>

                            {clusterId && (
                                <InfoRow
                                    icon={FileText}
                                    label="Cluster"
                                >
                                    <span className="break-all font-mono text-xs">
                                        {clusterId}
                                    </span>
                                </InfoRow>
                            )}
                        </div>
                    </section>

                    {/* Reporter */}
                    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="font-semibold text-slate-900">
                            Reporter
                        </h2>

                        <div className="mt-5 space-y-5">
                            <InfoRow
                                icon={User}
                                label="Name"
                            >
                                {reporterName}
                            </InfoRow>

                            {reporterEmail && (
                                <InfoRow
                                    icon={Mail}
                                    label="Email"
                                >
                                    <a
                                        href={`mailto:${reporterEmail}`}
                                        className="break-all text-blue-700 hover:text-blue-900"
                                    >
                                        {reporterEmail}
                                    </a>
                                </InfoRow>
                            )}
                        </div>
                    </section>

                    {/* Verification */}
                    {verification && (
                        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h2 className="font-semibold text-slate-900">
                                Verification
                            </h2>

                            <div className="mt-5 space-y-5">

                                {verification.verifiedAt && (
                                    <InfoRow
                                        icon={CalendarDays}
                                        label="Verified At"
                                    >
                                        {formatDate(
                                            verification.verifiedAt
                                        )}
                                    </InfoRow>
                                )}

                                {verification.verifiedBy && (
                                    <InfoRow
                                        icon={User}
                                        label="Verified By"
                                    >
                                        {typeof verification.verifiedBy === 'object'
                                            ? (
                                                verification.verifiedBy.name
                                                || verification.verifiedBy.email
                                                || verification.verifiedBy._id
                                            )
                                            : verification.verifiedBy}
                                    </InfoRow>
                                )}

                                {verification.rejectionReason && (
                                    <InfoRow
                                        icon={XCircle}
                                        label="Rejection Reason"
                                    >
                                        <span className="text-red-700">
                                            {verification.rejectionReason}
                                        </span>
                                    </InfoRow>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </main>
    )
}

export default DutyOfficerReportDetailsPage