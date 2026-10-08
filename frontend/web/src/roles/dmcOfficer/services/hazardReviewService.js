import api from '../../../services/api'

const hazardReviewPath = '/dutyofficer/hazard-reviews'

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

export const getIncomingHazardEscalations = async (config) => {
    const response = await api.get('/dmcofficer/hazard-escalations', config)
    return getResponseData(response) || []
}

export const escalateClusterToDmcOfficer = async (clusterId) => {
    const response = await api.post(
        `${hazardReviewPath}/clusters/${encodeURIComponent(clusterId)}/escalate`
    )
    return response.data
}

export const getOutgoingEscalations = async (config) => {
    const response = await api.get(`${hazardReviewPath}/escalations/recent`, config)
    return getResponseData(response) || []
}