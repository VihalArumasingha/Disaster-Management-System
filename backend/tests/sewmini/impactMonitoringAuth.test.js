import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../models/ImpactRecord.js', () => ({
    default: { find: vi.fn(), create: vi.fn(), findOneAndUpdate: vi.fn() }
}))
vi.mock('../../utils/operationalAudit.js', () => ({ default: vi.fn() }))
vi.mock('../../models/User.js', () => ({ default: { findById: vi.fn() } }))
vi.mock('jsonwebtoken', () => ({ default: { verify: vi.fn() } }))

import ImpactRecord from '../../models/ImpactRecord.js'
import User from '../../models/User.js'
import jwt from 'jsonwebtoken'
import writeOperationalAudit from '../../utils/operationalAudit.js'
import {
    createImpactRecord,
    listImpactRecords,
    updateImpactRecord
} from '../../roles/dmcOfficer/controllers/impactMonitoringController.js'
import authenticate from '../../middleware/authentication/authMiddleware.js'
import authorize from '../../middleware/authorization/roleMiddleware.js'

const recordId = '507f1f77bcf86cd799439011'
const user = { _id: '507f191e810c19729de860ea', role: 'ngomanager', name: 'Relief Manager' }

// Fake Express response 
const makeResponse = () => ({
    status: vi.fn(function () { return this }),
    json: vi.fn(function (body) { this.body = body; return this })
})

// Valid impact record — pass overrides to test specific fields
const impactInput = (overrides = {}) => ({
    disasterEvent: 'Flood 2026',
    district: 'Colombo',
    recordedDate: '2026-10-08',
    affectedPopulation: 120,
    evacuatedPopulation: 30,
    peopleInShelters: 25,
    injured: 2,
    deaths: 0,
    housesDamaged: 8,
    schoolsAffected: 1,
    roadsBlocked: 3,
    hospitalsAffected: 0,
    otherImpact: 'Road access disrupted',
    ...overrides
})

