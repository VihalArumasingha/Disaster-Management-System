import mongoose from 'mongoose'

export const validateClusterId = (
    req,
    res,
    next
) => {
    if (!mongoose.isValidObjectId(req.params.clusterId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid hazard cluster ID'
        })
    }

    next()
}

export const validateReportId = (
    req,
    res,
    next
) => {
    if (!mongoose.isValidObjectId(req.params.reportId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid hazard report ID'
        })
    }

    next()
}

export const validateRejection = (
    req,
    res,
    next
) => {
    if (
        typeof req.body.reason !== 'string'
        || !req.body.reason.trim()
    ) {
        return res.status(400).json({
            success: false,
            message: 'Rejection reason is required'
        })
    }

    if (req.body.reason.trim().length > 1000) {
        return res.status(400).json({
            success: false,
            message: 'Rejection reason cannot exceed 1000 characters'
        })
    }

    next()
}

export default {
    validateClusterId,
    validateReportId,
    validateRejection
}