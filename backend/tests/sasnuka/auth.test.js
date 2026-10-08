import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database and external dependencies so these remain UNIT tests
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
    registerUser,
    authenticateUser
} from '../../roles/auth/services/authService.js'

import validateAuthInput from '../../roles/auth/validators/authValidator.js'
import authorize from '../../middleware/authorization/roleMiddleware.js'
import authenticate from '../../middleware/authentication/authMiddleware.js'

describe('User Authentication and Authorization', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        process.env.JWT_SECRET = 'test-secret'
    })

    // =========================================================
    // USER REGISTRATION
    // =========================================================

    describe('User Registration', () => {

        // POSITIVE: valid registration should create a user
        it('should register a new user with a hashed password', async () => {
            User.findOne.mockResolvedValue(null)
            bcrypt.hash.mockResolvedValue('hashed-password')
            User.create.mockResolvedValue({
                _id: 'user1',
                name: 'John',
                email: 'john@test.com'
            })

            const result = await registerUser({
                name: ' John ',
                email: ' JOHN@TEST.COM ',
                password: 'Password123',
                phone: '0712345678'
            })

            expect(result._id).toBe('user1')
            expect(bcrypt.hash).toHaveBeenCalled()
            expect(User.create).toHaveBeenCalled()
        })

        // POSITIVE: valid location should be converted to GeoJSON
        it('should register a user with a valid location', async () => {
            User.findOne.mockResolvedValue(null)
            bcrypt.hash.mockResolvedValue('hashed-password')
            User.create.mockResolvedValue({
                _id: 'user2',
                name: 'Jane',
                email: 'jane@test.com'
            })

            const result = await registerUser({
                name: 'Jane',
                email: 'jane@test.com',
                password: 'Password123',
                phone: '0712345678',
                location: {
                    latitude: 6.9271,
                    longitude: 79.8612
                }
            })

            expect(result._id).toBe('user2')
            expect(User.create).toHaveBeenCalled()
        })

        // NEGATIVE: duplicate email should be rejected
        it('should reject registration when email already exists', async () => {
            User.findOne.mockResolvedValue({
                _id: 'existing-user'
            })

            await expect(
                registerUser({
                    name: 'John',
                    email: 'john@test.com',
                    password: 'Password123',
                    phone: '0712345678'
                })
            ).rejects.toMatchObject({
                statusCode: 409
            })
        })

        // ERROR: database duplicate-key error should be handled
        it('should handle a duplicate key database error', async () => {
            User.findOne.mockResolvedValue(null)
            bcrypt.hash.mockResolvedValue('hashed-password')

            const error = new Error('Duplicate key')
            error.code = 11000

            User.create.mockRejectedValue(error)

            await expect(
                registerUser({
                    name: 'John',
                    email: 'john@test.com',
                    password: 'Password123',
                    phone: '0712345678'
                })
            ).rejects.toMatchObject({
                statusCode: 409
            })
        })

        // ERROR: unexpected database error should be passed through
        it('should rethrow an unexpected database error', async () => {
            User.findOne.mockResolvedValue(null)
            bcrypt.hash.mockResolvedValue('hashed-password')

            const error = new Error('Database unavailable')
            User.create.mockRejectedValue(error)

            await expect(
                registerUser({
                    name: 'John',
                    email: 'john@test.com',
                    password: 'Password123',
                    phone: '0712345678'
                })
            ).rejects.toThrow('Database unavailable')
        })

    })

    // =========================================================
    // USER LOGIN
    // =========================================================

    describe('User Login', () => {

        // POSITIVE: correct citizen credentials should succeed
        it('should authenticate a citizen with correct credentials', async () => {
            User.findOne.mockResolvedValue({
                _id: 'user1',
                email: 'john@test.com',
                password: 'hashed-password',
                role: 'citizen'
            })

            bcrypt.compare.mockResolvedValue(true)

            const user = await authenticateUser({
                email: 'john@test.com',
                password: 'Password123',
                client: 'mobile'
            })

            expect(user._id).toBe('user1')
            expect(bcrypt.compare).toHaveBeenCalled()
        })

        // NEGATIVE: incorrect password should be rejected
        it('should reject login with incorrect credentials', async () => {
            User.findOne.mockResolvedValue({
                password: 'hashed-password',
                role: 'citizen'
            })

            bcrypt.compare.mockResolvedValue(false)

            await expect(
                authenticateUser({
                    email: 'john@test.com',
                    password: 'WrongPassword',
                    client: 'mobile'
                })
            ).rejects.toMatchObject({
                statusCode: 401
            })
        })

        // NEGATIVE: non-existent user should be rejected
        it('should reject login when the user does not exist', async () => {
            User.findOne.mockResolvedValue(null)

            await expect(
                authenticateUser({
                    email: 'unknown@test.com',
                    password: 'Password123',
                    client: 'mobile'
                })
            ).rejects.toMatchObject({
                statusCode: 401
            })
        })

        // NEGATIVE: citizen should not access staff portal
        it('should reject citizen access to the web portal', async () => {
            User.findOne.mockResolvedValue({
                password: 'hashed-password',
                role: 'citizen'
            })

            bcrypt.compare.mockResolvedValue(true)

            await expect(
                authenticateUser({
                    email: 'john@test.com',
                    password: 'Password123',
                    client: 'web'
                })
            ).rejects.toMatchObject({
                statusCode: 403
            })
        })

        // NEGATIVE: staff should not access citizen portal
        it('should reject staff access to the mobile portal', async () => {
            User.findOne.mockResolvedValue({
                password: 'hashed-password',
                role: 'dmcofficer'
            })

            bcrypt.compare.mockResolvedValue(true)

            await expect(
                authenticateUser({
                    email: 'officer@test.com',
                    password: 'Password123',
                    client: 'mobile'
                })
            ).rejects.toMatchObject({
                statusCode: 403
            })
        })

        // EDGE: unknown role should not be accepted
        it('should reject a user with an invalid role', async () => {
            User.findOne.mockResolvedValue({
                password: 'hashed-password',
                role: 'unknownrole'
            })

            bcrypt.compare.mockResolvedValue(true)

            await expect(
                authenticateUser({
                    email: 'user@test.com',
                    password: 'Password123',
                    client: 'web'
                })
            ).rejects.toMatchObject({
                statusCode: 403
            })
        })

    })

    // =========================================================
    // AUTHENTICATION VALIDATION
    // =========================================================

    describe('Authentication Validation', () => {

        const createResponse = () => ({
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        })

        // POSITIVE: valid login input should continue
        it('should accept valid login details', () => {
            const req = {
                path: '/login',
                body: {
                    email: 'john@test.com',
                    password: 'Password123',
                    client: 'mobile'
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(next).toHaveBeenCalled()
        })

        // POSITIVE: valid registration input should continue
        it('should accept valid registration details', () => {
            const req = {
                path: '/register',
                body: {
                    email: 'john@test.com',
                    password: 'Password123',
                    name: 'John',
                    phone: '0712345678'
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(next).toHaveBeenCalled()
        })

        // NEGATIVE: invalid email should be rejected
        it('should reject an invalid email', () => {
            const req = {
                path: '/login',
                body: {
                    email: 'invalid-email',
                    password: 'Password123',
                    client: 'mobile'
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(next).not.toHaveBeenCalled()
        })

        // NEGATIVE: short registration password should be rejected
        it('should reject a registration password shorter than 8 characters', () => {
            const req = {
                path: '/register',
                body: {
                    email: 'john@test.com',
                    password: '1234567',
                    name: 'John',
                    phone: '0712345678'
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(next).not.toHaveBeenCalled()
        })

        // EDGE: exactly 8 characters should be accepted
        it('should accept the minimum registration password length', () => {
            const req = {
                path: '/register',
                body: {
                    email: 'john@test.com',
                    password: '12345678',
                    name: 'John',
                    phone: '0712345678'
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(next).toHaveBeenCalled()
        })

        // EDGE: exactly 72 bytes should be accepted
        it('should accept a password of exactly 72 bytes', () => {
            const req = {
                path: '/login',
                body: {
                    email: 'john@test.com',
                    password: 'a'.repeat(72),
                    client: 'mobile'
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(next).toHaveBeenCalled()
        })

        // NEGATIVE: password above bcrypt's 72-byte limit should be rejected
        it('should reject a password longer than 72 bytes', () => {
            const req = {
                path: '/login',
                body: {
                    email: 'john@test.com',
                    password: 'a'.repeat(73),
                    client: 'mobile'
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(next).not.toHaveBeenCalled()
        })

        // NEGATIVE: missing name should be rejected
        it('should reject registration without a name', () => {
            const req = {
                path: '/register',
                body: {
                    email: 'john@test.com',
                    password: 'Password123',
                    phone: '0712345678'
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(next).not.toHaveBeenCalled()
        })

        // NEGATIVE: invalid phone number should be rejected
        it('should reject an invalid phone number', () => {
            const req = {
                path: '/register',
                body: {
                    email: 'john@test.com',
                    password: 'Password123',
                    name: 'John',
                    phone: 'abc'
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(next).not.toHaveBeenCalled()
        })

        // EDGE: phone number with minimum 7 digits should be accepted
        it('should accept a phone number with 7 digits', () => {
            const req = {
                path: '/register',
                body: {
                    email: 'john@test.com',
                    password: 'Password123',
                    name: 'John',
                    phone: '1234567'
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(next).toHaveBeenCalled()
        })

        // EDGE: valid location should be accepted
        it('should accept a valid registration location', () => {
            const req = {
                path: '/register',
                body: {
                    email: 'john@test.com',
                    password: 'Password123',
                    name: 'John',
                    phone: '0712345678',
                    location: {
                        latitude: 6.9271,
                        longitude: 79.8612
                    }
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(next).toHaveBeenCalled()
        })

        // NEGATIVE: latitude outside valid range should be rejected
        it('should reject an invalid latitude', () => {
            const req = {
                path: '/register',
                body: {
                    email: 'john@test.com',
                    password: 'Password123',
                    name: 'John',
                    phone: '0712345678',
                    location: {
                        latitude: 100,
                        longitude: 79.8612
                    }
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(next).not.toHaveBeenCalled()
        })

        // NEGATIVE: longitude outside valid range should be rejected
        it('should reject an invalid longitude', () => {
            const req = {
                path: '/register',
                body: {
                    email: 'john@test.com',
                    password: 'Password123',
                    name: 'John',
                    phone: '0712345678',
                    location: {
                        latitude: 6.9271,
                        longitude: 200
                    }
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(next).not.toHaveBeenCalled()
        })

        // NEGATIVE: unsupported login portal should be rejected
        it('should reject an invalid login portal', () => {
            const req = {
                path: '/login',
                body: {
                    email: 'john@test.com',
                    password: 'Password123',
                    client: 'tablet'
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(next).not.toHaveBeenCalled()
        })

    })

    // =========================================================
    // JWT AUTHENTICATION
    // =========================================================

    describe('JWT Authentication', () => {

        // NEGATIVE: request without token should be rejected
        it('should reject a request without a token', async () => {
            const req = {
                cookies: {}
            }

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            await authenticate(req, res, next)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(next).not.toHaveBeenCalled()
        })

        // ERROR: missing JWT configuration should return server error
        it('should reject authentication when JWT secret is missing', async () => {
            delete process.env.JWT_SECRET

            const req = {
                cookies: {
                    token: 'valid-token'
                }
            }

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            await authenticate(req, res, next)

            expect(res.status).toHaveBeenCalledWith(500)
            expect(next).not.toHaveBeenCalled()
        })

        // POSITIVE: valid token and existing user should authenticate
        it('should authenticate a valid token', async () => {
            jwt.verify.mockReturnValue({
                userId: 'user1'
            })

            const user = {
                _id: 'user1',
                role: 'citizen'
            }

            const select = vi.fn().mockResolvedValue(user)

            User.findById.mockReturnValue({
                select
            })

            const req = {
                cookies: {
                    token: 'valid-token'
                }
            }

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            await authenticate(req, res, next)

            expect(req.user).toEqual(user)
            expect(next).toHaveBeenCalled()
        })

        // NEGATIVE: invalid JWT should return 401
        it('should reject an invalid token', async () => {
            jwt.verify.mockImplementation(() => {
                const error = new Error('Invalid token')
                error.name = 'JsonWebTokenError'
                throw error
            })

            const req = {
                cookies: {
                    token: 'invalid-token'
                }
            }

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            await authenticate(req, res, next)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(next).not.toHaveBeenCalled()
        })

        // ERROR: unexpected JWT error should be passed to error middleware
        it('should pass unexpected JWT errors to next', async () => {
            const error = new Error('Unexpected JWT failure')
            error.name = 'UnexpectedError'

            jwt.verify.mockImplementation(() => {
                throw error
            })

            const req = {
                cookies: {
                    token: 'token'
                }
            }

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            await authenticate(req, res, next)

            expect(next).toHaveBeenCalledWith(error)
        })

        // EDGE: decoded token without userId should be rejected
        it('should reject a token without a userId', async () => {
            jwt.verify.mockReturnValue({
                role: 'citizen'
            })

            const req = {
                cookies: {
                    token: 'token'
                }
            }

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            await authenticate(req, res, next)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(next).not.toHaveBeenCalled()
        })

        // EDGE: decoded JWT that is not an object should be rejected
        it('should reject a non-object decoded token', async () => {
            jwt.verify.mockReturnValue('invalid')

            const req = {
                cookies: {
                    token: 'token'
                }
            }

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            await authenticate(req, res, next)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(next).not.toHaveBeenCalled()
        })

        // NEGATIVE: valid token for deleted user should be rejected
        it('should reject authentication when the user is not found', async () => {
            jwt.verify.mockReturnValue({
                userId: 'missing-user'
            })

            const select = vi.fn().mockResolvedValue(null)

            User.findById.mockReturnValue({
                select
            })

            const req = {
                cookies: {
                    token: 'valid-token'
                }
            }

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            await authenticate(req, res, next)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(next).not.toHaveBeenCalled()
        })

    })

    // =========================================================
    // ROLE AUTHORIZATION
    // =========================================================

    describe('Role Authorization', () => {

        // POSITIVE: authorized role should be allowed
        it('should allow an authorized role', () => {
            const middleware = authorize('dutyofficer')

            const req = {
                user: {
                    role: 'dutyofficer'
                }
            }

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            middleware(req, res, next)

            expect(next).toHaveBeenCalled()
        })

        // POSITIVE: normalized role should also be accepted
        it('should allow a role with different capitalization', () => {
            const middleware = authorize('dutyofficer')

            const req = {
                user: {
                    role: 'Duty-Officer'
                }
            }

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            middleware(req, res, next)

            expect(next).toHaveBeenCalled()
        })

        // NEGATIVE: unauthorized role should be denied
        it('should deny an unauthorized role', () => {
            const middleware = authorize('dutyofficer')

            const req = {
                user: {
                    role: 'citizen'
                }
            }

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            middleware(req, res, next)

            expect(res.status).toHaveBeenCalledWith(403)
            expect(next).not.toHaveBeenCalled()
        })

        // EDGE: missing/invalid role should be denied
        it('should reject authorization when the role is missing', () => {
            const middleware = authorize('dutyofficer')

            const req = {
                user: {}
            }

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            middleware(req, res, next)

            expect(res.status).toHaveBeenCalledWith(403)
            expect(next).not.toHaveBeenCalled()
        })

        // NEGATIVE: missing authenticated user should return 401
        it('should reject authorization when the user is missing', () => {
            const middleware = authorize('dutyofficer')

            const req = {}

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn()
            }

            const next = vi.fn()

            middleware(req, res, next)

            expect(res.status).toHaveBeenCalledWith(401)
            expect(next).not.toHaveBeenCalled()
        })

    })

})