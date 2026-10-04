import express from 'express'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import validateAuthInput from '../validators/authValidator.js'
import {
    currentUser,
    login,
    logout,
    register
} from '../controllers/authController.js'

const router = express.Router()

router.post('/register', validateAuthInput, register)
router.post('/login', validateAuthInput, login)
router.post('/logout', logout)
router.get('/me', authenticate, currentUser)

export default router