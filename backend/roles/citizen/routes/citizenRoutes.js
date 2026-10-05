import express from 'express'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'
import {
    listNotifications,
    listRecentWarnings,
    getLatestCitizenWarning,
    markNotificationRead,
    getWarningDetail,
    nearbyHazards,
    nearbyFacilities
} from '../controllers/notificationController.js'
import hazardReportRoutes from './hazardReportRoutes.js'

const router = express.Router()

router.use(authenticate, authorize(USER_ROLES.citizen))
router.get('/warnings/recent', listRecentWarnings)
router.get('/warnings/latest-for-me', getLatestCitizenWarning)
router.get('/nearby-hazards', nearbyHazards)
router.get('/nearby-facilities', nearbyFacilities)
router.get('/warnings/:warningId', getWarningDetail)
router.get('/notifications', listNotifications)
router.patch('/notifications/:notificationId/read', markNotificationRead)

router.use('/hazard-reports', hazardReportRoutes)

export default router