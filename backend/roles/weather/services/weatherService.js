import axios from 'axios'

// In-memory cache for weather data (10 minute TTL)
const weatherCache = new Map()
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes in milliseconds

// Default location (Negombo, Sri Lanka)
const DEFAULT_LOCATION = {
    lat: 7.2088,
    lon: 79.8354,
    place: 'Negombo, Sri Lanka'
}

class WeatherService {
    constructor() {
        this.baseUrl = 'https://api.openweathermap.org/data/2.5/weather'
    }

    getCacheKey(lat, lon) {
        return `${lat},${lon}`
    }

    getCachedWeather(lat, lon) {
        const key = this.getCacheKey(lat, lon)
        const cached = weatherCache.get(key)
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data
        }
        
        return null
    }

    setCachedWeather(lat, lon, data) {
        const key = this.getCacheKey(lat, lon)
        weatherCache.set(key, {
            data,
            timestamp: Date.now()
        })
    }

    async getWeather(lat = null, lon = null) {
        try {
            // Use default location if no coordinates provided
            const latitude = lat || DEFAULT_LOCATION.lat
            const longitude = lon || DEFAULT_LOCATION.lon

            // Check cache first
            const cached = this.getCachedWeather(latitude, longitude)
            if (cached) {
                return cached
            }

            const apiKey = process.env.OPENWEATHER_KEY
            if (!apiKey) {
                throw new Error('OpenWeather API key not configured')
            }

            // Fetch from OpenWeather API
            const response = await axios.get(this.baseUrl, {
                params: {
                    lat: latitude,
                    lon: longitude,
                    appid: apiKey,
                    units: 'metric'
                },
                timeout: 5000 // 5 second timeout
            })

            // Shape the response for frontend
            const weatherData = {
                tempC: Math.round(response.data.main.temp),
                condition: response.data.weather[0].description,
                humidity: response.data.main.humidity,
                windSpeed: response.data.wind.speed,
                visibilityKm: (response.data.visibility / 1000).toFixed(1),
                place: response.data.name || (lat ? `${latitude}, ${longitude}` : DEFAULT_LOCATION.place)
            }

            // Cache the result
            this.setCachedWeather(latitude, longitude, weatherData)

            return weatherData
        } catch (error) {
            if (error.message === 'OpenWeather API key not configured') {
                throw error
            }

            if (error.response) {
                // API returned an error
                if (error.response.status === 401) {
                    throw new Error('Invalid OpenWeather API key')
                } else if (error.response.status === 404) {
                    throw new Error('Location not found')
                } else {
                    throw new Error(`Weather API error: ${error.response.status}`)
                }
            } else if (error.code === 'ECONNABORTED') {
                throw new Error('Weather service timeout')
            } else {
                throw new Error('Failed to fetch weather data')
            }
        }
    }
}

export default new WeatherService()