import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Heart, User, Building2, X, Check, Upload, Trash2, Loader2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000"

/* utils — kept in sync with DonationForm.jsx */
const channelLabel = (v) =>
  v === "bank_deposit" ? "Bank deposit" :
  v === "online_gateway" ? "Online gateway" :
  v === "cash_counter" ? "Cash" : v

// DB stores the display label ("Bank deposit" | "Online gateway" | "Cash");
// older rows may store the raw key — accept both.
const channelKey = (v) => {
  if (!v) return "bank_deposit"
  if (["bank_deposit", "online_gateway", "cash_counter"].includes(v)) return v
  const l = String(v).toLowerCase()
  if (l.startsWith("bank")) return "bank_deposit"
  if (l.startsWith("online")) return "online_gateway"
  return "cash_counter"
}

const slipUrl = (p) =>
  !p ? "" : /^https?:\/\//i.test(p) ? p : `${API_BASE}/${String(p).replace(/\\/g, "/")}`

const isValidPhone = (s) => {
  const v = String(s || "").replace(/[^\d+]/g, "")
  return /^\+94\d{9}$/.test(v) || /^0\d{9}$/.test(v)
}

const toInputDate = (v) => {
  if (!v) return ""
  const d = new Date(v)
  return isNaN(d) ? "" : d.toISOString().slice(0, 10)
}

