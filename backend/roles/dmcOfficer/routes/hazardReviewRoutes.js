import express from 'express'

import {
    getReviewQueue,
    getReviewCluster,
    verifyReport,
    rejectReport
} from '../controllers/hazardReviewController.js'

import {
    validateClusterId,
    validateReportId,
    validateRejection
} from '../validators/hazardReviewValidator.js'

const router = express.Router()

router.get(
    '/clusters',
    getReviewQueue
)

router.get(
    '/clusters/:clusterId',
    validateClusterId,
    getReviewCluster
)

router.patch(
    '/reports/:reportId/verify',
    validateReportId,
    verifyReport
)

router.patch(
    '/reports/:reportId/reject',
    validateReportId,
    validateRejection,
    rejectReport
)

export default router