import jwt from 'jsonwebtoken'
import User from '../../models/User.js'

const authenticate = async (req, res, next) => {
    const token = req.cookies?.token

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        })
    }

    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            success: false,
            message: 'Authentication is not configured'
        })
    }

    let decoded
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (error) {
        if (
            ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError']
                .includes(error.name)
        ) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            })
        }

        return next(error)
    }

    if (typeof decoded !== 'object' || !decoded.userId) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        })
    }

    const user = await User.findById(decoded.userId)
        .select('-password')

    if (!user) {
        return res.status(401).json({
            success: false,
            message: 'User not found'
        })
    }

    req.user = user

    next()
}

export default authenticate