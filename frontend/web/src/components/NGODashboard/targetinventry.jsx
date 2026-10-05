import { useState } from 'react'
import { Loader2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

/* Matches the TargetInventory schema keys / units shown in the design */
const TARGET_ITEMS = [
    { key: 'dry_rations', label: 'Dry Rations', unit: 'packs', icon: '📦' },
    { key: 'water', label: 'Water', unit: 'liters', icon: '💧' },
    { key: 'bedding', label: 'Bedding', unit: 'sets', icon: '🛏️' },
    { key: 'medical', label: 'Medical Supplies', unit: 'kits', icon: '🧪' },
    { key: 'clothing', label: 'Clothing', unit: 'sets', icon: '👕' },
    { key: 'hygiene', label: 'Hygiene Kits', unit: 'packs', icon: '🧴' }
]

/* Schema defaults, used when no target document exists yet */
const DEFAULT_TARGETS = {
    dry_rations: 100,
    water: 100,
    bedding: 50,
    medical: 50,
    clothing: 50,
    hygiene: 100
}

/**
 * "Set Inventory Targets" modal — PUT /api/targetinventories.
 * props:
 *   targets — current target document (key → number)
 *   onClose — cancel callback
 *   onSaved — called with the updated target doc after a successful PUT
 *
 * The parent mounts this component only while the modal is open, so state is
 * initialised straight from props (remount = reset).
 */
export default function SetInventoryTargets({ targets = {}, onClose, onSaved }) {
    const [values, setValues] = useState(() => {
        const init = {}
        for (const { key } of TARGET_ITEMS) {
            const current = Number(targets[key])
            init[key] = Number.isFinite(current) && targets[key] !== undefined && targets[key] !== null
                ? String(current)
                : String(DEFAULT_TARGETS[key])
        }
        return init
    })
    const [saving, setSaving] = useState(false)
    const [serverError, setServerError] = useState('')

    const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }))

    const invalid = (key) => {
        const n = Number(values[key])
        return values[key] === '' || Number.isNaN(n) || n < 0
    }

    const handleSave = async () => {
        const bad = TARGET_ITEMS.find(({ key }) => invalid(key))
        if (bad) {
            setServerError(`Target for ${bad.label} must be a non-negative number.`)
            return
        }

        setServerError('')
        setSaving(true)
        try {
            const payload = {}
            for (const { key } of TARGET_ITEMS) payload[key] = Number(values[key])

            const res = await fetch(`${API_BASE}/api/targetinventories`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.message || `Server error ${res.status}`)
            onSaved(data.data)
        } catch (err) {
            setServerError(err.message || 'Could not save the targets. Please try again.')
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 p-4 md:p-8">
            <div className="mx-auto w-full max-w-6xl space-y-5">
                {/* ── Header ── */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-5 shadow-lg md:px-8">
                    <div>
                        <h2 className="text-2xl font-extrabold text-white md:text-3xl">🎯 Set Inventory Targets</h2>
                        <p className="mt-1 text-sm text-blue-100">Configure target quantities for each relief item</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="rounded-xl bg-white/20 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/30 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                        >
                            {saving && <Loader2 size={15} className="animate-spin" />}
                            Save Targets
                        </button>
                    </div>
                </div>

                {/* ── Target cards ── */}
                <div className="rounded-2xl bg-gradient-to-b from-blue-700 to-blue-900 p-5 shadow-inner md:p-7">
                    {serverError && (
                        <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                            {serverError}
                        </p>
                    )}

                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                        {TARGET_ITEMS.map(({ key, label, unit, icon }) => (
                            <div key={key} className="overflow-hidden rounded-2xl bg-white shadow-md">
                                <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-red-400" />
                                <div className="p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-2xl">
                                            {icon}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900">{label}</h3>
                                            <p className="text-sm text-slate-500">Unit: {unit}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-3">
                                        <input
                                            type="number"
                                            min="0"
                                            value={values[key]}
                                            onChange={set(key)}
                                            aria-label={`Target for ${label}`}
                                            className={`w-full rounded-xl border px-4 py-2.5 text-lg font-semibold text-slate-800 focus:outline-none focus:ring-2 ${
                                                invalid(key)
                                                    ? 'border-red-400 focus:ring-red-300'
                                                    : 'border-slate-300 focus:border-blue-500 focus:ring-blue-500/20'
                                            }`}
                                        />
                                        <span className="shrink-0 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
                                            {unit}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
