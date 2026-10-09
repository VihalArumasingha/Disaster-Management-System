import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock external dependencies so these are isolated unit tests.
vi.mock('../../models/User.js', () => ({
    default: {
        findOne: vi.fn(),
        create: vi.fn(),
        findById: vi.fn()
    }
}))

vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn(),
        compare: vi.fn()
    }
}))

vi.mock('jsonwebtoken', () => ({
    default: {
        verify: vi.fn()
    }
}))

vi.mock('../../utils/citizenTargetAreas.js', () => ({
    getCitizenTargetAreaIds: vi.fn(),
    addCitizenToTargetAreas: vi.fn()
}))

import User from '../../models/User.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import {
    getCitizenTargetAreaIds,
    addCitizenToTargetAreas
} from '../../utils/citizenTargetAreas.js'

import {
    registerUser,
    authenticateUser
} from '../../roles/auth/services/authService.js'

import validateAuthInput from '../../roles/auth/validators/authValidator.js'
import authenticate from '../../middleware/authentication/authMiddleware.js'
import authorize from '../../middleware/authorization/roleMiddleware.js'

const USER_ID = '64a000000000000000000020'
const AREA_ID = '64a000000000000000000001'

const makeResponse = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn()
})

const validRegistration = (overrides = {}) => ({
    path: '/register',
    body: {
        name: 'Test Citizen',
        email: 'citizen@example.test',
        password: 'Password123',
        phone: '0712345678',
        ...overrides
    }
})

const validLogin = (overrides = {}) => ({
    email: 'citizen@example.test',
    password: 'Password123',
    client: 'mobile',
    ...overrides
})

