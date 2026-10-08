import mongoose from 'mongoose'
import HazardReport from '../../../models/HazardReport.js'

export const getDutyOfficerReports = async () => {
    return HazardReport.find({})
        .populate('reporterId', 'name email')
        .sort({
            submittedAt: -1
        })
        .lean()
}

export const getDutyOfficerReportById = async (
    reportId
) => {
    if (!mongoose.isValidObjectId(reportId)) {
        const error = new Error(
            'Invalid hazard report ID'
        )

        error.statusCode = 400

        throw error
    }

    return HazardReport.findById(reportId)
        .populate('reporterId', 'name email')
        .populate('clusterId')
        .lean()
}

export default {
    getDutyOfficerReports,
    getDutyOfficerReportById
}