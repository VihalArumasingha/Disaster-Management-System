import axios from 'axios'
import { normalizeRole } from '../../../utils/constants.js'
import { getOverview } from '../services/warningManagementService.js'

export {
    addWarningUpdate,
    editWarning,
    issueWarningNow,
    reviewWarning,
    resolveWarningNow,
    saveWarning,
    warningRecipientPreview,
    warnings
} from './warningController.js'
export {
    saveTargetArea,
    targetAreaPreview,
    targetAreas
} from './targetAreaController.js'

export const overview = async (req, res, next) => {
    try {
        res.json({ success: true, overview: await getOverview() })
    } catch (error) {
        next(error)
    }
}

export const openWeatherTile = async (req, res, next) => {
    const { layer, z, x, y } = req.params
    const zoom = Number(z)
    const tileX = Number(x)
    const tileY = Number(y)
    const tileCount = 2 ** zoom

    if (
        !['precipitation_new', 'clouds_new', 'temp_new'].includes(layer)
        || !Number.isInteger(zoom)
        || zoom < 0
        || zoom > 18
        || !Number.isInteger(tileX)
        || !Number.isInteger(tileY)
        || tileX < 0
        || tileY < 0
        || tileX >= tileCount
        || tileY >= tileCount
    ) {
        return res.status(400).json({
            success: false,
            message: 'Invalid map tile request'
        })
    }

    if (!process.env.OPENWEATHER_KEY) {
        return res.status(503).json({
            success: false,
            message: 'OpenWeather map overlay is not configured'
        })
    }

    try {
        const response = await axios.get(
            `https://tile.openweathermap.org/map/${layer}/${zoom}/${tileX}/${tileY}.png`,
            {
                params: { appid: process.env.OPENWEATHER_KEY },
                responseType: 'arraybuffer',
                timeout: 10000
            }
        )
        res.set('Content-Type', response.headers['content-type'] || 'image/png')
        res.set('Cache-Control', 'public, max-age=300')
        res.status(200).send(response.data)
    } catch (error) {
        if (error.response) {
            return res.status(error.response.status === 401 ? 502 : 503).json({
                success: false,
                message: 'OpenWeather map tiles are currently unavailable'
            })
        }
        next(error)
    }
}

export const profile = (req, res) => {
    res.json({
        success: true,
        profile: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            phone: req.user.phone,
            role: normalizeRole(req.user.role),
            createdAt: req.user.createdAt
        }
    })
}
