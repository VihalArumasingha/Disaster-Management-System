import { useState, useEffect } from 'react'
import axios from 'axios'

const useWeather = (lat = null, lon = null) => {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                setLoading(true)
                setError(null)

                const params = {}
                if (lat) params.lat = lat
                if (lon) params.lon = lon

                const response = await axios.get('/api/weather', { params })

                if (response.data.success) {
                    setData(response.data.data)
                } else {
                    setError(response.data.error || 'Failed to fetch weather')
                }
            } catch (err) {
                setError(err.response?.data?.error || 'Weather unavailable')
            } finally {
                setLoading(false)
            }
        }

        fetchWeather()
    }, [lat, lon])

    return { data, loading, error }
}

export default useWeather