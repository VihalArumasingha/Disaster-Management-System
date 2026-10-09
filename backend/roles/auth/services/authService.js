import bcrypt from 'bcryptjs'
import User from '../../../models/User.js'
import { normalizeRole, USER_ROLES } from '../../../utils/constants.js'
import {
    addCitizenToTargetAreas,
    getCitizenTargetAreaIds
} from '../../../utils/citizenTargetAreas.js'

const createAuthError = (message, statusCode) => {
    const error = new Error(message)
    error.statusCode = statusCode
    return error
}

export const registerUser = async ({
    name,
    email,
    password,
    phone,
    location,
    nationalId,
    homeAddress,
    district
}) => {
    const normalizedEmail = email.trim().toLowerCase()
    const existingUser = await User.findOne({ email: normalizedEmail })

    if (existingUser) {
        throw createAuthError('An account with this email already exists', 409)
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const point = location
        ? {
            type: 'Point',
            coordinates: [location.longitude, location.latitude]
        }
        : undefined
    const targetAreaIds = point
        ? await getCitizenTargetAreaIds(point)
        : []

    try {
        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            phone: phone.trim(),
            nationalId,
            homeAddress,
            district,
            ...(point ? { location: point } : {}),
            role: USER_ROLES.citizen
        })

        await addCitizenToTargetAreas(user._id, targetAreaIds)
        return user
    } catch (error) {
        if (error.code === 11000) {
            throw createAuthError('An account with this email already exists', 409)
        }

        throw error
    }
}

export const authenticateUser = async ({ email, password, client }) => {
    const user = await User.findOne({ email: email.trim().toLowerCase() })

    if (!user || !(await bcrypt.compare(password, user.password))) {
        throw createAuthError('Invalid email or password', 401)
    }

    const role = normalizeRole(user.role)
    const validRoles = Object.values(USER_ROLES)
    const isCitizen = role === USER_ROLES.citizen

    if (
        !validRoles.includes(role)
        || (client === 'mobile' && !isCitizen)
        || (client === 'web' && isCitizen)
    ) {
        throw createAuthError(
            client === 'mobile'
                ? 'This account is not registered for the citizen portal'
                : 'This account does not have access to the staff portal',
            403
        )
    }

    return user
}