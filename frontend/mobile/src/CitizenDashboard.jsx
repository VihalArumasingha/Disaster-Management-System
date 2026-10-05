import {
    AlertTriangle,
    Bell,
    ChevronRight,
    ClipboardPlus,
    Clock3,
    Heart,
    House,
    LogOut,
    Map,
    MapPin,
    ShieldCheck,
    UserRound
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './authContext'
import { CITIZEN_ROLE } from './constants/roles'
import api from './services/api'

const navigation = [
    { label: 'Home', path: '/dashboard', icon: House },
    { label: 'Map', path: '/map', icon: Map },
    { label: 'Report', path: '/report', icon: ClipboardPlus, primary: true },
    { label: 'Alerts', path: '/alerts', icon: Bell },
    { label: 'Profile', path: '/profile', icon: UserRound }
]

const severityStyles = {
    advisory: 'bg-sky-100 text-sky-800',
    watch: 'bg-amber-100 text-amber-900',
    warning: 'bg-orange-100 text-orange-900',
    emergency: 'bg-red-100 text-red-800'
}

const greetingForTime = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
}

const formatIssuedAt = (date) => {
    if (!date) return 'Recently issued'
    const parsed = new Date(date)
    return Number.isNaN(parsed.getTime())
        ? 'Recently issued'
        : parsed.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function CitizenDashboard() {
    const { user, loading, signOut } = useAuth()
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const [notifications, setNotifications] = useState([])
    const [warnings, setWarnings] = useState([])
    const [loadError, setLoadError] = useState('')
    const [signOutError, setSignOutError] = useState('')
    const [loadingWarnings, setLoadingWarnings] = useState(true)

    useEffect(() => {
        if (!user || user.role !== CITIZEN_ROLE) return undefined
        let active = true

        const loadCitizenData = async () => {
            try {
                const [notificationResponse, warningResponse] = await Promise.all([
                    api.get('/citizen/notifications'),
                    api.get('/citizen/warnings/recent')
                ])
                if (!active) return
                setNotifications(notificationResponse.data.notifications)
                setWarnings(warningResponse.data.warnings)
                setLoadError('')
            } catch (requestError) {
                if (active) {
                    setLoadError(
                        requestError.response?.data?.message
                        || 'Could not load your latest alerts. Please try again.'
                    )
                }
            } finally {
                if (active) setLoadingWarnings(false)
            }
        }

        loadCitizenData()
        const refreshTimer = window.setInterval(loadCitizenData, 30000)
        return () => {
            active = false
            window.clearInterval(refreshTimer)
        }
    }, [user])

    if (loading) {
        return <div className="px-6 py-16 text-center text-slate-500">Loading your account…</div>
    }
    if (!user) return <Navigate to="/login" replace />
    if (user.role !== CITIZEN_ROLE) return <Navigate to="/login" replace />

    const unreadCount = notifications.filter((notification) => !notification.readAt).length
    const activePath = pathname === '/' ? '/dashboard' : pathname
    const firstName = user.name?.trim().split(/\s+/)[0] || 'there'
    const latestWarning = warnings[0]

    const handleSignOut = async () => {
        try {
            await signOut()
            navigate('/login', { replace: true })
        } catch {
            setSignOutError('Could not sign out. Check your connection and try again.')
        }
    }

    const markRead = async (notificationId) => {
        try {
            const { data } = await api.patch(`/citizen/notifications/${notificationId}/read`)
            setNotifications((current) => current.map((notification) => (
                notification._id === notificationId ? data.notification : notification
            )))
        } catch (requestError) {
            setLoadError(
                requestError.response?.data?.message
                || 'Could not update this alert. Please try again.'
            )
        }
    }

    const renderHome = () => (
        <>
            <section className="px-5 pb-5 pt-7">
                <p className="text-sm font-medium text-slate-500">{greetingForTime()},</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{firstName}</h1>
                <p className="mt-1 text-sm text-slate-500">Here are the latest safety updates for you.</p>
            </section>

            <section className="px-5">
                <div className="mb-3 flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Stay informed</p>
                        <h2 className="mt-1 text-lg font-bold text-slate-950">Latest warning</h2>
                    </div>
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                        For your area
                    </span>
                </div>

                {loadingWarnings ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                        Loading your latest warning…
                    </div>
                ) : latestWarning ? (
                    <article className="overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">
                        <div className="flex items-center gap-3 bg-red-700 px-5 py-4 text-white">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                                <AlertTriangle size={21} aria-hidden="true" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-red-100">
                                    Official safety warning
                                </p>
                                <h3 className="mt-0.5 truncate text-lg font-bold">{latestWarning.title}</h3>
                            </div>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-800">
                                {latestWarning.severity}
                            </span>
                        </div>
                        <div className="p-5">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${severityStyles[latestWarning.severity] || 'bg-slate-100 text-slate-700'}`}>
                                    {latestWarning.severity}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
                                    {String(latestWarning.hazardType || 'hazard').replaceAll('_', ' ')}
                                </span>
                            </div>

                            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                {latestWarning.message}
                            </p>

                            {latestWarning.targetAreaIds?.length > 0 && (
                                <div className="mt-4 rounded-2xl bg-red-50 p-3.5">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-red-800">
                                        <MapPin size={15} aria-hidden="true" />
                                        Affected area{latestWarning.targetAreaIds.length === 1 ? '' : 's'}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {latestWarning.targetAreaIds.map((area) => (
                                            <span
                                                key={area._id || area}
                                                className="rounded-full border border-red-200 bg-white px-3 py-1 text-xs font-medium text-slate-700"
                                            >
                                                {area.name || 'Target area'}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                                <Clock3 size={14} aria-hidden="true" />
                                <span>Issued {formatIssuedAt(latestWarning.issuedAt || latestWarning.createdAt)}</span>
                            </div>
                            <Link
                                to="/alerts"
                                className="mt-5 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-800"
                            >
                                View all alerts
                                <ChevronRight size={17} aria-hidden="true" />
                            </Link>
                        </div>
                    </article>
                ) : (
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                                <ShieldCheck size={21} aria-hidden="true" />
                            </span>
                            <div>
                                <h3 className="font-bold text-slate-900">You’re all caught up</h3>
                                <p className="mt-1 text-sm text-slate-600">There are no recent warnings for your registered location.</p>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            <section className="mt-7 px-5 pb-5">
                <div className="rounded-2xl bg-blue-50 p-4">
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 shrink-0 text-blue-700" size={19} aria-hidden="true" />
                        <p className="text-sm leading-5 text-blue-950">
                            Keep notifications enabled so you can receive important safety updates.
                        </p>
                    </div>
                </div>
            </section>
        </>
    )

    const renderAlerts = () => (
        <section className="px-5 pb-5 pt-7">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Your updates</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Alerts</h1>
            <p className="mt-1 text-sm text-slate-500">Official warnings and safety updates for your area.</p>
            {warnings.length > 0 && (
                <div className="mt-5">
                    <h2 className="mb-3 text-sm font-bold text-slate-800">Recent warnings</h2>
                    <div className="space-y-3">
                        {warnings.map((warning) => (
                            <article key={warning._id} className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-bold uppercase text-red-700">
                                            {warning.severity} · {warning.hazardType}
                                        </p>
                                        <h3 className="mt-1 font-semibold text-slate-900">{warning.title}</h3>
                                    </div>
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${severityStyles[warning.severity] || 'bg-slate-100 text-slate-700'}`}>
                                        {warning.severity}
                                    </span>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-700">{warning.message}</p>
                                {warning.targetAreaIds?.length > 0 && (
                                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                                        <MapPin size={13} aria-hidden="true" />
                                        {warning.targetAreaIds.map((area) => area.name || 'Target area').join(', ')}
                                    </p>
                                )}
                                <p className="mt-3 text-xs text-slate-500">
                                    Issued {formatIssuedAt(warning.issuedAt || warning.createdAt)}
                                </p>
                            </article>
                        ))}
                    </div>
                </div>
            )}

            <h2 className="mb-3 mt-6 text-sm font-bold text-slate-800">In-app notifications</h2>
            {notifications.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                    No notifications yet. New safety updates will appear here.
                </div>
            ) : (
                <div className="space-y-3">
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
                            <p className="mt-3 text-xs text-slate-500">{formatIssuedAt(notification.createdAt)}</p>
                        </article>
                    ))}
                </div>
            )}
        </section>
    )

    const renderSection = () => {
        if (activePath === '/dashboard') return renderHome()
        if (activePath === '/alerts') return renderAlerts()
        if (activePath === '/profile') {
            return (
                <section className="px-5 pb-5 pt-7">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Account</p>
                    <h1 className="mt-1 text-2xl font-bold text-slate-950">Your profile</h1>
                    <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-800">
                            {firstName.slice(0, 1).toUpperCase()}
                        </div>
                        <h2 className="mt-4 text-lg font-bold text-slate-900">{user.name}</h2>
                        <p className="mt-1 text-sm text-slate-600">{user.email}</p>
                        <p className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                            {user.role}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleSignOut}
                        className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    >
                        <LogOut size={17} aria-hidden="true" />
                        Sign out
                    </button>
                    {signOutError && <p role="alert" className="mt-3 text-sm text-red-700">{signOutError}</p>}
                </section>
            )
        }
        const isReport = activePath === '/report'
        const Icon = isReport ? ClipboardPlus : Map
        return (
            <section className="px-5 pb-5 pt-7">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Citizen services</p>
                <h1 className="mt-1 text-2xl font-bold text-slate-950">{isReport ? 'Report a hazard' : 'Hazard map'}</h1>
                <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                        <Icon size={25} aria-hidden="true" />
                    </span>
                    <h2 className="mt-4 font-bold text-slate-900">{isReport ? 'Hazard reporting is coming next' : 'Map view is coming next'}</h2>
                    <p className="mt-2 text-sm leading-5 text-slate-600">
                        {isReport
                            ? 'You will be able to send a hazard report to the response team from here.'
                            : 'Your local hazard map and nearby risk information will be available here.'}
                    </p>
                    <Link to="/dashboard" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">
                        Back to Home <ChevronRight size={16} aria-hidden="true" />
                    </Link>
                </div>
            </section>
        )
    }

    return (
        <div className="mx-auto min-h-screen w-full max-w-md bg-slate-50 pb-[calc(6rem+env(safe-area-inset-bottom))] text-slate-900 shadow-xl">
            <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-slate-100 bg-white/95 px-5 backdrop-blur">
                <Link to="/dashboard" className="flex items-center gap-2.5" aria-label="DMS home">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-800 text-white">
                        <ShieldCheck size={23} aria-hidden="true" />
                    </span>
                    <span>
                        <span className="block text-base font-extrabold leading-5 tracking-tight text-slate-950">DMS</span>
                        <span className="block text-[10px] font-medium leading-4 text-slate-500">Disaster Management</span>
                    </span>
                </Link>
                <div className="flex items-center gap-3">
                    <Link
                        to="/donation"
                        className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-blue-600 transition"
                    >
                        <Heart size={16} aria-hidden="true" />
                        Support Disaster
                    </Link>
                    <Link
                        to="/alerts"
                        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100"
                        aria-label={unreadCount > 0 ? `${unreadCount} unread alerts` : 'Alerts'}
                    >
                        <Bell size={21} aria-hidden="true" />
                        {unreadCount > 0 && (
                            <span className="absolute right-1 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </Link>
                    <Link
                        to="/profile"
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800"
                        aria-label="Your profile"
                    >
                        {firstName.slice(0, 1).toUpperCase()}
                    </Link>
                </div>
            </header>

            {loadError && (
                <p role="alert" className="mx-5 mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                    {loadError}
                </p>
            )}
            {renderSection()}

            <nav
                aria-label="Main navigation"
                className="fixed bottom-0 left-1/2 z-30 grid h-[74px] w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.07)] backdrop-blur"
            >
                {navigation.map(({ label, path, icon: Icon, primary }) => {
                    const isActive = activePath === path
                    return (
                        <Link
                            key={path}
                            to={path}
                            aria-current={isActive ? 'page' : undefined}
                            className={`flex flex-col items-center justify-center gap-1 ${isActive ? 'text-blue-600' : 'text-slate-500'}`}
                        >
                            <span className="relative">
                                <Icon size={21} strokeWidth={isActive ? 2.4 : 1.9} aria-hidden="true" />
                                {label === 'Alerts' && unreadCount > 0 && (
                                    <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white" />
                                )}
                            </span>
                            <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
                        </Link>
                    )
                })}
            </nav>
        </div>
    )
}

export default CitizenDashboard
