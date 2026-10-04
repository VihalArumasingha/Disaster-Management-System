import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/hooks'

function Header() {
    const { user, logout } = useAuth()
    const [logoutError, setLogoutError] = useState('')

    const handleLogout = async () => {
        setLogoutError('')
        try {
            await logout()
        } catch {
            setLogoutError('Could not sign out. Check your connection and try again.')
        }
    }

    return (
        <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <Link to="/" className="flex items-center space-x-3">
                        <img 
                            src="/favicon.ico" 
                            alt="SafeZone Logo" 
                            className="h-8 w-8"
                        />
                        <span className="text-xl font-bold text-gray-900">SafeZone</span>
                    </Link>

                    <nav className="hidden md:flex items-center space-x-8">
                        <Link 
                            to="/" 
                            className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                        >
                            Home
                        </Link>
                        {user && (
                            <Link
                                to="/dashboard"
                                className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                            >
                                Dashboard
                            </Link>
                        )}
                        <a
                            href={import.meta.env.VITE_MOBILE_APP_URL || 'http://localhost:5174'}
                            className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                        >
                            Citizen portal
                        </a>
                    </nav>

                    <div className="flex items-center space-x-3">
                        {user ? (
                            <>
                                <span className="hidden sm:inline text-sm text-gray-600">
                                    {user.name}
                                </span>
                                <button
                                    onClick={handleLogout}
                                    className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Sign out
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    to="/register"
                                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
                                >
                                    Create account
                                </Link>
                                <Link
                                    to="/login"
                                    className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Staff sign in
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {logoutError && (
                <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-center text-sm text-red-700">
                    {logoutError}
                </p>
            )}
        </header>
    )
}

export default Header
