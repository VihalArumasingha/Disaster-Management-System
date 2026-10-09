import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks'
import { USER_ROLES } from '../../constants/roles'

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

function AuthPage({ mode }) {
    const isRegister = mode === 'register'
    const { user, loading, loadError, login, register } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
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
    const registered = location.state?.registered

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

    if (loading) {
        return <div className="py-24 text-center text-gray-600">Loading…</div>
    }

    if (user && user.role !== USER_ROLES.citizen) {
        return <Navigate to="/dashboard" replace />
    }

    const handleSubmit = async (event) => {
        event.preventDefault()
        setError('')
        setSubmitting(true)

        try {
            if (isRegister) {
                await register({
                    ...form,
                    ...(citizenLocation ? { location: citizenLocation } : {})
                })
                navigate('/login', {
                    replace: true,
                    state: { registered: true }
                })
                return
            }

            await login({ email: form.email, password: form.password })
            navigate('/dashboard', { replace: true })
        } catch (requestError) {
            setError(
                requestError.response?.data?.message
                || 'Unable to complete your request. Please try again.'
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <main className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-6xl items-center px-4 py-12">
            <div className="grid w-full overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">
                <section className="bg-slate-900 p-8 text-white md:p-12">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                        SafeZone operations
                    </p>
                    <h1 className="mt-6 text-3xl font-bold md:text-4xl">
                        {isRegister ? 'Create your account' : 'Staff portal sign in'}
                    </h1>
                    <p className="mt-4 leading-7 text-slate-300">
                        {isRegister
                            ? 'One account registration for both SafeZone experiences. New accounts start as citizens; authorized staff roles are assigned by an administrator.'
                            : 'Sign in to the DMC officer, duty officer, or NGO manager workspace. Citizen accounts use the SafeZone mobile view.'}
                    </p>
                    <Link
                        to="/"
                        className="mt-8 inline-block text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                        ← Return to SafeZone
                    </Link>
                </section>

                <section className="p-8 md:p-12">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {isRegister ? 'Register' : 'Welcome back'}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        {isRegister
                            ? 'Your account will be created with the citizen role.'
                            : 'Use your assigned staff account to continue.'}
                    </p>

                    {registered && (
                        <p role="status" className="mt-5 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                            Account created. Sign in after your staff role has been assigned.
                        </p>
                    )}
                    {loadError && (
                        <p role="alert" className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                            {loadError}
                        </p>
                    )}
                    {error && (
                        <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                            {error}
                        </p>
                    )}

                    <form onSubmit={handleSubmit} className="mt-7 space-y-5">
                        {isRegister && (
                            <label className="block text-sm font-medium text-gray-700">
                                Full name
                                <input
                                    required
                                    autoComplete="name"
                                    value={form.name}
                                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                        )}
                        {isRegister && (
                            <label className="block text-sm font-medium text-gray-700">
                                Phone number
                                <input
                                    required
                                    type="tel"
                                    autoComplete="tel"
                                    minLength={7}
                                    value={form.phone}
                                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                        )}
                        {isRegister && (
                            <label className="block text-sm font-medium text-gray-700">
                                National ID <span className="font-normal text-gray-500">(optional)</span>
                                <input
                                    autoComplete="off"
                                    value={form.nationalId}
                                    onChange={(event) => setForm({ ...form, nationalId: event.target.value })}
                                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                        )}
                        {isRegister && (
                            <label className="block text-sm font-medium text-gray-700">
                                Home address <span className="font-normal text-gray-500">(optional)</span>
                                <textarea
                                    autoComplete="street-address"
                                    rows={2}
                                    value={form.homeAddress}
                                    onChange={(event) => setForm({ ...form, homeAddress: event.target.value })}
                                    className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>
                        )}
                        {isRegister && (
                            <label className="block text-sm font-medium text-gray-700">
                                District <span className="font-normal text-gray-500">(optional)</span>
                                <select
                                    autoComplete="address-level2"
                                    value={form.district}
                                    onChange={(event) => setForm({ ...form, district: event.target.value })}
                                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="">Select a district</option>
                                    {SRI_LANKAN_DISTRICTS.map((district) => (
                                        <option key={district} value={district}>{district}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                        <label className="block text-sm font-medium text-gray-700">
                            Email address
                            <input
                                required
                                type="email"
                                autoComplete="email"
                                value={form.email}
                                onChange={(event) => setForm({ ...form, email: event.target.value })}
                                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                            />
                        </label>
                        <label className="block text-sm font-medium text-gray-700">
                            Password
                            <input
                                required
                                type="password"
                                minLength={isRegister ? 8 : undefined}
                                autoComplete={isRegister ? 'new-password' : 'current-password'}
                                value={form.password}
                                onChange={(event) => setForm({ ...form, password: event.target.value })}
                                className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                            />
                            {isRegister && <span className="mt-1 block text-xs text-gray-500">At least 8 characters.</span>}
                        </label>
                            {isRegister && (
                                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                    <p className="text-sm font-medium text-gray-800">Your location (optional)</p>
                                    <p className="mt-1 text-xs leading-5 text-gray-600">
                                        Share your current location to be matched to any DMC target area that covers it.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={requestLocation}
                                        disabled={locating}
                                        className="mt-3 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                                    >
                                        {locating ? 'Getting location…' : citizenLocation ? 'Update my location' : 'Use my current location'}
                                    </button>
                                    {locationMessage && (
                                        <p role="status" className="mt-2 text-xs text-gray-600">{locationMessage}</p>
                                    )}
                                </div>
                            )}
                        <button
                            disabled={submitting || locating}
                            className="w-full rounded-xl bg-blue-700 px-4 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {submitting
                                ? 'Please wait…'
                                : isRegister
                                    ? 'Create account'
                                    : 'Sign in to staff portal'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-gray-600">
                        {isRegister ? 'Already registered?' : 'Need an account?'}{' '}
                        <Link
                            to={isRegister ? '/login' : '/register'}
                            className="font-semibold text-blue-700 hover:text-blue-900"
                        >
                            {isRegister ? 'Sign in' : 'Create one'}
                        </Link>
                    </p>
                </section>
            </div>
        </main>
    )
}

export default AuthPage
