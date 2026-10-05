import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BellRing, Users } from 'lucide-react'
import api from '../../../services/api'
import TargetAreaMap from '../components/TargetAreaMap'

const severityStyles = {
    advisory: 'bg-sky-50 text-sky-800',
    watch: 'bg-amber-50 text-amber-800',
    warning: 'bg-orange-50 text-orange-800',
    emergency: 'bg-red-50 text-red-800'
}

function ReviewWarningPage() {
    const { warningId } = useParams()
    const navigate = useNavigate()
    const [review, setReview] = useState(null)
    const [confirmed, setConfirmed] = useState(false)
    const [issuing, setIssuing] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        api.get(`/dmcofficer/warnings/${warningId}/review`)
            .then(({ data }) => {
                if (active) setReview(data)
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || 'Could not load warning review.')
            })
        return () => {
            active = false
        }
    }, [warningId])

    const overlays = useMemo(() => {
        const targetAreas = review?.warning.targetAreaIds || []
        const counts = new Map()
        targetAreas.forEach((area) => {
            const current = counts.get(area._id) || { area, count: 0 }
            current.count += 1
            counts.set(area._id, current)
        })
        return [...counts.values()].map(({ area, count }) => ({
            geometry: area.geometry,
            name: area.name,
            count
        }))
    }, [review])

    const issue = async () => {
        setError('')
        setIssuing(true)
        try {
            const { data } = await api.post(`/dmcofficer/warnings/${warningId}/issue`)
            navigate('/dmcofficer/warnings', {
                replace: true,
                state: {
                    issuanceStarted: true,
                    warningId: data.warning._id,
                    deliverySummary: data.deliverySummary
                }
            })
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not issue warning.')
        } finally {
            setIssuing(false)
        }
    }

    if (error && !review) {
        return (
            <main className="mx-auto max-w-4xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
                <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>
                <Link to="/dmcofficer/warnings" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                    <ArrowLeft size={16} /> Back to warnings
                </Link>
            </main>
        )
    }

    if (!review) {
        return <main className="px-5 py-20 text-center text-slate-600">Loading final warning review…</main>
    }

    const { warning, deliveryAudience } = review
    const warningResolved = Boolean(warning.resolvedAt)

    return (
        <main className="mx-auto max-w-5xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <Link to="/dmcofficer/warnings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700">
                <ArrowLeft size={16} /> Warnings
            </Link>
            <div className="mt-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Final check</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Review Warning Before Issue</h1>
                <p className="mt-2 text-slate-600">This review is read-only. Check the full warning and affected audience before sending.</p>
            </div>

            {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}

            <article className="mt-7 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">{warning.title}</h2>
                        <p className="mt-2 text-sm capitalize text-slate-600">{warning.hazardType} hazard · {warning.severity} severity</p>
                    </div>
                    <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${severityStyles[warning.severity]}`}>
                        {warning.severity}
                    </span>
                </header>

                <section>
                    <h3 className="text-sm font-semibold text-slate-800">Full warning message</h3>
                    <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{warning.message}</p>
                </section>

                <section>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-800">Selected target areas</h3>
                        <span className="text-xs text-slate-500">{warning.targetAreaIds.length} area selection(s)</span>
                    </div>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                        {warning.targetAreaIds.map((area, index) => (
                            <li key={`${area._id}-${index}`} className="rounded-lg border border-slate-200 p-3">
                                <p className="text-sm font-semibold text-slate-900">{area.name}</p>
                                <p className="mt-1 text-xs capitalize text-slate-500">{area.areaType} · {area.hazardTypes.join(', ')}</p>
                            </li>
                        ))}
                    </ul>
                    {overlays.length > 0 && (
                        <div className="mt-4">
                            <TargetAreaMap overlays={overlays} height="380px" />
                        </div>
                    )}
                </section>

                <section className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-blue-950"><Users size={17} /> Current delivery audience</h3>
                    <p className="mt-2 text-sm leading-6 text-blue-900">
                        {deliveryAudience.recipients} current citizen-role account(s) will receive an in-app alert and an SMS attempt.
                        If either primary channel fails, an email fallback will be attempted.
                    </p>
                    <p className="mt-1 text-xs text-blue-800">
                        SMS contacts available: {deliveryAudience.smsRecipients} · Email fallback contacts available: {deliveryAudience.emailFallbackRecipients}
                    </p>
                </section>

                <dl className="grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-slate-500">Prepared by</dt><dd className="mt-1 font-medium text-slate-800">{warning.createdBy?.name || 'DMC Officer'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Created</dt><dd className="mt-1 font-medium text-slate-800">{new Date(warning.createdAt).toLocaleString()}</dd></div>
                    <div><dt className="text-xs text-slate-500">Draft status</dt><dd className="mt-1 font-medium capitalize text-slate-800">{warning.status}</dd></div>
                </dl>

                {warningResolved && (
                    <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                        This warning was resolved by {warning.resolvedBy?.name || 'a DMC officer'} and cannot be issued again.
                    </p>
                )}
                <label className="flex items-start gap-3 border-t border-slate-100 pt-5 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                        disabled={warningResolved}
                        className="mt-1 accent-blue-700"
                    />
                    <span>I have reviewed the warning details and audience. Issue this warning and attempt the listed notifications.</span>
                </label>
                <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
                    {!warningResolved && warning.status === 'draft' && (
                        <Link to={`/dmcofficer/warnings/${warningId}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">
                            Edit Draft
                        </Link>
                    )}
                    <button
                        type="button"
                        onClick={issue}
                        disabled={warningResolved || !['draft', 'partially_issued', 'delivery_failed'].includes(warning.status) || !confirmed || issuing || deliveryAudience.recipients === 0}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-700 px-5 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <BellRing size={16} /> {issuing ? 'Issuing…' : warningResolved ? 'Warning Resolved' : 'Confirm and Issue Warning'}
                    </button>
                </div>
                {deliveryAudience.recipients === 0 && (
                    <p className="text-sm text-amber-800">No eligible citizen accounts are currently matched to these target areas.</p>
                )}
            </article>
        </main>
    )
}

export default ReviewWarningPage
