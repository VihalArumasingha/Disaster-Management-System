import { useRef, useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Heart, User, Building2, X, Check, Upload } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000"

/* utils */
const channelLabel = (v) =>
  v === "bank_deposit" ? "Bank deposit" :
  v === "online_gateway" ? "Online gateway" :
  v === "cash_counter" ? "Cash" : v

function buildWhatsAppURL(phoneRaw, text) {
  if (!phoneRaw) return null
  let n = (phoneRaw + "").replace(/[^\d+]/g, "")
  if (/^0\d{8,}$/.test(n)) n = "+94" + n.slice(1)
  if (/^\d{8,}$/.test(n)) n = "+" + n
  const digits = n.replace(/\D/g, "")
  if (digits.length < 9) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

const isValidPhone = (s) => {
  const v = String(s || "").replace(/[^\d+]/g, "")
  return /^\+94\d{9}$/.test(v) || /^0\d{9}$/.test(v)
}

const luhn = (num) => {
  const s = String(num).replace(/\s+/g, "")
  let sum = 0, dbl = false
  for (let i = s.length - 1; i >= 0; i--) {
    let d = parseInt(s[i], 10)
    if (dbl) { d *= 2; if (d > 9) d -= 9 }
    sum += d; dbl = !dbl
  }
  return sum % 10 === 0
}

export default function DonationMoney() {
  const nav = useNavigate()
  const location = useLocation()
  const [search] = useSearchParams()
  const searchStr = search.toString()
  const causeJSON = useMemo(
    () => JSON.stringify(location.state?.cause || null),
    [location.state]
  )

  const [donationCause, setDonationCause] = useState({ id: "", title: "", area: "" })
  useEffect(() => {
    const fromState = causeJSON ? JSON.parse(causeJSON) : null
    const fromQuery = {
      id: search.get("cause") || "",
      title: search.get("title") || "",
      area: search.get("area") || "",
    }
    const picked = fromState || (fromQuery.id || fromQuery.title || fromQuery.area ? fromQuery : null)
    if (picked) {
      setDonationCause(prev =>
        prev.id !== picked.id || prev.title !== picked.title || prev.area !== picked.area ? picked : prev
      )
    }
  }, [searchStr, causeJSON])

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

  const [gateway, setGateway] = useState({ cardNo: "", exp: "", cvc: "", holder: "" })

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
    cardNo: useRef(null),
    exp: useRef(null),
    cvc: useRef(null),
    holder: useRef(null),
    whatsapp: useRef(null),
  }

  function onProofSelect(e) {
    const f = e.target.files?.[0]
    setProofErr(""); setProofFile(null); setProofPreview("")
    if (!f) return
    if (!["image/png", "image/jpeg"].includes(f.type)) { setProofErr("Only PNG or JPG allowed."); return }
    if (f.size > 2 * 1024 * 1024) { setProofErr("File too large. Max 2 MB."); return }
    setProofFile(f)
    setProofPreview(URL.createObjectURL(f))
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

    if (channel !== "cash_counter") {
      if (channel === "bank_deposit") {
        if (!bank.name.trim()) e.bankName = "Bank name is required."
        if (!bank.depositDate) e.depositDate = "Deposit date is required."
        if (!bank.reference.trim()) e.reference = "Reference / Slip No. is required."
      } else if (channel === "online_gateway") {
        const cn = gateway.cardNo.replace(/\s+/g, "")
        if (!cn) e.cardNo = "Card number is required."
        else if (!/^\d{13,19}$/.test(cn) || !luhn(cn)) e.cardNo = "Invalid card number."

        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(gateway.exp)) {
          e.exp = "Use MM/YY."
        } else {
          const [mm, yy] = gateway.exp.split("/")
          const expMonth = parseInt(mm, 10)
          const expYear = 2000 + parseInt(yy, 10)
          const now = new Date()
          const currentMonth = now.getMonth() + 1
          const currentYear = now.getFullYear()

          if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
            e.exp = "Card expiry date has passed."
          }
        }

        if (!/^\d{3,4}$/.test(gateway.cvc)) e.cvc = "CVC should be 3–4 digits."
        if (!gateway.holder.trim()) e.holder = "Cardholder name is required."
      }
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
      if (displayName) fd.append("donorName", displayName)
      if (donorEmail) fd.append("donorEmail", donorEmail)
      if (donorPhone) fd.append("donorPhone", donorPhone)
      if (donorAddress) fd.append("donorAddress", donorAddress)
      if (whatsapp) fd.append("whatsapp", whatsapp)

      if (amount) fd.append("amount", String(Number(amount)))
      if (currency) fd.append("currency", currency)
      if (channel) fd.append("channel", channelLabel(channel))

      fd.append("isAnonymous", isAnonymous ? "true" : "false")
      fd.append("allowNamePublic", (!isAnonymous && allowNamePublic) ? "true" : "false")

      if (channel === "bank_deposit") {
        if (bank.name) fd.append("bankName", bank.name)
        if (bank.branch) fd.append("branch", bank.branch)
        if (bank.depositDate) fd.append("depositDate", bank.depositDate)
        if (bank.depositor) fd.append("depositorName", bank.depositor)
        if (bank.reference) fd.append("referenceNo", bank.reference)
        if (proofFile) fd.append("evidence", proofFile)
      }

      fd.append("status", "RECEIVED")

      const res = await fetch(`${API_BASE}/api/donations`, { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) {
        if (Array.isArray(data?.errors) && data.errors.length) setServerErrors(data.errors)
        throw new Error(data?.message || "Failed to save donation")
      }

      setSuccessMsg("Donation recorded successfully.")
      setShowToast(true)
      setSaving(false)

      if (whatsapp.trim()) {
        const msg = `Thank you for your donation to SafeZone NGO.
Amount: ${amount || "-"} ${currency}
Channel: ${channelLabel(channel)}
${donationCause?.title ? `Cause: ${donationCause.title} (${donationCause.area || "-"})` : ""}
We appreciate your support!`
        const url = buildWhatsAppURL(whatsapp.trim(), msg)
        if (url) window.open(url, "_blank")
      }

      setTimeout(() => setShowToast(false), 2500)
      setTimeout(() => nav("/ngomanager/donations", { state: { flash: "Donation recorded successfully." } }), 1100)
    } catch (err) {
      setSaving(false)
      setSubmitErr(err.message || "Something went wrong")
    }
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
          <span className="font-bold text-slate-900">Support</span>
        </div>
        <div className="w-20" />
      </header>

      <form onSubmit={onSubmit} className="px-5 py-6">
        {/* Hero */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {donationCause?.title ? `Fundraiser • ${donationCause.title}` : "Start Fundraising"}
          </h1>
          <p className="text-sm text-slate-600">
            {donationCause?.title
              ? "Your donation will be allocated to the selected response."
              : "Please support our cause with a small donation today!"}
          </p>
          {donationCause?.area && (
            <div className="mt-2 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
              Area: {donationCause.area}
            </div>
          )}
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
                onChange={(e) => donorType === "organization" ? setOrgName(e.target.value) : setDonorName(e.target.value)}
              />
              {errors.displayName && <p className="mt-1 text-xs text-red-600">{errors.displayName}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
              <input
                ref={refs.donorPhone}
                type="text"
                className={`w-full rounded-xl border px-4 py-3 text-sm ${
                  errors.donorPhone ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                placeholder="+94 XX XXX XXXX"
                value={donorPhone}
                onChange={(e) => setDonorPhone(e.target.value)}
              />
              {errors.donorPhone && <p className="mt-1 text-xs text-red-600">{errors.donorPhone}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                ref={refs.donorEmail}
                type="email"
                className={`w-full rounded-xl border px-4 py-3 text-sm ${
                  errors.donorEmail ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                placeholder="name@email.com"
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
              />
              {errors.donorEmail && <p className="mt-1 text-xs text-red-600">{errors.donorEmail}</p>}
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

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Upload deposit evidence</label>
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
                        <img src={proofPreview} alt="Proof preview" className="h-32 w-auto rounded-lg border border-slate-200" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {channel === "online_gateway" && (
              <div className="space-y-4">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  Demo only — do not enter real card data.
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Card number <span className="text-red-500">*</span></label>
                  <input
                    ref={refs.cardNo}
                    type="text"
                    className={`w-full rounded-xl border px-4 py-3 text-sm ${
                      errors.cardNo ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                    placeholder="1234 5678 9012 3456"
                    value={gateway.cardNo}
                    onChange={(e) => setGateway((g) => ({ ...g, cardNo: e.target.value }))}
                  />
                  {errors.cardNo && <p className="mt-1 text-xs text-red-600">{errors.cardNo}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Expiry (MM/YY) <span className="text-red-500">*</span></label>
                    <input
                      ref={refs.exp}
                      type="text"
                      className={`w-full rounded-xl border px-4 py-3 text-sm ${
                        errors.exp ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                      placeholder="MM/YY"
                      value={gateway.exp}
                      onChange={(e) => setGateway((g) => ({ ...g, exp: e.target.value }))}
                    />
                    {errors.exp && <p className="mt-1 text-xs text-red-600">{errors.exp}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">CVC <span className="text-red-500">*</span></label>
                    <input
                      ref={refs.cvc}
                      type="text"
                      className={`w-full rounded-xl border px-4 py-3 text-sm ${
                        errors.cvc ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                      placeholder="123"
                      value={gateway.cvc}
                      onChange={(e) => setGateway((g) => ({ ...g, cvc: e.target.value }))}
                    />
                    {errors.cvc && <p className="mt-1 text-xs text-red-600">{errors.cvc}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cardholder name <span className="text-red-500">*</span></label>
                  <input
                    ref={refs.holder}
                    type="text"
                    className={`w-full rounded-xl border px-4 py-3 text-sm ${
                      errors.holder ? "border-red-500 focus:border-red-500" : "border-slate-300 focus:border-blue-500"
                    } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
                    placeholder="As printed on the card"
                    value={gateway.holder}
                    onChange={(e) => setGateway((g) => ({ ...g, holder: e.target.value }))}
                  />
                  {errors.holder && <p className="mt-1 text-xs text-red-600">{errors.holder}</p>}
                </div>
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
          {saving ? "Submitting…" : "Submit Donation"}
        </button>
      </form>

      {/* Success Toast */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-xl bg-green-600 px-5 py-3 text-white shadow-lg">
          <Check size={20} />
          <span className="text-sm font-medium">Donation recorded successfully.</span>
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
