
const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

/* UI helpers */
function ToggleChip({ id, checked, onChange, children }) {
  return (
    <div className="don-toggle-chip">
      <input id={id} type="checkbox" className="don-toggle-inp" checked={checked} onChange={onChange} />
      <label htmlFor={id} className="don-toggle-lab">
        <span className="don-tick" aria-hidden>✓</span>
        <span className="don-txt">{children}</span>
      </label>
    </div>
  );
}

function Field({ label, required = false, hint, error, children }) {
  return (
    <div className={`don-field ${error ? "don-field-err" : ""}`}>
      <label className="don-lab">
        {label} {required && <span className="don-req">*</span>}
      </label>
      {children}
      {hint && !error ? <div className="don-help">{hint}</div> : null}
      {error ? <div className="don-err-text">{error}</div> : null}
    </div>
  );
}

/* utils */
const channelLabel = (v) =>
  v === "bank_deposit" ? "Bank deposit" :
  v === "online_gateway" ? "Online gateway" :
  v === "cash_counter" ? "Cash" : v;

function buildWhatsAppURL(phoneRaw, text) {
  if (!phoneRaw) return null;
  let n = (phoneRaw + "").replace(/[^\d+]/g, "");
  if (/^0\d{8,}$/.test(n)) n = "+94" + n.slice(1);
  if (/^\d{8,}$/.test(n)) n = "+" + n;
  const digits = n.replace(/\D/g, "");
  if (digits.length < 9) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

const isValidPhone = (s) => {
  const v = String(s || "").replace(/[^\d+]/g, "");
  return /^\+94\d{9}$/.test(v) || /^0\d{9}$/.test(v); // +947XXXXXXXX or 0XXXXXXXXX
};

const luhn = (num) => {
  const s = String(num).replace(/\s+/g, "");
  let sum = 0, dbl = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let d = parseInt(s[i], 10);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return sum % 10 === 0;
};

export default function Donationform() {
  const nav = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const searchStr = search.toString(); // stable dep
  const causeJSON = useMemo(
    () => JSON.stringify(location.state?.cause || null),
    [location.state]
  );

  // optional cause (from router state or query)
  const [donationCause, setDonationCause] = useState({ id: "", title: "", area: "" });
  useEffect(() => {
    const fromState = causeJSON ? JSON.parse(causeJSON) : null;
    const fromQuery = {
      id: search.get("cause") || "",
      title: search.get("title") || "",
      area: search.get("area") || "",
    };
    const picked = fromState || (fromQuery.id || fromQuery.title || fromQuery.area ? fromQuery : null);
    if (picked) {
      setDonationCause(prev =>
        prev.id !== picked.id || prev.title !== picked.title || prev.area !== picked.area ? picked : prev
      );
    }
  }, [searchStr, causeJSON]);

  /* donor basics */
  const [donorType, setDonorType] = useState("individual"); // 'individual' | 'organization'
  const [donorName, setDonorName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [donorAddress, setDonorAddress] = useState("");

  /* money */
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("LKR");
  const [channel, setChannel] = useState("bank_deposit");

  /* visibility */
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowNamePublic, setAllowNamePublic] = useState(true);

  /* WhatsApp (optional) */
  const [whatsapp, setWhatsapp] = useState("");

  /* bank extras */
  const [bank, setBank] = useState({
    name: "",
    depositDate: "",
    branch: "",
    depositor: "",
    reference: "",
  });

  /* online gateway demo fields (required when channel = online_gateway) */
  const [gateway, setGateway] = useState({ cardNo: "", exp: "", cvc: "", holder: "" });

  /* deposit proof */
  const [proofFile, setProofFile] = useState(null);
  const [proofErr, setProofErr] = useState("");
  const [proofPreview, setProofPreview] = useState("");

  /* submit UI state */
  const [saving, setSaving] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [serverErrors, setServerErrors] = useState([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  /* inline errors + focus */
  const [errors, setErrors] = useState({});
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
  };

  function onProofSelect(e) {
    const f = e.target.files?.[0];
    setProofErr(""); setProofFile(null); setProofPreview("");
    if (!f) return;
    if (!["image/png", "image/jpeg"].includes(f.type)) { setProofErr("Only PNG or JPG allowed."); return; }
    if (f.size > 2 * 1024 * 1024) { setProofErr("File too large. Max 2 MB."); return; }
    setProofFile(f);
    setProofPreview(URL.createObjectURL(f));
  }

  const isOrg = donorType === "organization";
  const displayName = isOrg ? orgName : donorName;

  /* -------- validation -------- */
  const validate = () => {
    const e = {};

   if (!displayName.trim()) {
  e.displayName = isOrg ? "Organization name is required." : "Donor name is required.";
} else if (/\d/.test(displayName)) {
  e.displayName = "Name should not contain numbers.";
}

    if (!donorEmail.trim() && !donorPhone.trim()) {
      e.donorEmail = "Provide at least email or phone.";
      e.donorPhone = "Provide at least email or phone.";
    }
    if (donorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
  e.donorEmail = "Enter a valid email address.";
}

    if (donorPhone && !isValidPhone(donorPhone)) e.donorPhone = "Enter a valid phone (e.g., +94712345678 or 0712345678).";
    if (whatsapp && !isValidPhone(whatsapp)) e.whatsapp = "Enter a valid WhatsApp number.";

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount = "Enter a positive amount.";

    // Payment fields required for everything EXCEPT cash counter
    if (channel !== "cash_counter") {
      if (channel === "bank_deposit") {
        if (!bank.name.trim()) e.bankName = "Bank name is required.";
        if (!bank.depositDate) e.depositDate = "Deposit date is required.";
        if (!bank.reference.trim()) e.reference = "Reference / Slip No. is required.";
      } else if (channel === "online_gateway") {
        const cn = gateway.cardNo.replace(/\s+/g, "");
        if (!cn) e.cardNo = "Card number is required.";
        else if (!/^\d{13,19}$/.test(cn) || !luhn(cn)) e.cardNo = "Invalid card number.";
     
        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(gateway.exp)) {
  e.exp = "Use MM/YY.";
} else {
  // Check if expired
  const [mm, yy] = gateway.exp.split("/");
  const expMonth = parseInt(mm, 10);
  const expYear = 2000 + parseInt(yy, 10);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
    e.exp = "Card expiry date has passed.";
  }
}

        if (!/^\d{3,4}$/.test(gateway.cvc)) e.cvc = "CVC should be 3–4 digits.";
        if (!gateway.holder.trim()) e.holder = "Cardholder name is required.";
      }
    }

    setErrors(e);

    if (Object.keys(e).length) {
      const first = Object.keys(e)[0];
      const r = refs[first];
      if (r && r.current) {
        r.current.focus({ preventScroll: false });
        r.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return false;
    }
    return true;
  };

  /* -------- submit -------- */
  async function onSubmit(e) {
    e.preventDefault();
    setSubmitErr(""); setServerErrors([]); setSuccessMsg("");
    setSaving(true);

    try {
      if (!validate()) { setSaving(false); return; }

      const fd = new FormData();
      fd.append("donorType", isOrg ? "Organization" : "Individual");
      if (displayName) fd.append("donorName", displayName);
      if (donorEmail) fd.append("donorEmail", donorEmail);
      if (donorPhone) fd.append("donorPhone", donorPhone);
      if (donorAddress) fd.append("donorAddress", donorAddress);
      if (whatsapp) fd.append("whatsapp", whatsapp);

      if (amount) fd.append("amount", String(Number(amount)));
      if (currency) fd.append("currency", currency);
      if (channel) fd.append("channel", channelLabel(channel));

      fd.append("isAnonymous", isAnonymous ? "true" : "false");
      fd.append("allowNamePublic", (!isAnonymous && allowNamePublic) ? "true" : "false");

      if (channel === "bank_deposit") {
        if (bank.name) fd.append("bankName", bank.name);
        if (bank.branch) fd.append("branch", bank.branch);
        if (bank.depositDate) fd.append("depositDate", bank.depositDate);
        if (bank.depositor) fd.append("depositorName", bank.depositor);
        if (bank.reference) fd.append("referenceNo", bank.reference);
        if (proofFile) fd.append("evidence", proofFile);
      }

      fd.append("status", "RECEIVED");

      const res = await fetch(`${API_BASE}/api/donations`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (Array.isArray(data?.errors) && data.errors.length) setServerErrors(data.errors);
        throw new Error(data?.message || "Failed to save donation");
      }

      // success: toast + banner
      setSuccessMsg("Donation recorded successfully.");
      setShowToast(true);
      setSaving(false);

      // optional WhatsApp thank-you
      if (whatsapp.trim()) {
        const msg = `Thank you for your donation to SafeZone NGO.
Amount: ${amount || "-"} ${currency}
Channel: ${channelLabel(channel)}
${donationCause?.title ? `Cause: ${donationCause.title} (${donationCause.area || "-"})` : ""}
We appreciate your support!`;
        const url = buildWhatsAppURL(whatsapp.trim(), msg);
        if (url) window.open(url, "_blank");
      }

      // hide toast & go back
      setTimeout(() => setShowToast(false), 2500);
      setTimeout(() => nav("/donation", { state: { flash: "Donation recorded successfully." } }), 1100);
    } catch (err) {
      setSaving(false);
      setSubmitErr(err.message || "Something went wrong");
    }
  }

  // -------- UI --------
  return (
    <div className="donation-component">
      <form className="don-wrap" onSubmit={onSubmit}>
      <div className="don-hero">
        <div>
          <h1 className="don-title">
            {donationCause?.title ? `Fundraiser • ${donationCause.title}` : "Fundraiser"}
          </h1>
          <div className="don-sub">
            {donationCause?.title
              ? "Your donation will be allocated to the selected response."
              : "Please support our cause with a small donation today!"}
          </div>
          {donationCause?.area && <div className="don-chip don-soft don-mt6">Area: {donationCause.area}</div>}
        </div>

        {/* Only a single Cancel button here, per your requirement */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="don-btn don-btn-ghost"
            onClick={() => {
              if (location.state?.from) nav(location.state.from);
              else if (window.history.length > 1) nav(-1);
              else nav("/donation");
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Alerts */}
      {successMsg && <div className="don-alert don-alert-success">{successMsg}</div>}
      {(submitErr || serverErrors.length > 0) && (
        <div className="don-alert don-alert-error">
          {submitErr}
          {serverErrors.length > 0 && (
            <ul className="don-err-list">
              {serverErrors.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="don-grid">
        <section className="don-panel">
          <h3 className="don-panel-title">Donor details</h3>

          <div className="don-row">
            <label className="don-lab">Donor type</label>
            <div className="don-chips">
              <label className="don-radio">
                <input type="radio" name="donorType" checked={donorType === "individual"} onChange={() => setDonorType("individual")} />
                <span>Individual</span>
              </label>
              <label className="don-radio">
                <input type="radio" name="donorType" checked={donorType === "organization"} onChange={() => setDonorType("organization")} />
                <span>Organization</span>
              </label>
            </div>
          </div>

          <div className="don-grid2">
            <Field
              label={donorType === "organization" ? "Organization name" : "Donor name"}
              required
              error={errors.displayName}
            >
              <input
                ref={refs.displayName}
                className={`don-inp ${errors.displayName ? "don-inp-err" : ""}`}
                placeholder={donorType === "organization" ? "e.g., Kind Hearts Foundation" : "e.g., Tharindu Perera"}
                value={donorType === "organization" ? orgName : donorName}
                onChange={(e) => donorType === "organization" ? setOrgName(e.target.value) : setDonorName(e.target.value)}
              />
            </Field>

            <Field label="Phone" error={errors.donorPhone} hint="e.g., +94712345678 or 0712345678">
              <input
                ref={refs.donorPhone}
                className={`don-inp ${errors.donorPhone ? "don-inp-err" : ""}`}
                placeholder="+94 XX XXX XXXX"
                value={donorPhone}
                onChange={(e) => setDonorPhone(e.target.value)}
              />
            </Field>
          </div>

          <div className="don-grid2">
            <Field label="Email" error={errors.donorEmail}>
              <input
                ref={refs.donorEmail}
                className={`don-inp ${errors.donorEmail ? "don-inp-err" : ""}`}
                placeholder="name@email.com"
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
              />
            </Field>
            <Field label="Address">
              <input className="don-inp" placeholder="Street, City" value={donorAddress} onChange={(e) => setDonorAddress(e.target.value)} />
            </Field>
          </div>

          <div className="don-grid3">
            <Field label="Amount" required error={errors.amount}>
              <input
                ref={refs.amount}
                className={`don-inp ${errors.amount ? "don-inp-err" : ""}`}
                placeholder="e.g., 5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Currency" required>
              <select className="don-inp" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option>LKR</option><option>USD</option><option>EUR</option>
              </select>
            </Field>
            <Field label="Channel" required>
              <select className="don-inp" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="bank_deposit">Bank deposit</option>
                <option value="online_gateway">Online gateway</option>
                <option value="cash_counter">Cash counter</option>
              </select>
            </Field>
          </div>

          <Field label="WhatsApp (optional)" error={errors.whatsapp}>
            <input
              ref={refs.whatsapp}
              className={`don-inp ${errors.whatsapp ? "don-inp-err" : ""}`}
              placeholder="+94 7X XXX XXXX"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </Field>

          <div className="don-consent-wrap">
            <div className="don-consent-grid">
              <ToggleChip
                id="isAnonymous"
                checked={isAnonymous}
                onChange={(e) => {
                  const v = e.target.checked;
                  setIsAnonymous(v);
                  if (v) setAllowNamePublic(false);
                }}
              >
                Make donor anonymous
              </ToggleChip>

              <ToggleChip
                id="allowNamePublic"
                checked={!isAnonymous && allowNamePublic}
                onChange={(e) => setAllowNamePublic(e.target.checked)}
              >
                Allow name to be public
              </ToggleChip>
            </div>
          </div>
        </section>

        <section className="don-panel">
          <h3 className="don-panel-title">Payment details</h3>

          {channel === "bank_deposit" && (
            <>
              <div className="don-grid3">
                <Field label="Bank name" required error={errors.bankName}>
                  <input
                    ref={refs.bankName}
                    className={`don-inp ${errors.bankName ? "don-inp-err" : ""}`}
                    placeholder="e.g., BOC"
                    value={bank.name}
                    onChange={(e) => setBank((b) => ({ ...b, name: e.target.value }))}
                  />
                </Field>
                <Field label="Branch">
                  <input
                    className="don-inp"
                    placeholder="e.g., Matara"
                    value={bank.branch}
                    onChange={(e) => setBank((b) => ({ ...b, branch: e.target.value }))}
                  />
                </Field>
                <Field label="Deposit date" required error={errors.depositDate}>
                  <input
                    ref={refs.depositDate}
                    type="date"
                    className={`don-inp ${errors.depositDate ? "don-inp-err" : ""}`}
                    value={bank.depositDate}
                    onChange={(e) => setBank((b) => ({ ...b, depositDate: e.target.value }))}
                  />
                </Field>
              </div>

              <div className="don-grid2">
                <Field label="Depositor name">
                  <input
                    className="don-inp"
                    placeholder="who deposited"
                    value={bank.depositor}
                    onChange={(e) => setBank((b) => ({ ...b, depositor: e.target.value }))}
                  />
                </Field>
                <Field label="Reference / Slip No." required error={errors.reference}>
                  <input
                    ref={refs.reference}
                    className={`don-inp ${errors.reference ? "don-inp-err" : ""}`}
                    placeholder="SLIP-12345"
                    value={bank.reference}
                    onChange={(e) => setBank((b) => ({ ...b, reference: e.target.value }))}
                  />
                </Field>
              </div>

              <div className="don-upload-card">
                <div className="don-upload-head">
                  <strong>Upload deposit evidence</strong>
                  <span className="don-muted">PNG/JPG, ≤ 2 MB</span>
                </div>
                <input className="don-inp" type="file" accept="image/png,image/jpeg" onChange={onProofSelect} />
                {proofErr && <div className="don-err-text">{proofErr}</div>}
                {proofPreview && (
                  <div className="don-proof-wrap">
                    <img src={proofPreview} alt="Proof preview" className="don-proof-img" />
                  </div>
                )}
              </div>
            </>
          )}

          {channel === "online_gateway" && (
            <div className="don-gateway-demo">
              <div className="don-gw-row">
                <Field label="Card number" required error={errors.cardNo}>
                  <input
                    ref={refs.cardNo}
                    className={`don-inp ${errors.cardNo ? "don-inp-err" : ""}`}
                    placeholder="1234 5678 9012 3456"
                    value={gateway.cardNo}
                    onChange={(e) => setGateway((g) => ({ ...g, cardNo: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="don-grid3">
                <Field label="Expiry (MM/YY)" required error={errors.exp}>
                  <input
                    ref={refs.exp}
                    className={`don-inp ${errors.exp ? "don-inp-err" : ""}`}
                    placeholder="MM/YY"
                    value={gateway.exp}
                    onChange={(e) => setGateway((g) => ({ ...g, exp: e.target.value }))}
                  />
                </Field>
                <Field label="CVC" required error={errors.cvc}>
                  <input
                    ref={refs.cvc}
                    className={`don-inp ${errors.cvc ? "don-inp-err" : ""}`}
                    placeholder="123"
                    value={gateway.cvc}
                    onChange={(e) => setGateway((g) => ({ ...g, cvc: e.target.value }))}
                  />
                </Field>
                <Field label="Cardholder name" required error={errors.holder}>
                  <input
                    ref={refs.holder}
                    className={`don-inp ${errors.holder ? "don-inp-err" : ""}`}
                    placeholder="As printed on the card"
                    value={gateway.holder}
                    onChange={(e) => setGateway((g) => ({ ...g, holder: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="don-muted don-small">Demo only — do not enter real card data.</div>
            </div>
          )}
        </section>
      </div>

      <div className="don-form-actions">
        <button type="submit" className="don-btn don-btn-primary don-btn-lg" disabled={saving}>
          {saving ? "Submitting…" : "Submit"}
        </button>
      </div>

      {/* success toast */}
      {showToast && (
        <div className="don-toast don-toast-success">
          <span>Donation recorded successfully.</span>
          <button className="don-toast-x" onClick={() => setShowToast(false)} aria-label="Close">×</button>
        </div>
      )}
    </form>
    </div>
  );
}
