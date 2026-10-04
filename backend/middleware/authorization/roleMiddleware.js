import { normalizeRole } from '../../utils/constants.js'

const authorize = (...allowedRoles) => {
    const normalizedAllowedRoles = allowedRoles.map(normalizeRole)

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            })
        }

        if (!normalizedAllowedRoles.includes(normalizeRole(req.user.role))) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            })
        }

        next()
    }
}

export default authorize