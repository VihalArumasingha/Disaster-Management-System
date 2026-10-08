import {
    getDutyOfficerReports,
    getDutyOfficerReportById
} from '../services/dutyOfficerReportService.js'

export const getReports = async (
    req,
    res,
    next
) => {
    try {
        const reports =
            await getDutyOfficerReports()

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

export default {
    getReports,
    getReport
}