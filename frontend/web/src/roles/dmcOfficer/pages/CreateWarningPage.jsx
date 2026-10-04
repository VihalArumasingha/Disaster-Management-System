import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import api from '../../../services/api'

const hazardOptions = ['flood', 'landslide', 'tsunami', 'storm', 'other']
const severityOptions = ['advisory', 'watch', 'warning', 'emergency']

function CreateWarningPage() {
    const navigate = useNavigate()
    const [areas, setAreas] = useState([])
    const [form, setForm] = useState({
        title: '',
        severity: 'warning',
        hazardType: 'flood',
        message: ''
    })
    const [targetAreaIds, setTargetAreaIds] = useState([])
    const [recipientCount, setRecipientCount] = useState(null)
    const [loadingAreas, setLoadingAreas] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        api.get('/dmcofficer/target-areas')
            .then(({ data }) => {
                if (active) setAreas(data.targetAreas)
            })
            .catch((requestError) => {
                if (active) {
                    setError(
                        requestError.response?.data?.message
                        || 'Could not load target areas.'
                    )
                }
            })
            .finally(() => {
                if (active) setLoadingAreas(false)
            })
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        if (targetAreaIds.length === 0) return undefined

        let active = true
        const timer = setTimeout(() => {
            api.post('/dmcofficer/warnings/preview', { targetAreaIds })
                .then(({ data }) => {
                    if (active) setRecipientCount(data.recipientCount)
                })
                .catch((requestError) => {
                    if (active) {
                        setRecipientCount(null)
                        setError(
                            requestError.response?.data?.message
                            || 'Could not estimate warning recipients.'
                        )
                    }
                })
        }, 250)

        return () => {
            active = false
            clearTimeout(timer)
        }
    }, [targetAreaIds])

    const toggleArea = (areaId) => {
        setError('')
        setRecipientCount(null)
        setTargetAreaIds((current) => (
            current.includes(areaId)
                ? current.filter((id) => id !== areaId)
                : [...current, areaId]
        ))
    }

    const submitWarning = async (event) => {
        event.preventDefault()
        setError('')
        if (targetAreaIds.length === 0) {
            setError('Select at least one target area.')
            return
        }

        setSubmitting(true)
        try {
            await api.post('/dmcofficer/warnings', {
                ...form,
                targetAreaIds
            })
            navigate('/dmcofficer/warnings', {
                replace: true,
                state: { created: true }
            })
        } catch (requestError) {
            setError(
                requestError.response?.data?.message
                || 'Could not create the warning. Please try again.'
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <main className="mx-auto max-w-4xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <Link to="/dmcofficer/warnings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700">
                <ArrowLeft size={16} /> Warnings
            </Link>
            <div className="mt-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Public safety</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Create Warning</h1>
                <p className="mt-2 text-slate-600">Choose target areas to automatically select the citizens with locations in those boundaries.</p>
            </div>
            {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}

            <form onSubmit={submitWarning} className="mt-7 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <label className="block text-sm font-semibold text-slate-800">
                    Warning Title <span className="text-red-600">*</span>
                    <input
                        required
                        maxLength={160}
                        value={form.title}
                        onChange={(event) => setForm({ ...form, title: event.target.value })}
                        placeholder="e.g. Flood risk near Galani River"
                        className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    />
                </label>

                <div className="grid gap-5 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-800">
                        Severity <span className="text-red-600">*</span>
                        <select
                            value={form.severity}
                            onChange={(event) => setForm({ ...form, severity: event.target.value })}
                            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal capitalize"
                        >
                            {severityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                    </label>
                    <label className="block text-sm font-semibold text-slate-800">
                        Hazard Type <span className="text-red-600">*</span>
                        <select
                            value={form.hazardType}
                            onChange={(event) => setForm({ ...form, hazardType: event.target.value })}
                            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal capitalize"
                        >
                            {hazardOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                    </label>
                </div>

                <label className="block text-sm font-semibold text-slate-800">
                    Warning Message <span className="text-red-600">*</span>
                    <textarea
                        required
                        rows={5}
                        maxLength={4000}
                        value={form.message}
                        onChange={(event) => setForm({ ...form, message: event.target.value })}
                        placeholder="Provide clear instructions and safety guidance."
                        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    />
                </label>

                <fieldset>
                    <legend className="text-sm font-semibold text-slate-800">
                        Target Areas <span className="text-red-600">*</span>
                    </legend>
                    {loadingAreas ? (
                        <p className="mt-3 text-sm text-slate-600">Loading target areas…</p>
                    ) : areas.length === 0 ? (
                        <div className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                            Create a target area before creating a warning.
                            <Link to="/dmcofficer/target-areas/create" className="ml-1 font-semibold underline">Create target area</Link>
                        </div>
                    ) : (
                        <div className="mt-3 space-y-2">
                            {areas.map((area) => (
                                <label key={area._id} className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 hover:bg-slate-50">
                                    <span className="flex items-start gap-3">
                                        <input
                                            type="checkbox"
                                            checked={targetAreaIds.includes(area._id)}
                                            onChange={() => toggleArea(area._id)}
                                            className="mt-1 accent-blue-700"
                                        />
                                        <span>
                                            <span className="block text-sm font-semibold text-slate-900">{area.name}</span>
                                            <span className="mt-1 block text-xs capitalize text-slate-500">{area.hazardTypes.join(', ')}</span>
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-xs font-medium text-slate-600">{area.citizenCount} citizens</span>
                                </label>
                            ))}
                        </div>
                    )}
                </fieldset>

                <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4">
                    <Users size={21} className="shrink-0 text-blue-700" />
                    <div>
                        <p className="text-xs font-medium text-slate-600">Automatically selected recipients</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                            {targetAreaIds.length === 0
                                ? 'Select target areas'
                                : recipientCount === null
                                    ? 'Calculating…'
                                    : `${recipientCount} citizens`}
                        </p>
                    </div>
                </div>
                <p className="text-xs leading-5 text-slate-500">
                    Only current citizen-role accounts are included. This saves a draft; notifications are not sent.
                </p>

                <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row">
                    <Link
                        to="/dmcofficer/warnings"
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={submitting || loadingAreas || areas.length === 0}
                        className="min-h-11 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? 'Saving…' : 'Save Warning Draft'}
                    </button>
                </div>
            </form>
        </main>
    )
}

export default CreateWarningPage