export default function EditDonationMoney() {
  const nav = useNavigate()
  const { donationId } = useParams()

  /* ── load state ── */
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState("")
  const [existingSlip, setExistingSlip] = useState("")
  const [removeSlip, setRemoveSlip] = useState(false)

  /* ── form state (mirrors DonationForm) ── */
  const [donorType, setDonorType] = useState("individual")
  const [donorName, setDonorName] = useState("")
  const [orgName, setOrgName] = useState("")
  const [donorEmail, setDonorEmail] = useState("")
  const [donorPhone, setDonorPhone] = useState("")
  const [donorAddress, setDonorAddress] = useState("")

  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("LKR")
  const [channel, setChannel] = useState("bank_deposit")

  const [isAnonymous, setIsAnonymous] = useState(false)
  const [allowNamePublic, setAllowNamePublic] = useState(true)

  const [whatsapp, setWhatsapp] = useState("")

  const [bank, setBank] = useState({
    name: "",
    depositDate: "",
    branch: "",
    depositor: "",
    reference: "",
  })

  const [proofFile, setProofFile] = useState(null)
  const [proofErr, setProofErr] = useState("")
  const [proofPreview, setProofPreview] = useState("")

  const [saving, setSaving] = useState(false)
  const [submitErr, setSubmitErr] = useState("")
  const [serverErrors, setServerErrors] = useState([])
  const [successMsg, setSuccessMsg] = useState("")
  const [showToast, setShowToast] = useState(false)

  const [errors, setErrors] = useState({})
  const refs = {
    displayName: useRef(null),
    donorPhone: useRef(null),
    donorEmail: useRef(null),
    amount: useRef(null),
    bankName: useRef(null),
    depositDate: useRef(null),
    reference: useRef(null),
    whatsapp: useRef(null),
  }
  /* ── load the existing donation (prefill) ── */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadErr("")
      try {
        const res = await fetch(`${API_BASE}/api/donations/${donationId}`, {
          credentials: "include",
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.message || `Server error ${res.status}`)

        const d = json?.data
        if (!d || cancelled) return

        setDonorType(d.donorType === "Organization" ? "organization" : "individual")
        if (d.donorType === "Organization") setOrgName(d.donorName || "")
        else setDonorName(d.donorName || "")
        setDonorEmail(d.donorEmail || "")
        setDonorPhone(d.donorPhone || "")
        setDonorAddress(d.donorAddress || "")
        setWhatsapp(d.whatsapp || "")
        setAmount(d.amount != null ? String(d.amount) : "")
        setCurrency(d.currency || "LKR")
        setChannel(channelKey(d.channel))
        setIsAnonymous(!!d.isAnonymous)
        setAllowNamePublic(d.allowNamePublic !== false)
        setBank({
          name: d.bankName || "",
          depositDate: toInputDate(d.depositDate),
          branch: d.branch || "",
          depositor: d.depositorName || "",
          reference: d.referenceNo || "",
        })
        setExistingSlip(d.evidencePath || "")
      } catch (e) {
        if (!cancelled) setLoadErr(e.message || "Failed to load donation")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [donationId])

  function onProofSelect(e) {
    const f = e.target.files?.[0]
    setProofErr(""); setProofFile(null); setProofPreview("")
    if (!f) return
    if (!["image/png", "image/jpeg"].includes(f.type)) { setProofErr("Only PNG or JPG allowed."); return }
    if (f.size > 2 * 1024 * 1024) { setProofErr("File too large. Max 2 MB."); return }
    setProofFile(f)
    setProofPreview(URL.createObjectURL(f))
    setRemoveSlip(false)
  }

  const isOrg = donorType === "organization"
  const displayName = isOrg ? orgName : donorName

  const validate = () => {
    const e = {}

    if (!displayName.trim()) {
      e.displayName = isOrg ? "Organization name is required." : "Donor name is required."
    } else if (/\d/.test(displayName)) {
      e.displayName = "Name should not contain numbers."
    }

    if (!donorEmail.trim() && !donorPhone.trim()) {
      e.donorEmail = "Provide at least email or phone."
      e.donorPhone = "Provide at least email or phone."
    }
    if (donorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
      e.donorEmail = "Enter a valid email address."
    }

    if (donorPhone && !isValidPhone(donorPhone)) e.donorPhone = "Enter a valid phone (e.g., +94712345678 or 0712345678)."
    if (whatsapp && !isValidPhone(whatsapp)) e.whatsapp = "Enter a valid WhatsApp number."

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount = "Enter a positive amount."

    if (channel === "bank_deposit") {
      if (!bank.name.trim()) e.bankName = "Bank name is required."
      if (!bank.depositDate) e.depositDate = "Deposit date is required."
      if (!bank.reference.trim()) e.reference = "Reference / Slip No. is required."
    }

    setErrors(e)

    if (Object.keys(e).length) {
      const first = Object.keys(e)[0]
      const r = refs[first]
      if (r && r.current) {
        r.current.focus({ preventScroll: false })
        r.current.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      return false
    }
    return true
  }
  async function onSubmit(e) {
    e.preventDefault()
    setSubmitErr(""); setServerErrors([]); setSuccessMsg("")
    setSaving(true)

    try {
      if (!validate()) { setSaving(false); return }

      const fd = new FormData()
      fd.append("donorType", isOrg ? "Organization" : "Individual")
      fd.append("donorName", displayName)
      fd.append("donorEmail", donorEmail)
      fd.append("donorPhone", donorPhone)
      fd.append("donorAddress", donorAddress)
      fd.append("whatsapp", whatsapp)

      fd.append("amount", String(Number(amount)))
      fd.append("currency", currency)
      fd.append("channel", channelLabel(channel))

      fd.append("isAnonymous", isAnonymous ? "true" : "false")
      fd.append("allowNamePublic", (!isAnonymous && allowNamePublic) ? "true" : "false")

      if (channel === "bank_deposit") {
        fd.append("bankName", bank.name)
        fd.append("branch", bank.branch)
        fd.append("depositDate", bank.depositDate)
        fd.append("depositorName", bank.depositor)
        fd.append("referenceNo", bank.reference)
      } else {
        // channel changed away from bank deposit → clear bank fields
        fd.append("bankName", "")
        fd.append("branch", "")
        fd.append("depositDate", "")
        fd.append("depositorName", "")
        fd.append("referenceNo", "")
      }

      if (proofFile) fd.append("evidence", proofFile)
      else if (removeSlip) fd.append("removeSlip", "true")

      const res = await fetch(`${API_BASE}/api/donations/${donationId}`, {
        method: "PUT",
        body: fd,
        credentials: "include",
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if (Array.isArray(data?.errors) && data.errors.length) setServerErrors(data.errors)
        throw new Error(data?.message || "Failed to update donation")
      }

      setSuccessMsg("Donation updated successfully.")
      setShowToast(true)
      setSaving(false)

      setTimeout(() => setShowToast(false), 2500)
      setTimeout(() => nav("/ngomanager/donations"), 1100)
    } catch (err) {
      setSaving(false)
      setSubmitErr(err.message || "Something went wrong")
    }
  }

  /* ── loading ── */
  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center bg-slate-50">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading donation…</span>
        </div>
      </div>
    )
  }

  /* ── load error ── */
  if (loadErr) {
    return (
      <div className="grid min-h-[60vh] place-items-center bg-slate-50 p-6">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <p className="mb-1 text-sm font-semibold text-red-700">Could not load donation</p>
          <p className="mb-5 text-sm text-slate-600">{loadErr}</p>
          <button
            onClick={() => nav("/ngomanager/donations")}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Donations
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl bg-slate-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-slate-100 bg-white/95 px-5 backdrop-blur">
        <button
          onClick={() => nav("/ngomanager/donations")}
          className="flex items-center gap-2 text-slate-700 hover:text-blue-600 transition"
        >
          <ArrowLeft size={20} />
          <span className="font-semibold">Back</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-white">
            <Heart size={20} />
          </span>
          <span className="font-bold text-slate-900">Edit Donation</span>
        </div>
        <div className="w-20" />
      </header>

      <form onSubmit={onSubmit} className="px-5 py-6">
        {/* Hero */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Update donation record</h1>
          <p className="text-sm text-slate-600">
            All fields are prefilled from the selected record. Edit what you need and save.
          </p>
        </div>

        {/* Alerts */}
        {successMsg && (
          <div className="mb-4 rounded-xl bg-green-50 border border-green-200 p-4 text-sm text-green-800">
            {successMsg}
          </div>
        )}
        {(submitErr || serverErrors.length > 0) && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
            {submitErr}
            {serverErrors.length > 0 && (
              <ul className="mt-2 list-disc list-inside">
                {serverErrors.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            )}
          </div>
        )}

        {/* Donor Details */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Donor details</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Donor type</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDonorType("individual")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 font-medium transition ${
                  donorType === "individual"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <User size={18} />
                Individual
              </button>
              <button
                type="button"
                onClick={() => setDonorType("organization")}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3 font-medium transition ${
                  donorType === "organization"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Building2 size={18} />
                Organization
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {donorType === "organization" ? "Organization name" : "Donor name"} <span className="text-red-500">*</span>
              </label>
              <input
                ref={refs.displayName}
                type="text"
                className={`w-full rounded-xl border px-4 py-3 text-sm ${
                  errors.displayName ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                placeholder={donorType === "organization" ? "e.g., Kind Hearts Foundation" : "e.g., Tharindu Perera"}
                value={donorType === "organization" ? orgName : donorName}
                onChange={(e) =>
                  donorType === "organization" ? setOrgName(e.target.value) : setDonorName(e.target.value)
                }
              />
              {errors.displayName && <p className="mt-1 text-xs text-red-600">{errors.displayName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                ref={refs.donorEmail}
                type="email"
                className={`w-full rounded-xl border px-4 py-3 text-sm ${
                  errors.donorEmail ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                placeholder="name@example.com"
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
              />
              {errors.donorEmail && <p className="mt-1 text-xs text-red-600">{errors.donorEmail}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input
                ref={refs.donorPhone}
                type="tel"
                className={`w-full rounded-xl border px-4 py-3 text-sm ${
                  errors.donorPhone ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                placeholder="07X XXX XXXX"
                value={donorPhone}
                onChange={(e) => setDonorPhone(e.target.value)}
              />
              {errors.donorPhone && <p className="mt-1 text-xs text-red-600">{errors.donorPhone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                placeholder="Street, City"
                value={donorAddress}
                onChange={(e) => setDonorAddress(e.target.value)}
              />
            </div>
          </div>
        </div>
        {/* Donation Details */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Donation details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount <span className="text-red-500">*</span></label>
              <input
                ref={refs.amount}
                type="number"
                className={`w-full rounded-xl border px-4 py-3 text-sm ${
                  errors.amount ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                placeholder="e.g., 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Currency <span className="text-red-500">*</span></label>
              <select
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option>LKR</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment channel <span className="text-red-500">*</span></label>
              <select
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
              >
                <option value="bank_deposit">Bank deposit</option>
                <option value="online_gateway">Online gateway</option>
                <option value="cash_counter">Cash counter</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">WhatsApp (optional)</label>
              <input
                ref={refs.whatsapp}
                type="text"
                className={`w-full rounded-xl border px-4 py-3 text-sm ${
                  errors.whatsapp ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                placeholder="+94 7X XXX XXXX"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
              {errors.whatsapp && <p className="mt-1 text-xs text-red-600">{errors.whatsapp}</p>}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => {
                  const v = e.target.checked
                  setIsAnonymous(v)
                  if (v) setAllowNamePublic(false)
                }}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">Make donor anonymous</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!isAnonymous && allowNamePublic}
                onChange={(e) => setAllowNamePublic(e.target.checked)}
                disabled={isAnonymous}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
              />
              <span className="text-sm text-slate-700">Allow name to be public</span>
            </label>
          </div>
        </div>
        {/* Payment Details */}
        {channel !== "cash_counter" && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Payment details</h2>

            {channel === "bank_deposit" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Bank name <span className="text-red-500">*</span></label>
                  <input
                    ref={refs.bankName}
                    type="text"
                    className={`w-full rounded-xl border px-4 py-3 text-sm ${
                      errors.bankName ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                    placeholder="e.g., BOC"
                    value={bank.name}
                    onChange={(e) => setBank((b) => ({ ...b, name: e.target.value }))}
                  />
                  {errors.bankName && <p className="mt-1 text-xs text-red-600">{errors.bankName}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Branch</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="e.g., Matara"
                    value={bank.branch}
                    onChange={(e) => setBank((b) => ({ ...b, branch: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Deposit date <span className="text-red-500">*</span></label>
                  <input
                    ref={refs.depositDate}
                    type="date"
                    className={`w-full rounded-xl border px-4 py-3 text-sm ${
                      errors.depositDate ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                    value={bank.depositDate}
                    onChange={(e) => setBank((b) => ({ ...b, depositDate: e.target.value }))}
                  />
                  {errors.depositDate && <p className="mt-1 text-xs text-red-600">{errors.depositDate}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Depositor name</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="who deposited"
                    value={bank.depositor}
                    onChange={(e) => setBank((b) => ({ ...b, depositor: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference / Slip No. <span className="text-red-500">*</span></label>
                  <input
                    ref={refs.reference}
                    type="text"
                    className={`w-full rounded-xl border px-4 py-3 text-sm ${
                      errors.reference ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                    placeholder="SLIP-12345"
                    value={bank.reference}
                    onChange={(e) => setBank((b) => ({ ...b, reference: e.target.value }))}
                  />
                  {errors.reference && <p className="mt-1 text-xs text-red-600">{errors.reference}</p>}
                </div>
                {/* Current slip */}
                {existingSlip && !removeSlip && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Current slip</label>
                    <div className="flex items-center gap-3">
                      <img
                        src={slipUrl(existingSlip)}
                        alt="Current slip"
                        onError={(e) => { e.currentTarget.style.display = "none" }}
                        className="h-24 w-auto rounded-lg border border-slate-200 bg-slate-50 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setRemoveSlip(true)}
                        className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </div>
                )}

                {removeSlip && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    The current slip will be removed when you save — or upload a new one below to replace it.
                  </div>
                )}

                {/* Replace / upload slip */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    {existingSlip && !removeSlip ? "Replace deposit evidence" : "Upload deposit evidence"}
                  </label>
                  <div className="mt-2">
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 hover:border-blue-400 hover:bg-blue-50 transition">
                      <Upload size={24} className="text-slate-400 mb-2" />
                      <span className="text-sm text-slate-600">Tap to upload</span>
                      <span className="text-xs text-slate-500">PNG/JPG, ≤ 2 MB</span>
                      <input type="file" accept="image/png,image/jpeg" onChange={onProofSelect} className="hidden" />
                    </label>
                    {proofErr && <p className="mt-1 text-xs text-red-600">{proofErr}</p>}
                    {proofPreview && (
                      <div className="mt-3">
                        <img src={proofPreview} alt="New slip preview" className="h-32 w-auto rounded-lg border border-slate-200" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {channel === "online_gateway" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Card details are never stored — only the selected channel is saved, so no card data is needed when editing.
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 bg-blue-600 text-white font-medium rounded-2xl shadow-sm hover:bg-blue-700 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-xl bg-green-600 px-5 py-3 text-white shadow-lg">
          <Check size={20} />
          <span className="text-sm font-medium">Donation updated successfully.</span>
          <button
            onClick={() => setShowToast(false)}
            className="ml-2 text-white/80 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

