import express from 'express'
import donationUpload from '../../../middleware/upload/donationUpload.js'
import { createDonation, listDonations, updateDonationStatus } from '../controllers/donationController.js'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'

const router = express.Router()

// Public: anyone can submit a donation (no auth required)
router.post('/', donationUpload.single('evidence'), createDonation)

// Protected: NGO manager can list all donations
router.get('/', authenticate, authorize(USER_ROLES.ngomanager), listDonations)

// Protected: NGO manager can change donation status
router.patch('/:id/status', authenticate, authorize(USER_ROLES.ngomanager), updateDonationStatus)

export default router
