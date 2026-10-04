import generateToken from '../../../utils/generateToken.js'
import { normalizeRole } from '../../../utils/constants.js'
import {
    authenticateUser,
    registerUser
} from '../services/authService.js'

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
}

const toPublicUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role)
})

export const register = async (req, res, next) => {
    try {
        const user = await registerUser(req.body)
        res.status(201).json({
            success: true,
            message: 'Account created. You can now sign in.',
            user: toPublicUser(user)
        })
    } catch (error) {
        next(error)
    }
}

export const login = async (req, res, next) => {
    try {
        const user = await authenticateUser(req.body)
        res.cookie('token', generateToken(user._id), cookieOptions)
        res.status(200).json({
            success: true,
            user: toPublicUser(user)
        })
    } catch (error) {
        next(error)
    }
}

export const logout = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    })
    res.status(200).json({
        success: true,
        message: 'Signed out successfully'
    })
}

export const currentUser = (req, res) => {
    res.status(200).json({
        success: true,
        user: toPublicUser(req.user)
    })
}