import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Check, X, Calendar, Search } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const PRESET_ROLES = ['Driver', 'Medic', 'Logistics', 'Cooking', 'Translator']
const PRESET_LANGS = ['Sinhala', 'Tamil', 'English']

export default function Volunteer() {
  const nav = useNavigate()

  /* ── volunteer type ─────────────────────────────── */
  const [volunteerType, setVolunteerType] = useState('individual') // 'individual' | 'team'

  /* ── about you ──────────────────────────────────── */
  const [fullName, setFullName]     = useState('')
  const [phone, setPhone]           = useState('')
  const [email, setEmail]           = useState('')
  const [whatsapp, setWhatsapp]     = useState('')
  const [livingArea, setLivingArea] = useState('')
  const [group, setGroup]           = useState('')

  /* role / skill chips */
  const [selectedRoles, setSelectedRoles]   = useState([])
  const [customRoleInput, setCustomRoleInput] = useState('')
  const [extraRoles, setExtraRoles]         = useState([])

  /* language chips */
  const [selectedLangs, setSelectedLangs]   = useState([])
  const [customLangInput, setCustomLangInput] = useState('')
  const [extraLangs, setExtraLangs]         = useState([])

  /* ── availability & assignment ───────────────────── */
  const [availDate, setAvailDate] = useState('')
  const [availTime, setAvailTime] = useState('both') // 'daytime' | 'night' | 'both'

  /* operation */
  const [opQuery, setOpQuery]       = useState('')
  const [operations, setOperations] = useState([])
  const [opLoading, setOpLoading]   = useState(false)
  const [opError, setOpError]       = useState('')
  const [selectedOp, setSelectedOp] = useState(null)
  const [showOpDrop, setShowOpDrop] = useState(false)

  /* members */
  const [members, setMembers] = useState(1)

  /* notes */
  const [notes, setNotes] = useState('')

  /* ── form state ─────────────────────────────────── */
  const [errors, setErrors]       = useState({})
  const [saving, setSaving]       = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [showToast, setShowToast] = useState(false)

  const fullNameRef = useRef(null)

  /* ── keep members in sync with volunteer type ────── */
  useEffect(() => {
    if (volunteerType === 'individual') setMembers(1)
    else if (members < 2) setMembers(2)
  }, [volunteerType])

  /* ── fetch operations ────────────────────────────── */
  useEffect(() => {
    if (!showOpDrop) return
    const ctrl = new AbortController()
    setOpLoading(true)
    setOpError('')
    fetch(`${API_BASE}/api/operations?q=${encodeURIComponent(opQuery)}`, {
      signal: ctrl.signal
    })
      .then(r => r.json())
      .then(d => {
        setOperations(Array.isArray(d?.data) ? d.data : [])
        setOpLoading(false)
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setOpError('Failed to load operations. Please try again.')
          setOpLoading(false)
        }
      })
    return () => ctrl.abort()
  }, [opQuery, showOpDrop])

  /* ── chip helpers ────────────────────────────────── */
  const toggleRole = (role) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    )
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

  const toggleLang = (lang) =>
    setSelectedLangs(prev =>
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

  /* ── validation ──────────────────────────────────── */
  const isValidPhone = (s) => {
    const v = String(s || '').replace(/[^\d+]/g, '')
    return /^\+94\d{9}$/.test(v) || /^0\d{9}$/.test(v)
  }

  const validate = () => {
    const e = {}
    if (!fullName.trim())  e.fullName  = 'Full name is required.'
    if (!phone.trim())     e.phone     = 'Phone is required.'
    else if (!isValidPhone(phone)) e.phone = 'Enter a valid Sri Lankan phone number.'
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = 'Enter a valid email address.'
    if (!availDate)        e.availDate  = 'Available date is required.'
    if (!selectedOp)       e.operation  = 'Please select an operation.'
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

  /* ── submit ──────────────────────────────────────── */
  const handleSubmit = async (ev) => {
    ev.preventDefault()
    setSubmitErr('')
    setSaving(true)
    if (!validate()) { setSaving(false); return }

    try {
      const res = await fetch(`${API_BASE}/api/volunteers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          operationId: selectedOp?._id,
          operationName: selectedOp?.name,
          members: volunteerType === 'team' ? members : 1,
          notes
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || 'Submission failed.')
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
      setTimeout(() => nav('/donation'), 1500)
    } catch (err) {
      setSubmitErr(err.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  /* ── styles ──────────────────────────────────────── */
  const inputCls = (field) =>
    `w-full rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
      errors[field]
        ? 'border-red-400 focus:border-red-400'
        : 'border-slate-200 focus:border-blue-500'
    }`

  const chipCls = (active) =>
    `px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
      active
        ? 'border-slate-500 text-slate-900 bg-slate-100'
        : 'border-slate-300 text-slate-600 hover:border-slate-400 bg-transparent'
    }`

  const timeBtnCls = (val) =>
    availTime === val
      ? 'px-4 py-1.5 rounded-full bg-orange-400 text-white text-sm font-medium'
      : 'px-4 py-1.5 rounded-full border border-slate-300 text-slate-600 text-sm font-medium hover:border-slate-400 transition'

  /* ── render ──────────────────────────────────────── */
  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-slate-50 pb-24">

      {/* Header */}
      <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-slate-100 bg-white/95 px-5 backdrop-blur">
        <button
          onClick={() => nav(-1)}
          className="flex items-center gap-2 text-slate-700 hover:text-blue-600 transition"
        >
          <ArrowLeft size={20} />
          <span className="font-semibold">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-white">
            <Heart size={20} />
          </span>
          <span className="font-bold text-slate-900">Support</span>
        </div>
        <div className="w-20" />
      </header>

      <form onSubmit={handleSubmit} className="px-5 py-6 space-y-5">

        {/* Alerts */}
        {submitErr && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {submitErr}
          </div>
        )}
        {opError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {opError}
          </div>
        )}

        {/* ── Volunteer Type ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-700 mb-3">Volunteer type</p>
          <div className="flex rounded-xl overflow-hidden border border-slate-200">
            <button
              type="button"
              onClick={() => setVolunteerType('individual')}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                volunteerType === 'individual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setVolunteerType('team')}
              className={`flex-1 py-3 text-sm font-semibold transition ${
                volunteerType === 'team'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Team / Group
            </button>
          </div>
        </div>

        {/* ── About You ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900">About you</h2>

          {/* Full name + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Full name <span className="text-red-500">*</span>
              </label>
              <input
                ref={fullNameRef}
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
              <label className="block text-xs font-medium text-slate-600 mb-1">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">
                WhatsApp <span className="text-slate-400 font-normal">(optional)</span>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Living Area</label>
              <input
                type="text"
                className={inputCls('')}
                placeholder="e.g., Ratnapura, Galle"
                value={livingArea}
                onChange={e => setLivingArea(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Group <span className="text-slate-400 font-normal">(optional)</span>
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
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Role / skill <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ROLES.map(role => (
                <button key={role} type="button" onClick={() => toggleRole(role)} className={chipCls(selectedRoles.includes(role))}>
                  {role}
                </button>
              ))}
              {extraRoles.map(role => (
                <span key={role} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-400 text-sm text-slate-800 bg-slate-100">
                  {role}
                  <button type="button" onClick={() => removeCustomRole(role)} className="hover:text-red-500"><X size={12} /></button>
                </span>
              ))}
              <input
                type="text"
                className="flex-1 min-w-[140px] px-3 py-1.5 rounded-full border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
                placeholder="Other (type & press Enter)"
                value={customRoleInput}
                onChange={e => setCustomRoleInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomRole() } }}
              />
            </div>
            {errors.roles && <p className="mt-1 text-xs text-red-500">{errors.roles}</p>}
            <p className="mt-1 text-[11px] text-slate-400">Pick at least one.</p>
          </div>

          {/* Language chips */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Languages you can speak
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_LANGS.map(lang => (
                <button key={lang} type="button" onClick={() => toggleLang(lang)} className={chipCls(selectedLangs.includes(lang))}>
                  {lang}
                </button>
              ))}
              {extraLangs.map(lang => (
                <span key={lang} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-400 text-sm text-slate-800 bg-slate-100">
                  {lang}
                  <button type="button" onClick={() => removeCustomLang(lang)} className="hover:text-red-500"><X size={12} /></button>
                </span>
              ))}
              <input
                type="text"
                className="flex-1 min-w-[180px] px-3 py-1.5 rounded-full border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
                placeholder="Other language (type & press Enter)"
                value={customLangInput}
                onChange={e => setCustomLangInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomLang() } }}
              />
            </div>
          </div>
        </div>

        {/* ── Availability & Assignment ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Availability &amp; assignment</h2>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
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
                <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              {errors.availDate && <p className="mt-1 text-xs text-red-500">{errors.availDate}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Available time <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2 flex-wrap mt-1">
                <button type="button" onClick={() => setAvailTime('daytime')} className={timeBtnCls('daytime')}>Daytime</button>
                <button type="button" onClick={() => setAvailTime('night')}   className={timeBtnCls('night')}>Night</button>
                <button type="button" onClick={() => setAvailTime('both')}    className={timeBtnCls('both')}>Both (24h)</button>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Pick Daytime and/or Night.</p>
            </div>
          </div>

          {/* Operation search */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Operation <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
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
              <div className="mt-1 rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden">
                {opLoading && <p className="px-4 py-3 text-sm text-slate-500">Searching…</p>}
                {!opLoading && operations.length === 0 && (
                  <p className="px-4 py-3 text-sm text-slate-400">No operations available</p>
                )}
                {!opLoading && operations.map(op => (
                  <button
                    key={op._id}
                    type="button"
                    className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition"
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
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Members to assign{volunteerType === 'team' && <span className="text-red-500"> *</span>}
            </label>
            {volunteerType === 'individual' ? (
              <div className="rounded-full bg-orange-400 text-white text-sm font-semibold px-5 py-2 inline-block">
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y"
              placeholder="Anything we should know (health, travel, etc.)..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-2xl shadow hover:bg-blue-700 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving ? 'Submitting…' : 'Submit Application'}
          {!saving && <Check size={18} />}
        </button>
      </form>

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-xl bg-green-600 px-5 py-3 text-white shadow-lg z-50">
          <Check size={20} />
          <span className="text-sm font-medium">Application submitted successfully!</span>
          <button onClick={() => setShowToast(false)} className="ml-2 text-white/80 hover:text-white">
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
