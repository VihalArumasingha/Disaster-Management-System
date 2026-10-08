import express from 'express'

import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'

import hazardReviewRoutes from '../../dmcOfficer/routes/hazardReviewRoutes.js'

import {
    getReports,
    getReport
} from '../controllers/dutyOfficerReportController.js'
const router = express.Router()

router.use(
    authenticate,
    authorize(USER_ROLES.dutyofficer)
)

router.get(
    '/reports',
    getReports
)

router.get(
    '/reports/:reportId',
    getReport
)

router.use(
    '/hazard-reviews',
    hazardReviewRoutes
)

export default router