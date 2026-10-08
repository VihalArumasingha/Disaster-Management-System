import { useEffect, useState } from 'react'
import { Building2, HeartHandshake, MapPin, Package, Pencil, Plus, RefreshCw, Save, ShieldCheck, Users } from 'lucide-react'
import api from '../../services/api'

const fieldClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
const contributionTypes = ['Financial', 'Goods', 'Service', 'Other']
const today = new Date().toISOString().slice(0, 10)
const emptyContribution = { contributionType: 'Financial', description: '', amount: '', currency: 'LKR', quantity: '', disasterEvent: '', contributedAt: today }

function OrganizationPortalPage({ view }) {
    const [data, setData] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [profileEditing, setProfileEditing] = useState(false)
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
    const [passwordOpen, setPasswordOpen] = useState(false)
    const [contribution, setContribution] = useState(emptyContribution)

    const loadData = async () => {
        setLoading(true)
        setError('')
        try {
            const [{ data: dashboard }, { data: profileResult }] = await Promise.all([
                api.get('/organization/dashboard'),
                api.get('/organization/profile')
            ])
            setData(dashboard)
            setProfile(profileResult.organization)
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not load organization data.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let active = true
        Promise.all([api.get('/organization/dashboard'), api.get('/organization/profile')])
            .then(([dashboardResponse, profileResponse]) => {
                if (!active) return
                setData(dashboardResponse.data)
                setProfile(profileResponse.data.organization)
                setError('')
            })
            .catch((requestError) => {
                if (active) setError(requestError.response?.data?.message || 'Could not load organization data.')
            })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [])

    const saveProfile = async (event) => {
        event.preventDefault()
        setSaving(true)
        setError('')
        setNotice('')
        try {
            const { data: result } = await api.put('/organization/profile', {
                organizationName: profile.organizationName,
                contactPerson: profile.contactPerson,
                email: profile.email,
                phone: profile.phone,
                address: profile.address,
                district: profile.district,
                description: profile.description
            })
            setProfile(result.organization)
            setProfileEditing(false)
            setNotice('Organization profile updated.')
            await loadData()
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not update organization profile.')
        } finally {
            setSaving(false)
        }
    }

    const changePassword = async (event) => {
        event.preventDefault()
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setError('New password and confirmation do not match.')
            return
        }
        setSaving(true)
        setError('')
        setNotice('')
        try {
            const { data: result } = await api.patch('/organization/password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            })
            setNotice(result.message)
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
            setPasswordOpen(false)
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not change password.')
        } finally {
            setSaving(false)
        }
    }

    const recordContribution = async (event) => {
        event.preventDefault()
        setSaving(true)
        setError('')
        setNotice('')
        try {
            await api.post('/organization/contributions', {
                ...contribution,
                amount: contribution.amount === '' ? undefined : Number(contribution.amount),
                quantity: contribution.quantity === '' ? undefined : Number(contribution.quantity)
            })
            setContribution(emptyContribution)
            setNotice('Contribution recorded.')
            await loadData()
        } catch (requestError) {
            setError(requestError.response?.data?.message || 'Could not record contribution.')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <main className="mx-auto max-w-7xl px-5 py-20 text-center text-slate-600">Loading your organization data…</main>

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Organization workspace</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">{pageTitle(view)}</h1>
                    <p className="mt-2 text-slate-600">{profile?.organizationName} · {profile?.district}</p>
                </div>
                <button type="button" onClick={loadData} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw size={16} /> Refresh</button>
            </header>
            {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {notice && <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
            {!data || !profile ? null : (
                <>
                    {view === 'dashboard' && <Overview data={data} />}
                    {view === 'profile' && (
                        <ProfileSection
                            profile={profile}
                            setProfile={setProfile}
                            editing={profileEditing}
                            setEditing={setProfileEditing}
                            saving={saving}
                            saveProfile={saveProfile}
                            passwordOpen={passwordOpen}
                            setPasswordOpen={setPasswordOpen}
                            passwordForm={passwordForm}
                            setPasswordForm={setPasswordForm}
                            changePassword={changePassword}
                        />
                    )}
                    {view === 'donations' && <Donations data={data.donations} />}
                    {view === 'activities' && <Activities rows={data.contributions} />}
                    {view === 'disasters' && <Disasters data={data} />}
                </>
            )}
        </main>
    )
}

function Overview({ data }) {
    const cards = [
        ['Activities', data.summary.contributions, 'Recorded contribution history', Users],
        ['Active disasters', data.summary.activeDisasters, `Hazard types: ${data.hazardTypes.map(humanize).join(', ') || 'none reported'}`, MapPin],
        ['District impacts', data.summary.impactRecords, `Impact records for ${data.organization.district}`, Building2]
    ]
    return (
        <>
            <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {cards.map(([label, value, caption, Icon]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{label}</p><Icon size={19} className="text-blue-700" /></div><p className="mt-3 text-2xl font-bold text-slate-900">{quantity(value)}</p><p className="mt-1 text-xs text-slate-500">{caption}</p></article>)}
            </section>
            <section className="mt-6 grid gap-4 xl:grid-cols-2">
                <DataList title="Relevant active disasters" empty="No active disaster alerts currently match your district." rows={data.disasters} render={(row) => <div><p className="font-semibold text-slate-900">{row.title} · {humanize(row.hazardType)}</p><p className="mt-1 text-sm text-slate-600">{row.summary}</p><p className="mt-1 text-xs text-slate-500">{row.severity} · {row.city}</p></div>} />
                <DataList title="Recent district impact" empty="No district impact records have been recorded." rows={data.impacts.slice(0, 6)} render={(row) => <div><p className="font-semibold text-slate-900">{row.disasterEvent} · {row.district}</p><p className="mt-1 text-sm text-slate-600">{quantity(row.affectedPopulation)} affected · {quantity(row.evacuatedPopulation)} evacuated · {quantity(row.injured)} injured</p><p className="mt-1 text-xs text-slate-500">{new Date(row.recordedDate).toLocaleDateString()}</p></div>} />
            </section>
        </>
    )
}

function ProfileSection({ profile, setProfile, editing, setEditing, saving, saveProfile, passwordOpen, setPasswordOpen, passwordForm, setPasswordForm, changePassword }) {
    const districts = ['Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya']
    return (
        <div className="mt-7 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Organization profile</h2><p className="mt-1 text-sm text-slate-500">Sensitive organization type, registration number, and activation are managed by DMC.</p></div><button type="button" onClick={() => setEditing(!editing)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"><Pencil size={15} />{editing ? 'Cancel' : 'Edit'}</button></div>
                <form onSubmit={saveProfile} className="mt-5 grid gap-4 sm:grid-cols-2">
                    <ProfileInput label="Organization name" value={profile.organizationName} disabled={!editing} onChange={(value) => setProfile({ ...profile, organizationName: value })} />
                    <ProfileInput label="Contact person" value={profile.contactPerson} disabled={!editing} onChange={(value) => setProfile({ ...profile, contactPerson: value })} />
                    <ProfileInput label="Registered email / login" value={profile.email} type="email" disabled={!editing} onChange={(value) => setProfile({ ...profile, email: value })} />
                    <ProfileInput label="Phone" value={profile.phone} type="tel" disabled={!editing} onChange={(value) => setProfile({ ...profile, phone: value })} />
                    <ProfileInput label="Address" value={profile.address} disabled={!editing} onChange={(value) => setProfile({ ...profile, address: value })} />
                    <label className="block text-sm font-medium text-slate-700">District<select className={fieldClass} value={profile.district} disabled={!editing} onChange={(event) => setProfile({ ...profile, district: event.target.value })}>{districts.map((district) => <option key={district}>{district}</option>)}</select></label>
                    <label className="block text-sm font-medium text-slate-700 sm:col-span-2">Description<textarea className={fieldClass} rows="3" value={profile.description || ''} disabled={!editing} onChange={(event) => setProfile({ ...profile, description: event.target.value })} /></label>
                    {editing && <div className="sm:col-span-2"><button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Save size={16} />{saving ? 'Saving…' : 'Save profile'}</button></div>}
                </form>
                <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><ProfileDetail label="Organization ID" value={profile.organizationId} /><ProfileDetail label="Organization type" value={profile.organizationType} /><ProfileDetail label="Registration number" value={profile.registrationNumber || 'Not provided'} /><ProfileDetail label="Account status" value={profile.status} /></div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-semibold text-slate-900">Account security</h2><p className="mt-1 text-sm text-slate-500">Change the password securely. The current password is required.</p><button type="button" onClick={() => setPasswordOpen(!passwordOpen)} className="mt-4 rounded-lg border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-700">{passwordOpen ? 'Close password form' : 'Change password'}</button>{passwordOpen && <form onSubmit={changePassword} className="mt-4 space-y-3"><ProfileInput label="Current password" type="password" value={passwordForm.currentPassword} onChange={(value) => setPasswordForm({ ...passwordForm, currentPassword: value })} /><ProfileInput label="New password" type="password" value={passwordForm.newPassword} onChange={(value) => setPasswordForm({ ...passwordForm, newPassword: value })} /><ProfileInput label="Confirm new password" type="password" value={passwordForm.confirmPassword} onChange={(value) => setPasswordForm({ ...passwordForm, confirmPassword: value })} /><p className="text-xs text-slate-500">Use a password between 8 and 72 bytes.</p><button disabled={saving} className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Updating…' : 'Update password'}</button></form>}</section>
        </div>
    )
}

function Donations({ data }) {
    return <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-slate-200 px-5 py-4 font-semibold">Donations for this organization</h2>{data.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Donor', 'Amount', 'Channel', 'Status', 'Date'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.map((row) => <tr key={row._id}><td className="px-4 py-3">{row.donorName || row.donorEmail}</td><td className="px-4 py-3">{row.currency} {quantity(row.amount)}</td><td className="px-4 py-3">{row.channel || '—'}</td><td className="px-4 py-3">{row.status}</td><td className="px-4 py-3">{new Date(row.depositDate || row.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <EmptyState message="No organization donations are linked to the registered email yet." />}</section>
}


function Activities({ rows }) {
    return (
        <div className="mt-7">
            <DataList
                title="Contribution history"
                empty="No contributions recorded yet."
                rows={rows}
                render={(row) => (
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
                                {row.contributionType}
                            </span>
                            <p className="font-semibold text-slate-900">{row.description}</p>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                            {row.amount !== undefined && row.amount !== null
                                ? `${row.currency || 'LKR'} ${quantity(row.amount)}`
                                : ''}
                            {row.amount !== undefined && row.amount !== null && row.quantity !== undefined && row.quantity !== null ? ' · ' : ''}
                            {row.quantity !== undefined && row.quantity !== null
                                ? `Quantity ${quantity(row.quantity)}`
                                : ''}
                            {row.disasterEvent ? ` · ${row.disasterEvent}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            {new Date(row.contributedAt).toLocaleDateString()} · Recorded by {row.recordedBy?.name || 'DMC Officer'}
                        </p>
                    </div>
                )}
            />
        </div>
    )
}

function Disasters({ data }) {
    return <div className="mt-7 grid gap-5 xl:grid-cols-2"><DataList title={`Active disaster information · ${data.organization.district}`} empty="No active disaster alerts currently match your district." rows={data.disasters} render={(row) => <div><p className="font-semibold text-slate-900">{row.title} · {humanize(row.hazardType)}</p><p className="mt-1 text-sm text-slate-600">{row.summary}</p><p className="mt-1 text-xs text-slate-500">{row.severity} · Top needs: {row.topNeeds}</p></div>} /><DataList title="Existing district impact records" empty="No impact monitoring records for your district." rows={data.impacts} render={(row) => <div><p className="font-semibold text-slate-900">{row.disasterEvent}</p><p className="mt-1 text-sm text-slate-600">Affected {quantity(row.affectedPopulation)} · Evacuated {quantity(row.evacuatedPopulation)} · Shelter {quantity(row.peopleInShelters)} · Injured {quantity(row.injured)} · Deaths {quantity(row.deaths)}</p><p className="mt-1 text-xs text-slate-500">{new Date(row.recordedDate).toLocaleDateString()}</p></div>} /><DataList title="District shelters" empty="No shelter records for your district." rows={data.shelters} render={(row) => <div><p className="font-semibold">{row.shelterName} · {row.shelterId}</p><p className="mt-1 text-sm text-slate-600">{quantity(row.currentOccupancy)} / {quantity(row.capacity)} occupied · {quantity(row.availableCapacity)} spaces available · {row.status}</p></div>} /><div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900"><p className="font-semibold">Existing incident and hazard reporting</p><p className="mt-2">District-matched alerts and impact monitoring reuse the existing warning and impact records. Report Clusters and Escalated Reports are maintained in the DMC workflow; those records do not currently include an organization or district relationship, so they are not presented as organization-specific records.</p><p className="mt-2">Hazard types shown here come from saved disaster alerts and target-area records: {data.hazardTypes.map(humanize).join(', ') || 'no hazard types in matching records'}.</p></div></div>
}

function DataList({ title, rows, empty, render }) {
    return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-900">{title} <span className="text-xs font-normal text-slate-500">({rows.length})</span></h2>{rows.length ? <ul className="divide-y divide-slate-100">{rows.map((row, index) => <li key={row._id || row.distributionId || row.supplyId || index} className="px-4 py-3">{render(row)}</li>)}</ul> : <EmptyState message={empty} />}</section>
}

function ProfileInput({ label, value, onChange, disabled = false, type = 'text', required = false }) {
    return <label className="block text-sm font-medium text-slate-700">{label}<input required={required} type={type} className={fieldClass} value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>
}

function ProfileDetail({ label, value }) {
    return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm text-slate-800">{value}</p></div>
}

function EmptyState({ message }) {
    return <p className="p-6 text-center text-sm text-slate-500">{message}</p>
}

function pageTitle(view) {
    return ({ dashboard: 'Organization Overview', profile: 'Organization Profile', donations: 'Donations', activities: 'Activities & Contributions', disasters: 'Disasters & District Impact' })[view] || 'Organization Workspace'
}

function humanize(value) {
    return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function quantity(value) {
    return new Intl.NumberFormat().format(Number(value) || 0)
}

export default OrganizationPortalPage