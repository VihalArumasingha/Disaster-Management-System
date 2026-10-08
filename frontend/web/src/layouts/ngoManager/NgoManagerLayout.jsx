import { useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { Building2, ClipboardList, Handshake, HeartHandshake, History, LayoutDashboard, LogOut, Menu, Package, PackageCheck, ShieldAlert, Siren, Truck, Users, Warehouse, X } from 'lucide-react'
import { useAuth } from '../../auth/hooks'
import { dashboardPathForRole } from '../../auth/utils/dashboardPaths'
import { USER_ROLES } from '../../constants/roles'

const NAV_ITEMS = [
    { label: 'Overview', icon: LayoutDashboard, to: '/ngomanager/dashboard' },
    { label: 'Donations', icon: HeartHandshake, to: '/ngomanager/donations' },
    { label: 'Active Disasters', icon: Siren, to: '/ngomanager/active-disasters' },
    { label: 'Relief Quantities', icon: Package, to: '/ngomanager/relief-quantities' },
    { label: 'Collecting Centers', icon: Warehouse, to: '/ngomanager/collecting-centers' },
    { label: 'Assign Relief Teams', icon: ClipboardList, to: '/ngomanager/assign-relief-teams' },
    { label: 'Volunteers & Assignments', icon: Users, to: '/ngomanager/volunteers' },
    { label: 'Relief Distribution', icon: PackageCheck, to: '/ngomanager/relief-distribution' },
    { label: 'Supply Distribution Audit', icon: Truck, to: '/ngomanager/relief-distributions' },
    { label: 'Impact Monitoring', icon: Activity, to: '/ngomanager/impact-monitoring' },
    { label: 'Impact Analysis & Reports', icon: BarChart3, to: '/ngomanager/analytics-reports' },
    { label: 'Shelter Management', icon: Building2, to: '/ngomanager/shelters' },
    { label: 'Organizations', icon: Handshake, to: '/ngomanager/organizations' },
    { label: 'NGO Past', icon: History, to: '/ngomanager/past' },
]

const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        isActive
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`

function NgoManagerLayout({ children }) {
    const { user, loading, logout } = useAuth()
    const navigate = useNavigate()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [logoutError, setLogoutError] = useState('')

    if (loading) {
        return <div className="grid min-h-screen place-items-center text-slate-600">Loading NGO workspace…</div>
    }
    if (!user) return <Navigate to="/login" replace />
    if (user.role !== USER_ROLES.ngomanager) {
        return <Navigate to={dashboardPathForRole(user.role)} replace />
    }

    const closeMobile = () => setMobileOpen(false)

    const signOut = async () => {
        setLogoutError('')
        try {
            await logout()
            navigate('/login', { replace: true })
        } catch {
            setLogoutError('Could not sign out. Check your connection and try again.')
        }
    }

    const sidebar = (
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col bg-[#10233b] px-4 py-5 text-white transition-transform lg:translate-x-0 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
            {/* Brand */}
            <div className="flex items-center justify-between border-b border-slate-700/70 px-2 pb-5">
                <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600">
                        <ShieldAlert size={21} />
                    </div>
                    <div>
                        <p className="font-bold tracking-wide">SafeZone</p>
                        <p className="text-xs text-slate-400">DMC operations</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={closeMobile}
                    aria-label="Close navigation"
                    className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 lg:hidden"
                >
                    <X size={19} />
                </button>
            </div>

            {/* Nav */}
            <nav aria-label="DMC Officer navigation" className="mt-5 flex-1 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map(({ label, icon: Icon, to }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/ngomanager/dashboard'}
                        className={linkClass}
                        onClick={closeMobile}
                    >
                        {Icon ? <Icon size={18} /> : <span className="w-[18px]" aria-hidden="true" />}
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* User footer */}
            <div className="border-t border-slate-700/70 px-2 pt-4">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="mt-1 text-xs text-slate-400">DMC Officer</p>
                <button
                    type="button"
                    onClick={signOut}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                    <LogOut size={16} /> Sign out
                </button>
            </div>
        </aside>
    )

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900">
            {/* Mobile hamburger */}
            <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                className="fixed left-4 top-4 z-30 rounded-lg bg-slate-900 p-2 text-white shadow-lg lg:hidden"
            >
                <Menu size={20} />
            </button>

            {/* Backdrop */}
            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={closeMobile}
                    className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden"
                />
            )}

            {sidebar}

            {/* Main content */}
            <div className="min-h-screen lg:pl-[260px]">
                {logoutError && (
                    <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800">
                        {logoutError}
                    </p>
                )}
                {/* Support both <Outlet> (nested routes) and direct children */}
                {children ?? <Outlet />}
            </div>
        </div>
    )
}

export default NgoManagerLayout