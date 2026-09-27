import CurrentWeatherCard from './CurrentWeatherCard'

function Home() {
    return (
        <div className="w-full">
            {/* Hero Section */}
            <div 
                className="w-full min-h-[400px] flex items-center"
                style={{
                    background: 'linear-gradient(135deg, #6667E0 0%, #5B8492 45%, #4CAF50 100%)'
                }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
                    <div className="flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12 max-w-[1400px] mx-auto">
                        
                        {/* Left Side - Content */}
                        <div className="flex-1 w-full lg:w-2/3">
                            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                                Stay Safe, Stay Informed
                            </h1>
                            <p className="text-base md:text-lg lg:text-xl text-blue-100 mb-8">
                                Real-time disaster alerts, safety resources, and community support at your fingertips.
                            </p>
                            
                            {/* Search Bar */}
                            <div className="relative w-full">
                                <input
                                    type="text"
                                    placeholder="Search by place name or disaster type..."
                                    className="w-full px-6 py-4 pr-14 rounded-full bg-white text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-300 shadow-lg"
                                />
                                <button className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-full transition-colors">
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Right Side - Weather Card */}
                        <div className="w-full lg:w-auto">
                            <CurrentWeatherCard />
                        </div>
                    </div>
                </div>
            </div>

            {/* Live Disaster Map Section */}
            <div className="w-full bg-gray-50 py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
                            Live Disaster Map
                        </h2>
                        <p className="text-lg text-gray-600">
                            Monitor active emergencies and alerts worldwide
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Home