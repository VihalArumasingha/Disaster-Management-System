import express from 'express'
import {
    getVolunteers,
    getVolunteerById,
    createVolunteer,
    updateVolunteer,
    updateVolunteerAssignment,
    deleteVolunteer
} from '../controllers/volunteerController.js'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'

const volunteerRouter = express.Router()

// ── /api/volunteers ──────────────────────────────────────────────────────────
// GET: public (list + detail for the pages; mobile app also reads these)
volunteerRouter.get('/', getVolunteers)
volunteerRouter.get('/:volunteerId', getVolunteerById)
// POST: public — citizen mobile app registers itself, NGO "Add volunteer" page
// (the NGO layout already gates the UI; same approach as donation creation)
volunteerRouter.post('/', createVolunteer)
// PUT / PATCH / DELETE: NGO manager only
volunteerRouter.put('/:volunteerId', authenticate, authorize(USER_ROLES.ngomanager), updateVolunteer)
volunteerRouter.patch(
    '/:volunteerId/assignment',
    authenticate,
    authorize(USER_ROLES.ngomanager),
    updateVolunteerAssignment
)
volunteerRouter.delete('/:volunteerId', authenticate, authorize(USER_ROLES.ngomanager), deleteVolunteer)

export default volunteerRouter
