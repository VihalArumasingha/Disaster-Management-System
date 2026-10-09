import {
    createTargetArea,
    listTargetAreas,
    previewTargetArea
} from '../services/targetAreaService.js'

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
