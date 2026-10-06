import {
    createHazardReport,
    getCitizenHazardReports,
    getCitizenHazardReportById,
    getHazardReportByPhotoFilename,
    updateCitizenHazardReport,
    deleteCitizenHazardReport
} from '../services/hazardReportService.js'

import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const uploadDirectory = fileURLToPath(
    new URL('../../../uploads/hazard-reports/', import.meta.url)
)

export const createReport = async (
    req,
    res,
    next
) => {
    try {
        const reportData = { ...req.body }

        if (req.file) {
            reportData.photo = {
                url: `/api/hazard-report-photos/${req.file.filename}`,
                capturedAt: req.body.capturedAt
            }
        }

        const result = await createHazardReport(
            req.user._id,
            reportData
        )

        res.status(201).json({
            success: true,
            report: result.report,
            cluster: result.cluster
        })
    } catch (error) {
        /*
         * Duplicate reports are an expected application
         * response, not a server failure.
         */
        if (error.code === 'DUPLICATE_HAZARD_REPORT') {
            if (req.file) {
                await unlink(req.file.path).catch(() => {})
            }

            return res.status(409).json({
                success: false,
                isDuplicate: true,
                existingReportId: error.existingReportId,
                message: 'A similar report was recently submitted.'
            })
        }

        if (req.file) {
            await unlink(req.file.path).catch(() => {})
        }

        next(error)
    }
}

export const getReportPhoto = async (
    req,
    res,
    next
) => {
    try {
        if (
            !/^[\w-]+\.(jpg|png|webp|gif|avif|heic|heif)$/i.test(
                req.params.filename
            )
        ) {
            return res.status(404).json({
                success: false,
                message: 'Hazard report photo not found'
            })
        }

        const report = await getHazardReportByPhotoFilename(
            req.params.filename
        )

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Hazard report photo not found'
            })
        }

        res.set('Cache-Control', 'private, max-age=3600')
        res.set('X-Content-Type-Options', 'nosniff')

        res.sendFile(
            path.join(
                uploadDirectory,
                req.params.filename
            )
        )
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