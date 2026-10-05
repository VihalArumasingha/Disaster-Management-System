const getReportCountScore = (reportCount) => {
    if (reportCount >= 6) return 40
    if (reportCount >= 4) return 30
    if (reportCount >= 2) return 20
    return 10
}

const getSeverityScore = (hazardType) => {
    const severityScores = {
        landslide: 40,
        flood: 35,
        road_blockage: 20,
        other: 10
    }

    return severityScores[hazardType] || 10
}

const getRecencyScore = (lastReportedAt) => {
    const ageInHours = (
        Date.now() - new Date(lastReportedAt).getTime()
    ) / (1000 * 60 * 60)

    if (ageInHours <= 1) return 20
    if (ageInHours <= 3) return 15
    if (ageInHours <= 6) return 10

    return 0
}

const getPriorityLevel = (score) => {
    if (score >= 75) return 'critical'
    if (score >= 50) return 'high'
    if (score >= 25) return 'medium'

    return 'low'
}

export const calculateClusterPriority = (cluster) => {
    const reportCountScore = getReportCountScore(
        cluster.reportCount
    )

    const severityScore = getSeverityScore(
        cluster.hazardType
    )

    const recencyScore = getRecencyScore(
        cluster.lastReportedAt
    )

    const priorityScore = Math.min(
        reportCountScore
        + severityScore
        + recencyScore,
        100
    )

    const priorityLevel = getPriorityLevel(
        priorityScore
    )

    return {
        priorityScore,
        priorityLevel
    }
}

export default {
    calculateClusterPriority
}