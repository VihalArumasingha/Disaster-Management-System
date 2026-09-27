import { useState, useEffect } from 'react'
import useWeather from '../../hooks/useWeather'

function CurrentWeatherCard({ lat = null, lon = null }) {
    const [userLocation, setUserLocation] = useState({ lat, lon })
    const [locationError, setLocationError] = useState(null)
    const [gettingLocation, setGettingLocation] = useState(false)

    useEffect(() => {
        // If coordinates are already provided, use them
        if (lat && lon) {
            setUserLocation({ lat, lon })
            return
        }

        // Otherwise, try to get user's current location
        setGettingLocation(true)
        setLocationError(null)

        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    })
                    setGettingLocation(false)
                },
                (error) => {
                    console.error('Geolocation error:', error)
                    setLocationError('Unable to get your location')
                    setGettingLocation(false)
                    // Fall back to null (will use default location)
                    setUserLocation({ lat: null, lon: null })
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            )
        } else {
            setLocationError('Geolocation not supported')
            setGettingLocation(false)
        }
    }, [lat, lon])

    const { data, loading, error } = useWeather(userLocation.lat, userLocation.lon)

    if (loading || gettingLocation) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border-2 border-blue-400 p-6 w-full md:w-[390px]">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-blue-100 rounded w-3/4"></div>
                    <div className="h-8 bg-blue-100 rounded w-1/2"></div>
                    <div className="space-y-2">
                        <div className="h-3 bg-blue-100 rounded"></div>
                        <div className="h-3 bg-blue-100 rounded w-5/6"></div>
                        <div className="h-3 bg-blue-100 rounded w-4/6"></div>
                    </div>
                </div>
                {gettingLocation && (
                    <p className="text-sm text-blue-600 mt-4 text-center">Getting your location...</p>
                )}
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl shadow-lg border-2 border-blue-400 p-6 w-full md:w-[390px]">
                <div className="text-center text-blue-600">
                    <svg className="h-12 w-12 mx-auto mb-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                    </svg>
                    <p className="text-sm">Weather unavailable</p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-2xl shadow-lg border-2 border-blue-400 p-6 w-full md:w-[390px] relative overflow-hidden">
            {/* Weather Animation Container */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Rain Animation */}
                {(data.condition.includes('rain') || data.condition.includes('drizzle')) && (
                    <div className="rain-container">
                        {[...Array(20)].map((_, i) => (
                            <div 
                                key={`rain-${i}`}
                                className="rain-drop"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 2}s`,
                                    animationDuration: `${0.5 + Math.random() * 0.5}s`
                                }}
                            ></div>
                        ))}
                    </div>
                )}

                {/* Storm Animation */}
                {(data.condition.includes('storm') || data.condition.includes('thunder')) && (
                    <div className="storm-container">
                        {[...Array(20)].map((_, i) => (
                            <div 
                                key={`storm-rain-${i}`}
                                className="rain-drop"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 2}s`,
                                    animationDuration: `${0.3 + Math.random() * 0.3}s`
                                }}
                            ></div>
                        ))}
                        <div className="lightning-flash"></div>
                    </div>
                )}

                {/* Snow Animation */}
                {data.condition.includes('snow') && (
                    <div className="snow-container">
                        {[...Array(30)].map((_, i) => (
                            <div 
                                key={`snow-${i}`}
                                className="snowflake"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 3}s`,
                                    animationDuration: `${2 + Math.random() * 2}s`,
                                    fontSize: `${8 + Math.random() * 8}px`
                                }}
                            >
                                ❄
                            </div>
                        ))}
                    </div>
                )}

                {/* Sun Rays Animation */}
                {data.condition.includes('clear') && (
                    <div className="sun-container">
                        <div className="sun-rays"></div>
                    </div>
                )}

                {/* Cloud Animation */}
                {data.condition.includes('cloud') && !data.condition.includes('rain') && !data.condition.includes('storm') && (
                    <div className="cloud-container">
                        {[...Array(3)].map((_, i) => (
                            <div 
                                key={`cloud-${i}`}
                                className="floating-cloud"
                                style={{
                                    top: `${20 + i * 25}%`,
                                    animationDelay: `${i * 0.5}s`,
                                    animationDuration: `${8 + i * 2}s`
                                }}
                            >
                                ☁️
                            </div>
                        ))}
                    </div>
                )}

                {/* Fog Animation */}
                {data.condition.includes('fog') || data.condition.includes('mist') && (
                    <div className="fog-container">
                        {[...Array(5)].map((_, i) => (
                            <div 
                                key={`fog-${i}`}
                                className="fog-layer"
                                style={{
                                    top: `${i * 20}%`,
                                    animationDelay: `${i * 0.8}s`,
                                    animationDuration: `${10 + i * 2}s`
                                }}
                            ></div>
                        ))}
                    </div>
                )}
            </div>

            {/* Header */}
            <div className="mb-4 relative z-10">
                <h3 className="text-lg font-semibold text-gray-800">Current Weather</h3>
                <div className="flex items-center space-x-2 mt-1">
                    <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm text-gray-600">{data.place}</span>
                </div>
            </div>

            {/* Light Blue Inner Section */}
            <div className="bg-blue-50 rounded-xl p-4 mb-4 relative z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-4xl font-bold text-gray-800">{data.tempC}°C</div>
                        <div className="text-gray-600 capitalize text-sm mt-1">{data.condition}</div>
                    </div>
                    <div className="text-5xl relative">
                        {/* Weather icon based on condition */}
                        {data.condition.includes('rain') || data.condition.includes('drizzle') ? (
                            <span className="animate-bounce">🌧️</span>
                        ) : data.condition.includes('cloud') ? (
                            <span className="animate-pulse">☁️</span>
                        ) : data.condition.includes('clear') ? (
                            <span className="animate-spin" style={{ animationDuration: '10s' }}>☀️</span>
                        ) : data.condition.includes('storm') || data.condition.includes('thunder') ? (
                            <span className="animate-pulse">⛈️</span>
                        ) : (
                            <span>🌤️</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Weather Details */}
            <div className="grid grid-cols-3 gap-2 relative z-10">
                <div className="bg-blue-50 rounded-lg p-3 text-center hover:bg-blue-100 transition-colors">
                    <div className="text-xs text-gray-600 mb-1">Humidity</div>
                    <div className="text-sm font-semibold text-gray-800">{data.humidity}%</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center hover:bg-blue-100 transition-colors">
                    <div className="text-xs text-gray-600 mb-1">Wind</div>
                    <div className="text-sm font-semibold text-gray-800">{data.windSpeed} m/s</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-center hover:bg-blue-100 transition-colors">
                    <div className="text-xs text-gray-600 mb-1">Visibility</div>
                    <div className="text-sm font-semibold text-gray-800">{data.visibilityKm} km</div>
                </div>
            </div>
        </div>
    )
}

export default CurrentWeatherCard