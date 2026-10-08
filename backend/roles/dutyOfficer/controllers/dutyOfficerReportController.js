import {
    getDutyOfficerReports,
    getDutyOfficerReportById,
    archiveDutyOfficerReport
} from '../services/dutyOfficerReportService.js'

export const getReports = async (
    req,
    res,
    next
) => {
    try {
        const includeArchived =
            req.query.archived === 'true'

        const reports =
            await getDutyOfficerReports(
                includeArchived
            )

        res.status(200).json({
            success: true,
            count: reports.length,
            data: reports
        })
    } catch (error) {
        next(error)
    }
}

export const getReport = async (
    req,
    res,
    next
) => {
    try {
        const report =
            await getDutyOfficerReportById(
                req.params.reportId
            )

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Hazard report not found'
            })
        }

        res.status(200).json({
            success: true,
            data: report
        })
    } catch (error) {
        next(error)
    }
}

export const archiveReport = async (
    req,
    res,
    next
) => {
    try {
        const report =
            await archiveDutyOfficerReport(
                req.params.reportId,
                req.user._id
            )

        res.status(200).json({
            success: true,
            message:
                'Hazard report archived successfully',
            data: report
        })
    } catch (error) {
        next(error)
    }
}

export default {
    getReports,
    getReport,
    archiveReport
}