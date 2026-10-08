import { useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
    AlertTriangle,
    Activity,
    Bell,
    BarChart3,
    Building2,
    ChevronDown,
    ClipboardList,
    LayoutDashboard,
    LogOut,
    Map,
    Menu,
    Network,
    Package,
    ShieldAlert,
    Truck,
    UserRound,
    X
} from 'lucide-react'
import { useAuth } from '../../auth/hooks'
import { dashboardPathForRole } from '../../auth/utils/dashboardPaths'
import { USER_ROLES } from '../../constants/roles'

const linkClass = ({ isActive }) => (
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
        isActive
            ? 'bg-blue-700 text-white shadow-sm'
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`
)

function DmcOfficerLayout() {
    const { user, loading, logout } = useAuth()
    const navigate = useNavigate()
    const { pathname } = useLocation()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [warningsOpen, setWarningsOpen] = useState(pathname.includes('/warnings'))
    const [areasOpen, setAreasOpen] = useState(pathname.includes('/target-areas'))
    const [logoutError, setLogoutError] = useState('')

    if (loading) {
        return <div className="grid min-h-screen place-items-center text-slate-600">Loading DMC workspace…</div>
    }
    if (!user) return <Navigate to="/login" replace />
    if (user.role !== USER_ROLES.dmcofficer) {
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

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900">
            <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                className="fixed left-4 top-4 z-30 rounded-lg bg-slate-900 p-2 text-white shadow-lg lg:hidden"
            >
                <Menu size={20} />
            </button>

            {mobileOpen && (
                <button
                    type="button"
                    aria-label="Close navigation"
                    onClick={closeMobile}
                    className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden"
                />
            )}

            <aside className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col bg-[#10233b] px-4 py-5 text-white transition-transform lg:translate-x-0 ${
                mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
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

                <nav aria-label="DMC officer navigation" className="mt-5 flex-1 space-y-1 overflow-y-auto">
                    <NavLink to="/dmcofficer/dashboard" className={linkClass} onClick={closeMobile}>
                        <LayoutDashboard size={18} /> Dashboard
                    </NavLink>
                    <NavLink to="/dmcofficer/escalated-reports" className={linkClass} onClick={closeMobile}>
                        <AlertTriangle size={18} /> Escalated Reports
                    </NavLink>
                    <NavLink to="/dmcofficer/hazard-reviews" className={linkClass} onClick={closeMobile}>
                        <ClipboardList size={18} /> Report Clusters
                    </NavLink>

                    <button
                        type="button"
                        onClick={() => setWarningsOpen(!warningsOpen)}
                        aria-expanded={warningsOpen}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                            pathname.includes('/warnings')
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <span className="flex items-center gap-3"><Bell size={18} /> Warnings</span>
                        <ChevronDown size={16} className={warningsOpen ? 'rotate-180 transition' : 'transition'} />
                    </button>
                    {warningsOpen && (
                        <div className="ml-5 space-y-1 border-l border-slate-700 pl-3">
                            <NavLink to="/dmcofficer/warnings" end className={linkClass} onClick={closeMobile}>
                                View Warnings
                            </NavLink>
                            <NavLink to="/dmcofficer/warnings/create" className={linkClass} onClick={closeMobile}>
                                Create Warning
                            </NavLink>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => setAreasOpen(!areasOpen)}
                        aria-expanded={areasOpen}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                            pathname.includes('/target-areas')
                                ? 'bg-slate-800 text-white'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <span className="flex items-center gap-3"><Map size={18} /> Target Areas</span>
                        <ChevronDown size={16} className={areasOpen ? 'rotate-180 transition' : 'transition'} />
                    </button>
                    {areasOpen && (
                        <div className="ml-5 space-y-1 border-l border-slate-700 pl-3">
                            <NavLink to="/dmcofficer/target-areas" end className={linkClass} onClick={closeMobile}>
                                View Target Areas
                            </NavLink>
                            <NavLink to="/dmcofficer/target-areas/create" className={linkClass} onClick={closeMobile}>
                                Create Target Area
                            </NavLink>
                        </div>
                    )}
                  
                    <NavLink to="/dmcofficer/relief-distributions" className={linkClass} onClick={closeMobile}>
                        <Truck size={18} /> Relief Distribution
                    </NavLink>
                   

                    <NavLink to="/dmcofficer/profile" className={linkClass} onClick={closeMobile}>
                        <UserRound size={18} /> Profile
                    </NavLink>
                </nav>

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

            <div className="min-h-screen lg:pl-[270px]">
                {logoutError && (
                    <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800">
                        {logoutError}
                    </p>
                )}
                <Outlet />
            </div>
        </div>
    )
}

export default DmcOfficerLayout