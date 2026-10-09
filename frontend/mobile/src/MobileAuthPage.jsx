import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './authContext'
import { CITIZEN_ROLE } from './constants/roles'

const SRI_LANKAN_DISTRICTS = [
    'Ampara',
    'Anuradhapura',
    'Badulla',
    'Batticaloa',
    'Colombo',
    'Galle',
    'Gampaha',
    'Hambantota',
    'Jaffna',
    'Kalutara',
    'Kandy',
    'Kegalle',
    'Kilinochchi',
    'Kurunegala',
    'Mannar',
    'Matale',
    'Matara',
    'Monaragala',
    'Mullaitivu',
    'Nuwara Eliya',
    'Polonnaruwa',
    'Puttalam',
    'Ratnapura',
    'Trincomalee',
    'Vavuniya'
]

function MobileAuthPage({ mode }) {
    const isRegister = mode === 'register'
    const { user, loading, loadError, signIn, signUp } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        nationalId: '',
        homeAddress: '',
        district: ''
    })
    const [citizenLocation, setCitizenLocation] = useState(null)
    const [locationMessage, setLocationMessage] = useState('')
    const [locating, setLocating] = useState(false)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    if (loading) {
        return <div className="px-6 py-16 text-center text-slate-500">Loading your account…</div>
    }
    if (user?.role === CITIZEN_ROLE) return <Navigate to="/dashboard" replace />

    const requestLocation = () => {
        if (!navigator.geolocation) {
            setLocationMessage('Location is not supported by this browser. You can continue without it.')
            return
        }

        setLocating(true)
        setLocationMessage('')
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                setCitizenLocation({
                    latitude: coords.latitude,
                    longitude: coords.longitude
                })
                setLocationMessage('Location added. We will use it only to match relevant target areas.')
                setLocating(false)
            },
            () => {
                setLocationMessage('Location was not shared. You can continue without it.')
                setLocating(false)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        )
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setError('')
        setSubmitting(true)

        try {
            if (isRegister) {
                await signUp({
                    ...form,
                    ...(citizenLocation ? { location: citizenLocation } : {})
                })
                navigate('/login', {
                    replace: true,
                    state: { registered: true }
                })
                return
            }

            await signIn({ email: form.email, password: form.password })
            navigate('/dashboard', { replace: true })
        } catch (requestError) {
            setError(
                requestError.response?.data?.message
                || 'Could not complete your request. Check your connection and try again.'
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 sm:px-6">
            <section className="w-full max-w-md rounded-3xl bg-white px-6 py-8 shadow-xl sm:px-9 sm:py-10">
                <div className="mb-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-700 text-xl font-bold text-white">
                        S
                    </div>
                    <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                        SafeZone citizen
                    </p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                        {isRegister ? 'Create an account' : 'Welcome back'}
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        {isRegister
                            ? 'Register once to access citizen services. New accounts are created with the citizen role.'
                            : 'Sign in to see safety information and community support for citizens.'}
                    </p>
                </div>

                {location.state?.registered && !isRegister && (
                    <p role="status" className="mb-5 rounded-xl bg-green-50 p-3 text-sm text-green-800">
                        Account created. You can now sign in.
                    </p>
                )}
                {loadError && (
                    <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                        {loadError}
                    </p>
                )}
                {error && (
                    <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {isRegister && (
                        <label className="block text-sm font-medium text-slate-700">
                            Full name
                            <input
                                required
                                autoComplete="name"
                                value={form.name}
                                onChange={(event) => setForm({ ...form, name: event.target.value })}
                                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>
                    )}
                    {isRegister && (
                        <label className="block text-sm font-medium text-slate-700">
                            Phone number
                            <input
                                required
                                type="tel"
                                autoComplete="tel"
                                minLength={7}
                                value={form.phone}
                                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>
                    )}
                    {isRegister && (
                        <label className="block text-sm font-medium text-slate-700">
                            National ID <span className="font-normal text-slate-500">(optional)</span>
                            <input
                                autoComplete="off"
                                value={form.nationalId}
                                onChange={(event) => setForm({ ...form, nationalId: event.target.value })}
                                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>
                    )}
                    {isRegister && (
                        <label className="block text-sm font-medium text-slate-700">
                            Home address <span className="font-normal text-slate-500">(optional)</span>
                            <textarea
                                autoComplete="street-address"
                                rows={2}
                                value={form.homeAddress}
                                onChange={(event) => setForm({ ...form, homeAddress: event.target.value })}
                                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>
                    )}
                    {isRegister && (
                        <label className="block text-sm font-medium text-slate-700">
                            District <span className="font-normal text-slate-500">(optional)</span>
                            <select
                                autoComplete="address-level2"
                                value={form.district}
                                onChange={(event) => setForm({ ...form, district: event.target.value })}
                                className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">Select a district</option>
                                {SRI_LANKAN_DISTRICTS.map((district) => (
                                    <option key={district} value={district}>{district}</option>
                                ))}
                            </select>
                        </label>
                    )}
                    <label className="block text-sm font-medium text-slate-700">
                        Email address
                        <input
                            required
                            type="email"
                            autoComplete="email"
                            value={form.email}
                            onChange={(event) => setForm({ ...form, email: event.target.value })}
                            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>
                    {isRegister && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-medium text-slate-800">Your location (optional)</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">
                                Share your current location to be matched to any DMC target area that covers it.
                            </p>
                            <button
                                type="button"
                                onClick={requestLocation}
                                disabled={locating}
                                className="mt-3 min-h-10 rounded-lg border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                            >
                                {locating ? 'Getting location…' : citizenLocation ? 'Update my location' : 'Use my current location'}
                            </button>
                            {locationMessage && (
                                <p role="status" className="mt-2 text-xs text-slate-600">{locationMessage}</p>
                            )}
                        </div>
                    )}
                    <label className="block text-sm font-medium text-slate-700">
                        Password
                        <input
                            required
                            type="password"
                            minLength={isRegister ? 8 : undefined}
                            autoComplete={isRegister ? 'new-password' : 'current-password'}
                            value={form.password}
                            onChange={(event) => setForm({ ...form, password: event.target.value })}
                            className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-base outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
                        />
                        {isRegister && <span className="mt-1 block text-xs text-slate-500">At least 8 characters.</span>}
                    </label>
                    <button
                        disabled={submitting || locating}
                        className="min-h-12 w-full rounded-xl bg-blue-700 px-4 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
                    </button>
                </form>

                <p className="mt-6 text-center text-sm text-slate-600">
                    {isRegister ? 'Already have an account?' : 'New to SafeZone?'}{' '}
                    <Link
                        to={isRegister ? '/login' : '/register'}
                        className="font-semibold text-blue-700 hover:text-blue-900"
                    >
                        {isRegister ? 'Sign in' : 'Create account'}
                    </Link>
                </p>
                <p className="mt-7 border-t border-slate-100 pt-5 text-center text-xs leading-5 text-slate-500">
                    This is the citizen portal.{' '}
                    <a
                        href={import.meta.env.VITE_WEB_APP_URL || 'http://localhost:5173'}
                        className="font-semibold text-blue-700 hover:text-blue-900"
                    >
                        Staff members can sign in through the web portal.
                    </a>
                </p>
            </section>
        </main>
    )
}

export default MobileAuthPage
