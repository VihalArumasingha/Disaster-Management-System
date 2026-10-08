import api from '../../../services/api'

export const getDutyOfficerReports = async () => {
    const response = await api.get(
        '/dutyofficer/reports'
    )

    return response.data
}

export const getDutyOfficerReportById = async (
    reportId
) => {
    const result = await getDutyOfficerReports()

    const reports = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
            ? result.data
            : []

    return reports.find(
        (report) =>
            String(report?._id) === String(reportId)
    ) || null
}

export default {
    getDutyOfficerReports,
    getDutyOfficerReportById
}