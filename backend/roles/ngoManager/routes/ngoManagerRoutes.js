import express from 'express'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'
import disasterUpload from '../../../middleware/upload/disasterUpload.js'
import {
    getDisasters,
    getDisasterById,
    createDisaster,
    updateDisaster,
    deleteDisaster,
    getTargetAreas
} from '../controllers/ngoManagerController.js'

const router = express.Router()

router.use(authenticate, authorize(USER_ROLES.ngomanager))

// Disaster management routes
router.get('/disasters', getDisasters)
router.get('/disasters/:disasterId', getDisasterById)
router.post('/disasters', disasterUpload.array('images', 4), createDisaster)
router.put('/disasters/:disasterId', disasterUpload.array('images', 4), updateDisaster)
router.delete('/disasters/:disasterId', deleteDisaster)
router.get('/target-areas', getTargetAreas)

export default router