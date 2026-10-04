import { Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './authContext'
import { CITIZEN_ROLE } from './constants/roles'
import api from './services/api'

const citizenServices = [
    {
        title: 'Local alerts',
        description: 'Stay informed about active incidents and official safety updates in your area.'
    },
    {
        title: 'Safety guidance',
        description: 'Find practical preparation advice and steps to take during an emergency.'
    },
    {
        title: 'Community support',
        description: 'Connect with assistance information and available community resources.'
    }
]

function CitizenDashboard() {
    const { user, loading, signOut } = useAuth()
    const navigate = useNavigate()
    const [error, setError] = useState('')
    const [notifications, setNotifications] = useState([])
    const [notificationError, setNotificationError] = useState('')

    useEffect(() => {
        if (!user || user.role !== CITIZEN_ROLE) return undefined
        let active = true
        api.get('/citizen/notifications')
            .then(({ data }) => {
                if (active) setNotifications(data.notifications)
            })
            .catch((requestError) => {
                if (active) {
                    setNotificationError(
                        requestError.response?.data?.message
                        || 'Could not load your alerts. Please try again.'
                    )
                }
            })
        return () => {
            active = false
        }
    }, [user])

    if (loading) {
        return <div className="px-6 py-16 text-center text-slate-500">Loading your account…</div>
    }
    if (!user) return <Navigate to="/login" replace />
    if (user.role !== CITIZEN_ROLE) return <Navigate to="/login" replace />

    const handleSignOut = async () => {
        try {
            await signOut()
            navigate('/login', { replace: true })
        } catch {
            setError('Could not sign out. Check your connection and try again.')
        }
    }

    const markRead = async (notificationId) => {
        try {
            const { data } = await api.patch(`/citizen/notifications/${notificationId}/read`)
            setNotifications((current) => current.map((notification) => (
                notification._id === notificationId ? data.notification : notification
            )))
        } catch (requestError) {
            setNotificationError(
                requestError.response?.data?.message
                || 'Could not update this alert. Please try again.'
            )
        }
    }

    return (
        <main className="mx-auto min-h-screen w-full max-w-md bg-slate-50 px-5 pb-10 pt-7 sm:px-7">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 font-bold text-white">S</div>
                    <div>
                        <p className="font-bold text-slate-900">SafeZone</p>
                        <p className="text-xs text-slate-500">Citizen services</p>
                    </div>
                </div>
                <button
                    onClick={handleSignOut}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                    Sign out
                </button>
            </header>

            <section className="mt-8 rounded-3xl bg-gradient-to-br from-blue-800 to-sky-600 p-6 text-white shadow-lg">
                <p className="text-sm font-medium text-blue-100">Citizen dashboard</p>
                <h1 className="mt-2 text-2xl font-bold">Hello, {user.name}</h1>
                <p className="mt-3 text-sm leading-6 text-blue-50">
                    Your safety information and community services, all in one place.
                </p>
            </section>

            {error && (
                <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </p>
            )}

            <section className="mt-8">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">Safety alerts</h2>
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                        {notifications.filter((notification) => !notification.readAt).length} unread
                    </span>
                </div>
                {notificationError && (
                    <p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{notificationError}</p>
                )}
                {notifications.length === 0 ? (
                    <p className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                        No alerts yet. Official warnings for your area will appear here.
                    </p>
                ) : (
                    <div className="mt-3 space-y-3">
                        {notifications.map((notification) => (
                            <article
                                key={notification._id}
                                className={`rounded-2xl border p-4 ${notification.readAt ? 'border-slate-200 bg-white' : 'border-red-200 bg-red-50'}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-red-700">
                                            {notification.severity} · {notification.hazardType}
                                        </p>
                                        <h3 className="mt-1 font-semibold text-slate-900">{notification.title}</h3>
                                    </div>
                                    {!notification.readAt && (
                                        <button
                                            type="button"
                                            onClick={() => markRead(notification._id)}
                                            className="shrink-0 text-xs font-semibold text-blue-700 underline"
                                        >
                                            Mark read
                                        </button>
                                    )}
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-700">{notification.message}</p>
                                <p className="mt-3 text-xs text-slate-500">{new Date(notification.createdAt).toLocaleString()}</p>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section className="mt-8">
                <h2 className="text-lg font-bold text-slate-900">Your services</h2>
                <div className="mt-4 space-y-3">
                    {citizenServices.map(({ title, description }, index) => (
                        <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                                    {index + 1}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900">{title}</h3>
                                    <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        </main>
    )
}

export default CitizenDashboard
