import express from 'express'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'
import {
    addOrganizationContribution,
    createOrganization,
    createShelter,
    getOrganization,
    getShelter,
    listOrganizations,
    listShelters,
    recordShelterOccupancy,
    updateOrganization,
    updateOrganizationStatus,
    updateShelter,
    updateShelterStatus
} from '../controllers/resourceManagementController.js'

const router = express.Router()

router.get('/shelters', listShelters)
router.post('/shelters', createShelter)
router.get('/shelters/:shelterId', getShelter)
router.put('/shelters/:shelterId', updateShelter)
router.patch('/shelters/:shelterId/status', updateShelterStatus)
router.post('/shelters/:shelterId/occupancy', recordShelterOccupancy)

router.get('/organizations', authorize(USER_ROLES.dmcofficer, USER_ROLES.ngomanager), listOrganizations)
router.post('/organizations', authorize(USER_ROLES.dmcofficer, USER_ROLES.ngomanager), createOrganization)
router.get('/organizations/:organizationId', authorize(USER_ROLES.dmcofficer, USER_ROLES.ngomanager), getOrganization)
router.put('/organizations/:organizationId', authorize(USER_ROLES.dmcofficer, USER_ROLES.ngomanager), updateOrganization)
router.patch('/organizations/:organizationId/status', authorize(USER_ROLES.dmcofficer, USER_ROLES.ngomanager), updateOrganizationStatus)
router.post('/organizations/:organizationId/contributions', authorize(USER_ROLES.dmcofficer, USER_ROLES.ngomanager), addOrganizationContribution)

export default router
