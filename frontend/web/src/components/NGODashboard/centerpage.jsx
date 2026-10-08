import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const CATEGORY_OPTIONS = ['Food', 'Medical', 'Clothing', 'Shelter', 'Water']

const EMPTY_FORM = {
    name: '',
    phone: '',
    address: '',
    city: '',
    openingHours: '',
    latitude: '',
    longitude: '',
    categories: []
}

/* ── small labelled input ─────────────────────────────────────────────────── */
function Field({ label, required, error, children }) {
    return (
        <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {label}{required && ' *'}
            </label>
            {children}
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>
    )
}

const inputClass = (error) =>
    `w-full rounded-xl border ${error ? 'border-red-400' : 'border-slate-300'} bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20`

const toFormState = (center) => (
    center
        ? {
            name: center.name ?? '',
            phone: center.phone ?? '',
            address: center.address ?? '',
            city: center.city ?? '',
            openingHours: center.openingHours ?? '',
            latitude: center.latitude ?? '',
            longitude: center.longitude ?? '',
            categories: Array.isArray(center.categories) ? [...center.categories] : []
        }
        : EMPTY_FORM
)

/**
 * Collecting center form (modal).
 * props:
 *   center  — existing center to edit, or null to create
 *   onClose — cancel callback
 *   onSaved — called with the saved center after a successful POST/PUT
 *
 * The parent mounts this component only while the form is open, so state is
 * initialised straight from props (remount = reset).
 */
export default function CenterForm({ center, onClose, onSaved }) {
    const [form, setForm] = useState(() => toFormState(center))
    const [saving, setSaving] = useState(false)
    const [serverError, setServerError] = useState('')
    const [errors, setErrors] = useState({})

    const isEdit = Boolean(center?._id)

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

    const toggleCategory = (category) => {
        setForm((f) => ({
            ...f,
            categories: f.categories.includes(category)
                ? f.categories.filter((c) => c !== category)
                : [...f.categories, category]
        }))
    }

    const validate = () => {
        const next = {}
        if (!form.name.trim()) next.name = 'Center name is required'
        if (!/^\d{10}$/.test(form.phone.replace(/\D/g, ''))) next.phone = 'Enter exactly 10 digits'
        if (!form.address.trim()) next.address = 'Address is required'
        if (!form.city.trim()) next.city = 'City is required'

        const lat = Number(form.latitude)
        if (form.latitude === '' || Number.isNaN(lat) || lat < -90 || lat > 90) {
            next.latitude = 'Enter a latitude between -90 and 90'
        }
        const lng = Number(form.longitude)
        if (form.longitude === '' || Number.isNaN(lng) || lng < -180 || lng > 180) {
            next.longitude = 'Enter a longitude between -180 and 180'
        }
        setErrors(next)
        return Object.keys(next).length === 0
    }

    const submit = async (e) => {
        e.preventDefault()
        setServerError('')
        if (!validate()) return

        setSaving(true)
        try {
            const url = isEdit
                ? `${API_BASE}/api/collectingcenters/${center._id}`
                : `${API_BASE}/api/collectingcenters`
            const res = await fetch(url, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    ...form,
                    phone: form.phone.replace(/\D/g, ''),
                    latitude: Number(form.latitude),
                    longitude: Number(form.longitude)
                })
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                setServerError(data.message || `Server error ${res.status}`)
                return
            }
            onSaved?.(data.center)
        } catch {
            setServerError('Could not save the center. Check your connection and try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
                {/* Header */}
                <div className="mb-6 flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">
                            {isEdit ? 'Edit Collecting Center' : 'New Collecting Center'}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Where donors drop off relief supplies.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close form"
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X size={18} />
                    </button>
                </div>

                {serverError && (
                    <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                        {serverError}
                    </p>
                )}

                <form onSubmit={submit} noValidate>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Name" required error={errors.name}>
                            <input
                                type="text"
                                value={form.name}
                                onChange={set('name')}
                                placeholder="Enter center name"
                                className={inputClass(errors.name)}
                            />
                        </Field>

                        <Field label="Phone" required error={errors.phone}>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={set('phone')}
                                placeholder="Enter phone number"
                                className={inputClass(errors.phone)}
                            />
                            <p className="mt-1 text-xs text-slate-400">10 digits</p>
                        </Field>

                        <div className="sm:col-span-2">
                            <Field label="Address" required error={errors.address}>
                                <input
                                    type="text"
                                    value={form.address}
                                    onChange={set('address')}
                                    placeholder="Enter full address"
                                    className={inputClass(errors.address)}
                                />
                            </Field>
                        </div>

                        <Field label="City / hometown" required error={errors.city}>
                            <input
                                type="text"
                                value={form.city}
                                onChange={set('city')}
                                placeholder="Enter city name"
                                className={inputClass(errors.city)}
                            />
                        </Field>

                        <Field label="Opening hours">
                            <input
                                type="text"
                                value={form.openingHours}
                                onChange={set('openingHours')}
                                placeholder="e.g., 9.00 AM – 5.00 PM"
                                className={inputClass(false)}
                            />
                        </Field>

                        <Field label="Latitude" required error={errors.latitude}>
                            <input
                                type="text"
                                value={form.latitude}
                                onChange={set('latitude')}
                                placeholder="e.g., 6.9271"
                                className={inputClass(errors.latitude)}
                            />
                        </Field>

                        <Field label="Longitude" required error={errors.longitude}>
                            <input
                                type="text"
                                value={form.longitude}
                                onChange={set('longitude')}
                                placeholder="e.g., 79.8612"
                                className={inputClass(errors.longitude)}
                            />
                        </Field>

                        <div className="sm:col-span-2">
                            <Field label="Categories">
                                <div className="flex flex-wrap gap-2.5">
                                    {CATEGORY_OPTIONS.map((category) => {
                                        const active = form.categories.includes(category)
                                        return (
                                            <button
                                                key={category}
                                                type="button"
                                                onClick={() => toggleCategory(category)}
                                                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                                                    active
                                                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/30'
                                                        : 'border-slate-200 bg-slate-100 text-slate-700 hover:border-slate-300'
                                                }`}
                                            >
                                                📎 {category}
                                            </button>
                                        )
                                    })}
                                </div>
                            </Field>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-7 flex justify-end gap-3 border-t border-slate-200 pt-5">
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
                            {saving && <Loader2 size={15} className="animate-spin" />}
                            Save Center
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
