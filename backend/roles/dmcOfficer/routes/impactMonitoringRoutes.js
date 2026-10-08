import express from 'express'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'
import {
    createImpactRecord,
    listImpactRecords,
    updateImpactRecord
} from '../controllers/impactMonitoringController.js'

const router = express.Router()

router.get('/impact-records', listImpactRecords)
router.post('/impact-records', authorize(USER_ROLES.dmcofficer), createImpactRecord)
router.put('/impact-records/:recordId', authorize(USER_ROLES.dmcofficer), updateImpactRecord)

export default router
