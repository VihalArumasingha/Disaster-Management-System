import { useState } from 'react'
import {
    ClipboardList,
    FileText,
    LayoutDashboard,
    LogOut,
    Menu,
    ShieldAlert,
    X,
    UserCircle,
    Settings
} from 'lucide-react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/hooks'
import { dashboardPathForRole } from '../../auth/utils/dashboardPaths'
import { USER_ROLES } from '../../constants/roles'

function DutyOfficerLayout() {
    const { user, loading, logout } = useAuth()
    const navigate = useNavigate()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [logoutError, setLogoutError] = useState('')

    if (loading) {
        return (
            <div className="grid min-h-screen place-items-center text-slate-600">
                Loading Duty Officer workspace…
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    if (user.role !== USER_ROLES.dutyofficer) {
        return <Navigate to={dashboardPathForRole(user.role)} replace />
    }

    const closeMobile = () => setMobileOpen(false)

    const signOut = async () => {
        setLogoutError('')

        try {
            await logout()
            navigate('/login', { replace: true })
        } catch {
            setLogoutError(
                'Could not sign out. Check your connection and try again.'
            )
        }
    }

    const linkClass = ({ isActive }) => (
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            isActive
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`
    )

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900">
            {/* Mobile navigation button */}
            <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                className="fixed left-4 top-4 z-30 rounded-lg bg-slate-900 p-2 text-white shadow-lg lg:hidden"
            >
                <Menu size={20} />
            </button>

            {/* Mobile backdrop */}
            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={closeMobile}
                    className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden"
                />
            )}

            {/* Duty Officer sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col justify-between bg-[#10233b] px-4 py-5 text-white transition-transform duration-200 lg:translate-x-0 ${
                    mobileOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div>
                    {/* Sidebar branding */}
                    <div className="flex items-center justify-between border-b border-slate-700/70 px-2 pb-5">
                        <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600">
                                <ShieldAlert size={21} />
                            </div>

                            <div>
                                <p className="font-bold">SafeZone</p>
                                <p className="text-xs text-slate-400">
                                    Duty Officer operations
                                </p>
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

                    {/* Navigation */}
                    <nav
                        aria-label="Duty Officer navigation"
                        className="mt-5 flex-1 space-y-1 overflow-y-auto"
                    >
                        <NavLink
                            to="/dutyofficer/dashboard"
                            end
                            className={linkClass}
                            onClick={closeMobile}
                        >
                            <LayoutDashboard size={18} />
                            Dashboard
                        </NavLink>

                        <NavLink
                            to="/dutyofficer/hazard-reviews"
                            className={linkClass}
                            onClick={closeMobile}
                        >
                            <ClipboardList size={18} />
                            Report Clusters
                        </NavLink>

                        <NavLink
                            to="/dutyofficer/reports"
                            className={linkClass}
                            onClick={closeMobile}
                        >
                            <FileText size={18} />
                            Reports
                        </NavLink>
                    </nav>
                </div>

                {/* User / sign out block anchored to bottom */}
                <div className="border-t border-slate-700/70 pt-4 pb-2">
                    <div className="mb-4 px-2">
                        <p className="truncate text-sm font-semibold text-white">
                            {user.name}
                        </p>
                        <p className="text-xs text-slate-400">
                            Duty Officer
                        </p>
                    </div>

                    <nav className="space-y-1">
                        <NavLink
                            to="/dutyofficer/profile"
                            className={linkClass}
                            onClick={closeMobile}
                        >
                            <UserCircle size={18} />
                            Profile
                        </NavLink>
                        
                        <NavLink
                            to="/dutyofficer/settings"
                            className={linkClass}
                            onClick={closeMobile}
                        >
                            <Settings size={18} />
                            Settings
                        </NavLink>
                        
                        <button
                            type="button"
                            onClick={signOut}
                            className="w-full mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                        >
                            <LogOut size={18} />
                            Sign out
                        </button>
                    </nav>

                    {logoutError && (
                        <p
                            role="alert"
                            className="mt-3 px-2 text-xs text-red-300"
                        >
                            {logoutError}
                        </p>
                    )}
                </div>
            </aside>

            {/* Main application area */}
            <div className="min-h-screen lg:pl-[270px]">
                {logoutError && (
                    <p
                        role="alert"
                        className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800 lg:hidden"
                    >
                        {logoutError}
                    </p>
                )}

                <Outlet />
            </div>
        </div>
    )
}

export default DutyOfficerLayout