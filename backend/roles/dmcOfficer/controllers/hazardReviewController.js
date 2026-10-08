import {
    getHazardReviewQueue,
    getHazardReviewCluster,
    verifyHazardReport,
    rejectHazardReport
} from '../services/hazardReviewService.js'

import {
    evaluateWarningEscalation,
    createEscalationHandoff,
    getEscalationByCluster,
    getIncomingHazardEscalations as listIncomingHazardEscalations,
    getOutgoingHazardEscalations as listOutgoingHazardEscalations
} from '../services/warningEscalationService.js'

export const getReviewQueue = async (
    req,
    res,
    next
) => {
    try {
        const clusters =
            await getHazardReviewQueue()

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
        const cluster =
            await getHazardReviewCluster(
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
        const result =
            await verifyHazardReport(
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
            message:
                'Hazard report verified successfully',

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
        const result =
            await rejectHazardReport(
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
            message:
                'Hazard report rejected successfully',

            report: result.report,
            cluster: result.cluster
        })
    } catch (error) {
        next(error)
    }
}

/*
 * Duty Officer checks whether the cluster
 * currently meets escalation criteria.
 */
export const checkEscalation = async (
    req,
    res,
    next
) => {
    try {
        const evaluation =
            await evaluateWarningEscalation(
                req.params.clusterId
            )

        if (!evaluation) {
            return res.status(404).json({
                success: false,
                message: 'Hazard cluster not found'
            })
        }

        res.status(200).json({
            success: true,
            data: evaluation
        })
    } catch (error) {
        next(error)
    }
}

/*
 * Duty Officer explicitly sends the
 * escalation to the DMC Officer.
 *
 * This does NOT issue a warning.
 */
export const escalateToDmcOfficer = async (
    req,
    res,
    next
) => {
    try {
        const escalation =
            await createEscalationHandoff(
                req.params.clusterId,
                req.user._id
            )

        if (!escalation) {
            return res.status(404).json({
                success: false,
                message: 'Hazard cluster not found'
            })
        }

        res.status(201).json({
            success: true,
            message:
                'Hazard escalation sent to DMC Officer',
            data: escalation
        })
    } catch (error) {
        next(error)
    }
}

export const getClusterEscalation = async (
    req,
    res,
    next
) => {
    try {
        const escalation =
            await getEscalationByCluster(
                req.params.clusterId
            )

        res.status(200).json({
            success: true,
            data: escalation
        })
    } catch (error) {
        next(error)
    }
}

export const getOutgoingEscalations = async (
    req,
    res,
    next
) => {
    try {
        const escalations = await listOutgoingHazardEscalations(req.user._id)

        res.status(200).json({
            success: true,
            data: escalations
        })
    } catch (error) {
        next(error)
    }
}

export const getIncomingHazardEscalations = async (
    req,
    res,
    next
) => {
    try {
        const escalations = await listIncomingHazardEscalations()

        res.status(200).json({
            success: true,
            data: escalations
        })
    } catch (error) {
        next(error)
    }
}

export default {
    getReviewQueue,
    getReviewCluster,
    verifyReport,
    rejectReport,
    checkEscalation,
    escalateToDmcOfficer,
    getIncomingHazardEscalations,
    getOutgoingEscalations,
    getClusterEscalation
}