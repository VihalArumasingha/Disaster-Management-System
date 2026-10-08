import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const ITEM_OPTIONS = [
    { value: 'dry_rations', label: 'Dry rations', unit: 'packs' },
    { value: 'water', label: 'Water', unit: 'liters' },
    { value: 'bedding', label: 'Bedding', unit: 'sets' },
    { value: 'medical', label: 'Medical kits', unit: 'kits' },
    { value: 'clothing', label: 'Clothing', unit: 'sets' },
    { value: 'hygiene', label: 'Hygiene packs', unit: 'packs' }
]

const toISODate = (value) => {
    if (!value) return ''
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

const toFormState = (item) => ({
    item: item?.item ?? '',
    quantity: item?.quantity ?? '',
    unit: item?.unit ?? '',
    center: item?.center ?? '',
    date: toISODate(item?.date) || toISODate(item?.createdAt),
    notes: item?.notes ?? ''
})

/* ── small labelled input ─────────────────────────────────────────────────── */
function Field({ label, required, error, children }) {
    return (
        <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                {label}
                {required && <span className="ml-0.5 text-red-500">*</span>}
            </label>
            {children}
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    )
}

const inputClass = (error) =>
    `w-full rounded-xl border ${error ? 'border-red-400' : 'border-slate-300'} bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`

/**
 * "Edit Inventory Item" modal — PUT /api/inventory/:itemId.
 * props:
 *   item    — existing inventory row to edit
 *   centers — collecting centers (options for the Collection Center select)
 *   onClose — cancel callback
 *   onSaved — called with the updated item after a successful PUT
 */
export default function EditInventoryItem({ item, centers = [], onClose, onSaved }) {
    const [form, setForm] = useState(() => toFormState(item))
    const [saving, setSaving] = useState(false)
    const [serverError, setServerError] = useState('')
    const [errors, setErrors] = useState({})

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

    const validate = () => {
        const next = {}
        if (!form.item) next.item = 'Item type is required'
        const qty = Number(form.quantity)
        if (form.quantity === '' || Number.isNaN(qty) || qty < 0) next.quantity = 'Enter a valid quantity'
        if (!form.unit.trim()) next.unit = 'Unit is required'
        if (!form.center.trim()) next.center = 'Collection center is required'
        setErrors(next)
        return Object.keys(next).length === 0
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setServerError('')
        if (!validate()) return

        setSaving(true)
        try {
            const res = await fetch(`${API_BASE}/api/inventory/${item._id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item: form.item,
                    quantity: Number(form.quantity),
                    unit: form.unit.trim(),
                    center: form.center.trim(),
                    date: form.date || undefined,
                    notes: form.notes.trim()
                })
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.message || `Server error ${res.status}`)
            onSaved(data.data)
        } catch (err) {
            setServerError(err.message || 'Could not save the changes. Please try again.')
            setSaving(false)
        }
    }

    const selectedUnit = ITEM_OPTIONS.find((opt) => opt.value === form.item)?.unit || 'units'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
                {/* ── Header ── */}
                <div className="relative bg-gradient-to-r from-violet-600 to-indigo-700 px-6 py-5 text-white">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-4 top-4 rounded-full p-1.5 text-white/80 hover:bg-white/15 hover:text-white"
                    >
                        <X size={18} />
                    </button>
                    <h2 className="text-2xl font-bold">✏️ Edit Inventory Item</h2>
                    <p className="mt-1 text-sm text-white/80">Update inventory item details</p>
                </div>

                {/* ── Form ── */}
                <form onSubmit={handleSubmit} noValidate className="max-h-[70vh] overflow-y-auto px-6 py-5">
                    {serverError && (
                        <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                            {serverError}
                        </p>
                    )}

                    <div className="space-y-4">
                        <Field label="Item Type" required error={errors.item}>
                            <select value={form.item} onChange={set('item')} className={inputClass(errors.item)}>
                                <option value="">Select item type</option>
                                {ITEM_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </Field>

                        <Field label="Quantity" required error={errors.quantity}>
                            <input
                                type="number"
                                min="0"
                                value={form.quantity}
                                onChange={set('quantity')}
                                placeholder="e.g. 150"
                                className={inputClass(errors.quantity)}
                            />
                        </Field>

                        <Field label="Unit" required error={errors.unit}>
                            <input
                                type="text"
                                value={form.unit}
                                onChange={set('unit')}
                                placeholder={`e.g. ${selectedUnit}`}
                                className={inputClass(errors.unit)}
                            />
                        </Field>

                        <Field label="Collection Center" required error={errors.center}>
                            <select value={form.center} onChange={set('center')} className={inputClass(errors.center)}>
                                <option value="">Select center</option>
                                {centers.map((c) => (
                                    <option key={c._id || c.name} value={c.name}>{c.name}</option>
                                ))}
                                {form.center && !centers.some((c) => c.name === form.center) && (
                                    <option value={form.center}>{form.center}</option>
                                )}
                            </select>
                        </Field>

                        <Field label="Date">
                            <input type="date" value={form.date} onChange={set('date')} className={inputClass(false)} />
                        </Field>

                        <Field label="Notes">
                            <textarea
                                rows={3}
                                value={form.notes}
                                onChange={set('notes')}
                                placeholder="Additional notes about this inventory item..."
                                className={`${inputClass(false)} resize-y`}
                            />
                        </Field>
                    </div>

                    {/* ── Footer ── */}
                    <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                        >
                            {saving ? <Loader2 size={15} className="animate-spin" /> : '💾'}
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

