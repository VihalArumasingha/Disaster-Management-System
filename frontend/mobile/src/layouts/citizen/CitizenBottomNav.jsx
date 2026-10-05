import {
    Bell,
    Home,
    Map,
    Megaphone,
    User
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

function CitizenBottomNav() {
    const navigate = useNavigate()
    const location = useLocation()

    const isActive = (path) => location.pathname === path

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-md border-t border-slate-200 bg-white">
            <div className="relative grid grid-cols-5 px-2 py-2">

                {/* Home */}
                <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className={`flex flex-col items-center gap-1 py-1 text-xs font-medium ${
                        isActive('/dashboard')
                            ? 'text-slate-900'
                            : 'text-slate-500'
                    }`}
                >
                    <Home className="h-5 w-5" />
                    <span>Home</span>
                </button>

                {/* Map */}
                <button
                    type="button"
                    onClick={() => navigate('/map')}
                    className={`flex flex-col items-center gap-1 py-1 text-xs font-medium ${
                        isActive('/map')
                            ? 'text-slate-900'
                            : 'text-slate-500'
                    }`}
                >
                    <Map className="h-5 w-5" />
                    <span>Map</span>
                </button>

                {/* Report */}
                <button
                    type="button"
                    onClick={() => navigate('/report-hazard')}
                    className="relative -mt-7 flex flex-col items-center text-xs font-bold text-teal-700"
                >
                    <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-teal-700 text-white shadow-lg">
                        <Megaphone className="h-7 w-7" />
                    </span>

                    <span className="mt-1">
                        Report
                    </span>
                </button>

                {/* Alerts */}
                <button
                    type="button"
                    onClick={() => navigate('/alerts')}
                    className={`flex flex-col items-center gap-1 py-1 text-xs font-medium ${
                        isActive('/alerts')
                            ? 'text-slate-900'
                            : 'text-slate-500'
                    }`}
                >
                    <Bell className="h-5 w-5" />
                    <span>Alerts</span>
                </button>

                {/* Profile */}
                <button
                    type="button"
                    onClick={() => navigate('/profile')}
                    className={`flex flex-col items-center gap-1 py-1 text-xs font-medium ${
                        isActive('/profile')
                            ? 'text-slate-900'
                            : 'text-slate-500'
                    }`}
                >
                    <User className="h-5 w-5" />
                    <span>Profile</span>
                </button>
            </div>
        </nav>
    )
}

export default CitizenBottomNav