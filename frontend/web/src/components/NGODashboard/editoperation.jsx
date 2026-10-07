import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

/**
 * Add / edit modal for a relief-distribution operation.
 * `initial` = null for create, or an operation object (with `id`) to edit.
 * Saves via POST/PUT /api/operations (writes require an NGO manager session).
 */
export default function OperationModal({ open, initial, onClose, onSaved }) {
    const isEdit = Boolean(initial?.id)

    /* fresh form state — the parent mounts this modal only while it is open */
    const [name, setName] = useState(initial?.name || '')
    const [location, setLocation] = useState(initial?.location || '')
    const [requiredVolunteers, setRequiredVolunteers] = useState(
        initial?.requiredVolunteers != null ? String(initial.requiredVolunteers) : ''
    )
    const [status, setStatus] = useState(
        initial?.status === 'ACTIVE' || initial?.status === 'COMPLETED' ? initial.status : 'PENDING'
    )
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState('')

    if (!open) return null

    const submit = async (e) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed) {
            setErr('Operation name is required.')
            return
        }
        const count = requiredVolunteers === '' ? 0 : Number(requiredVolunteers)
        if (!Number.isFinite(count) || count < 0) {
            setErr('Required volunteer count must be 0 or more.')
            return
        }

        setSaving(true)
        setErr('')
        try {
            const res = await fetch(
                isEdit
                    ? `${API_BASE}/api/operations/${initial.id}`
                    : `${API_BASE}/api/operations`,
                {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        name: trimmed,
                        location: location.trim(),
                        requiredVolunteers: Math.floor(count),
                        status
                    })
                }
            )
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || 'Failed to save operation.')
            onSaved?.(data.operation)
            onClose?.()
        } catch (e2) {
            setErr(e2.message || 'Failed to save operation.')
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
            aria-label={isEdit ? 'Edit operation' : 'New operation'}
        >
            <form
                onSubmit={submit}
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
                <div className="mb-5 flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">
                            {isEdit ? 'Edit Operation' : 'New Volunteer Operation'}
                        </h2>
                        <p className="text-xs text-slate-500">
                            {isEdit
                                ? 'Update the operation details below.'
                                : 'Create a field operation and its volunteer need.'}
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
                        <label htmlFor="op-name" className="mb-1 block text-xs font-semibold text-slate-600">
                            Operation Name *
                        </label>
                        <input
                            id="op-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Flood Relief Operations"
                            className={fieldClass}
                            autoFocus
                        />
                    </div>

                    <div>
                        <label htmlFor="op-location" className="mb-1 block text-xs font-semibold text-slate-600">
                            Location
                        </label>
                        <input
                            id="op-location"
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g. Kelani Valley"
                            className={fieldClass}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="op-count" className="mb-1 block text-xs font-semibold text-slate-600">
                                Required Volunteers *
                            </label>
                            <input
                                id="op-count"
                                type="number"
                                min="0"
                                step="1"
                                value={requiredVolunteers}
                                onChange={(e) => setRequiredVolunteers(e.target.value)}
                                placeholder="0"
                                className={fieldClass}
                            />
                        </div>
                        <div>
                            <label htmlFor="op-status" className="mb-1 block text-xs font-semibold text-slate-600">
                                Status
                            </label>
                            <select
                                id="op-status"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className={fieldClass}
                            >
                                <option value="PENDING">Pending</option>
                                <option value="ACTIVE">Active</option>
                                <option value="COMPLETED">Completed</option>
                            </select>
                        </div>
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
                        {isEdit ? 'Save Changes' : 'Create Operation'}
                    </button>
                </div>
            </form>
        </div>
    )
}
