import api from '../../../services/api'

export const getDutyOfficerReports = async (
    includeArchived = false
) => {
    const response = await api.get(
        '/dutyofficer/reports',
        {
            params: includeArchived
                ? {
                    archived: 'true'
                }
                : {}
        }
    )

    return response.data
}

export const getDutyOfficerReportById = async (
    reportId
) => {
    const response = await api.get(
        `/dutyofficer/reports/${reportId}`
    )

    return response.data?.data || null
}

export const archiveDutyOfficerReport = async (
    reportId
) => {
    const { data } = await api.patch(
        `/dutyofficer/reports/${reportId}/archive`
    )

    return data
}

export default {
    getDutyOfficerReports,
    getDutyOfficerReportById,
    archiveDutyOfficerReport
}