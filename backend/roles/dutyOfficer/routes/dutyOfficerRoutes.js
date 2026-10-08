import express from 'express'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'
import hazardReviewRoutes from '../../dmcOfficer/routes/hazardReviewRoutes.js'

const router = express.Router()

router.use(authenticate, authorize(USER_ROLES.dutyofficer))
router.use('/hazard-reviews', hazardReviewRoutes)

export default router