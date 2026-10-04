import express from 'express'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'

const router = express.Router()

router.use(authenticate, authorize(USER_ROLES.citizen))

export default router