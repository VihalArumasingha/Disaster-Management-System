import { useCallback, useEffect, useMemo, useState } from 'react'

import { useNavigate } from 'react-router-dom'

import {

    Archive,

    CheckCircle2,

    Clock3,

    Download,

    FileText,

    MapPin,

    RefreshCw,

    Search,

    TriangleAlert,

    XCircle

} from 'lucide-react'



import {
    archiveDutyOfficerReport,
    getDutyOfficerReports
} from '../services/dutyOfficerReportService'



const districts = [

    'All districts',

    'Ampara',

    'Anuradhapura',

    'Badulla',

    'Batticaloa',

    'Colombo',

    'Galle',

    'Gampaha',

    'Hambantota',

    'Jaffna',

    'Kalutara',

    'Kandy',

    'Kegalle',

    'Kilinochchi',

    'Kurunegala',

    'Mannar',

    'Matale',

    'Matara',

    'Monaragala',

    'Mullaitivu',

    'Nuwara Eliya',

    'Polonnaruwa',

    'Puttalam',

    'Ratnapura',

    'Trincomalee',

    'Vavuniya'

]



const statusLabels = {

    all: 'All',

    pending: 'Pending',

    verified: 'Verified',

    rejected: 'Rejected'

}



const titleCase = (value) =>

    String(value || 'Unknown')

        .replaceAll('_', ' ')

        .replace(/\b\w/g, (letter) => letter.toUpperCase())



const formatDate = (value) => {

    if (!value || Number.isNaN(new Date(value).getTime())) {

        return 'Time unavailable'

    }



    return new Intl.DateTimeFormat(undefined, {

        dateStyle: 'medium',

        timeStyle: 'short'

    }).format(new Date(value))

}



