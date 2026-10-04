import { useEffect, useState } from 'react'
import { ShieldCheck, UserRound } from 'lucide-react'
import api from '../../../services/api'

function DmcProfilePage() {
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        api.get('/dmcofficer/profile')
            .then(({ data }) => {
                if (active) setProfile(data.profile)
            })
            .catch((requestError) => {
                if (active) {
                    setError(
                        requestError.response?.data?.message
                        || 'Could not load your profile.'
                    )
                }
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
        }
    }, [])

    return (
        <main className="mx-auto max-w-4xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Account</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Profile</h1>
            <p className="mt-2 text-slate-600">Your DMC officer account details.</p>

            {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
            {loading ? (
                <p className="mt-8 text-sm text-slate-600">Loading profile…</p>
            ) : profile ? (
                <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center gap-4 bg-slate-900 p-6 text-white sm:p-8">
                        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-600">
                            <UserRound size={27} />
                        </span>
                        <div>
                            <h2 className="text-xl font-semibold">{profile.name}</h2>
                            <p className="mt-1 text-sm text-slate-300">DMC Officer</p>
                        </div>
                    </div>
                    <dl className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
                        <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email address</dt>
                            <dd className="mt-1 break-all text-sm font-medium text-slate-900">{profile.email}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone number</dt>
                            <dd className="mt-1 text-sm font-medium text-slate-900">{profile.phone || 'Not provided'}</dd>
                        </div>
                        <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</dt>
                            <dd className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-slate-900">
                                <ShieldCheck size={16} className="text-green-700" /> {profile.role}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Account created</dt>
                            <dd className="mt-1 text-sm font-medium text-slate-900">
                                {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '—'}
                            </dd>
                        </div>
                    </dl>
                </section>
            ) : null}
        </main>
    )
}

export default DmcProfilePage
