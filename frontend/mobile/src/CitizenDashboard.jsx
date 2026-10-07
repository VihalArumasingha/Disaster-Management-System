import {
    AlertTriangle,
    ArrowLeft,
    ArrowUp,
    Bell,
    ChevronRight,
    CircleCheck,
    ClipboardPlus,
    Hospital,
    Heart,
    House,
    LifeBuoy,
    LogOut,
    Map,
    MapPin,
    Megaphone,
    RefreshCw,
    ShieldCheck,
    UserRound,
    CloudSun,
    Navigation,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from './authContext'
import NgoPastHighlights from './components/Donation/NgoPastHighlights'
import { CITIZEN_ROLE } from './constants/roles'
import api from './services/api'
import NearbyHazardsPanel from './NearbyHazardsPanel'
import WarningMap from './WarningMap'
import ReportHazard from './pages/ReportHazard'
import useWeather from './hooks/useWeather'

const navigation = [
    { label: 'Home', path: '/dashboard', icon: House },
    { label: 'Map', path: '/map', icon: Map },
    {
        label: 'Report',
        path: '/report-hazard',
        icon: ClipboardPlus,
        primary: true
    },
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
        : parsed.toLocaleString([], {
              dateStyle: 'medium',
              timeStyle: 'short'
          })
}

const helpOptions = [
    { label: 'Find help', detail: 'Emergency support', icon: LifeBuoy },
    { label: 'Find shelters', detail: 'Nearby shelter options', icon: House },
    { label: 'Nearby hospitals', detail: 'Medical care nearby', icon: Hospital },
    { label: 'Safe locations', detail: 'Places to stay safe', icon: ShieldCheck }
]

function CitizenDashboard() {
    const { user, loading, signOut } = useAuth()
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const { warningId } = useParams()
    const [notifications, setNotifications] = useState([])
    const [warnings, setWarnings] = useState([])
    const [loadError, setLoadError] = useState('')
    const [signOutError, setSignOutError] = useState('')
    const [loadingWarnings, setLoadingWarnings] = useState(true)
    const [detailWarning, setDetailWarning] = useState(null)
    const [loadedDetailId, setLoadedDetailId] = useState('')
    const [detailError, setDetailError] = useState('')
    const [weatherLocation, setWeatherLocation] = useState({ lat: null, lon: null })

    const { data: weatherData, loading: weatherLoading, error: weatherError } = useWeather(
        weatherLocation.lat,
        weatherLocation.lon
    )

    useEffect(() => {
        if (!('geolocation' in navigator)) return undefined

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setWeatherLocation({
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                })
            },
            () => {
                // The weather hook will fall back to the backend's default location.
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
        )

        return undefined
    }, [])
    useEffect(() => {
        if (!user || user.role !== CITIZEN_ROLE) {
            return undefined
        }

        let active = true

        const loadCitizenData = async () => {
            try {
                const [notificationResponse, warningResponse] = await Promise.all([
                    api.get('/citizen/notifications'),
                    api.get('/citizen/warnings/recent')
                ])

                if (!active) return

                setNotifications(notificationResponse.data.notifications || [])
                setWarnings(warningResponse.data.warnings || [])
                setLoadError('')
            } catch (requestError) {
                if (active) {
                    setLoadError(
                        requestError.response?.data?.message ||
                            'Could not load your latest alerts. Please try again.'
                    )
                }
            } finally {
                if (active) {
                    setLoadingWarnings(false)
                }
            }
        }

        loadCitizenData()

        const refreshTimer = window.setInterval(
            loadCitizenData,
            30000
        )

        return () => {
            active = false
            window.clearInterval(refreshTimer)
        }
    }, [user])

    useEffect(() => {
        if (!user || user.role !== CITIZEN_ROLE || !warningId) return undefined
        let active = true
        api.get(`/citizen/warnings/${warningId}`)
            .then(({ data }) => {
                if (active) {
                    setDetailWarning(data.warning)
                    setDetailError('')
                }
            })
            .catch((requestError) => {
                if (!active) return
                setDetailWarning(null)
                setDetailError(
                    requestError.response?.data?.message
                    || 'Could not load this warning. Please try again.'
                )
            })
            .finally(() => {
                if (active) setLoadedDetailId(warningId)
            })
        return () => {
            active = false
        }
    }, [user, warningId])

    if (loading) {
        return (
            <div className="px-6 py-16 text-center text-slate-500">
                Loading your account…
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    if (user.role !== CITIZEN_ROLE) {
        return <Navigate to="/login" replace />
    }

    const unreadCount = notifications.filter(
        (notification) => !notification.readAt
    ).length

    const activePath =
        pathname === '/' ? '/dashboard' : pathname

    const firstName =
        user.name?.trim().split(/\s+/)[0] || 'there'

    const isWarningDetail = Boolean(warningId)
    const loadingDetail = isWarningDetail && loadedDetailId !== warningId
    const handleSignOut = async () => {
        try {
            await signOut()
            navigate('/login', { replace: true })
        } catch {
            setSignOutError(
                'Could not sign out. Check your connection and try again.'
            )
        }
    }

    const markRead = async (notificationId) => {
        try {
            const { data } = await api.patch(
                `/citizen/notifications/${notificationId}/read`
            )

            setNotifications((current) =>
                current.map((notification) =>
                    notification._id === notificationId
                        ? data.notification
                        : notification
                )
            )
        } catch (requestError) {
            setLoadError(
                requestError.response?.data?.message ||
                    'Could not update this alert. Please try again.'
            )
        }
    }

    const renderHome = () => {
        const weatherCondition = String(weatherData?.condition || '').toLowerCase()
        const weatherIcon = weatherCondition.includes('storm') || weatherCondition.includes('thunder')
            ? '⛈️'
            : weatherCondition.includes('rain') || weatherCondition.includes('drizzle')
                ? '🌧️'
                : weatherCondition.includes('cloud')
                    ? '☁️'
                    : weatherCondition.includes('clear')
                        ? '☀️'
                        : '🌤️'

        return (
            <>
                {/* Hero */}
                <section className="relative overflow-hidden bg-[linear-gradient(120deg,#0B5273_0%,#087E8B_48%,#0EA5C9_100%)] px-5 pb-5 pt-4 text-white shadow-[0_12px_30px_rgba(11,31,63,0.18)]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(182,233,255,0.18),transparent_32%)]" />
                    <div
                        aria-hidden="true"
                        className="absolute -right-8 bottom-0 top-0 w-[62%] opacity-20 mix-blend-screen"
                        style={{
                            backgroundImage: "url('/safezone-hero.png')",
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'center right',
                            backgroundSize: 'cover',
                            filter: 'saturate(0.8) contrast(1.1) brightness(1.08)'
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0b5273]/90 via-[#087e8b]/80 to-[#0ea5c9]/20" />

                    <div className="relative z-10">
                        <p className="text-xs font-semibold text-sky-100">{greetingForTime()},</p>
                        <h1 className="mt-0.5 text-[28px] font-extrabold leading-8 tracking-tight text-white">{firstName}</h1>
                        <p className="mt-1 max-w-[300px] text-xs leading-4 text-sky-50/85">
                            Stay informed, stay prepared, and help keep your community safe.
                        </p>

                        <div className="mt-4 grid grid-cols-3 gap-2">
                            <Link to="/alerts" className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm transition hover:bg-white/15">
                                <p className="text-[9px] font-bold uppercase tracking-wide text-sky-100">Alerts</p>
                                <p className="mt-0.5 text-xs font-extrabold text-white">{unreadCount} unread</p>
                            </Link>
                            <Link to="/map" className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm transition hover:bg-white/15">
                                <p className="text-[9px] font-bold uppercase tracking-wide text-sky-100">Map</p>
                                <p className="mt-0.5 text-xs font-extrabold text-white">Nearby risks</p>
                            </Link>
                            <Link to="/report-hazard" className="rounded-2xl border border-white/15 bg-white/10 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm transition hover:bg-white/15">
                                <p className="text-[9px] font-bold uppercase tracking-wide text-sky-100">Action</p>
                                <p className="mt-0.5 text-xs font-extrabold text-white">Report</p>
                            </Link>
                        </div>
                    </div>
                </section>

                <main className="space-y-5 px-4 pb-6 pt-4">
                    {/* Weather */}
                    <section className="relative overflow-hidden rounded-[26px] border border-sky-100 bg-white shadow-[0_12px_32px_rgba(15,76,129,0.10)]">
                        <div className="absolute -right-8 top-12 h-28 w-28 rounded-full bg-sky-100/70 blur-2xl" />
                        <div className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-blue-50 blur-2xl" />

                        <div className="relative flex items-center justify-between px-5 py-4">
                            <div className="flex items-center gap-2.5">
                                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-500 text-white shadow-sm">
                                    <CloudSun size={19} />
                                </span>
                                <div>
                                    <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-blue-600">Today</p>
                                    <h2 className="text-base font-extrabold text-slate-950">Local weather</h2>
                                </div>
                            </div>
                            {weatherData?.place && (
                                <div className="flex max-w-[135px] items-center gap-1 text-right text-[10px] font-semibold text-slate-500">
                                    <Navigation size={11} className="shrink-0 text-blue-600" />
                                    <span className="truncate">{weatherData.place}</span>
                                </div>
                            )}
                        </div>

                        {weatherLoading ? (
                            <div className="relative mx-4 mb-4 animate-pulse overflow-hidden rounded-[22px] bg-gradient-to-br from-sky-50 to-blue-50 p-4">
                                <CloudSun className="absolute -right-2 -top-3 text-sky-100" size={86} />
                                <div className="relative">
                                    <div className="h-9 w-24 rounded-xl bg-white/80" />
                                    <div className="mt-2 h-4 w-32 rounded bg-white/80" />
                                </div>
                                <div className="relative mt-5 grid grid-cols-3 gap-2">
                                    <div className="h-14 rounded-xl bg-white/70" />
                                    <div className="h-14 rounded-xl bg-white/70" />
                                    <div className="h-14 rounded-xl bg-white/70" />
                                </div>
                            </div>
                        ) : weatherError || !weatherData ? (
                            <div className="relative mx-4 mb-4 overflow-hidden rounded-[22px] bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 p-4">
                                <CloudSun className="absolute -right-3 -top-5 text-sky-100" size={100} strokeWidth={1.2} />
                                <div className="relative flex items-center gap-3">
                                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-blue-600 shadow-sm">
                                        <CloudSun size={25} />
                                    </span>
                                    <div>
                                        <p className="text-sm font-extrabold text-slate-800">Weather is taking a moment</p>
                                        <p className="mt-1 text-[11px] leading-4 text-slate-600">Safety alerts and nearby hazard information are still available below.</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="relative mx-4 mb-4 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#eaf4ff] via-[#edf8ff] to-[#dff7f5] p-4">
                                <CloudSun className="absolute -right-4 -top-5 text-sky-100/90" size={112} strokeWidth={1.1} />
                                <div className="relative flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[44px] font-black leading-none tracking-tight text-[#0b1f3a]">{weatherData.tempC}°</p>
                                        <p className="mt-2 text-xs font-bold capitalize text-slate-600">{weatherData.condition}</p>
                                    </div>
                                    <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-white/85 text-4xl shadow-[0_8px_20px_rgba(15,76,129,0.10)] backdrop-blur">
                                        {weatherIcon}
                                    </div>
                                </div>

                                <div className="relative mt-4 grid grid-cols-3 gap-2">
                                    <div className="rounded-xl bg-white/70 px-2 py-2.5 text-center backdrop-blur">
                                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Humidity</p>
                                        <p className="mt-1 text-xs font-extrabold text-slate-800">{weatherData.humidity}%</p>
                                    </div>
                                    <div className="rounded-xl bg-white/70 px-2 py-2.5 text-center backdrop-blur">
                                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Wind</p>
                                        <p className="mt-1 text-xs font-extrabold text-slate-800">{weatherData.windSpeed} m/s</p>
                                    </div>
                                    <div className="rounded-xl bg-white/70 px-2 py-2.5 text-center backdrop-blur">
                                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Visibility</p>
                                        <p className="mt-1 text-xs font-extrabold text-slate-800">{weatherData.visibilityKm} km</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <NearbyHazardsPanel />

                    {/* Quick help */}
                    <section>
                        <div className="mb-3 px-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Emergency support</p>
                            <h2 className="mt-1 text-xl font-extrabold text-slate-950">Get help nearby</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {helpOptions.map(({ label, detail, icon: Icon }) => (
                                <button key={label} type="button" className="group min-h-[126px] rounded-[24px] border border-sky-100 bg-gradient-to-br from-white to-sky-50 p-4 text-left shadow-[0_8px_20px_rgba(15,76,129,0.06)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_10px_24px_rgba(15,76,129,0.10)] active:scale-[0.98]">
                                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-sm transition group-hover:from-blue-700 group-hover:to-cyan-600">
                                        <Icon size={21} />
                                    </span>
                                    <span className="mt-3 block text-sm font-extrabold text-slate-950">{label}</span>
                                    <span className="mt-1 block text-[11px] leading-4 text-slate-500">{detail}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Recent warnings */}
                    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between px-5 py-4">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Stay updated</p>
                                <h2 className="mt-1 text-lg font-extrabold text-slate-950">Recent warnings</h2>
                            </div>
                            <Link to="/alerts" className="text-xs font-bold text-blue-700">See all</Link>
                        </div>
                        {loadingWarnings ? (
                            <p className="border-t border-slate-100 px-5 py-5 text-sm text-slate-500">Loading recent warnings…</p>
                        ) : warnings.length === 0 ? (
                            <p className="border-t border-slate-100 px-5 py-5 text-sm text-slate-600">There are no recent official warnings.</p>
                        ) : (
                            <div>
                                {warnings.map((warning) => {
                                    const areaNames = warning.targetAreaIds?.map((area) => area.name).filter(Boolean)
                                    const location = areaNames?.length ? areaNames.join(', ') : 'Countrywide'
                                    const issuedAt = warning.issuedAt || warning.createdAt
                                    const timestamp = issuedAt ? new Date(issuedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Recently'
                                    const deliveryFailed = warning.status === 'delivery_failed'
                                    const resolved = Boolean(warning.resolvedAt)
                                    return (
                                        <Link key={warning._id} to={`/warnings/${warning._id}`} className="flex min-h-[78px] items-center gap-3 border-t border-slate-100 px-5 py-3 transition hover:bg-slate-50">
                                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${warning.severity === 'emergency' || warning.severity === 'warning' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                                                <AlertTriangle size={18} />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-bold text-slate-950">{warning.title}</span>
                                                <span className="mt-0.5 block truncate text-[11px] text-slate-500">{location} · {timestamp}</span>
                                                <span className="mt-1.5 flex flex-wrap gap-1.5">
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${severityStyles[warning.severity] || 'bg-slate-100 text-slate-700'}`}>{warning.severity}</span>
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${resolved ? 'bg-emerald-50 text-emerald-700' : deliveryFailed ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{resolved ? 'Resolved' : deliveryFailed ? 'Delivery issue' : 'Active'}</span>
                                                </span>
                                            </span>
                                            <ChevronRight size={18} className="shrink-0 text-slate-300" />
                                        </Link>
                                    )
                                })}
                            </div>
                        )}
                    </section>

                    {/* Notification summary */}
                    <section className="rounded-[24px] border border-sky-100 bg-gradient-to-r from-[#edf7ff] via-[#f4f9ff] to-[#ecfff9] p-4 shadow-[0_10px_24px_rgba(11,31,63,0.05)]">
                        <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-sky-100">
                                <ShieldCheck size={18} />
                            </span>
                            <div>
                                <p className="text-sm font-bold text-blue-950">Your safety feed is active</p>
                                <p className="mt-1 text-xs leading-5 text-blue-900/70">You have {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}. Keep alerts enabled for important updates.</p>
                            </div>
                        </div>
                    </section>

                    {/* NGO Past activity - bottom of page */}
                    <div className="px-5 pb-8">
                        <NgoPastHighlights />
                    </div>
                </main>
            </>
        )
    }

    const renderAlerts = () => (
        <section className="px-5 pb-5 pt-7">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Your updates
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Alerts
            </h1>

            <p className="mt-1 text-sm text-slate-500">
                Official warnings and safety updates for your area.
            </p>

            {warnings.length > 0 && (
                <div className="mt-5">
                    <h2 className="mb-3 text-sm font-bold text-slate-800">
                        Recent warnings
                    </h2>

                    <div className="space-y-3">
                        {warnings.map((warning) => (
                            <article
                                key={warning._id}
                                className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-bold uppercase text-red-700">
                                            {warning.severity} ·{' '}
                                            {warning.hazardType}
                                        </p>

                                        <h3 className="mt-1 font-semibold text-slate-900">
                                            {warning.title}
                                        </h3>
                                    </div>

                                    <span
                                        className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                                            severityStyles[
                                                warning.severity
                                            ] ||
                                            'bg-slate-100 text-slate-700'
                                        }`}
                                    >
                                        {warning.severity}
                                    </span>
                                </div>

                                <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-slate-700">
                                    {warning.message}
                                </p>

                                {warning.targetAreaIds?.length > 0 && (
                                    <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                                        <MapPin
                                            size={13}
                                            aria-hidden="true"
                                        />

                                        {warning.targetAreaIds
                                            .map(
                                                (area) =>
                                                    area.name ||
                                                    'Target area'
                                            )
                                            .join(', ')}
                                    </p>
                                )}

                                <p className="mt-3 text-xs text-slate-500">
                                    Issued{' '}
                                    {formatIssuedAt(
                                        warning.issuedAt ||
                                            warning.createdAt
                                    )}
                                </p>
                            </article>
                        ))}
                    </div>
                </div>
            )}

            <h2 className="mb-3 mt-6 text-sm font-bold text-slate-800">
                In-app notifications
            </h2>

            {notifications.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                    No notifications yet. New safety updates will appear
                    here.
                </div>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notification) => (
                        <article
                            key={notification._id}
                            className={`overflow-hidden rounded-3xl border shadow-sm ${notification.readAt ? 'border-slate-200 bg-white' : 'border-red-200 bg-white'}`}
                        >
                            <Link to={`/warnings/${notification.warningId}`} className="block">
                                <div className="flex items-center gap-3 bg-red-700 px-4 py-3.5 text-white">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
                                        <AlertTriangle size={18} aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-red-100">
                                            Official safety notification
                                        </p>
                                        <h2 className="truncate text-base font-bold">{notification.title}</h2>
                                    </div>
                                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-red-800">
                                        {notification.severity}
                                    </span>
                                </div>
                                <div className="p-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${severityStyles[notification.severity] || 'bg-slate-100 text-slate-700'}`}>
                                            {notification.severity}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">
                                            {String(notification.hazardType || 'hazard').replaceAll('_', ' ')}
                                        </span>
                                        {!notification.readAt && (
                                            <span className="ml-auto rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase text-blue-700">
                                                New
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{notification.message}</p>
                                </div>
                            </Link>
                            <div className="mx-4 flex items-center justify-between gap-3 border-t border-slate-100 py-3">
                                <p className="text-xs text-slate-500">{formatIssuedAt(notification.createdAt)}</p>
                                {!notification.readAt && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            markRead(notification._id)
                                        }
                                        className="shrink-0 text-xs font-semibold text-blue-700 underline"
                                    >
                                        Mark read
                                    </button>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    )

    const renderWarningDetail = () => {
        if (loadingDetail) {
            return <p className="px-5 py-10 text-center text-sm text-slate-500">Loading warning details…</p>
        }
        if (detailError) {
            return (
                <section className="px-5 pb-5 pt-7">
                    <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                        <ArrowLeft size={17} /> Back to Home
                    </Link>
                    <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{detailError}</p>
                </section>
            )
        }
        if (!detailWarning) return null
        const timeline = [...(detailWarning.updates || [])].sort(
            (first, second) => new Date(second.createdAt) - new Date(first.createdAt)
        )

        return (
            <section className="px-5 pb-6 pt-5">
                <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                    <ArrowLeft size={17} /> Back to Home
                </Link>
                <article className="mt-4 overflow-hidden rounded-3xl border border-red-200 bg-white shadow-sm">
                    <div className="bg-red-700 px-5 py-5 text-white">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-red-100">Official safety warning</p>
                        <h1 className="mt-2 text-xl font-bold leading-7">{detailWarning.title}</h1>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold uppercase text-red-800">
                                {detailWarning.severity}
                            </span>
                            <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold capitalize text-white">
                                {String(detailWarning.hazardType || 'hazard').replaceAll('_', ' ')}
                            </span>
                            {detailWarning.resolvedAt && (
                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-900">
                                    Resolved
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="space-y-6 p-5">
                        <section>
                            <h2 className="text-lg font-bold text-slate-950">Disaster overview</h2>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{detailWarning.message}</p>
                        </section>

                        <section>
                            <div className="flex items-center gap-2">
                                <MapPin size={18} className="text-red-700" aria-hidden="true" />
                                <h2 className="text-lg font-bold text-slate-950">Affected areas</h2>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                                The highlighted boundaries show the areas covered by this warning.
                            </p>
                            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                                <WarningMap areas={detailWarning.targetAreaIds || []} height={280} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {(detailWarning.targetAreaIds || []).map((area) => (
                                    <span key={area._id} className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800">
                                        {area.name}
                                    </span>
                                ))}
                            </div>
                        </section>

                        <section>
                            <h2 className="text-lg font-bold text-slate-950">What to do</h2>
                            {detailWarning.actionSteps?.length ? (
                                <ol className="mt-3 space-y-3">
                                    {detailWarning.actionSteps.map((step, index) => (
                                        <li key={`${index}-${step}`} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                                                {index + 1}
                                            </span>
                                            <span className="pt-0.5">{step}</span>
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    Follow instructions from local emergency services and monitor this page for updates.
                                </p>
                            )}
                        </section>

                        <section>
                            <div className="flex items-center gap-2">
                                <RefreshCw size={18} className="text-blue-700" aria-hidden="true" />
                                <h2 className="text-lg font-bold text-slate-950">Updates</h2>
                            </div>
                            {timeline.length === 0 ? (
                                <p className="mt-3 text-sm text-slate-600">No updates have been posted for this warning.</p>
                            ) : (
                                <ol className="mt-4 space-y-0">
                                    {timeline.map((update, index) => {
                                        const UpdateIcon = update.type === 'issued'
                                            ? Megaphone
                                            : update.type === 'resolved'
                                                ? CircleCheck
                                            : update.type === 'severity'
                                                ? ArrowUp
                                                : update.type === 'area'
                                                    ? RefreshCw
                                                    : Megaphone
                                        return (
                                            <li key={update._id || `${update.title}-${update.createdAt}`} className="relative flex gap-3 pb-5 last:pb-0">
                                                {index < timeline.length - 1 && (
                                                    <span className="absolute left-[13px] top-8 h-[calc(100%-1.5rem)] w-px bg-slate-200" />
                                                )}
                                                <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${update.type === 'resolved' ? 'bg-emerald-100 text-emerald-800' : update.type === 'severity' ? 'bg-red-100 text-red-700' : update.type === 'issued' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                                    <UpdateIcon size={14} aria-hidden="true" />
                                                </span>
                                                <div className="min-w-0 pt-0.5">
                                                    <h3 className="text-sm font-semibold text-slate-900">{update.title}</h3>
                                                    <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-600">{update.message}</p>
                                                    {update.affectedAreaIds?.length > 0 && (
                                                        <p className="mt-1 text-xs text-slate-600">
                                                            Affected areas: {update.affectedAreaIds.map((area) => area.name).join(', ')}
                                                        </p>
                                                    )}
                                                    {update.severity && (
                                                        <p className="mt-1 text-xs font-semibold capitalize text-red-700">
                                                            Severity: {update.severity}
                                                        </p>
                                                    )}
                                                    <p className="mt-1 text-xs text-slate-500">{formatIssuedAt(update.createdAt)}</p>
                                                </div>
                                            </li>
                                        )
                                    })}
                                </ol>
                            )}
                        </section>

                        <p className="border-t border-slate-100 pt-4 text-xs text-slate-500">
                            Warning issued {formatIssuedAt(detailWarning.issuedAt || detailWarning.createdAt)}
                            {detailWarning.issuedBy?.name && <> by {detailWarning.issuedBy.name}</>}
                            {detailWarning.createdBy?.name && <> · Created by {detailWarning.createdBy.name}</>}
                            {detailWarning.resolvedBy?.name && <> · Resolved by {detailWarning.resolvedBy.name}</>}
                        </p>
                    </div>
                </article>
            </section>
        )
    }

    const renderSection = () => {
        if (isWarningDetail) return renderWarningDetail()
        if (activePath === '/dashboard') return renderHome()
        if (activePath === '/report-hazard') return <ReportHazard />
        if (activePath === '/map') return <NearbyHazardsPanel fullPage />
        if (activePath === '/alerts') return renderAlerts()
        if (activePath === '/profile') {
            return (
                <section className="px-5 pb-5 pt-7">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Account
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-slate-950">
                        Your profile
                    </h1>

                    <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
                            {firstName.slice(0, 1).toUpperCase()}
                        </div>

                        <h2 className="mt-4 text-lg font-bold text-slate-900">
                            {user.name}
                        </h2>

                        <p className="mt-1 text-sm text-slate-600">
                            {user.email}
                        </p>

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

                    {signOutError && (
                        <p
                            role="alert"
                            className="mt-3 text-sm text-red-700"
                        >
                            {signOutError}
                        </p>
                    )}
                </section>
            )
        }

        if (activePath === '/map') {
            return (
                <section className="px-5 pb-5 pt-7">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                        Citizen services
                    </p>

                    <h1 className="mt-1 text-2xl font-bold text-slate-950">
                        Hazard map
                    </h1>

                    <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                            <Map size={25} aria-hidden="true" />
                        </span>

                        <h2 className="mt-4 font-bold text-slate-900">
                            Map view is coming next
                        </h2>

                        <p className="mt-2 text-sm leading-5 text-slate-600">
                            Your local hazard map and nearby risk information
                            will be available here.
                        </p>

                        <Link
                            to="/dashboard"
                            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700"
                        >
                            Back to Home
                            <ChevronRight
                                size={16}
                                aria-hidden="true"
                            />
                        </Link>
                    </div>
                </section>
            )
        }

        return (
            <section className="px-5 pb-5 pt-7">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                    Citizen services
                </p>

                <h1 className="mt-1 text-2xl font-bold text-slate-950">
                    {activePath === '/report-hazard'
                        ? 'Report a hazard'
                        : activePath.startsWith('/my-reports')
                            ? 'My reports'
                            : 'Citizen dashboard'}
                </h1>

                <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
                    <ShieldCheck
                        className="mx-auto text-blue-700"
                        size={30}
                        aria-hidden="true"
                    />

                    <h2 className="mt-4 font-bold text-slate-900">
                        Welcome back
                    </h2>

                    <p className="mt-2 text-sm leading-5 text-slate-600">
                        {activePath === '/report-hazard'
                            ? 'The hazard report page is not available yet.'
                            : activePath.startsWith('/my-reports')
                                ? 'Your submitted hazard reports will appear here.'
                                : 'Use the navigation below to access citizen services.'}
                    </p>
                </div>
            </section>
        )
    }

    return (
        <div className="mx-auto min-h-screen w-full max-w-md bg-[#f6f8fc] pb-[calc(6rem+env(safe-area-inset-bottom))] text-slate-900 shadow-2xl">
            <header className={`sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[linear-gradient(120deg,#126A9F_0%,#078FAE_48%,#08B5D1_100%)] px-4 text-white shadow-[0_4px_18px_rgba(7,25,52,0.18)] ${activePath === '/report-hazard' ? 'h-[54px]' : 'h-[58px]'}`}>
                <Link
                    to="/dashboard"
                    className="flex min-w-0 items-center gap-2.5"
                    aria-label="SafeZone home"
                >
                    <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/15 ${activePath === '/report-hazard' ? 'h-9 w-9' : 'h-10 w-10'}`}>
                        <img
                            src="/safezone-mark.png"
                            alt=""
                            className="absolute inset-0 h-full w-full object-contain"
                        />
                    </span>

                    <span className="min-w-0">
                        <span className="block text-[15px] font-extrabold leading-4 tracking-tight text-white">
                            SafeZone
                        </span>
                        {activePath !== '/report-hazard' && (
                            <span className="block max-w-[155px] truncate text-[9px] font-medium leading-3 text-sky-100">
                                Disaster Management & Safety
                            </span>
                        )}
                    </span>
                </Link>

                <div className="flex shrink-0 items-center gap-1">
                    <Link
                        to="/donation"
                        className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-white transition hover:bg-white/10"
                        aria-label="Support disaster response"
                    >
                        <Heart size={15} className="shrink-0 text-white" aria-hidden="true" />
                        <span className="hidden min-[370px]:block text-left leading-3">
                            <span className="block text-[9px] font-semibold text-white/80">Support</span>
                            <span className="block text-[11px] font-extrabold text-white">Disaster</span>
                        </span>
                    </Link>

                    <Link
                        to="/alerts"
                        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white/90 transition hover:bg-white/10"
                        aria-label={unreadCount > 0 ? `${unreadCount} unread alerts` : 'Alerts'}
                    >
                        <Bell size={19} aria-hidden="true" />
                        {unreadCount > 0 && (
                            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white ring-2 ring-[#102a52]">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </Link>

                    <Link
                        to="/profile"
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-xs font-extrabold text-white ring-1 ring-white/15 transition hover:bg-white/15"
                        aria-label="Your profile"
                    >
                        {firstName.slice(0, 1).toUpperCase()}
                    </Link>
                </div>
            </header>

            {loadError && (
                <p
                    role="alert"
                    className="mx-5 mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
                >
                    {loadError}
                </p>
            )}

            {renderSection()}

            <nav
                aria-label="Main navigation"
                className="fixed bottom-0 left-1/2 z-30 grid h-[76px] w-full max-w-md -translate-x-1/2 grid-cols-5 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(15,23,42,0.10)] backdrop-blur"
            >
                {navigation.map(
                    ({ label, path, icon: Icon, primary }) => {
                        const isActive = activePath === path

                        if (primary) {
                            return (
                                <Link
                                    key={path}
                                    to={path}
                                    aria-label={label}
                                    className="flex flex-col items-center justify-center gap-1 text-slate-500"
                                >
                                    <span
                                        className={`-mt-7 flex h-[54px] w-[54px] items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-blue-700 to-cyan-500 text-white shadow-xl shadow-blue-600/30 ${
                                            isActive
                                                ? 'ring-2 ring-blue-200'
                                                : ''
                                        }`}
                                    >
                                        <Icon
                                            size={23}
                                            aria-hidden="true"
                                        />
                                    </span>

                                    <span
                                        className={`text-[10px] font-semibold ${
                                            isActive
                                                ? 'text-blue-700'
                                                : ''
                                        }`}
                                    >
                                        {label}
                                    </span>
                                </Link>
                            )
                        }

                        return (
                            <Link
                                key={path}
                                to={path}
                                aria-current={
                                    isActive ? 'page' : undefined
                                }
                                className={`flex flex-col items-center justify-center gap-1 ${
                                    isActive
                                        ? 'text-blue-700'
                                        : 'text-slate-500'
                                }`}
                            >
                                <span className="relative">
                                    <Icon
                                        size={21}
                                        strokeWidth={
                                            isActive ? 2.4 : 1.9
                                        }
                                        aria-hidden="true"
                                    />

                                    {label === 'Alerts' &&
                                        unreadCount > 0 && (
                                            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-600 ring-2 ring-white" />
                                        )}
                                </span>

                                <span
                                    className={`text-[10px] ${
                                        isActive
                                            ? 'font-bold'
                                            : 'font-medium'
                                    }`}
                                >
                                    {label}
                                </span>
                            </Link>
                        )
                    }
                )}
            </nav>
        </div>
    )
}

export default CitizenDashboard