const getCoordinates = (location) => {

    const coordinates = location?.coordinates



    if (

        location?.type !== 'Point'

        || !Array.isArray(coordinates)

        || coordinates.length !== 2

    ) {

        return null

    }



    const [longitude, latitude] = coordinates



    if (

        !Number.isFinite(longitude)

        || !Number.isFinite(latitude)

    ) {

        return null

    }



    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`

}



const getLocation = (report) => (

    report?.locationName

    || report?.address

    || report?.location?.name

    || getCoordinates(report?.location)

    || 'Location unavailable'

)



const getReporterName = (report) => {

    if (!report?.reporterId) {

        return 'Unknown reporter'

    }



    if (typeof report.reporterId === 'string') {

        return report.reporterId

    }



    return (

        report.reporterId.name

        || report.reporterId.fullName

        || report.reporterId.email

        || 'Unknown reporter'

    )

}



const getPhotoUrl = (report) => (

    report?.photo?.url

    || report?.photoUrl

    || null

)



const statusClasses = {

    pending: 'border-amber-200 bg-amber-50 text-amber-700',

    verified: 'border-emerald-200 bg-emerald-50 text-emerald-700',

    rejected: 'border-red-200 bg-red-50 text-red-700'

}



const statusIcon = {

    pending: Clock3,

    verified: CheckCircle2,

    rejected: XCircle

}



function DutyOfficerReportsPage() {

    const navigate = useNavigate()

    const [reports, setReports] = useState([])

    const [selectedStatus, setSelectedStatus] = useState('all')

    const [selectedDistrict, setSelectedDistrict] = useState('All districts')

    const [searchTerm, setSearchTerm] = useState('')
    const [showArchived, setShowArchived] = useState(false)


    const [loading, setLoading] = useState(true)

    const [refreshing, setRefreshing] = useState(false)

    const [error, setError] = useState('')



    const fetchReports = useCallback(async ({ isRefresh = false } = {}) => {
        if (isRefresh) {
            setRefreshing(true)
        } else {
            setLoading(true)
        }

        setError('')

        try {
            const result = await getDutyOfficerReports(showArchived)

            const nextReports = Array.isArray(result)
                ? result
                : Array.isArray(result?.data)
                    ? result.data
                    : []

            setReports(nextReports)
        } catch (requestError) {
            console.error(
                'Failed to fetch duty officer reports:',
                requestError
            )

            setError(
                requestError?.response?.data?.message
                || requestError?.message
                || 'Failed to load reports.'
            )
        } finally {
            setLoading(false)

            if (isRefresh) {
                setRefreshing(false)
            }
        }
    }, [showArchived])

    useEffect(() => {
        fetchReports()
    }, [fetchReports])


    const handleRefresh = async () => {
        await fetchReports({ isRefresh: true })
    }

    const handleArchive = async (report) => {
        if (!report?._id) {
            return
        }

        const status = String(report?.status || '').toLowerCase()

        if (status !== 'verified' && status !== 'rejected') {
            return
        }

        const confirmed = window.confirm(
            'Archive this report? It will be removed from the active report history.'
        )

        if (!confirmed) {
            return
        }

        try {
            setError('')

            await archiveDutyOfficerReport(report._id)

            setReports((currentReports) =>
                currentReports.filter(
                    (currentReport) =>
                        currentReport?._id !== report._id
                )
            )
        } catch (requestError) {
            console.error(
                'Failed to archive duty officer report:',
                requestError
            )

            setError(
                requestError?.response?.data?.message
                || requestError?.message
                || 'Failed to archive the report.'
            )
        }
    }

    const filteredReports = useMemo(() => {

        const normalizedSearch = searchTerm.trim().toLowerCase()



        return reports.filter((report) => {

            const status = String(

                report?.status || ''

            ).toLowerCase()



            const district =

                report?.district

                || report?.location?.district

                || ''



            const location = getLocation(report)

            const hazard = titleCase(report?.hazardType)

            const reporter = getReporterName(report)



            const matchesStatus =

                selectedStatus === 'all'

                || status === selectedStatus



            const matchesDistrict =

                selectedDistrict === 'All districts'

                || district === selectedDistrict



            const matchesSearch =

                !normalizedSearch

                || String(report?._id || '')

                    .toLowerCase()

                    .includes(normalizedSearch)

                || location

                    .toLowerCase()

                    .includes(normalizedSearch)

                || hazard

                    .toLowerCase()

                    .includes(normalizedSearch)

                || reporter

                    .toLowerCase()

                    .includes(normalizedSearch)

                || district

                    .toLowerCase()

                    .includes(normalizedSearch)



            return (

                matchesStatus

                && matchesDistrict

                && matchesSearch

            )

        })

    }, [

        reports,

        selectedStatus,

        selectedDistrict,

        searchTerm

    ])



    const counts = useMemo(() => ({

        all: reports.length,



        pending: reports.filter(

            (report) => report.status === 'pending'

        ).length,



        verified: reports.filter(

            (report) => report.status === 'verified'

        ).length,



        rejected: reports.filter(

            (report) => report.status === 'rejected'

        ).length

    }), [reports])



    const escapeCsvValue = (value) => {

        const stringValue = String(value ?? '')



        if (

            stringValue.includes(',')

            || stringValue.includes('"')

            || stringValue.includes('\n')

        ) {

            return `"${stringValue.replaceAll('"', '""')}"`

        }



        return stringValue

    }



    const handleExportCsv = () => {

        if (filteredReports.length === 0) {

            return

        }



        const headers = [

            'Report ID',

            'Location',

            'District',

            'Hazard',

            'Reporter',

            'Status',

            'Submitted'

        ]



        const rows = filteredReports.map((report) => [

            report?._id,

            getLocation(report),

            report?.district

                || report?.location?.district

                || '',

            titleCase(report?.hazardType),

            getReporterName(report),

            report?.status,

            formatDate(

                report?.submittedAt

                || report?.createdAt

            )

        ])



        const csvContent = [

            headers,

            ...rows

        ]

            .map((row) =>

                row.map(escapeCsvValue).join(',')

            )

            .join('\n')



        const blob = new Blob(

            [csvContent],

            {

                type: 'text/csv;charset=utf-8;'

            }

        )



        const url = URL.createObjectURL(blob)

        const link = document.createElement('a')



        link.href = url

        link.download = 'safezone-reports.csv'



        document.body.appendChild(link)

        link.click()

        document.body.removeChild(link)



        URL.revokeObjectURL(url)

    }



    return (

        <main className="mx-auto max-w-7xl px-5 pb-12 pt-8 sm:px-8 lg:pt-10">



            {/* Page heading */}

            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

                <div>

                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">

                        Report management

                    </p>



                    <h1 className="mt-2 text-3xl font-bold text-slate-900">

                        Report History

                    </h1>



                    <p className="mt-2 max-w-2xl text-slate-600">

                        Citizen hazard reports submitted for Duty Officer review.

                    </p>

                </div>



                <button

                    type="button"

                    onClick={handleRefresh}

                    disabled={refreshing}

                    className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 sm:self-auto"

                >

                    <RefreshCw

                        size={16}

                        className={

                            refreshing

                                ? 'animate-spin'

                                : ''

                        }

                    />



                    {refreshing

                        ? 'Refreshing...'

                        : 'Refresh'}

                </button>

            </header>



            {/* Error */}

            {error && (

                <section

                    role="alert"

                    className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4"

                >

                    <div className="flex items-start gap-3">

                        <TriangleAlert

                            size={20}

                            className="mt-0.5 shrink-0 text-red-600"

                        />



                        <div>

                            <h2 className="font-semibold text-red-900">

                                Reports could not be loaded

                            </h2>



                            <p className="mt-1 text-sm text-red-800">

                                {error}

                            </p>

                        </div>

                    </div>

                </section>

            )}



            {/* Status filters */}

            <section

                aria-label="Report status filters"

                className="mt-8"

            >

                <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">

                    {Object.entries(statusLabels).map(

                        ([value, label]) => (

                            <button

                                key={value}

                                type="button"

                                onClick={() =>

                                    setSelectedStatus(value)

                                }

                                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${

                                    selectedStatus === value

                                        ? 'bg-blue-700 text-white shadow-sm'

                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'

                                }`}

                            >

                                {label}



                                <span

                                    className={`ml-2 ${

                                        selectedStatus === value

                                            ? 'text-blue-100'

                                            : 'text-slate-400'

                                    }`}

                                >

                                    {counts[value]}

                                </span>

                            </button>

                        )

                    )}

                </div>

                <button
                    type="button"
                    onClick={() => {
                        setShowArchived((current) => !current)
                        setSelectedStatus('all')
                        setSelectedDistrict('All districts')
                    }}
                    className={`mt-3 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                        showArchived
                            ? 'border-slate-800 bg-slate-800 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                    <Archive size={16} />
                    {showArchived ? 'Showing Archived' : 'Show Archived'}
                </button>

            </section>



            {/* Search + district + export */}

            <section className="mt-4">

                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">



                    <div className="flex flex-col gap-3 sm:flex-row">



                        {/* Search */}

                        <div className="relative w-full sm:w-[360px]">

                            <Search

                                size={17}

                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"

                            />



                            <input

                                type="search"

                                value={searchTerm}

                                onChange={(event) =>

                                    setSearchTerm(

                                        event.target.value

                                    )

                                }

                                placeholder="Search reports..."

                                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

                            />

                        </div>



                        {/* District */}

                        <div className="flex flex-col">

                            <label

                                htmlFor="district-filter"

                                className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500"

                            >

                                District

                            </label>



                            <select

                                id="district-filter"

                                value={selectedDistrict}

                                onChange={(event) =>

                                    setSelectedDistrict(

                                        event.target.value

                                    )

                                }

                                aria-label="Filter reports by district"

                                className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

                            >

                                {districts.map((district) => (

                                    <option

                                        key={district}

                                        value={district}

                                    >

                                        {district}

                                    </option>

                                ))}

                            </select>

                        </div>

                    </div>



                    {/* Export */}

                    <button

                        type="button"

                        onClick={handleExportCsv}

                        disabled={filteredReports.length === 0}

                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"

                    >

                        <Download size={16} />

                        Export CSV

                    </button>

                </div>

            </section>



            {/* Result count */}

            <div className="mt-5 text-sm text-slate-500">

                Showing{' '}

                <span className="font-semibold text-slate-700">

                    {filteredReports.length}

                </span>{' '}

                {showArchived
                    ? filteredReports.length === 1
                        ? 'archived report'
                        : 'archived reports'
                    : filteredReports.length === 1
                        ? 'report'
                        : 'reports'}



                {selectedDistrict !== 'All districts' && (

                    <>

                        {' '}in{' '}

                        <span className="font-semibold text-slate-700">

                            {selectedDistrict}

                        </span>

                    </>

                )}

            </div>



            {/* Loading */}

            {loading ? (

                <section className="mt-3 space-y-3">

                    {[1, 2, 3, 4].map((item) => (

                        <div

                            key={item}

                            className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white"

                        />

                    ))}

                </section>

            ) : filteredReports.length === 0 ? (

                <section className="mt-3 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">

                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-700">

                        <FileText size={26} />

                    </span>



                    <h2 className="mt-5 text-lg font-semibold text-slate-900">

                        No reports found

                    </h2>



                    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">

                        {showArchived
                            ? 'There are no archived reports matching the current filters.'
                            : 'There are no active citizen hazard reports matching the current filters.'}

                    </p>

                </section>

            ) : (

                <section className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">



                    {/* Desktop table */}

                    <div className="hidden overflow-x-auto lg:block">

                        <table className="w-full border-collapse">

                            <thead>

                                <tr className="border-b border-slate-200 bg-slate-50/80 text-left">

                                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">

                                        Report

                                    </th>



                                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">

                                        Location

                                    </th>



                                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">

                                        Hazard

                                    </th>



                                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">

                                        Reporter

                                    </th>



                                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">

                                        Submitted

                                    </th>



                                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">

                                        Status

                                    </th>



                                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">

                                        Action

                                    </th>

                                </tr>

                            </thead>



                            <tbody>

                                {filteredReports.map((report) => {

                                    const status = String(

                                        report?.status || 'pending'

                                    ).toLowerCase()



                                    const StatusIcon =

                                        statusIcon[status]

                                        || Clock3



                                    const photoUrl =

                                        getPhotoUrl(report)



                                    return (

                                        <tr

                                            key={report?._id}

                                            className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"

                                        >

                                            <td className="px-5 py-4">

                                                <div className="flex items-center gap-3">

                                                    {photoUrl ? (

                                                        <img

                                                            src={photoUrl}

                                                            alt=""

                                                            className="h-11 w-11 rounded-lg object-cover"

                                                        />

                                                    ) : (

                                                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700">

                                                            <FileText size={18} />

                                                        </span>

                                                    )}



                                                    <div className="min-w-0">

                                                        <p className="max-w-[150px] truncate font-semibold text-slate-900">

                                                            {String(

                                                                report?._id || ''

                                                            ).slice(-8)}

                                                        </p>



                                                        <p className="text-xs text-slate-500">

                                                            Citizen report

                                                        </p>

                                                    </div>

                                                </div>

                                            </td>



                                            <td className="px-5 py-4">

                                                <div className="max-w-[220px]">

                                                    <p className="font-medium text-slate-800">

                                                        {getLocation(report)}

                                                    </p>



                                                    {getCoordinates(report?.location) && (

                                                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">

                                                            <MapPin size={12} />



                                                            {getCoordinates(

                                                                report?.location

                                                            )}

                                                        </p>

                                                    )}



                                                    {(report?.district

                                                        || report?.location?.district) && (

                                                        <p className="mt-1 text-xs font-medium text-blue-700">

                                                            District:{' '}

                                                            {report?.district

                                                                || report?.location?.district}

                                                        </p>

                                                    )}

                                                </div>

                                            </td>



                                            <td className="px-5 py-4">

                                                <span className="font-medium text-slate-800">

                                                    {titleCase(

                                                        report?.hazardType

                                                    )}

                                                </span>

                                            </td>



                                            <td className="px-5 py-4">

                                                <span className="text-sm font-medium text-slate-800">

                                                    {getReporterName(report)}

                                                </span>

                                            </td>



                                            <td className="px-5 py-4">

                                                <span className="text-sm text-slate-600">

                                                    {formatDate(

                                                        report?.submittedAt

                                                        || report?.createdAt

                                                    )}

                                                </span>

                                            </td>



                                            <td className="px-5 py-4">

                                                <span

                                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${

                                                        statusClasses[status]

                                                        || statusClasses.pending

                                                    }`}

                                                >

                                                    <StatusIcon size={13} />

                                                    {titleCase(status)}

                                                </span>

                                            </td>



                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            navigate(
                                                                `/dutyofficer/reports/${report?._id}`
                                                            )
                                                        }
                                                        className="text-sm font-semibold text-blue-700 hover:text-blue-900"
                                                    >
                                                        Open
                                                    </button>

                                                    {!showArchived
                                                        && (status === 'verified'
                                                            || status === 'rejected') && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleArchive(report)}
                                                                title="Archive report"
                                                                aria-label="Archive report"
                                                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800"
                                                            >
                                                                <Archive size={16} />
                                                            </button>
                                                        )}
                                                </div>
                                            </td>

                                        </tr>

                                    )

                                })}

                            </tbody>

                        </table>

                    </div>



                    {/* Mobile cards */}

                    <div className="divide-y divide-slate-100 lg:hidden">

                        {filteredReports.map((report) => {

                            const status = String(

                                report?.status || 'pending'

                            ).toLowerCase()



                            const StatusIcon =

                                statusIcon[status]

                                || Clock3



                            const photoUrl =

                                getPhotoUrl(report)



                            return (

                                <article

                                    key={report?._id}

                                    className="p-4"

                                >

                                    <div className="flex gap-3">

                                        {photoUrl ? (

                                            <img

                                                src={photoUrl}

                                                alt=""

                                                className="h-16 w-16 shrink-0 rounded-xl object-cover"

                                            />

                                        ) : (

                                            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">

                                                <FileText size={22} />

                                            </span>

                                        )}



                                        <div className="min-w-0 flex-1">

                                            <div className="flex flex-wrap items-start justify-between gap-2">

                                                <div>

                                                    <p className="font-semibold text-slate-900">

                                                        {titleCase(

                                                            report?.hazardType

                                                        )}

                                                    </p>



                                                    <p className="mt-1 text-xs text-slate-500">

                                                        Report #

                                                        {String(

                                                            report?._id || ''

                                                        ).slice(-8)}

                                                    </p>

                                                </div>



                                                <span

                                                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${

                                                        statusClasses[status]

                                                        || statusClasses.pending

                                                    }`}

                                                >

                                                    <StatusIcon size={12} />

                                                    {titleCase(status)}

                                                </span>

                                            </div>



                                            <p className="mt-3 flex items-start gap-1.5 text-sm text-slate-700">

                                                <MapPin

                                                    size={15}

                                                    className="mt-0.5 shrink-0 text-slate-400"

                                                />



                                                {getLocation(report)}

                                            </p>



                                            {(

                                                report?.district

                                                || report?.location?.district

                                            ) && (

                                                <p className="mt-1 text-xs font-medium text-blue-700">

                                                    District:{' '}

                                                    {report?.district

                                                        || report?.location?.district}

                                                </p>

                                            )}



                                            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">

                                                <span>

                                                    Reporter:{' '}

                                                    {getReporterName(report)}

                                                </span>



                                                <span>

                                                    {formatDate(

                                                        report?.submittedAt

                                                        || report?.createdAt

                                                    )}

                                                </span>

                                            </div>

                                                <div className="mt-3 flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate(
                                            `/dutyofficer/reports/${report?._id}`
                                        )
                                    }
                                    className="text-sm font-semibold text-blue-700"
                                >
                                    Open report →
                                </button>

                                {!showArchived
                                    && (status === 'verified'
                                        || status === 'rejected') && (
                                        <button
                                            type="button"
                                            onClick={() => handleArchive(report)}
                                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"
                                        >
                                            <Archive size={15} />
                                            Archive
                                        </button>
                                    )}
                            </div>

                                        </div>

                                    </div>

                                </article>

                            )

                        })}

                    </div>

                </section>

            )}

        </main>

    )

}



export default DutyOfficerReportsPage