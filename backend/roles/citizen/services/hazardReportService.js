import HazardReport from '../../../models/HazardReport.js'
import { assignReportToCluster } from './hazardClusteringService.js'

const DUPLICATE_DISTANCE_METERS = 200
const DUPLICATE_TIME_WINDOW_MINUTES = 10

const findRecentDuplicateReport = async (reporterId, data) => {
    if (!data.location?.coordinates) {
        return null
    }

    const duplicateSince = new Date(
        Date.now() - DUPLICATE_TIME_WINDOW_MINUTES * 60 * 1000
    )

    const duplicate = await HazardReport.findOne({
        reporterId,
        hazardType: data.hazardType,
        submittedAt: {
            $gte: duplicateSince,
        },
        location: {
            $near: {
                $geometry: data.location,
                $maxDistance: DUPLICATE_DISTANCE_METERS,
            },
        },
    }).sort({
        submittedAt: -1,
    })

    return duplicate
}

export const createHazardReport = async (
    reporterId,
    data
) => {
    /*
     * Check for an accidental duplicate before creating
     * a new report.
     *
     * The check is skipped when the citizen explicitly
     * chooses "Submit as new".
     */
    const forceSubmit =
        data.forceSubmit === true ||
        data.forceSubmit === 'true'

    if (!forceSubmit) {
        const duplicate = await findRecentDuplicateReport(
            reporterId,
            data
        )

        if (duplicate) {
            const error = new Error(
                'A similar report was recently submitted.'
            )

            error.code = 'DUPLICATE_HAZARD_REPORT'
            error.statusCode = 409
            error.existingReportId = duplicate._id.toString()

            throw error
        }
    }

    const report = await HazardReport.create({
        reporterId,
        hazardType: data.hazardType,
        description: data.description.trim(),
        photo: data.photo,
        location: data.location,
        capturedAt: data.capturedAt,
        submittedAt: new Date(),
        status: 'pending',
        syncStatus: 'synced'
    })

    const cluster = await assignReportToCluster(report)

    return {
        report,
        cluster
    }
}

export const getCitizenHazardReports = async (
    reporterId
) => {
    return HazardReport.find({ reporterId })
        .sort({ createdAt: -1 })
}

export const getCitizenHazardReportById = async (
    reporterId,
    reportId
) => {
    return HazardReport.findOne({
        _id: reportId,
        reporterId
    })
}

export const updateCitizenHazardReport = async (
    reporterId,
    reportId,
    data
) => {
    const report = await HazardReport.findOne({
        _id: reportId,
        reporterId
    })

    if (!report) {
        return null
    }

    if (report.status !== 'pending') {
        const error = new Error(
            'Only pending hazard reports can be updated'
        )

        error.statusCode = 400
        throw error
    }

    if (data.hazardType !== undefined) {
        report.hazardType = data.hazardType
    }

    if (data.description !== undefined) {
        report.description = data.description.trim()
    }

    if (data.location !== undefined) {
        report.location = data.location
    }

    if (data.capturedAt !== undefined) {
        report.capturedAt = new Date(data.capturedAt)
    }

    if (data.photo !== undefined) {
        report.photo = data.photo
    }

    await report.save()

    return report
}

export const deleteCitizenHazardReport = async (
    reporterId,
    reportId
) => {
    const report = await HazardReport.findOne({
        _id: reportId,
        reporterId
    })

    if (!report) {
        return null
    }

    if (report.status !== 'pending') {
        const error = new Error(
            'Only pending hazard reports can be deleted'
        )

        error.statusCode = 400
        throw error
    }

    await report.deleteOne()

    return report
}

export const getHazardReportByPhotoFilename = async (
    filename
) => {
    return HazardReport.findOne({
        'photo.url': `/api/hazard-report-photos/${filename}`
    })
}

export default {
    createHazardReport,
    getCitizenHazardReports,
    getCitizenHazardReportById,
    updateCitizenHazardReport,
    deleteCitizenHazardReport,
    getHazardReportByPhotoFilename
}