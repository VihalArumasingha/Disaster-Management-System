import express from 'express'

import {
    createReport,
    getReports,
    getReport,
    updateReport,
    deleteReport
} from '../controllers/hazardReportController.js'

import {
    validateCreateHazardReport,
    validateHazardReportId
} from '../validators/hazardReportValidator.js'

const router = express.Router()

router.post(
    '/',
    validateCreateHazardReport,
    createReport
)

router.get(
    '/',
    getReports
)

router.get(
    '/:id',
    validateHazardReportId,
    getReport
)

router.patch(
    '/:id',
    validateHazardReportId,
    updateReport
)

router.delete(
    '/:id',
    validateHazardReportId,
    deleteReport
)

export default router