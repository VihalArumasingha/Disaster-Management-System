const HAZARD_TYPES = [
    'flood',
    'landslide',
    'road_blockage',
    'other'
]

const validateHazardType = (hazardType) => (
    typeof hazardType === 'string'
    && HAZARD_TYPES.includes(hazardType)
)

const validateCoordinates = (coordinates) => {
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        return false
    }

    const [longitude, latitude] = coordinates

    return (
        Number.isFinite(longitude)
        && Number.isFinite(latitude)
        && longitude >= -180
        && longitude <= 180
        && latitude >= -90
        && latitude <= 90
    )
}

export const validateCreateHazardReport = (
    req,
    res,
    next
) => {
    const {
        hazardType,
        description,
        location,
        capturedAt
    } = req.body

    if (!validateHazardType(hazardType)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid hazard type'
        })
    }

    if (
        typeof description !== 'string'
        || !description.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: 'Description is required'
        })
    }

    if (
        !location
        || location.type !== 'Point'
        || !validateCoordinates(location.coordinates)
    ) {
        return res.status(400).json({
            success: false,
            message: 'A valid GeoJSON Point location is required'
        })
    }

    const parsedCapturedAt = new Date(capturedAt)

    if (!capturedAt || Number.isNaN(parsedCapturedAt.getTime())) {
        return res.status(400).json({
            success: false,
            message: 'A valid capturedAt date is required'
        })
    }

    next()
}

export const validateHazardReportId = (
    req,
    res,
    next
) => {
    if (!req.params.id) {
        return res.status(400).json({
            success: false,
            message: 'Hazard report ID is required'
        })
    }

    next()
}

export default {
    validateCreateHazardReport,
    validateHazardReportId
}