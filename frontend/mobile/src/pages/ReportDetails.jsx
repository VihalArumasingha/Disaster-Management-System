import {

    ArrowLeft,

    Camera,

    CheckCircle2,

    Clock3,

    MapPin,

    XCircle

} from 'lucide-react'

import { useEffect, useState } from 'react'

import {


    Navigate,

    useNavigate,

    useParams

} from 'react-router-dom'

import { useAuth } from '../authContext'

import { CITIZEN_ROLE } from '../constants/roles'

import api from '../services/api'



const hazardLabels = {

    flood: 'Flood',

    landslide: 'Landslide',

    road_blockage: 'Road blockage',

    other: 'Other hazard'

}



const formatHazardType = (type) =>

    hazardLabels[type] ||

    String(type || 'Hazard').replaceAll('_', ' ')



const formatDate = (value) => {

    if (!value) return 'Date unavailable'



    const date = new Date(value)



    if (Number.isNaN(date.getTime())) {

        return 'Date unavailable'

    }



    return date.toLocaleString([], {

        dateStyle: 'medium',

        timeStyle: 'short'

    })

}



const statusConfig = {

    pending: {

        label: 'Pending review',

        icon: Clock3,

        iconBg: 'bg-amber-100 text-amber-700',

        badge: 'bg-amber-100 text-amber-800'

    },

    verified: {

        label: 'Verified',

        icon: CheckCircle2,

        iconBg: 'bg-emerald-100 text-emerald-700',

        badge: 'bg-emerald-100 text-emerald-800'

    },

    rejected: {

        label: 'Rejected',

        icon: XCircle,

        iconBg: 'bg-red-100 text-red-700',

        badge: 'bg-red-100 text-red-800'

    }

}



