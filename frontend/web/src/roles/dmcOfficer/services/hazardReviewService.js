import api from '../../../services/api'

const hazardReviewPath = '/dmcofficer/hazard-reviews'

const getResponseData = (response) => response.data?.data

export const getHazardReviewQueue = async (config) => {
    const response = await api.get(`${hazardReviewPath}/clusters`, config)
    return getResponseData(response) || []
}

export const getHazardReviewCluster = async (clusterId, config) => {
    const response = await api.get(
        `${hazardReviewPath}/clusters/${encodeURIComponent(clusterId)}`,
        config
    )
    return getResponseData(response)
}

export const verifyHazardReport = async (reportId) => {
    const response = await api.patch(
        `${hazardReviewPath}/reports/${encodeURIComponent(reportId)}/verify`
    )
    return response.data
}

export const rejectHazardReport = async (reportId, reason) => {
    const response = await api.patch(
        `${hazardReviewPath}/reports/${encodeURIComponent(reportId)}/reject`,
        { reason }
    )
    return response.data
}

export const evaluateEscalation = async (clusterId, config) => {
    const response = await api.get(
        `${hazardReviewPath}/clusters/${encodeURIComponent(clusterId)}/escalation/evaluate`,
        config
    )
    return getResponseData(response)
}

export const getClusterEscalation = async (clusterId, config) => {
    const response = await api.get(
        `${hazardReviewPath}/clusters/${encodeURIComponent(clusterId)}/escalation`,
        config
    )
    return getResponseData(response)
}

export const getEscalationTrackingRecords = async (config) => {
    const clusters = await getHazardReviewQueue(config)
    const lookups = await Promise.allSettled(
        clusters.map(async (cluster) => {
            const clusterId = cluster._id || cluster.id
            if (!clusterId) return null
            const escalation = await getClusterEscalation(clusterId, config)
            if (!escalation) return null

            let currentEvaluation = null
            let evaluationUnavailable = false
            try {
                currentEvaluation = await evaluateEscalation(clusterId, config)
            } catch {
                evaluationUnavailable = true
            }

            const populatedCluster = escalation.clusterId && typeof escalation.clusterId === 'object'
                ? escalation.clusterId
                : cluster

            return {
                ...escalation,
                clusterId: populatedCluster._id || clusterId,
                cluster: populatedCluster,
                currentEvaluation,
                evaluationUnavailable
            }
        })
    )

    return {
        records: lookups
            .filter((result) => result.status === 'fulfilled' && result.value)
            .map((result) => result.value),
        lookupFailures: lookups.filter((result) => result.status === 'rejected').length,
        evaluationFailures: lookups.filter((result) => (
            result.status === 'fulfilled' && result.value?.evaluationUnavailable
        )).length,
        clusterCount: clusters.length
    }
}

export const escalateClusterToDutyOfficer = async (clusterId) => {
    const response = await api.post(
        `${hazardReviewPath}/clusters/${encodeURIComponent(clusterId)}/escalate`
    )
    return response.data
}