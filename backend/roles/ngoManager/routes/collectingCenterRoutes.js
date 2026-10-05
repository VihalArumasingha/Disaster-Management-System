import express from 'express'
import {
    getCollectingCenters,
    createCollectingCenter,
    updateCollectingCenter,
    deleteCollectingCenter
} from '../controllers/collectingCenterController.js'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'

const collectingCenterRouter = express.Router()

// ── /api/collectingcenters ────────────────────────────────────────────────────
// GET: public (support page + dashboard list centers)
collectingCenterRouter.get('/', getCollectingCenters)
// POST/PUT/DELETE: NGO manager only
collectingCenterRouter.post('/', authenticate, authorize(USER_ROLES.ngomanager), createCollectingCenter)
collectingCenterRouter.put('/:centerId', authenticate, authorize(USER_ROLES.ngomanager), updateCollectingCenter)
collectingCenterRouter.delete('/:centerId', authenticate, authorize(USER_ROLES.ngomanager), deleteCollectingCenter)

export default collectingCenterRouter
