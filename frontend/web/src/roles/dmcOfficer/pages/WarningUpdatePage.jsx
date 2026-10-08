import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send, Users } from 'lucide-react'
import api from '../../../services/api'

const severityOptions = ['Low', 'Medium', 'High', 'Critical']

function WarningUpdatePage() {
    const { warningId } = useParams()
    const navigate = useNavigate()
    const [warning, setWarning] = useState(null)
    const [areas, setAreas] = useState([])
    const [form, setForm] = useState({ title: '', message: '', severity: '', targetAreaIds: [] })
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        Promise.all([
            api.get(`/dmcofficer/warnings/${warningId}/review`),
            api.get('/dmcofficer/target-areas')
        ])
            .then(([warningResponse, areasResponse]) => {
                if (!active) return
                if (
                    warningResponse.data.warning.resolvedAt
                    || !['issued', 'partially_issued', 'delivery_failed'].includes(warningResponse.data.warning.status)
                ) {
                    setError('Only an active issued warning can receive updates.')
                    return
                }
                setWarning(warningResponse.data.warning)
                setAreas(areasResponse.data.targetAreas.filter((area) => (
                    !warningResponse.data.warning.targetAreaIds.some((selected) => selected._id === area._id)
                )))
            })
            .catch((requestError) => {
                if (active) {
                    setError(requestError.response?.data?.message || 'Could not load warning details.')
                }
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
        }
    }, [warningId])

    const toggleArea = (areaId) => {
        setForm((current) => ({
            ...current,
            targetAreaIds: current.targetAreaIds.includes(areaId)
                ? current.targetAreaIds.filter((id) => id !== areaId)
                : [...current.targetAreaIds, areaId]
        }))
    }

    const submitUpdate = async (event) => {
        event.preventDefault()
        setError('')
        setSubmitting(true)
        try {
            await api.post(`/dmcofficer/warnings/${warningId}/updates`, form)
            navigate('/dmcofficer/warnings', {
                replace: true,
                state: { warningUpdated: true }
            })
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not post this warning update.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <main className="mx-auto max-w-3xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <Link to="/dmcofficer/warnings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700">
                <ArrowLeft size={16} /> Warnings
            </Link>
            <div className="mt-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Public safety</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Post Warning Update</h1>
                {warning && <p className="mt-2 text-slate-600">{warning.title}</p>}
            </div>
            {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
            {loading ? (
                <p className="mt-6 text-sm text-slate-600">Loading warning details…</p>
            ) : warning && (
                <form onSubmit={submitUpdate} className="mt-7 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <label className="block text-sm font-semibold text-slate-800">
                        Update headline <span className="text-red-600">*</span>
                        <input
                            required
                            maxLength={120}
                            value={form.title}
                            onChange={(event) => setForm({ ...form, title: event.target.value })}
                            placeholder="e.g. Affected area expanded"
                            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <label className="block text-sm font-semibold text-slate-800">
                        Update details <span className="text-red-600">*</span>
                        <textarea
                            required
                            rows={4}
                            maxLength={2000}
                            value={form.message}
                            onChange={(event) => setForm({ ...form, message: event.target.value })}
                            placeholder="Share the latest verified information and what has changed."
                            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <label className="block text-sm font-semibold text-slate-800">
                        Change severity (optional)
                        <select
                            value={form.severity}
                            onChange={(event) => setForm({ ...form, severity: event.target.value })}
                            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal capitalize"
                        >
                            <option value="">Keep current: {warning.severity}</option>
                            {severityOptions.map((severity) => (
                                <option key={severity} value={severity}>{severity}</option>
                            ))}
                        </select>
                    </label>

                    <fieldset>
                        <legend className="text-sm font-semibold text-slate-800">Add affected areas (optional)</legend>
                        <p className="mt-1 text-xs text-slate-500">
                            Citizens in newly added areas will receive this update as a warning notification.
                        </p>
                        {areas.length === 0 ? (
                            <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                                All available target areas are already included.
                            </p>
                        ) : (
                            <div className="mt-3 space-y-2">
                                {areas.map((area) => (
                                    <label key={area._id} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
                                        <span className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={form.targetAreaIds.includes(area._id)}
                                                onChange={() => toggleArea(area._id)}
                                                className="mt-1 accent-blue-700"
                                            />
                                            <span>
                                                <span className="block text-sm font-semibold text-slate-900">{area.name}</span>
                                                <span className="mt-1 block text-xs capitalize text-slate-500">{area.hazardTypes?.join(', ')}</span>
                                            </span>
                                        </span>
                                        <span className="shrink-0 inline-flex items-center gap-1 text-xs text-slate-600">
                                            <Users size={13} /> {area.citizenCount || 0}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </fieldset>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
                    >
                        <Send size={16} />
                        {submitting ? 'Posting update…' : 'Post update'}
                    </button>
                </form>
            )}
        </main>
    )
}

export default WarningUpdatePage
