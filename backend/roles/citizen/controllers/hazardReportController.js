import {
    createHazardReport,
    getCitizenHazardReports,
    getCitizenHazardReportById,
    updateCitizenHazardReport,
    deleteCitizenHazardReport
} from '../services/hazardReportService.js'

export const createReport = async (
    req,
    res,
    next
) => {
    try {
        const result = await createHazardReport(
            req.user._id,
            req.body
        )

        res.status(201).json({
            success: true,
            report: result.report,
            cluster: result.cluster
        })
    } catch (error) {
        next(error)
    }
}

export const getReports = async (
    req,
    res,
    next
) => {
    try {
        const reports = await getCitizenHazardReports(
            req.user._id
        )

        res.status(200).json({
            success: true,
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
        const report = await getCitizenHazardReportById(
            req.user._id,
            req.params.id
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

export const updateReport = async (
    req,
    res,
    next
) => {
    try {
        const report = await updateCitizenHazardReport(
            req.user._id,
            req.params.id,
            req.body
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

export const deleteReport = async (
    req,
    res,
    next
) => {
    try {
        const report = await deleteCitizenHazardReport(
            req.user._id,
            req.params.id
        )

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Hazard report not found'
            })
        }

        res.status(200).json({
            success: true,
            message: 'Hazard report deleted successfully'
        })
    } catch (error) {
        next(error)
    }
}

export default {
    createReport,
    getReports,
    getReport,
    updateReport,
    deleteReport
}