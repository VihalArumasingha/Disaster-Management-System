import express from 'express'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'
import disasterUpload from '../../../middleware/upload/disasterUpload.js'
import {
    getApprovedDisasters,
    getVerifiedHazardReports,
    getDisasters,
    getDisasterById,
    createDisaster,
    updateDisaster,
    deleteDisaster,
    getTargetAreas,
    getOverviewMetrics
} from '../controllers/ngoManagerController.js'
import {
    listReliefDeployments,
    assignReliefTeam,
    updateReliefStatus
} from '../controllers/reliefDeploymentController.js'
import resourceManagementRoutes from '../../dmcOfficer/routes/resourceManagementRoutes.js'
import reliefManagementRoutes from '../../dmcOfficer/routes/reliefManagementRoutes.js'
import impactMonitoringRoutes from '../../dmcOfficer/routes/impactMonitoringRoutes.js'
import analyticsRoutes from '../../dmcOfficer/routes/analyticsRoutes.js'

const router = express.Router()

router.use(authenticate, authorize(USER_ROLES.ngomanager))

// Disaster management routes
router.get('/approved-disasters', getApprovedDisasters)
router.get('/verified-hazard-reports', getVerifiedHazardReports)
router.get('/disasters', getDisasters)
router.get('/disasters/:disasterId', getDisasterById)
router.post('/disasters', disasterUpload.array('images', 4), createDisaster)
router.put('/disasters/:disasterId', disasterUpload.array('images', 4), updateDisaster)
router.delete('/disasters/:disasterId', deleteDisaster)
router.get('/target-areas', getTargetAreas)

// Relief deployment routes (persisted + citizen notifications)
router.get('/relief-deployments', listReliefDeployments)
router.post('/relief-deployments', assignReliefTeam)
router.patch('/relief-deployments/:deploymentId', updateReliefStatus)

// Overview metrics route
router.get('/overview/metrics', getOverviewMetrics)
router.use(reliefManagementRoutes)
router.use(resourceManagementRoutes)
router.use(impactMonitoringRoutes)
router.use(analyticsRoutes)

export default router