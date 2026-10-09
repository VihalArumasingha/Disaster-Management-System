import { beforeEach, describe, expect, it, vi } from 'vitest'
import mongoose from 'mongoose'

vi.mock('../../models/Organization.js', () => ({ default: { find: vi.fn(), findOne: vi.fn() } }))
vi.mock('../../models/ReliefSupply.js', () => ({
    default: { aggregate: vi.fn(), create: vi.fn(), updateOne: vi.fn() }
}))
vi.mock('../../models/ReliefDistribution.js', () => ({
    default: { find: vi.fn(), findById: vi.fn(), create: vi.fn() }
}))
vi.mock('../../models/Shelter.js', () => ({ default: { find: vi.fn(), findOne: vi.fn() } }))
vi.mock('../../models/TargetArea.js', () => ({ default: { find: vi.fn(), findById: vi.fn() } }))
vi.mock('../../utils/operationalAudit.js', () => ({ default: vi.fn() }))

import Organization from '../../models/Organization.js'
import ReliefDistribution from '../../models/ReliefDistribution.js'
import ReliefSupply from '../../models/ReliefSupply.js'
import Shelter from '../../models/Shelter.js'
import TargetArea from '../../models/TargetArea.js'
import writeOperationalAudit from '../../utils/operationalAudit.js'
import {
    createReliefDistribution,
    createReliefSupply,
    listReliefDistributions,
    listReliefSupplyOptions,
    listReliefSupplies,
    updateReliefDistributionAudit
} from '../../roles/dmcOfficer/controllers/reliefManagementController.js'
import authorize from '../../middleware/authorization/roleMiddleware.js'

const organizationId = '507f1f77bcf86cd799439011'
const supplyId = '507f191e810c19729de860ea'
const distributionId = '507f1f77bcf86cd799439012'
const officer = { _id: '507f191e810c19729de860eb', role: 'dmcofficer' }
const makeResponse = () => ({
    status: vi.fn(function () { return this }),
    json: vi.fn(function (body) { this.body = body; return this })
})
const session = {
    withTransaction: vi.fn(async (callback) => callback()),
    endSession: vi.fn()
}
const distributionInput = (overrides = {}) => ({
    supply: supplyId,
    destinationType: 'District',
    district: 'Colombo',
    quantity: 4,
    distributionDate: '2026-10-08',
    recipient: 'Community Center',
    purpose: 'Emergency food relief',
    ...overrides
})

