import mongoose from 'mongoose'
import HazardReport from '../../../models/HazardReport.js'

export const getDutyOfficerReports = async (
    includeArchived = false
) => {
    const filter = includeArchived
        ? {
            archived: true
        }
        : {
            archived: {
                $ne: true
            }
        }

    return HazardReport.find(filter)
        .populate('reporterId', 'name email')
        .populate(
            'archive.archivedBy',
            'name email'
        )
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
        .populate(
            'archive.archivedBy',
            'name email'
        )
        .lean()
}

export const archiveDutyOfficerReport = async (
    reportId,
    officerId
) => {
    if (!mongoose.isValidObjectId(reportId)) {
        const error = new Error(
            'Invalid hazard report ID'
        )

        error.statusCode = 400

        throw error
    }

    if (!mongoose.isValidObjectId(officerId)) {
        const error = new Error(
            'Invalid officer ID'
        )

        error.statusCode = 400

        throw error
    }

    const report =
        await HazardReport.findById(reportId)

    if (!report) {
        const error = new Error(
            'Hazard report not found'
        )

        error.statusCode = 404

        throw error
    }

    if (report.archived === true) {
        const error = new Error(
            'This report is already archived'
        )

        error.statusCode = 400

        throw error
    }

    /*
     * Pending reports must remain in the
     * active Duty Officer workflow.
     */
    if (report.status === 'pending') {
        const error = new Error(
            'Pending reports cannot be archived. Review the report first.'
        )

        error.statusCode = 400

        throw error
    }

    /*
     * Only verified and rejected reports
     * can be archived.
     */
    if (
        report.status !== 'verified'
        && report.status !== 'rejected'
    ) {
        const error = new Error(
            'Only verified or rejected reports can be archived'
        )

        error.statusCode = 400

        throw error
    }

    report.archived = true

    report.archive = {
        archivedBy: officerId,
        archivedAt: new Date()
    }

    await report.save()

    return HazardReport.findById(report._id)
        .populate('reporterId', 'name email')
        .populate(
            'archive.archivedBy',
            'name email'
        )
        .lean()
}

export default {
    getDutyOfficerReports,
    getDutyOfficerReportById,
    archiveDutyOfficerReport
}