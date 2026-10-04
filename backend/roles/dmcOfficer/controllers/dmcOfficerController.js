import axios from 'axios'
import { normalizeRole } from '../../../utils/constants.js'
import {
    createTargetArea,
    createWarning,
    getWarningForReview,
    getOverview,
    issueWarning,
    listTargetAreas,
    listWarnings,
    previewTargetArea,
    previewWarningRecipients,
    updateWarning
} from '../services/dmcOfficerService.js'

export const overview = async (req, res, next) => {
    try {
        res.json({ success: true, overview: await getOverview() })
    } catch (error) {
        next(error)
    }
}

export const targetAreas = async (req, res, next) => {
    try {
        res.json({ success: true, targetAreas: await listTargetAreas() })
    } catch (error) {
        next(error)
    }
}

export const targetAreaPreview = async (req, res, next) => {
    try {
        const preview = await previewTargetArea(req.body.geometry)
        res.json({ success: true, ...preview })
    } catch (error) {
        next(error)
    }
}

export const saveTargetArea = async (req, res, next) => {
    try {
        const area = await createTargetArea(req.body, req.user._id)
        res.status(201).json({ success: true, targetArea: area })
    } catch (error) {
        next(error)
    }
}

export const warnings = async (req, res, next) => {
    try {
        res.json({ success: true, warnings: await listWarnings() })
    } catch (error) {
        next(error)
    }
}

export const saveWarning = async (req, res, next) => {
    try {
        const warning = await createWarning(req.body, req.user._id)
        res.status(201).json({ success: true, warning })
    } catch (error) {
        next(error)
    }
}

export const editWarning = async (req, res, next) => {
    try {
        const warning = await updateWarning(req.params.warningId, req.body)
        res.json({ success: true, warning })
    } catch (error) {
        next(error)
    }
}

export const reviewWarning = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await getWarningForReview(req.params.warningId)) })
    } catch (error) {
        next(error)
    }
}

export const issueWarningNow = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await issueWarning(req.params.warningId)) })
    } catch (error) {
        next(error)
    }
}

export const warningRecipientPreview = async (req, res, next) => {
    try {
        const preview = await previewWarningRecipients(req.body.targetAreaIds)
        res.json({ success: true, ...preview })
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