describe('Relief inventory, distribution, and audit', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(mongoose, 'startSession').mockResolvedValue(session)
        session.withTransaction.mockImplementation(async (callback) => callback())
        writeOperationalAudit.mockResolvedValue(undefined)
        Organization.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: organizationId }) })
        ReliefSupply.updateOne.mockResolvedValue({ modifiedCount: 1 })
    })

    it('registers a supply for an active organization and normalizes its dates and status', async () => {
        const saved = { _id: supplyId, supplyId: 'SUP-1', supplyName: 'Rice', category: 'Food' }
        ReliefSupply.create.mockResolvedValue(saved)
        const res = makeResponse()

        await createReliefSupply({
            user: officer,
            body: {
                organization: organizationId,
                disasterEvent: 'Flood 2026',
                category: 'Food',
                supplyName: 'Rice',
                unit: 'bags',
                quantityReceived: '12.5',
                receivedDate: '2026-10-07',
                expiryDate: '2027-01-01',
                storageLocation: 'Warehouse A',
                status: 'unexpected'
            }
        }, res, vi.fn())

        expect(res.status).toHaveBeenCalledWith(201)
        expect(ReliefSupply.create).toHaveBeenCalledWith(expect.objectContaining({
            quantityReceived: 12.5,
            status: 'Available',
            recordedBy: officer._id,
            receivedDate: new Date('2026-10-07'),
            expiryDate: new Date('2027-01-01')
        }))
        expect(writeOperationalAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'relief_supply.registered' }))
    })

    it.each([
        [{ quantityReceived: '0' }, /positive number/],
        [{ category: 'Invalid' }, /Category must be one of/],
        [{ organization: 'invalid-id' }, /valid organization/],
        [{ disasterEvent: '  ' }, /Disaster event is required/],
        [{ receivedDate: 'no-date' }, /Received date is invalid/],
        [{ expiryDate: '2026-10-06' }, /cannot be before/
        ]
    ])('rejects invalid supply details %#', async (overrides, message) => {
        const body = {
            organization: organizationId,
            disasterEvent: 'Flood',
            category: 'Water',
            supplyName: 'Drinking water',
            unit: 'liters',
            quantityReceived: 10,
            receivedDate: '2026-10-07',
            expiryDate: '',
            storageLocation: 'Depot',
            ...overrides
        }
        const res = makeResponse()
        await createReliefSupply({ body, user: officer }, res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.body.message).toMatch(message)
        expect(ReliefSupply.create).not.toHaveBeenCalled()
    })

    it('scopes inventory lists to an organization and reflects effective inventory state', async () => {
        const rows = [{
            supplyId: 'SUP-1',
            effectiveStatus: 'Expired',
            remainingQuantity: 0,
            organization: { organizationName: 'Aid Group' }
        }]
        ReliefSupply.aggregate.mockResolvedValue(rows)
        const res = makeResponse()
        const ngoUser = { ...officer, role: 'organization', organizationId }

        await listReliefSupplies({ user: ngoUser, query: { category: 'Food', organization: '507f1f77bcf86cd799439099' } }, res, vi.fn())

        expect(ReliefSupply.aggregate.mock.calls[0][0][0].$match).toMatchObject({
            organization: organizationId,
            category: 'Food'
        })
        expect(res.body.supplies[0]).toMatchObject({ status: 'Expired', organizationName: 'Aid Group' })
    })

    it('provides organization-scoped options and active relief destinations', async () => {
        const ngoUser = { ...officer, role: 'organization', organizationId }
        const activeOrgQuery = {
            select: vi.fn().mockReturnThis(),
            lean: vi.fn().mockResolvedValue([{ organizationName: 'Aid Group' }])
        }
        Organization.find.mockReturnValue(activeOrgQuery)
        ReliefSupply.aggregate.mockResolvedValue([{
            supplyId: 'SUP-1',
            remainingQuantity: 4,
            effectiveStatus: 'Available'
        }])
        Shelter.find.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            sort: vi.fn().mockReturnThis(),
            lean: vi.fn().mockResolvedValue([{ shelterName: 'School' }])
        })
        TargetArea.find.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            sort: vi.fn().mockReturnThis(),
            lean: vi.fn().mockResolvedValue([{ name: 'Village Hall' }])
        })
        const res = makeResponse()

        await listReliefSupplyOptions({ user: ngoUser, organization: { district: 'Colombo' } }, res, vi.fn())

        expect(Organization.find).toHaveBeenCalledWith({
            _id: organizationId,
            userAccount: officer._id,
            status: 'Active'
        })
        expect(Shelter.find).toHaveBeenCalledWith({ status: 'Active', district: 'Colombo' })
        expect(res.body.supplies[0].status).toBe('Available')
        expect(res.body.shelters).toEqual([{ shelterName: 'School' }])
        expect(res.body.reliefLocations).toEqual([{ name: 'Village Hall' }])
    })

    it('creates a district distribution within available stock and rejects over-distribution', async () => {
        const supply = {
            _id: supplyId,
            organization: { _id: organizationId },
            disasterEvent: 'Flood 2026',
            remainingQuantity: 5,
            receivedDate: new Date('2026-10-07'),
            unit: 'bags'
        }
        ReliefSupply.aggregate.mockReturnValue({
            session: vi.fn().mockResolvedValue([supply])
        })
        const created = { _id: distributionId, distributionId: 'DST-1', auditStatus: 'Pending Verification' }
        ReliefDistribution.create.mockResolvedValue([created])
        const res = makeResponse()

        await createReliefDistribution({ body: distributionInput(), user: officer }, res, vi.fn())

        expect(res.status).toHaveBeenCalledWith(201)
        expect(ReliefSupply.updateOne).toHaveBeenCalledWith(
            { _id: supplyId },
            { $inc: { inventoryRevision: 1 } },
            { session }
        )
        expect(ReliefDistribution.create).toHaveBeenCalledWith(
            [expect.objectContaining({
                organization: organizationId,
                quantity: 4,
                district: 'Colombo',
                auditStatus: 'Pending Verification'
            })],
            { session }
        )
        expect(writeOperationalAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'distribution.created' }))

        ReliefSupply.aggregate.mockReturnValue({
            session: vi.fn().mockResolvedValue([{ ...supply, remainingQuantity: 3 }])
        })
        const next = vi.fn()
        await createReliefDistribution({ body: distributionInput(), user: officer }, makeResponse(), next)
        expect(next.mock.calls[0][0].message).toMatch(/exceeds available supply/)
    })

    it('validates destination, quantities, and inventory-lock conflicts', async () => {
        const badResponse = makeResponse()
        await createReliefDistribution(
            { body: distributionInput({ destinationType: 'Nowhere' }), user: officer },
            badResponse,
            vi.fn()
        )
        expect(badResponse.body.message).toMatch(/valid distribution destination/)

        ReliefSupply.aggregate.mockReturnValue({
            session: vi.fn().mockResolvedValue([{
                _id: supplyId,
                organization: { _id: organizationId },
                disasterEvent: 'Flood',
                remainingQuantity: 10,
                receivedDate: new Date('2026-10-07'),
                unit: 'bags'
            }])
        })
        ReliefSupply.updateOne.mockResolvedValue({ modifiedCount: 0 })
        const next = vi.fn()
        await createReliefDistribution({ body: distributionInput(), user: officer }, makeResponse(), next)
        expect(next.mock.calls[0][0].statusCode).toBe(409)
        expect(next.mock.calls[0][0].message).toMatch(/inventory changed/)
        expect(session.endSession).toHaveBeenCalled()
    })

    it('rejects unavailable stock and a distribution dated before supply receipt', async () => {
        ReliefSupply.aggregate.mockReturnValue({ session: vi.fn().mockResolvedValue([]) })
        const unavailableNext = vi.fn()
        await createReliefDistribution(
            { body: distributionInput(), user: officer },
            makeResponse(),
            unavailableNext
        )
        expect(unavailableNext.mock.calls[0][0].message).toMatch(/Supply is unavailable/)

        ReliefSupply.aggregate.mockReturnValue({
            session: vi.fn().mockResolvedValue([{
                _id: supplyId,
                organization: { _id: organizationId },
                disasterEvent: 'Flood',
                remainingQuantity: 10,
                receivedDate: new Date('2026-10-10'),
                unit: 'bags'
            }])
        })
        const earlierNext = vi.fn()
        await createReliefDistribution(
            { body: distributionInput(), user: officer },
            makeResponse(),
            earlierNext
        )
        expect(earlierNext.mock.calls[0][0].message).toMatch(/cannot be before the supply received date/)
        expect(ReliefDistribution.create).not.toHaveBeenCalled()
    })

    it('requires active shelters for shelter deliveries and rejects invalid destination districts', async () => {
        const districtResponse = makeResponse()
        await createReliefDistribution(
            { body: distributionInput({ district: 'Atlantis' }), user: officer },
            districtResponse,
            vi.fn()
        )
        expect(districtResponse.body.message).toMatch(/valid district/)

        Shelter.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) })
        const shelterResponse = makeResponse()
        await createReliefDistribution(
            { body: distributionInput({ destinationType: 'Shelter', shelter: supplyId }), user: officer },
            shelterResponse,
            vi.fn()
        )
        expect(shelterResponse.body.message).toMatch(/active shelter/)
    })

    it('marks audit verified and rejects attempts that cannot restore rejected stock', async () => {
        const verifiedDistribution = {
            _id: distributionId,
            distributionId: 'DST-1',
            supply: supplyId,
            auditStatus: 'Pending Verification',
            auditHistory: [],
            save: vi.fn().mockResolvedValue(undefined),
            populate: vi.fn().mockResolvedValue(undefined)
        }
        ReliefDistribution.findById.mockReturnValue({ session: vi.fn().mockResolvedValue(verifiedDistribution) })
        const res = makeResponse()
        await updateReliefDistributionAudit({
            params: { distributionId },
            body: { auditStatus: 'Verified', verificationNotes: 'Checked stock count' },
            user: officer
        }, res, vi.fn())
        expect(verifiedDistribution.auditStatus).toBe('Verified')
        expect(verifiedDistribution.verifiedBy).toBe(officer._id)
        expect(verifiedDistribution.auditHistory[0]).toMatchObject({
            auditStatus: 'Verified',
            notes: 'Checked stock count',
            changedBy: officer._id
        })
        expect(res.body.success).toBe(true)

        const rejected = {
            ...verifiedDistribution,
            auditStatus: 'Rejected',
            quantity: 3,
            auditHistory: [],
            save: vi.fn(),
            populate: vi.fn()
        }
        ReliefDistribution.findById.mockReturnValue({ session: vi.fn().mockResolvedValue(rejected) })
        ReliefSupply.aggregate.mockReturnValue({ session: vi.fn().mockResolvedValue([{ remainingQuantity: 2 }]) })
        const next = vi.fn()
        await updateReliefDistributionAudit({
            params: { distributionId },
            body: { auditStatus: 'Verified' },
            user: officer
        }, makeResponse(), next)
        expect(next.mock.calls[0][0].message).toMatch(/not enough available supply/)
        expect(rejected.save).not.toHaveBeenCalled()
    })

    it('enforces audit input limits and restricts the audit action to DMC officers', async () => {
        const invalid = makeResponse()
        await updateReliefDistributionAudit({
            params: { distributionId },
            body: { auditStatus: 'Unknown', verificationNotes: 'x'.repeat(2001) },
            user: officer
        }, invalid, vi.fn())
        expect(invalid.status).toHaveBeenCalledWith(400)

        const forbidden = makeResponse()
        const next = vi.fn()
        authorize('dmcofficer')({ user: { role: 'organization' } }, forbidden, next)
        expect(forbidden.status).toHaveBeenCalledWith(403)
        expect(forbidden.body.message).toBe('Access denied')
        expect(next).not.toHaveBeenCalled()

        const unauthenticated = makeResponse()
        authorize('dmcofficer')({}, unauthenticated, next)
        expect(unauthenticated.status).toHaveBeenCalledWith(401)
    })

    it('lists distributions filtered to the authenticated organization and forwards API errors', async () => {
        ReliefDistribution.find.mockReturnValue({
            populate: vi.fn().mockReturnThis(),
            sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) })
        })
        const res = makeResponse()
        await listReliefDistributions(
            { user: { role: 'organization', organizationId }, query: { auditStatus: 'Verified', q: 'food' } },
            res,
            vi.fn()
        )
        expect(ReliefDistribution.find.mock.calls[0][0]).toMatchObject({
            organization: organizationId,
            auditStatus: 'Verified'
        })
        expect(res.body.distributions).toEqual([])

        const error = new Error('database down')
        ReliefDistribution.find.mockImplementation(() => { throw error })
        const next = vi.fn()
        await listReliefDistributions({ user: officer, query: {} }, makeResponse(), next)
        expect(next).toHaveBeenCalledWith(error)
    })

    it('handles approved relief-location checks without creating a distribution for a missing location', async () => {
        TargetArea.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(null) })
        const res = makeResponse()
        await createReliefDistribution({
            body: distributionInput({
                destinationType: 'Relief Location',
                reliefLocation: organizationId
            }),
            user: officer
        }, res, vi.fn())
        expect(res.body.message).toMatch(/approved relief location/)
        expect(ReliefDistribution.create).not.toHaveBeenCalled()
    })

    it('allows a valid shelter destination and rolls back unavailable audit inventory changes', async () => {
        Shelter.findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ _id: 'active-shelter' }) })
        ReliefSupply.aggregate.mockReturnValue({
            session: vi.fn().mockResolvedValue([{
                _id: supplyId,
                organization: { _id: organizationId },
                disasterEvent: 'Flood',
                remainingQuantity: 10,
                receivedDate: new Date('2026-10-07'),
                unit: 'bags'
            }])
        })
        ReliefDistribution.create.mockResolvedValue([{
            _id: distributionId,
            distributionId: 'DST-2',
            auditStatus: 'Pending Verification'
        }])
        const res = makeResponse()
        await createReliefDistribution({
            body: distributionInput({
                destinationType: 'Shelter',
                shelter: '507f1f77bcf86cd799439099'
            }),
            user: officer
        }, res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(201)
        expect(ReliefDistribution.create.mock.calls[0][0][0].shelter).toBe('active-shelter')

        const existing = {
            _id: distributionId,
            distributionId: 'DST-2',
            supply: supplyId,
            auditStatus: 'Pending Verification',
            auditHistory: [],
            save: vi.fn(),
            populate: vi.fn()
        }
        ReliefDistribution.findById.mockReturnValue({ session: vi.fn().mockResolvedValue(existing) })
        ReliefSupply.updateOne.mockResolvedValue({ modifiedCount: 0 })
        const next = vi.fn()
        await updateReliefDistributionAudit({
            params: { distributionId },
            body: { auditStatus: 'Flagged', verificationNotes: 'Review required' },
            user: officer
        }, makeResponse(), next)
        expect(next.mock.calls[0][0].statusCode).toBe(409)
        expect(existing.save).not.toHaveBeenCalled()
    })

    it('rejects overly long verification notes before querying a distribution', async () => {
        const res = makeResponse()
        await updateReliefDistributionAudit({
            params: { distributionId },
            body: { auditStatus: 'Flagged', verificationNotes: 'n'.repeat(2001) },
            user: officer
        }, res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.body.message).toMatch(/cannot exceed 2000/)
        expect(ReliefDistribution.findById).not.toHaveBeenCalled()
    })
})
