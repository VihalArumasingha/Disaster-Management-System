import HazardReport from '../../../models/HazardReport.js'
import ReportCluster from '../../../models/ReportCluster.js'

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

const getVerifiedReportCount = async (cluster) => {
    return HazardReport.countDocuments({
        _id: {
            $in: cluster.reportIds
        },
        status: 'verified'
    })
}

export const evaluateWarningEscalation = async (
    clusterId
) => {
    const cluster = await ReportCluster.findById(
        clusterId
    )

    if (!cluster) {
        return null
    }

    const verifiedReportCount =
        await getVerifiedReportCount(cluster)

    const hasEnoughVerifiedReports =
        verifiedReportCount >= MIN_VERIFIED_REPORTS

    const hasRequiredPriority =
        PRIORITY_RANK[cluster.priorityLevel]
        >= PRIORITY_RANK[MIN_PRIORITY_LEVEL]

    const shouldEscalate =
        hasEnoughVerifiedReports
        && hasRequiredPriority

    let reason = 'Cluster does not meet escalation criteria'

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

        escalationCriteria: {
            minimumVerifiedReports:
                MIN_VERIFIED_REPORTS,

            minimumPriorityLevel:
                MIN_PRIORITY_LEVEL
        }
    }
}

export const prepareEscalationHandoff = async (
    clusterId
) => {
    const evaluation =
        await evaluateWarningEscalation(clusterId)

    if (!evaluation) {
        return null
    }

    return {
        ...evaluation,

        source: 'hazard report review',

        target: 'warning workflow',

        handoffStatus: evaluation.shouldEscalate
            ? 'ready'
            : 'not_required',

        boundary: {
            createsWarnings: false,
            sendsNotifications: false,
            performsDutyOfficerWorkflow: false
        }
    }
}

export default {
    evaluateWarningEscalation,
    prepareEscalationHandoff
}