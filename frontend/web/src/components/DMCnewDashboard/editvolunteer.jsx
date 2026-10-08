import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, X, Calendar, Search, Save } from 'lucide-react'
import { PRESET_ROLES, PRESET_LANGS } from './volunteerpage.jsx'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

/* Edit form for a single volunteer (create + edit). Sample code adapted from
 * the citizen app form at frontend/mobile/src/components/Donation/Volunteer.jsx.
 * Persists to MongoDB through the /api/volunteers endpoints. */
export default function EditVolunteer() {
    const nav = useNavigate()
    const { volunteerId } = useParams()
    const isAdd = !volunteerId

    /* ── load the volunteer (edit mode) from the API ────────── */
    const [original, setOriginal] = useState(null)
    const [dataReady, setDataReady] = useState(isAdd)
    const [loadErr, setLoadErr] = useState('') // '' | 'notfound' | message

    useEffect(() => {
        if (isAdd) return undefined
        const ctrl = new AbortController()
        fetch(`${API_BASE}/api/volunteers/${volunteerId}`, {
            credentials: 'include',
            signal: ctrl.signal
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}))
                if (res.status === 404) { setLoadErr('notfound'); return }
                if (!res.ok) throw new Error(data?.message || 'Failed to load volunteer.')
                const v = { ...data.volunteer, id: data.volunteer._id }
                setOriginal(v)
                // populate the form fields (their initialisers ran with null)
                setVolunteerType(v.volunteerType || 'individual')
                setFullName(v.fullName || '')
                setPhone(v.phone || '')
                setEmail(v.email || '')
                setWhatsapp(v.whatsapp || '')
                setLivingArea(v.livingArea || '')
                setGroup(v.group || '')
                setSelectedRoles(v.roles || [])
                setExtraRoles((v.roles || []).filter((r) => !PRESET_ROLES.includes(r)))
                setSelectedLangs(v.languages || [])
                setExtraLangs((v.languages || []).filter((l) => !PRESET_LANGS.includes(l)))
                setAvailDate(v.availableDate || '')
                setAvailTime(v.availableTime || 'both')
                if (v.operationName) setSelectedOp({ _id: v.operationId, name: v.operationName })
                setMembers(v.members || 1)
                setNotes(v.notes || '')
                setDataReady(true)
            })
            .catch((err) => {
                if (err.name === 'AbortError') return
                setLoadErr(err.message || 'Failed to load volunteer.')
            })
        return () => ctrl.abort()
    }, [isAdd, volunteerId])

    /* ── volunteer type ─────────────────────────────────────── */
    const [volunteerType, setVolunteerType] = useState(original?.volunteerType || 'individual')

    /* ── about you ──────────────────────────────────────────── */
    const [fullName, setFullName]     = useState(original?.fullName || '')
    const [phone, setPhone]           = useState(original?.phone || '')
    const [email, setEmail]           = useState(original?.email || '')
    const [whatsapp, setWhatsapp]     = useState(original?.whatsapp || '')
    const [livingArea, setLivingArea] = useState(original?.livingArea || '')
    const [group, setGroup]           = useState(original?.group || '')

    /* role / skill chips */
    const [selectedRoles, setSelectedRoles] = useState(original?.roles || [])
    const [extraRoles, setExtraRoles] = useState(() => (original?.roles || []).filter(r => !PRESET_ROLES.includes(r)))
    const [customRoleInput, setCustomRoleInput] = useState('')

    /* language chips */
    const [selectedLangs, setSelectedLangs] = useState(original?.languages || [])
    const [extraLangs, setExtraLangs] = useState(() => (original?.languages || []).filter(l => !PRESET_LANGS.includes(l)))
    const [customLangInput, setCustomLangInput] = useState('')

    /* ── availability & assignment ──────────────────────────── */
    const [availDate, setAvailDate] = useState(original?.availableDate || '')
    const [availTime, setAvailTime] = useState(original?.availableTime || 'both') // 'daytime' | 'night' | 'both'
    const [selectedOp, setSelectedOp] = useState(() =>
        original?.operationName
            ? { _id: original?.operationId, name: original.operationName }
            : null
    )
    const [opQuery, setOpQuery] = useState('')
    const [showOpDrop, setShowOpDrop] = useState(false)
    const [members, setMembers] = useState(original?.members || 1)
    const [notes, setNotes] = useState(original?.notes || '')

    /* ── form state ─────────────────────────────────────────── */
    const [errors, setErrors]       = useState({})
    const [saving, setSaving]       = useState(false)
    const [submitErr, setSubmitErr] = useState('')
    const [showToast, setShowToast] = useState(false)

    const fullNameRef = useRef(null)

    /* ── relief-distribution operations for the dropdown ────── */
    const [operationList, setOperationList] = useState([])
    useEffect(() => {
        const ctrl = new AbortController()
        fetch(`${API_BASE}/api/operations`, {
            credentials: 'include',
            signal: ctrl.signal
        })
            .then((res) => res.json())
            .then((data) => {
                const list = Array.isArray(data?.operations)
                    ? data.operations
                    : Array.isArray(data?.data) ? data.data : []
                setOperationList(
                    list
                        .filter((o) => o && o.name)
                        .map((o) => ({ _id: o._id, name: o.name }))
                )
            })
            .catch(() => { /* dropdown stays empty */ })
        return () => ctrl.abort()
    }, [])

    const operations = operationList.filter(o =>
        o.name.toLowerCase().includes(opQuery.trim().toLowerCase())
    )

    /* keep members in sync with volunteer type */
    useEffect(() => {
        if (volunteerType === 'individual') setMembers(1)
        else if (members < 2) setMembers(2)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [volunteerType])

    if (!dataReady) {
        const backBtn = (
            <button
                type="button"
                onClick={() => nav('/ngomanager/volunteers')}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
                <ArrowLeft size={16} /> Back to volunteers
            </button>
        )
        if (loadErr === 'notfound') {
            return (
                <div className="px-5 py-16 text-center">
                    <h1 className="text-xl font-bold text-slate-900">Volunteer not found</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        This volunteer may have been deleted.
                    </p>
                    {backBtn}
                </div>
            )
        }
        if (loadErr) {
            return (
                <div className="px-5 py-16 text-center">
                    <h1 className="text-xl font-bold text-slate-900">Could not load volunteer</h1>
                    <p className="mt-2 text-sm text-slate-500">{loadErr}</p>
                    {backBtn}
                </div>
            )
        }
        return (
            <div className="px-5 py-16 text-center">
                <p className="text-sm font-medium text-slate-500">Loading volunteer…</p>
            </div>
        )
    }

        /* ── chip helpers ────────────────────────────────────────── */
    const toggleRole = (role) => {
        setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role])
        if (errors.roles) setErrors(p => ({ ...p, roles: '' }))
    }

    const addCustomRole = () => {
        const val = customRoleInput.trim()
        if (!val) return
        if (!extraRoles.includes(val) && !PRESET_ROLES.includes(val))
            setExtraRoles(p => [...p, val])
        if (!selectedRoles.includes(val)) {
            setSelectedRoles(p => [...p, val])
            if (errors.roles) setErrors(pr => ({ ...pr, roles: '' }))
        }
        setCustomRoleInput('')
    }

    const removeCustomRole = (role) => {
        setExtraRoles(p => p.filter(r => r !== role))
        setSelectedRoles(p => p.filter(r => r !== role))
    }

    const toggleLang = (lang) => setSelectedLangs(prev =>
        prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    )

    const addCustomLang = () => {
        const val = customLangInput.trim()
        if (!val) return
        if (!extraLangs.includes(val) && !PRESET_LANGS.includes(val))
            setExtraLangs(p => [...p, val])
        if (!selectedLangs.includes(val)) setSelectedLangs(p => [...p, val])
        setCustomLangInput('')
    }

    const removeCustomLang = (lang) => {
        setExtraLangs(p => p.filter(l => l !== lang))
        setSelectedLangs(p => p.filter(l => l !== lang))
    }

    /* ── validation (same rules as the mobile form) ─────────── */
    const isValidPhone = (s) => {
        const v = String(s || '').replace(/[^\d+]/g, '')
        return /^\+94\d{9}$/.test(v) || /^0\d{9}$/.test(v)
    }

    const validate = () => {
        const e = {}
        if (!fullName.trim()) e.fullName = 'Full name is required.'
        if (!phone.trim()) e.phone = 'Phone is required.'
        else if (!isValidPhone(phone)) e.phone = 'Enter a valid Sri Lankan phone number.'
        if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
            e.email = 'Enter a valid email address.'
        if (!availDate) e.availDate = 'Available date is required.'
        if (!selectedOp) e.operation = 'Please select an operation.'
        if (selectedRoles.length === 0) e.roles = 'Pick at least one role/skill.'
        if (volunteerType === 'team' && members < 2)
            e.members = 'Minimum 2 members required for a team.'
        setErrors(e)
        if (Object.keys(e).length) {
            fullNameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return false
        }
        return true
    }

    /* ── save to MongoDB via the API ────────────────────────── */
    const handleSubmit = async (ev) => {
        ev.preventDefault()
        setSubmitErr('')
        setSaving(true)
        if (!validate()) { setSaving(false); return }

        try {
            const payload = {
                volunteerType,
                fullName,
                phone,
                email,
                whatsapp,
                livingArea,
                group,
                roles: selectedRoles,
                languages: selectedLangs,
                availableDate: availDate,
                availableTime: availTime,
                operationId: selectedOp?._id || original?.operationId || '',
                operationName: selectedOp?.name || '',
                members: volunteerType === 'team' ? members : 1,
                notes
            }
            const res = await fetch(
                isAdd
                    ? `${API_BASE}/api/volunteers`
                    : `${API_BASE}/api/volunteers/${original.id}`,
                {
                    method: isAdd ? 'POST' : 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                }
            )
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.message || 'Saving failed.')
            setShowToast(true)
            setTimeout(() => nav('/ngomanager/volunteers'), 1400)
        } catch (err) {
            setSubmitErr(err.message || 'Something went wrong.')
        } finally {
            setSaving(false)
        }
    }

    /* ── styles ─────────────────────────────────────────────── */
    const inputCls = (field) =>
        `w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
            errors[field] ? 'border-red-400 focus:border-red-400' : 'border-slate-200 focus:border-blue-500'
        }`

    const chipCls = (active) =>
        `px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
            active
                ? 'border-slate-500 text-slate-900 bg-slate-100'
                : 'border-slate-300 text-slate-600 hover:border-slate-400 bg-transparent'
        }`

    const timeBtnCls = (val) =>
        availTime === val
            ? 'px-4 py-1.5 rounded-full bg-blue-600 text-white text-sm font-medium'
            : 'px-4 py-1.5 rounded-full border border-slate-300 text-slate-600 text-sm font-medium hover:border-slate-400 transition'

    /* ── render ─────────────────────────────────────────────── */
    return (
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {/* Header */}
            <header className="mb-5 flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => nav('/ngomanager/volunteers')}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-600"
                >
                    <ArrowLeft size={18} /> Back to volunteers
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-lg">👫</span>
                    <div className="text-right">
                        <p className="text-sm font-bold text-slate-900">{isAdd ? 'Add volunteer' : 'Edit volunteer'}</p>
                        <p className="text-xs text-slate-500">{isAdd ? 'New record' : original?.fullName}</p>
                    </div>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Alerts */}
                {submitErr && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {submitErr}
                    </div>
                )}

                {/* ── Volunteer Type ── */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="mb-3 text-sm font-medium text-slate-700">Volunteer type</p>
                    <div className="flex overflow-hidden rounded-xl border border-slate-200">
                        {['individual', 'team'].map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setVolunteerType(t)}
                                className={`flex-1 py-3 text-sm font-semibold transition ${
                                    volunteerType === t
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {t === 'individual' ? 'Individual' : 'Team / Group'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── About You ── */}
                <div ref={fullNameRef} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900">About you</h2>

                    {/* Full name + Phone */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Full name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                className={inputCls('fullName')}
                                placeholder="e.g., Tharindu Perera"
                                value={fullName}
                                onChange={e => {
                                    setFullName(e.target.value)
                                    if (errors.fullName) setErrors(p => ({ ...p, fullName: '' }))
                                }}
                            />
                            {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName}</p>}
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Phone <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="tel"
                                className={inputCls('phone')}
                                placeholder="+94 XX XXX XXXX"
                                value={phone}
                                onChange={e => {
                                    setPhone(e.target.value)
                                    if (errors.phone) setErrors(p => ({ ...p, phone: '' }))
                                }}
                            />
                            {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone}</p>}
                        </div>
                    </div>

                    {/* Email + WhatsApp */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                            <input
                                type="email"
                                className={inputCls('email')}
                                placeholder="name@email.com"
                                value={email}
                                onChange={e => {
                                    setEmail(e.target.value)
                                    if (errors.email) setErrors(p => ({ ...p, email: '' }))
                                }}
                            />
                            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                WhatsApp <span className="font-normal text-slate-400">(optional)</span>
                            </label>
                            <input
                                type="tel"
                                className={inputCls('')}
                                placeholder="+94 XX XXX XXXX"
                                value={whatsapp}
                                onChange={e => setWhatsapp(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Living Area + Group */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">Living area</label>
                            <input
                                type="text"
                                className={inputCls('')}
                                placeholder="e.g., Ratnapura, Galle"
                                value={livingArea}
                                onChange={e => setLivingArea(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Group <span className="font-normal text-slate-400">(optional)</span>
                            </label>
                            <input
                                type="text"
                                className={inputCls('')}
                                placeholder="e.g., Red Cross, Local Community Group"
                                value={group}
                                onChange={e => setGroup(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Role / Skill chips */}
                    <div>
                        <label className="mb-2 block text-xs font-medium text-slate-600">
                            Role / skill <span className="text-red-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_ROLES.map(role => (
                                <button key={role} type="button" onClick={() => toggleRole(role)} className={chipCls(selectedRoles.includes(role))}>
                                    {role}
                                </button>
                            ))}
                            {extraRoles.map(role => (
                                <span key={role} className="inline-flex items-center gap-1 rounded-full border border-slate-400 bg-slate-100 px-3 py-1.5 text-sm text-slate-800">
                                    {role}
                                    <button type="button" onClick={() => removeCustomRole(role)} className="hover:text-red-500">
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                            <input
                                type="text"
                                className="min-w-[140px] flex-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="Other (type & press Enter)"
                                value={customRoleInput}
                                onChange={e => setCustomRoleInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomRole() } }}
                            />
                        </div>
                        {errors.roles && <p className="mt-1 text-xs text-red-500">{errors.roles}</p>}
                    </div>

                    {/* Language chips */}
                    <div>
                        <label className="mb-2 block text-xs font-medium text-slate-600">Languages you can speak</label>
                        <div className="flex flex-wrap gap-2">
                            {PRESET_LANGS.map(lang => (
                                <button key={lang} type="button" onClick={() => toggleLang(lang)} className={chipCls(selectedLangs.includes(lang))}>
                                    {lang}
                                </button>
                            ))}
                            {extraLangs.map(lang => (
                                <span key={lang} className="inline-flex items-center gap-1 rounded-full border border-slate-400 bg-slate-100 px-3 py-1.5 text-sm text-slate-800">
                                    {lang}
                                    <button type="button" onClick={() => removeCustomLang(lang)} className="hover:text-red-500">
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                            <input
                                type="text"
                                className="min-w-[180px] flex-1 rounded-full border border-slate-200 px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
                                placeholder="Other language (type & press Enter)"
                                value={customLangInput}
                                onChange={e => setCustomLangInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomLang() } }}
                            />
                        </div>
                    </div>
                </div>

                {/* ── Availability & Assignment ── */}
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-bold text-slate-900">Availability &amp; assignment</h2>

                    {/* Date + Time */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Available date <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className={`${inputCls('availDate')} pr-10`}
                                    value={availDate}
                                    onChange={e => {
                                        setAvailDate(e.target.value)
                                        if (errors.availDate) setErrors(p => ({ ...p, availDate: '' }))
                                    }}
                                />
                                <Calendar size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                            {errors.availDate && <p className="mt-1 text-xs text-red-500">{errors.availDate}</p>}
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600">
                                Available time <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1 flex flex-wrap gap-2">
                                <button type="button" onClick={() => setAvailTime('daytime')} className={timeBtnCls('daytime')}>Daytime</button>
                                <button type="button" onClick={() => setAvailTime('night')} className={timeBtnCls('night')}>Night</button>
                                <button type="button" onClick={() => setAvailTime('both')} className={timeBtnCls('both')}>Both (24h)</button>
                            </div>
                        </div>
                    </div>

                    {/* Operation search */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                            Operation <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                className={`${inputCls('operation')} pl-8`}
                                placeholder="Type to search operations..."
                                value={selectedOp ? selectedOp.name : opQuery}
                                onFocus={() => { setSelectedOp(null); setShowOpDrop(true) }}
                                onChange={e => {
                                    setOpQuery(e.target.value)
                                    setSelectedOp(null)
                                    setShowOpDrop(true)
                                    if (errors.operation) setErrors(p => ({ ...p, operation: '' }))
                                }}
                            />
                        </div>
                        {showOpDrop && (
                            <div className="mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
                                {operations.length === 0 && (
                                    <p className="px-4 py-3 text-sm text-slate-400">No operations available</p>
                                )}
                                {operations.map(op => (
                                    <button
                                        key={op._id}
                                        type="button"
                                        className="w-full px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                                        onClick={() => {
                                            setSelectedOp(op)
                                            setOpQuery('')
                                            setShowOpDrop(false)
                                            if (errors.operation) setErrors(p => ({ ...p, operation: '' }))
                                        }}
                                    >
                                        {op.name}
                                    </button>
                                ))}
                            </div>
                        )}
                        {errors.operation && <p className="mt-1 text-xs text-red-500">{errors.operation}</p>}
                    </div>

                    {/* Members to assign */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">
                            Members to assign{volunteerType === 'team' && <span className="text-red-500"> *</span>}
                        </label>
                        {volunteerType === 'individual' ? (
                            <div className="inline-block rounded-full bg-slate-800 px-5 py-2 text-sm font-semibold text-white">
                                Individual — counted as 1
                            </div>
                        ) : (
                            <>
                                <input
                                    type="number"
                                    min={2}
                                    className={inputCls('members')}
                                    value={members}
                                    onChange={e => {
                                        setMembers(Number(e.target.value))
                                        if (errors.members) setErrors(p => ({ ...p, members: '' }))
                                    }}
                                />
                                <p className="mt-1 text-[11px] text-slate-400">Minimum 2 members required.</p>
                                {errors.members && <p className="mt-1 text-xs text-red-500">{errors.members}</p>}
                            </>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">Notes</label>
                        <textarea
                            rows={3}
                            className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            placeholder="Anything we should know (health, travel, etc.)..."
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                </div>

                {/* Submit bar */}
                <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 font-semibold text-white shadow transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : (isAdd ? 'Add volunteer' : 'Save changes')}
                        {!saving && <Save size={18} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => nav('/ngomanager/volunteers')}
                        className="rounded-2xl border border-slate-300 bg-white py-3.5 px-6 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                </div>
            </form>

            {/* Toast */}
            {showToast && (
                <div className="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-green-600 px-5 py-3 text-white shadow-lg">
                    <Check size={20} />
                    <span className="text-sm font-medium">
                        {isAdd ? 'Volunteer added successfully!' : 'Volunteer updated successfully!'}
                    </span>
                    <button type="button" onClick={() => setShowToast(false)} className="text-white/80 hover:text-white">
                        <X size={18} />
                    </button>
                </div>
            )}
        </div>
    )
}








