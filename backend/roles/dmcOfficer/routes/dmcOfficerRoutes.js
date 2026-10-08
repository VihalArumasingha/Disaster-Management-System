import express from 'express'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'
import hazardReviewRoutes from './hazardReviewRoutes.js'
import impactMonitoringRoutes from './impactMonitoringRoutes.js'
import analyticsRoutes from './analyticsRoutes.js'
import reliefManagementRoutes from './reliefManagementRoutes.js'
import resourceManagementRoutes from './resourceManagementRoutes.js'
import { getIncomingHazardEscalations } from '../controllers/hazardReviewController.js'
import {
    openWeatherTile,
    addWarningUpdate,
    editWarning,
    issueWarningNow,
    overview,
    profile,
    reviewWarning,
    resolveWarningNow,
    saveTargetArea,
    saveWarning,
    targetAreaPreview,
    targetAreas,
    warningRecipientPreview,
    warnings
} from '../controllers/dmcOfficerController.js'

const router = express.Router()

router.use(authenticate, authorize(USER_ROLES.dmcofficer))

router.get('/overview', overview)
router.get('/profile', profile)
router.use('/hazard-reviews', hazardReviewRoutes)
router.use(reliefManagementRoutes)
router.use(resourceManagementRoutes)
router.use(impactMonitoringRoutes)
router.use(analyticsRoutes)
router.get('/hazard-escalations', getIncomingHazardEscalations)
router.get('/target-areas', targetAreas)
router.post('/target-areas/preview', targetAreaPreview)
router.post('/target-areas', saveTargetArea)
router.get('/warnings', warnings)
router.post('/warnings', saveWarning)
router.post('/warnings/preview', warningRecipientPreview)
router.get('/warnings/:warningId/review', reviewWarning)
router.post('/warnings/:warningId/updates', addWarningUpdate)
router.patch('/warnings/:warningId/resolve', resolveWarningNow)
router.put('/warnings/:warningId', editWarning)
router.post('/warnings/:warningId/issue', issueWarningNow)
router.get('/map/tiles/:layer/:z/:x/:y', openWeatherTile)

export default router