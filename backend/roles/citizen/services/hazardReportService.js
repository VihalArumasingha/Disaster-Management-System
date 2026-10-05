import HazardReport from '../../../models/HazardReport.js'
import { assignReportToCluster } from './hazardClusteringService.js'


export const createHazardReport = async (
    reporterId,
    data
) => {
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
}}

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

export default {
    createHazardReport,
    getCitizenHazardReports,
    getCitizenHazardReportById,
    updateCitizenHazardReport,
    deleteCitizenHazardReport
}

export const getHazardReportByPhotoFilename = async (filename) => {
    return HazardReport.findOne({
        'photo.url': `/api/hazard-report-photos/${filename}`
    })
}