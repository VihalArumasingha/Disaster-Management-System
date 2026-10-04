import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, Plus, Users } from 'lucide-react'
import api from '../../../services/api'

const severityStyles = {
    advisory: 'bg-sky-50 text-sky-800',
    watch: 'bg-amber-50 text-amber-800',
    warning: 'bg-orange-50 text-orange-800',
    emergency: 'bg-red-50 text-red-800'
}

function WarningsPage() {
    const location = useLocation()
    const [warnings, setWarnings] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        api.get('/dmcofficer/warnings')
            .then(({ data }) => {
                if (active) setWarnings(data.warnings)
            })
            .catch((requestError) => {
                if (active) {
                    setError(
                        requestError.response?.data?.message
                        || 'Could not load warnings.'
                    )
                }
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
        }
    }, [])

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Public safety</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">Warnings</h1>
                    <p className="mt-2 text-slate-600">Review prepared warnings and their automatically selected citizen audience.</p>
                </div>
                <Link
                    to="/dmcofficer/warnings/create"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                >
                    <Plus size={17} /> Create Warning
                </Link>
            </div>

            {location.state?.created && (
                <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                    Warning created as a draft. No notification has been sent.
                </p>
            )}
            {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
            {loading ? (
                <p className="mt-8 text-sm text-slate-600">Loading warnings…</p>
            ) : warnings.length === 0 ? (
                <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <Bell className="mx-auto text-slate-400" size={30} />
                    <h2 className="mt-4 font-semibold text-slate-900">No warnings created yet</h2>
                    <p className="mt-2 text-sm text-slate-600">Create a warning and its selected target areas will determine the citizen audience.</p>
                </section>
            ) : (
                <section className="mt-8 space-y-4">
                    {warnings.map((warning) => (
                        <article key={warning._id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">{warning.title}</h2>
                                    <p className="mt-1 text-sm capitalize text-slate-600">{warning.hazardType} · {warning.status}</p>
                                </div>
                                <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${severityStyles[warning.severity] || 'bg-slate-100 text-slate-700'}`}>
                                    {warning.severity}
                                </span>
                            </div>
                            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{warning.message}</p>
                            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1.5"><Users size={14} /> {warning.recipientCount} citizens selected</span>
                                <span>Areas: {warning.targetAreaIds.map((area) => area.name).join(', ') || '—'}</span>
                                <span>{new Date(warning.createdAt).toLocaleString()}</span>
                            </div>
                        </article>
                    ))}
                </section>
            )}
            <p className="mt-7 text-xs leading-5 text-slate-500">
                Warnings are saved as drafts for now. SMS/push delivery is not configured and no notifications are sent from this page.
            </p>
        </main>
    )
}

export default WarningsPage