describe('Authentication and Authorization Unit Tests', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        vi.stubEnv('JWT_SECRET', 'unit-test-secret')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    // ========================================================
    // REGISTRATION
    // ========================================================

    describe('User Registration', () => {

        // POSITIVE: valid user details create an account with a hashed password.
        it('registers a user successfully', async () => {
            User.findOne.mockResolvedValue(null)
            bcrypt.hash.mockResolvedValue('hashed-password')
            User.create.mockResolvedValue({ _id: USER_ID })

            const result = await registerUser({
                name: ' Test Citizen ',
                email: ' CITIZEN@EXAMPLE.TEST ',
                password: 'Password123',
                phone: ' 0712345678 '
            })

            expect(result._id).toBe(USER_ID)
            expect(bcrypt.hash).toHaveBeenCalledWith('Password123', 12)
            expect(User.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'Test Citizen',
                    email: 'citizen@example.test',
                    password: 'hashed-password',
                    phone: '0712345678',
                    role: 'citizen'
                })
            )
        })

        // POSITIVE: registration with GPS coordinates resolves target areas.
        it('registers a citizen with a location', async () => {
            User.findOne.mockResolvedValue(null)
            bcrypt.hash.mockResolvedValue('hashed-password')
            User.create.mockResolvedValue({ _id: USER_ID })
            getCitizenTargetAreaIds.mockResolvedValue([AREA_ID])

            await registerUser({
                name: 'Citizen',
                email: 'citizen@example.test',
                password: 'Password123',
                phone: '0712345678',
                location: {
                    latitude: 6.9,
                    longitude: 79.8
                }
            })

            expect(getCitizenTargetAreaIds).toHaveBeenCalledWith({
                type: 'Point',
                coordinates: [79.8, 6.9]
            })

            expect(addCitizenToTargetAreas).toHaveBeenCalledWith(
                USER_ID,
                [AREA_ID]
            )
        })

        // NEGATIVE: duplicate email addresses cannot register again.
        it('rejects a duplicate email', async () => {
            User.findOne.mockResolvedValue({ _id: 'existing-user' })

            await expect(registerUser({
                name: 'Citizen',
                email: 'citizen@example.test',
                password: 'Password123',
                phone: '0712345678'
            })).rejects.toMatchObject({ statusCode: 409 })

            expect(User.create).not.toHaveBeenCalled()
        })

        // ERROR: a MongoDB duplicate-key error becomes a conflict response.
        it('handles a duplicate-key database error', async () => {
            User.findOne.mockResolvedValue(null)
            bcrypt.hash.mockResolvedValue('hashed-password')

            const error = new Error('Duplicate key')
            error.code = 11000
            User.create.mockRejectedValue(error)

            await expect(registerUser({
                name: 'Citizen',
                email: 'citizen@example.test',
                password: 'Password123',
                phone: '0712345678'
            })).rejects.toMatchObject({ statusCode: 409 })
        })
    })

    // ========================================================
    // LOGIN
    // ========================================================

    describe('User Login', () => {

        // POSITIVE: correct credentials allow a citizen to sign in.
        it('authenticates a citizen on the mobile portal', async () => {
            const user = {
                _id: USER_ID,
                email: 'citizen@example.test',
                password: 'hashed-password',
                role: 'citizen'
            }

            User.findOne.mockResolvedValue(user)
            bcrypt.compare.mockResolvedValue(true)

            const result = await authenticateUser(validLogin())

            expect(result).toBe(user)
            expect(bcrypt.compare).toHaveBeenCalledWith(
                'Password123',
                'hashed-password'
            )
        })

        // NEGATIVE: unknown accounts receive an authentication error.
        it('rejects an unknown user', async () => {
            User.findOne.mockResolvedValue(null)

            await expect(authenticateUser(validLogin()))
                .rejects.toMatchObject({ statusCode: 401 })

            expect(bcrypt.compare).not.toHaveBeenCalled()
        })

        // NEGATIVE: a wrong password prevents login.
        it('rejects an incorrect password', async () => {
            User.findOne.mockResolvedValue({
                password: 'hashed-password',
                role: 'citizen'
            })
            bcrypt.compare.mockResolvedValue(false)

            await expect(authenticateUser(validLogin({
                password: 'WrongPassword'
            }))).rejects.toMatchObject({ statusCode: 401 })
        })

        // NEGATIVE: citizens cannot sign in to the staff web portal.
        it('rejects citizens using the web portal', async () => {
            User.findOne.mockResolvedValue({
                password: 'hashed-password',
                role: 'citizen'
            })
            bcrypt.compare.mockResolvedValue(true)

            await expect(authenticateUser(validLogin({
                client: 'web'
            }))).rejects.toMatchObject({ statusCode: 403 })
        })

        // NEGATIVE: staff accounts cannot use the citizen mobile portal.
        it('rejects staff using the mobile portal', async () => {
            User.findOne.mockResolvedValue({
                password: 'hashed-password',
                role: 'dmcofficer'
            })
            bcrypt.compare.mockResolvedValue(true)

            await expect(authenticateUser(validLogin({
                client: 'mobile'
            }))).rejects.toMatchObject({ statusCode: 403 })
        })

        // EDGE: an unknown role cannot authenticate to the application.
        it('rejects a user with an unsupported role', async () => {
            User.findOne.mockResolvedValue({
                password: 'hashed-password',
                role: null
            })
            bcrypt.compare.mockResolvedValue(true)

            await expect(authenticateUser(validLogin({
                client: 'web'
            }))).rejects.toMatchObject({ statusCode: 403 })
        })
    })

    // ========================================================
    // INPUT VALIDATION
    // ========================================================

    describe('Authentication input validation', () => {

        // POSITIVE: valid login input reaches the next middleware.
        it('accepts valid login input', () => {
            const res = makeResponse()
            const next = vi.fn()

            validateAuthInput({
                path: '/login',
                body: validLogin()
            }, res, next)

            expect(next).toHaveBeenCalledOnce()
        })

        // POSITIVE: valid registration details are accepted.
        it('accepts valid registration input', () => {
            const res = makeResponse()
            const next = vi.fn()

            validateAuthInput(validRegistration(), res, next)

            expect(next).toHaveBeenCalledOnce()
        })

        // NEGATIVE: invalid email and missing credentials are rejected.
        it('rejects malformed login credentials', () => {
            const invalidBodies = [
                { email: 'not-an-email', password: 'Password123', client: 'mobile' },
                { email: 'citizen@example.test', password: '', client: 'mobile' },
                { password: 'Password123', client: 'mobile' }
            ]

            for (const body of invalidBodies) {
                const res = makeResponse()
                const next = vi.fn()

                validateAuthInput({ path: '/login', body }, res, next)

                expect(res.status).toHaveBeenCalledWith(400)
                expect(next).not.toHaveBeenCalled()
            }
        })

        // EDGE/NEGATIVE: registration passwords must have at least 8 characters
        // and all passwords must not exceed 72 UTF-8 bytes.
        it('enforces password length boundaries', () => {
            const requests = [
                validRegistration({ password: '1234567' }),
                {
                    path: '/login',
                    body: {
                        email: 'citizen@example.test',
                        password: 'a'.repeat(73),
                        client: 'mobile'
                    }
                }
            ]

            for (const req of requests) {
                const res = makeResponse()
                const next = vi.fn()

                validateAuthInput(req, res, next)

                expect(res.status).toHaveBeenCalledWith(400)
                expect(next).not.toHaveBeenCalled()
            }
        })

        // NEGATIVE: registration requires a name.
        it('rejects registration without a valid name', () => {
            const res = makeResponse()
            const next = vi.fn()

            validateAuthInput(
                validRegistration({ name: '   ' }),
                res,
                next
            )

            expect(res.status).toHaveBeenCalledWith(400)
            expect(next).not.toHaveBeenCalled()
        })

        // NEGATIVE: invalid phone details are rejected.
        it('rejects an invalid phone number', () => {
            const res = makeResponse()
            const next = vi.fn()

            validateAuthInput(
                validRegistration({ phone: 'not-a-phone' }),
                res,
                next
            )

            expect(res.status).toHaveBeenCalledWith(400)
            expect(next).not.toHaveBeenCalled()
        })

        // EDGE/NEGATIVE: supplied GPS coordinates must be within geographic limits.
        it('rejects invalid optional location coordinates', () => {
            const locations = [
                null,
                { latitude: 91, longitude: 79.8 },
                { latitude: 6.9, longitude: 181 }
            ]

            for (const location of locations) {
                const res = makeResponse()
                const next = vi.fn()

                validateAuthInput(
                    validRegistration({ location }),
                    res,
                    next
                )

                expect(res.status).toHaveBeenCalledWith(400)
                expect(next).not.toHaveBeenCalled()
            }
        })

        // NEGATIVE: login portal must be mobile or web.
        it('rejects an unsupported portal', () => {
            const res = makeResponse()
            const next = vi.fn()

            validateAuthInput({
                path: '/login',
                body: validLogin({ client: 'tablet' })
            }, res, next)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(next).not.toHaveBeenCalled()
        })
    })

    // ========================================================
    // JWT AUTHENTICATION
    // ========================================================

    describe('JWT authentication middleware', () => {

        // NEGATIVE: requests without a token are unauthenticated.
        it('rejects a request without a token', async () => {
            const res = makeResponse()
            const next = vi.fn()

            await authenticate({ cookies: {} }, res, next)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(next).not.toHaveBeenCalled()
        })

        // POSITIVE: a valid token resolves the user and continues.
        it('authenticates a valid token', async () => {
            const user = { _id: USER_ID, role: 'citizen' }

            jwt.verify.mockReturnValue({ userId: USER_ID })
            User.findById.mockReturnValue({
                select: vi.fn().mockResolvedValue(user)
            })

            const req = { cookies: { token: 'valid-token' } }
            const res = makeResponse()
            const next = vi.fn()

            await authenticate(req, res, next)

            expect(req.user).toBe(user)
            expect(next).toHaveBeenCalledOnce()
        })

        // NEGATIVE: invalid or expired JWTs receive an unauthorized response.
        it('rejects an invalid JWT', async () => {
            const error = new Error('Invalid token')
            error.name = 'JsonWebTokenError'

            jwt.verify.mockImplementation(() => {
                throw error
            })

            const res = makeResponse()
            const next = vi.fn()

            await authenticate(
                { cookies: { token: 'invalid-token' } },
                res,
                next
            )

            expect(res.status).toHaveBeenCalledWith(401)
            expect(next).not.toHaveBeenCalled()
        })

        // NEGATIVE: deleted users can no longer authenticate with old tokens.
        it('rejects a token whose user no longer exists', async () => {
            jwt.verify.mockReturnValue({ userId: USER_ID })
            User.findById.mockReturnValue({
                select: vi.fn().mockResolvedValue(null)
            })

            const res = makeResponse()
            const next = vi.fn()

            await authenticate(
                { cookies: { token: 'valid-token' } },
                res,
                next
            )

            expect(res.status).toHaveBeenCalledWith(401)
            expect(next).not.toHaveBeenCalled()
        })

        // ERROR: authentication refuses to proceed if JWT configuration is absent.
        it('rejects authentication when the JWT secret is missing', async () => {
            vi.stubEnv('JWT_SECRET', '')

            const res = makeResponse()
            const next = vi.fn()

            await authenticate(
                { cookies: { token: 'token' } },
                res,
                next
            )

            expect(res.status).toHaveBeenCalledWith(500)
            expect(next).not.toHaveBeenCalled()
        })
    })

    // ========================================================
    // ROLE AUTHORIZATION
    // ========================================================

    describe('Role authorization middleware', () => {

        // POSITIVE: role normalization allows equivalent role formatting.
        it('allows an authorized normalized role', () => {
            const next = vi.fn()

            authorize('dmcofficer')(
                { user: { role: 'DMC_Officer' } },
                makeResponse(),
                next
            )

            expect(next).toHaveBeenCalledOnce()
        })

        // NEGATIVE: an authenticated user with the wrong role gets 403.
        it('denies a user with an unauthorized role', () => {
            const res = makeResponse()
            const next = vi.fn()

            authorize('dutyofficer')(
                { user: { role: 'citizen' } },
                res,
                next
            )

            expect(res.status).toHaveBeenCalledWith(403)
            expect(next).not.toHaveBeenCalled()
        })

        // NEGATIVE: authorization cannot proceed before authentication.
        it('returns 401 when no user is attached to the request', () => {
            const res = makeResponse()
            const next = vi.fn()

            authorize('dutyofficer')({}, res, next)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(next).not.toHaveBeenCalled()
        })
    })
})