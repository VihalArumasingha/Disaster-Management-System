import express from 'express'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'
import reliefManagementRoutes from '../../dmcOfficer/routes/reliefManagementRoutes.js'
import {
    bindActiveOrganization,
    changeOrganizationPassword,
    getOrganizationDashboard,
    getOrganizationProfile,
    recordOrganizationContribution,
    updateOrganizationProfile
} from '../controllers/organizationPortalController.js'

const router = express.Router()

router.use(authenticate, authorize(USER_ROLES.organization), bindActiveOrganization)
router.get('/dashboard', getOrganizationDashboard)
router.get('/profile', getOrganizationProfile)
router.put('/profile', updateOrganizationProfile)
router.patch('/password', changeOrganizationPassword)
router.post('/contributions', recordOrganizationContribution)
router.use(reliefManagementRoutes)

export default router
