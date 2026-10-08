import express from 'express'

import {
    getReviewQueue,
    getReviewCluster,
    verifyReport,
    rejectReport,
    checkEscalation,
    escalateToDmcOfficer,
    getClusterEscalation
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

router.get(
    '/clusters/:clusterId/escalation',
    validateClusterId,
    getClusterEscalation
)

router.get(
    '/clusters/:clusterId/escalation/evaluate',
    validateClusterId,
    checkEscalation
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

router.post(
    '/clusters/:clusterId/escalate',
    validateClusterId,
    escalateToDmcOfficer
)

export default router