function ReportDetails() {

    const { reportId } = useParams()

    const { user, loading } = useAuth()

    const navigate = useNavigate()



    const [report, setReport] = useState(null)

    const [loadingReport, setLoadingReport] =

        useState(true)

    const [error, setError] = useState('')



    useEffect(() => {

        if (!user || user.role !== CITIZEN_ROLE || !reportId) {

            return

        }



        let active = true



        const loadReport = async () => {

            try {

                setLoadingReport(true)

                setError('')
                const { data } = await api.get('/citizen/hazard-reports')
                const reports = Array.isArray(data)
                    ? data
                    : data.reports || data.data || []
                const matchedReport = reports.find(
                    (item) => item._id === reportId
                )

                if (!matchedReport) {
                    throw new Error('This hazard report could not be found.')
                }

                if (active) {
                    setReport(matchedReport)
                }

            } catch (requestError) {

                if (active) {

                    setError(

                        requestError.response?.data?.message ||

                            'Could not load this report.'

                    )

                    setReport(null)

                }

            } finally {

                if (active) {

                    setLoadingReport(false)

                }

            }

        }



        loadReport()



        return () => {

            active = false

        }

    }, [user, reportId])



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



    if (loadingReport) {

        return (

            <div className="mx-auto min-h-screen w-full max-w-md bg-slate-50 px-5 py-10">

                <div className="h-6 w-28 animate-pulse rounded bg-slate-200" />

                <div className="mt-6 h-48 animate-pulse rounded-3xl bg-white" />

                <div className="mt-4 h-40 animate-pulse rounded-3xl bg-white" />

            </div>

        )

    }



    if (error || !report) {

        return (

            <div className="mx-auto min-h-screen w-full max-w-md bg-slate-50 px-5 py-8">

                <button

                    type="button"

                    onClick={() =>

                        navigate('/my-reports')

                    }

                    className="flex items-center gap-2 text-sm font-semibold text-slate-700"

                >

                    <ArrowLeft size={18} />

                    My Reports

                </button>



                <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 p-5">

                    <h1 className="font-bold text-red-900">

                        Report unavailable

                    </h1>



                    <p className="mt-2 text-sm leading-6 text-red-800">

                        {error ||

                            'This hazard report could not be found.'}

                    </p>

                </div>

            </div>

        )

    }



    const config =

        statusConfig[report.status] ||

        statusConfig.pending



    const StatusIcon = config.icon



    const [longitude, latitude] =

        report.location?.coordinates || []



    return (

        <div className="mx-auto min-h-screen w-full max-w-md bg-slate-50 pb-8 text-slate-900 shadow-xl">

            <header className="sticky top-0 z-20 flex h-[70px] items-center border-b border-slate-100 bg-white/95 px-5 backdrop-blur">

                <button

                    type="button"

                    onClick={() =>

                        navigate('/my-reports')

                    }

                    className="flex items-center gap-2 text-sm font-semibold text-slate-700"

                >

                    <ArrowLeft size={19} />

                    My Reports

                </button>

            </header>



            <main className="px-5 pb-8 pt-6">

                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">

                    Hazard report

                </p>



                <h1 className="mt-2 text-2xl font-bold leading-8 text-slate-950">

                    {formatHazardType(

                        report.hazardType

                    )}

                </h1>



                <div className="mt-4 flex items-center gap-2">

                    <span

                        className={`flex h-10 w-10 items-center justify-center rounded-full ${config.iconBg}`}

                    >

                        <StatusIcon size={21} />

                    </span>



                    <span

                        className={`rounded-full px-3 py-1.5 text-xs font-bold ${config.badge}`}

                    >

                        {config.label}

                    </span>

                </div>



                <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

                    <h2 className="text-base font-bold text-slate-950">

                        Description

                    </h2>



                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">

                        {report.description}

                    </p>

                </section>



                <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

                    <div className="flex items-center gap-2">

                        <MapPin

                            size={18}

                            className="text-teal-700"

                        />



                        <h2 className="text-base font-bold text-slate-950">

                            Location

                        </h2>

                    </div>



                    <p className="mt-2 text-sm text-slate-600">

                        Location captured with your report.

                    </p>



                    {latitude !== undefined &&

                        longitude !== undefined && (

                            <p className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">

                                Coordinates:{' '}

                                {latitude.toFixed(6)},{' '}

                                {longitude.toFixed(6)}

                            </p>

                        )}

                </section>



                {report.photo?.url && (

                    <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

                        <div className="flex items-center gap-2">

                            <Camera

                                size={18}

                                className="text-teal-700"

                            />



                            <h2 className="text-base font-bold text-slate-950">

                                Evidence photo

                            </h2>

                        </div>



                        <img

                            src={`${api.defaults.baseURL.replace(

                                /\/api$/,

                                ''

                            )}${report.photo.url}`}

                            alt="Hazard evidence"

                            className="mt-4 w-full rounded-2xl object-cover"

                        />

                    </section>

                )}



                <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">

                    <h2 className="text-base font-bold text-slate-950">

                        Report timeline

                    </h2>



                    <div className="mt-5 space-y-5">

                        <div className="flex gap-3">

                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">

                                <CheckCircle2 size={16} />

                            </span>



                            <div>

                                <p className="text-sm font-semibold text-slate-900">

                                    Report submitted

                                </p>



                                <p className="mt-1 text-xs text-slate-500">

                                    {formatDate(

                                        report.submittedAt ||

                                            report.createdAt

                                    )}

                                </p>

                            </div>

                        </div>



                        {report.status ===

                            'pending' && (

                            <div className="flex gap-3">

                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">

                                    <Clock3

                                        size={16}

                                    />

                                </span>



                                <div>

                                    <p className="text-sm font-semibold text-slate-900">

                                        Waiting for verification

                                    </p>



                                    <p className="mt-1 text-xs leading-5 text-slate-500">

                                        A Duty Officer will review your report.

                                    </p>

                                </div>

                            </div>

                        )}



                        {report.status ===

                            'verified' && (

                            <div className="flex gap-3">

                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">

                                    <CheckCircle2

                                        size={16}

                                    />

                                </span>



                                <div>

                                    <p className="text-sm font-semibold text-slate-900">

                                        Report verified

                                    </p>



                                    <p className="mt-1 text-xs text-slate-500">

                                        {formatDate(

                                            report.verification

                                                ?.verifiedAt

                                        )}

                                    </p>

                                </div>

                            </div>

                        )}



                        {report.status ===

                            'rejected' && (

                            <div className="flex gap-3">

                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">

                                    <XCircle

                                        size={16}

                                    />

                                </span>



                                <div className="min-w-0">

                                    <p className="text-sm font-semibold text-slate-900">

                                        Report rejected

                                    </p>



                                    <p className="mt-1 text-xs text-slate-500">

                                        {formatDate(

                                            report.verification

                                                ?.verifiedAt

                                        )}

                                    </p>



                                    {report.verification

                                        ?.rejectionReason && (

                                        <div className="mt-3 rounded-xl bg-red-50 p-3">

                                            <p className="text-xs font-bold uppercase tracking-wide text-red-800">

                                                Reason

                                            </p>



                                            <p className="mt-1 text-sm leading-5 text-red-900">

                                                {

                                                    report

                                                        .verification

                                                        .rejectionReason

                                                }

                                            </p>

                                        </div>

                                    )}

                                </div>

                            </div>

                        )}

                    </div>

                </section>

            </main>

        </div>

    )

}



export default ReportDetails
