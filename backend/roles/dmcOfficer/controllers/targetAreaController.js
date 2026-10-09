import {
    createTargetArea,
    listTargetAreas,
    previewTargetArea
} from '../services/targetAreaService.js'

export const targetAreas = async (req, res, next) => {
    try {
        // Keep HTTP response formatting here while the service owns queries and response shaping.
        res.json({ success: true, targetAreas: await listTargetAreas() })
    } catch (error) {
        next(error)
    }
}

export const targetAreaPreview = async (req, res, next) => {
    try {
        // Preview is read-only so the UI can show the affected citizen count before saving.
        const preview = await previewTargetArea(req.body.geometry)
        res.json({ success: true, ...preview })
    } catch (error) {
        next(error)
    }
}

export const saveTargetArea = async (req, res, next) => {
    try {
        // The authenticated officer ID comes from middleware, not client-supplied request data.
        const area = await createTargetArea(req.body, req.user._id)
        res.status(201).json({ success: true, targetArea: area })
    } catch (error) {
        next(error)
    }
}
