import {
    getHazardReviewQueue,
    getHazardReviewCluster,
    verifyHazardReport,
    rejectHazardReport
} from '../services/hazardReviewService.js'

export const getReviewQueue = async (
    req,
    res,
    next
) => {
    try {
        const clusters = await getHazardReviewQueue()

        res.status(200).json({
            success: true,
            data: clusters
        })
    } catch (error) {
        next(error)
    }
}

export const getReviewCluster = async (
    req,
    res,
    next
) => {
    try {
        const cluster = await getHazardReviewCluster(
            req.params.clusterId
        )

        if (!cluster) {
            return res.status(404).json({
                success: false,
                message: 'Hazard cluster not found'
            })
        }

        res.status(200).json({
            success: true,
            data: cluster
        })
    } catch (error) {
        next(error)
    }
}

export const verifyReport = async (
    req,
    res,
    next
) => {
    try {
        const result = await verifyHazardReport(
            req.params.reportId,
            req.user._id
        )

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Hazard report not found'
            })
        }

        res.status(200).json({
            success: true,
            message: 'Hazard report verified successfully',
            report: result.report,
            cluster: result.cluster,
            escalation: result.escalation
        })
    } catch (error) {
        next(error)
    }
}

export const rejectReport = async (
    req,
    res,
    next
) => {
    try {
        const result = await rejectHazardReport(
            req.params.reportId,
            req.user._id,
            req.body.reason
        )

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Hazard report not found'
            })
        }

        res.status(200).json({
            success: true,
            message: 'Hazard report rejected successfully',
            report: result.report,
            cluster: result.cluster
        })
    } catch (error) {
        next(error)
    }
}

export default {
    getReviewQueue,
    getReviewCluster,
    verifyReport,
    rejectReport
}