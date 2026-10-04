import express from 'express'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'
import { listNotifications, markNotificationRead } from '../controllers/notificationController.js'

const router = express.Router()

router.use(authenticate, authorize(USER_ROLES.citizen))
router.get('/notifications', listNotifications)
router.patch('/notifications/:notificationId/read', markNotificationRead)

export default router