import HazardReport from '../../../models/HazardReport.js'
import ReportCluster from '../../../models/ReportCluster.js'
import HazardEscalation from '../../../models/HazardEscalation.js'

const MIN_VERIFIED_REPORTS = Number(
    process.env.HAZARD_ESCALATION_MIN_VERIFIED_REPORTS || 1
)

const MIN_PRIORITY_LEVEL = (
    process.env.HAZARD_ESCALATION_MIN_PRIORITY_LEVEL
    || 'high'
)

const PRIORITY_RANK = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4
}

const getVerifiedReports = async (cluster) => {
    return HazardReport.find({
        _id: {
            $in: cluster.reportIds
        },
        status: 'verified'
    })
        .select('_id')
        .lean()
}

export const evaluateWarningEscalation = async (
    clusterId
) => {
    const cluster = await ReportCluster.findById(clusterId)

    if (!cluster) {
        return null
    }

    const verifiedReports =
        await getVerifiedReports(cluster)

    const verifiedReportCount =
        verifiedReports.length

    const hasEnoughVerifiedReports =
        verifiedReportCount >= MIN_VERIFIED_REPORTS

    const hasRequiredPriority =
        PRIORITY_RANK[cluster.priorityLevel]
        >= PRIORITY_RANK[MIN_PRIORITY_LEVEL]

    const shouldEscalate =
        hasEnoughVerifiedReports
        && hasRequiredPriority

    let reason =
        'Cluster does not meet escalation criteria'

    if (shouldEscalate) {
        reason =
            'Verified hazard reports and cluster priority meet escalation criteria'
    } else if (!hasEnoughVerifiedReports) {
        reason =
            'Cluster does not have enough verified hazard reports'
    } else if (!hasRequiredPriority) {
        reason =
            'Cluster priority is below the escalation threshold'
    }

    return {
        shouldEscalate,
        reason,

        clusterId: cluster._id,
        hazardType: cluster.hazardType,

        priorityScore: cluster.priorityScore,
        priorityLevel: cluster.priorityLevel,

        verifiedReportCount,

        verifiedReportIds:
            verifiedReports.map(report => report._id),

        escalationCriteria: {
            minimumVerifiedReports:
                MIN_VERIFIED_REPORTS,

            minimumPriorityLevel:
                MIN_PRIORITY_LEVEL
        }
    }
}

/*
 * Creates the actual persistent handoff from
 * Duty Officer → DMC Officer.
 *
 * This does NOT create a Warning.
 * This does NOT send notifications.
 */
export const createEscalationHandoff = async (
    clusterId,
    officerId
) => {
    const evaluation =
        await evaluateWarningEscalation(clusterId)

    if (!evaluation) {
        return null
    }

    if (!evaluation.shouldEscalate) {
        const error = new Error(
            evaluation.reason
        )

        error.statusCode = 400

        throw error
    }

    const existing = await HazardEscalation.findOne({ clusterId })

    if (existing) {
        if (existing.status !== 'pending_dmc_review') {
            const error = new Error(
                'An escalation already exists for this cluster'
            )

            error.statusCode = 409

            throw error
        }

        return existing
            .populate([
                {
                    path: 'clusterId'
                },
                {
                    path: 'verifiedReportIds'
                },
                {
                    path: 'escalatedBy',
                    select: 'name email role'
                }
            ])
    }

    const escalation =
        await HazardEscalation.create({
            clusterId: evaluation.clusterId,

            hazardType:
                evaluation.hazardType,

            priorityScore:
                evaluation.priorityScore,

            priorityLevel:
                evaluation.priorityLevel,

            verifiedReportIds:
                evaluation.verifiedReportIds,

            verifiedReportCount:
                evaluation.verifiedReportCount,

            escalatedBy:
                officerId,

            escalatedAt:
                new Date(),

            status:
                'pending_dmc_review'
        })

    return escalation
        .populate([
            {
                path: 'clusterId'
            },
            {
                path: 'verifiedReportIds'
            },
            {
                path: 'escalatedBy',
                select: 'name email role'
            }
        ])
}

export const getEscalationByCluster = async (
    clusterId
) => {
    return HazardEscalation.findOne({
        clusterId
    })
        .populate(
            'clusterId'
        )
        .populate(
            'verifiedReportIds'
        )
        .populate(
            'escalatedBy',
            'name email role'
        )
}

export const getIncomingHazardEscalations = async () => {
    return HazardEscalation.find({
        status: 'pending_dmc_review'
    })
        .populate({
            path: 'clusterId',
            populate: {
                path: 'reportIds',
                select: 'hazardType description location capturedAt submittedAt status photo'
            }
        })
        .populate(
            'verifiedReportIds',
            'hazardType description location capturedAt submittedAt status photo'
        )
        .populate(
            'escalatedBy',
            'name email role'
        )
        .sort({ escalatedAt: -1 })
}

export default {
    evaluateWarningEscalation,
    createEscalationHandoff,
    getEscalationByCluster,
    getIncomingHazardEscalations
}