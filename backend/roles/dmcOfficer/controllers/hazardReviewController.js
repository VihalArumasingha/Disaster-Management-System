import {
    getHazardReviewFoundationStatus
} from '../services/hazardReviewService.js'

export const getHazardReviewStatus = async (
    req,
    res,
    next
) => {
    try {
        const status = await getHazardReviewFoundationStatus()

        res.status(200).json({
            success: true,
            data: status
        })
    } catch (error) {
        next(error)
    }
}

export default {
    getHazardReviewStatus
}