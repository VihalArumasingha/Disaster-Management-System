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

export const evaluateEscalation = async (clusterId) => {
    const response = await api.get(
        `${hazardReviewPath}/clusters/${encodeURIComponent(clusterId)}/escalation/evaluate`
    )
    return getResponseData(response)
}

export const getClusterEscalation = async (clusterId) => {
    const response = await api.get(
        `${hazardReviewPath}/clusters/${encodeURIComponent(clusterId)}/escalation`
    )
    return getResponseData(response)
}

export const escalateClusterToDutyOfficer = async (clusterId) => {
    const response = await api.post(
        `${hazardReviewPath}/clusters/${encodeURIComponent(clusterId)}/escalate`
    )
    return response.data
}