describe('Impact records and access control', () => {
    // Reset mocks before every test → clean state
    beforeEach(() => {
        vi.clearAllMocks()
        writeOperationalAudit.mockResolvedValue(undefined)
    })

    it('creates a valid impact record and records the authenticated actor', async () => {
        const created = {
            _id: recordId,
            disasterEvent: 'Flood 2026',
            district: 'Colombo',
            populate: vi.fn().mockResolvedValue(undefined)
        }
        ImpactRecord.create.mockResolvedValue(created)
        const res = makeResponse()

        await createImpactRecord({ body: impactInput(), user }, res, vi.fn())

        expect(res.status).toHaveBeenCalledWith(201)
        // recordedBy must be the authenticated user's ID
        expect(ImpactRecord.create).toHaveBeenCalledWith(expect.objectContaining({
            disasterEvent: 'Flood 2026',
            affectedPopulation: 120,
            recordedBy: user._id,
            recordedDate: new Date('2026-10-08')
        }))
        expect(writeOperationalAudit).toHaveBeenCalledWith(expect.objectContaining({
            action: 'impact.recorded',
            entityId: recordId
        }))
    })

    // Parameterized tests — one test, many invalid inputs
    it.each([
        [{ affectedPopulation: -1 }, /affectedPopulation must be a non-negative whole number/],
        [{ injured: 1.5 }, /injured must be a non-negative whole number/],       // decimal not allowed
        [{ disasterEvent: '  ' }, /Disaster event is required/],                 // whitespace only
        [{ district: 'Atlantis' }, /valid district/],                            // unknown district
        [{ recordedDate: 'yesterday-ish' }, /Recorded date is invalid/]          // bad date format
    ])('rejects invalid impact input %#', async (overrides, message) => {
        const res = makeResponse()
        await createImpactRecord({ body: impactInput(overrides), user }, res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.body.message).toMatch(message)
        // Validation fails → nothing saved to DB
        expect(ImpactRecord.create).not.toHaveBeenCalled()
    })

    it('lists records using valid district and escaped event/search filters', async () => {
        // Fake Mongoose chain
        ImpactRecord.find.mockReturnValue({
            populate: vi.fn().mockReturnValue({
                sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: recordId }]) })
            })
        })
        const res = makeResponse()

        await listImpactRecords(
            { query: { district: 'Colombo', event: '.*', q: 'A+B' } },
            res,
            vi.fn()
        )

        const query = ImpactRecord.find.mock.calls[0][0]
        expect(query.district).toBe('Colombo')
        // Special regex chars must be escaped 
        expect(query.disasterEvent.source).toBe('\\.\\*')
        expect(query.$or[0].disasterEvent.source).toBe('A\\+B')
        expect(res.body.records).toHaveLength(1)
        expect(res.body.districts).toContain('Colombo')
    })

    it('prevents malformed IDs and limits NGO managers to their own records', async () => {
        // Malformed ObjectId → 400, no DB call
        const invalidIdResponse = makeResponse()
        await updateImpactRecord(
            { params: { recordId: 'bad-id' }, body: impactInput(), user },
            invalidIdResponse,
            vi.fn()
        )
        expect(invalidIdResponse.status).toHaveBeenCalledWith(400)
        expect(ImpactRecord.findOneAndUpdate).not.toHaveBeenCalled()

        ImpactRecord.findOneAndUpdate.mockReturnValue({
            populate: vi.fn().mockResolvedValue(null)
        })
        const forbidden = makeResponse()
        await updateImpactRecord(
            { params: { recordId }, body: impactInput(), user },
            forbidden,
            vi.fn()
        )
       
        expect(ImpactRecord.findOneAndUpdate.mock.calls[0][0]).toEqual({
            _id: recordId,
            recordedBy: user._id
        })
        expect(forbidden.status).toHaveBeenCalledWith(404)
    })

    it('allows DMC updates by ID and forwards persistence errors', async () => {
        const updated = {
            _id: recordId,
            disasterEvent: 'Flood 2026',
            district: 'Colombo'
        }
        ImpactRecord.findOneAndUpdate.mockReturnValue({
            populate: vi.fn().mockResolvedValue(updated)
        })
        const res = makeResponse()
        await updateImpactRecord({
            params: { recordId },
            body: impactInput(),
            user: { ...user, role: 'dmcofficer' }
        }, res, vi.fn())
        // DMC officer can update ANY record by ID (no recordedBy filter)
        expect(ImpactRecord.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: recordId })
        expect(res.body.record).toBe(updated)
        expect(writeOperationalAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'impact.updated' }))

        // DB error → forwarded to Express error handler via next()
        const error = new Error('database unavailable')
        ImpactRecord.find.mockImplementation(() => { throw error })
        const next = vi.fn()
        await listImpactRecords({ query: {} }, makeResponse(), next)
        expect(next).toHaveBeenCalledWith(error)
    })

    it('requires a token, rejects invalid tokens, and attaches an authenticated user', async () => {
        // No token → 401
        const missing = makeResponse()
        await authenticate({ cookies: {} }, missing, vi.fn())
        expect(missing.status).toHaveBeenCalledWith(401)

        // Expired token → 401
        process.env.JWT_SECRET = 'test-secret'
        jwt.verify.mockImplementation(() => {
            const error = new Error('expired')
            error.name = 'TokenExpiredError'
            throw error
        })
        const invalid = makeResponse()
        await authenticate({ cookies: { token: 'expired' } }, invalid, vi.fn())
        expect(invalid.status).toHaveBeenCalledWith(401)

        // Valid token → user attached to req, next() called once
        jwt.verify.mockReturnValue({ userId: user._id })
        User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(user) })
        const req = { cookies: { token: 'valid-token' } }
        const next = vi.fn()
        await authenticate(req, makeResponse(), next)
        expect(req.user).toBe(user)
        expect(next).toHaveBeenCalledOnce()
    })

    it('rejects missing roles and allows authorized disaster-response roles', () => {
        // No user on request → 401
        const res = makeResponse()
        const next = vi.fn()
        authorize('dmcofficer', 'ngomanager')({}, res, next)
        expect(res.status).toHaveBeenCalledWith(401)

        // Authorized role → passes through, no error status
        const allowedResponse = makeResponse()
        authorize('dmcofficer', 'ngomanager')({ user: { role: 'ngo-manager' } }, allowedResponse, next)
        expect(next).toHaveBeenCalledOnce()
        expect(allowedResponse.status).not.toHaveBeenCalled()
    })

    it('rejects unconfigured auth, malformed claims, and deleted users while forwarding unexpected JWT errors', async () => {
        // JWT_SECRET missing → 500 (server config error)
        delete process.env.JWT_SECRET
        const unconfigured = makeResponse()
        await authenticate({ cookies: { token: 'token' } }, unconfigured, vi.fn())
        expect(unconfigured.status).toHaveBeenCalledWith(500)

        // Token decodes to non-object → 401
        process.env.JWT_SECRET = 'test-secret'
        jwt.verify.mockReturnValue('not-a-claims-object')
        const malformed = makeResponse()
        await authenticate({ cookies: { token: 'token' } }, malformed, vi.fn())
        expect(malformed.status).toHaveBeenCalledWith(401)

        // User no longer in DB → 401 "User not found"
        jwt.verify.mockReturnValue({ userId: user._id })
        User.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(null) })
        const deleted = makeResponse()
        await authenticate({ cookies: { token: 'token' } }, deleted, vi.fn())
        expect(deleted.status).toHaveBeenCalledWith(401)
        expect(deleted.body.message).toBe('User not found')

        // Unexpected JWT error → forwarded to Express error handler
        const unexpected = new Error('crypto provider failure')
        jwt.verify.mockImplementation(() => { throw unexpected })
        const next = vi.fn()
        await authenticate({ cookies: { token: 'token' } }, makeResponse(), next)
        expect(next).toHaveBeenCalledWith(unexpected)
    })
})