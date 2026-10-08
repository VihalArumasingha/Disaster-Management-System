import express from 'express'
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

router.get('/organizations', listOrganizations)
router.post('/organizations', createOrganization)
router.get('/organizations/:organizationId', getOrganization)
router.put('/organizations/:organizationId', updateOrganization)
router.patch('/organizations/:organizationId/status', updateOrganizationStatus)
router.post('/organizations/:organizationId/contributions', addOrganizationContribution)

export default router
