import { Link } from 'react-router-dom'

function Header() {
    return (
        <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Left: Logo and Brand */}
                    <div className="flex items-center space-x-3">
                        <img 
                            src="/favicon.ico" 
                            alt="SafeZone Logo" 
                            className="h-8 w-8"
                        />
                        <span className="text-xl font-bold text-gray-900">SafeZone</span>
                    </div>

                    {/* Center: Navigation Links */}
                    <nav className="hidden md:flex items-center space-x-8">
                        <Link 
                            to="/" 
                            className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                        >
                            Home
                        </Link>
                        <Link 
                            to="/victim-dashboard" 
                            className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                        >
                            Victim Dashboard
                        </Link>
                        <Link 
                            to="/alerts" 
                            className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                        >
                            Alerts
                        </Link>
                        <Link 
                            to="/contact" 
                            className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                        >
                            Contact Us
                        </Link>
                        <Link 
                            to="/profile" 
                            className="text-gray-700 hover:text-gray-900 font-medium transition-colors"
                        >
                            User Profile
                        </Link>
                    </nav>

                    {/* Right: Auth Buttons */}
                    <div className="flex items-center space-x-3">
                        <button className="bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors">
                            Support Disaster
                        </button>
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                            Register
                        </button>
                        <button className="bg-white text-gray-700 px-4 py-2 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition-colors">
                            Login
                        </button>
                    </div>
                </div>
            </div>
        </header>
    )
}

export default Header
