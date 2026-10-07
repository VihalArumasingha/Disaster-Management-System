import express from 'express'
import ngoPastUpload from '../../../middleware/upload/ngoPastUpload.js'
import {
    getPastRecords,
    getPastRecordById,
    createPastRecord,
    updatePastRecord,
    deletePastRecord
} from '../controllers/ngoPastController.js'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'

// ── /api/ngopast ──────────────────────────────────────────────────
// NGO Past Records. GET is public (the NGO dashboard and the citizen
// mobile app both read the list); mutating routes require an NGO
// manager session. Images upload straight to Cloudinary (max 2).
const ngoPastRouter = express.Router()

ngoPastRouter.get('/', getPastRecords)
ngoPastRouter.get('/:recordId', getPastRecordById)
ngoPastRouter.post(
    '/',
    authenticate,
    authorize(USER_ROLES.ngomanager),
    ngoPastUpload.array('images', 2),
    createPastRecord
)
ngoPastRouter.put(
    '/:recordId',
    authenticate,
    authorize(USER_ROLES.ngomanager),
    ngoPastUpload.array('images', 2),
    updatePastRecord
)
ngoPastRouter.delete(
    '/:recordId',
    authenticate,
    authorize(USER_ROLES.ngomanager),
    deletePastRecord
)

export default ngoPastRouter
