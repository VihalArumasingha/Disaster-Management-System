import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

/**
 * "Track Distribution Quantities" modal — add or edit one distribution record
 * (date + families assisted + resources distributed).
 * Saves via POST/PUT /api/distributionrecords (writes need an NGO session).
 */
export default function DistributionRecordModal({ open, initial, onClose, onSaved }) {
    const isEdit = Boolean(initial?.id)

    /* fresh form state — the parent mounts this modal only while it is open */
    const [date, setDate] = useState(initial?.date || new Date().toISOString().slice(0, 10))
    const [familiesAssisted, setFamiliesAssisted] = useState(
        initial?.familiesAssisted != null ? String(initial.familiesAssisted) : ''
    )
    const [resourcesDistributed, setResourcesDistributed] = useState(
        initial?.resourcesDistributed != null ? String(initial.resourcesDistributed) : ''
    )
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')

    if (!open) return null

    const submit = async (e) => {
        e.preventDefault()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            setErr('Please choose a valid date.')
            return
        }
        const families = Number(familiesAssisted)
        const resources = Number(resourcesDistributed)
        if (!Number.isFinite(families) || families < 0) {
            setErr('Families assisted must be 0 or more.')
            return
        }
        if (!Number.isFinite(resources) || resources < 0) {
            setErr('Resources distributed must be 0 or more.')
            return
        }

        setSaving(true)
        setErr('')
        try {
            const res = await fetch(
                isEdit
                    ? `${API_BASE}/api/distributionrecords/${initial.id}`
                    : `${API_BASE}/api/distributionrecords`,
                {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        date,
                        familiesAssisted: Math.floor(families),
                        resourcesDistributed: Math.floor(resources)
                    })
                }
            )
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || 'Failed to save the record.')
            onSaved?.(data.record)
            onClose?.()
        } catch (e2) {
            setErr(e2.message || 'Failed to save the record.')
        } finally {
            setSaving(false)
        }
    }

    const fieldClass =
        'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20'

    return (
        <div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Track distribution quantities"
        >
            <form
                onSubmit={submit}
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
                <div className="mb-5 flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">
                            {isEdit ? 'Edit Distribution Record' : 'Track Distribution Quantities'}
                        </h2>
                        <p className="text-xs text-slate-500">
                            Record what was handed out on a given date.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="dr-date" className="mb-1 block text-xs font-semibold text-slate-600">
                            Date *
                        </label>
                        <input
                            id="dr-date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className={fieldClass}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label htmlFor="dr-families" className="mb-1 block text-xs font-semibold text-slate-600">
                            Families Assisted *
                        </label>
                        <input
                            id="dr-families"
                            type="number"
                            min="0"
                            step="1"
                            value={familiesAssisted}
                            onChange={(e) => setFamiliesAssisted(e.target.value)}
                            placeholder="0"
                            className={fieldClass}
                        />
                    </div>

                    <div>
                        <label htmlFor="dr-resources" className="mb-1 block text-xs font-semibold text-slate-600">
                            Resources Distributed *
                        </label>
                        <input
                            id="dr-resources"
                            type="number"
                            min="0"
                            step="1"
                            value={resourcesDistributed}
                            onChange={(e) => setResourcesDistributed(e.target.value)}
                            placeholder="0"
                            className={fieldClass}
                        />
                    </div>
                </div>

                {err && (
                    <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                        {err}
                    </p>
                )}

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                        {saving && <Loader2 size={15} className="animate-spin" />}
                        {isEdit ? 'Save Changes' : 'Save Record'}
                    </button>
                </div>
            </form>
        </div>
    )
}
