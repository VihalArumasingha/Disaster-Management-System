import weatherService from '../services/weatherService.js'

const getWeather = async (req, res) => {
    try {
        const { lat, lon } = req.query

        const weatherData = await weatherService.getWeather(lat, lon)

        res.status(200).json({
            success: true,
            data: weatherData
        })
    } catch (error) {
        console.error('Weather error:', error.message)
        res.status(503).json({
            success: false,
            error: error.message
        })
    }
}

export default {
    getWeather
}