import { describe, it, expect, vi, beforeEach } from 'vitest'

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

    // =========================
    // REGISTRATION
    // =========================

    describe('User Registration', () => {

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

    })

    // =========================
    // LOGIN
    // =========================

    describe('User Login', () => {

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

    })

    // =========================
    // VALIDATION
    // =========================

    describe('Authentication Validation', () => {

        const createResponse = () => ({
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        })

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

        it('should reject a registration password shorter than 8 characters', () => {
            const req = {
                path: '/register',
                body: {
                    email: 'john@test.com',
                    password: '1234567'
                }
            }

            const res = createResponse()
            const next = vi.fn()

            validateAuthInput(req, res, next)

            expect(res.status).toHaveBeenCalledWith(400)
            expect(next).not.toHaveBeenCalled()
        })

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

    // =========================
    // JWT AUTHENTICATION
    // =========================

    describe('JWT Authentication', () => {

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

    })

    // =========================
    // AUTHORIZATION
    // =========================

    describe('Role Authorization', () => {

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