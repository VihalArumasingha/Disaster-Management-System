import { beforeEach, describe, expect, it, vi } from 'vitest'
import mongoose from 'mongoose'

vi.mock('../../models/Organization.js', () => ({
    default: { find: vi.fn(), findById: vi.fn(), findByIdAndUpdate: vi.fn() }
}))
vi.mock('../../models/OrganizationContribution.js', () => ({
    default: { find: vi.fn(), create: vi.fn() }
}))
vi.mock('../../models/ShelterOccupancy.js', () => ({ default: { find: vi.fn(), create: vi.fn() } }))
vi.mock('../../models/User.js', () => ({ default: { exists: vi.fn(), create: vi.fn() } }))
vi.mock('../../utils/operationalAudit.js', () => ({ default: vi.fn() }))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn() } }))

// Fake Shelter constructor
vi.mock('../../models/Shelter.js', () => {
    const Model = vi.fn(function (values) {
        Object.assign(this, values)
        this._id = '507f1f77bcf86cd799439011'
        this.shelterId = 'SH-TEST001'
        this.save = vi.fn().mockResolvedValue(this)
        this.set = vi.fn((updates) => Object.assign(this, updates))
        this.toJSON = vi.fn(() => ({ ...this }))
    })
    Object.assign(Model, {
        find: vi.fn(),
        findById: vi.fn()
    })
    return { default: Model }
})

import Shelter from '../../models/Shelter.js'
import ShelterOccupancy from '../../models/ShelterOccupancy.js'
import writeOperationalAudit from '../../utils/operationalAudit.js'
import {
    createShelter,
    addOrganizationContribution,
    createOrganization,
    getOrganization,
    getShelter,
    listOrganizations,
    listShelters,
    recordShelterOccupancy,
    updateShelter,
    updateOrganizationStatus,
    updateShelterStatus
} from '../../roles/dmcOfficer/controllers/resourceManagementController.js'
import Organization from '../../models/Organization.js'
import OrganizationContribution from '../../models/OrganizationContribution.js'
import UserModel from '../../models/User.js'
import bcrypt from 'bcryptjs'

const shelterId = '507f1f77bcf86cd799439011'
const user = { _id: '507f191e810c19729de860ea' }

// Fake Express response 
const makeResponse = () => ({
    status: vi.fn(function () { return this }),
    json: vi.fn(function (body) { this.body = body; return this })
})

// Valid shelter input — pass overrides to test specific fields
const shelterInput = (overrides = {}) => ({
    shelterName: 'Central School',
    district: 'Colombo',
    address: 'Main Street',
    shelterType: 'School',
    capacity: 20,
    contactPerson: 'A. Perera',
    contactNumber: '0712345678',
    facilities: 'Water, First aid',
    disasterEvent: 'Flood 2026',
    ...overrides
})

// Fake Mongoose session — transactions run inline
const session = {
    withTransaction: vi.fn(async (callback) => callback()),
    endSession: vi.fn()
}

describe('Shelter management and occupancy history', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.spyOn(mongoose, 'startSession').mockResolvedValue(session)
        session.withTransaction.mockImplementation(async (callback) => callback())
        // create() with array returns array (Mongoose insertMany style)
        ShelterOccupancy.create.mockImplementation(async ([row]) => [{ _id: 'history-1', ...row }])
        writeOperationalAudit.mockResolvedValue(undefined)
    })

    it('creates a shelter with parsed facilities and a starting occupancy snapshot', async () => {
        const res = makeResponse()
        const req = { body: shelterInput({ currentOccupancy: '4' }), user }

        await createShelter(req, res, vi.fn())

        expect(res.status).toHaveBeenCalledWith(201)
        // facilities string split → array; currentOccupancy string → number
        expect(res.body.shelter).toMatchObject({
            shelterName: 'Central School',
            currentOccupancy: 4,
            status: 'Active',
            facilities: ['Water', 'First aid']
        })
        // Occupancy snapshot saved inside a transaction
        expect(ShelterOccupancy.create).toHaveBeenCalledWith(
            [expect.objectContaining({ occupancyCount: 4, recordedBy: user._id })],
            { session }
        )
        expect(writeOperationalAudit).toHaveBeenCalledTimes(2)
    })

    it('marks a shelter at capacity Full and rejects invalid starting occupancy', async () => {
        // 20/20 → status "Full"
        const fullResponse = makeResponse()
        await createShelter(
            { body: shelterInput({ currentOccupancy: 20 }), user },
            fullResponse,
            vi.fn()
        )
        expect(fullResponse.body.shelter.status).toBe('Full')

        // 21 > capacity 20 → 400, no DB save
        const badResponse = makeResponse()
        await createShelter(
            { body: shelterInput({ currentOccupancy: 21 }), user },
            badResponse,
            vi.fn()
        )
        expect(badResponse.status).toHaveBeenCalledWith(400)
        expect(badResponse.body.message).toMatch(/between 0 and capacity/)
        expect(ShelterOccupancy.create).toHaveBeenCalledTimes(1)
    })

    it('lists shelters with available capacity and safe searchable filters', async () => {
        Shelter.find.mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([{ capacity: 10, currentOccupancy: 7 }])
            })
        })
        const res = makeResponse()

        await listShelters({ query: { q: '.*', type: 'School', status: 'Active' } }, res, vi.fn())

        const filter = Shelter.find.mock.calls[0][0]
        // '.*' escaped → literal '\.\*' (prevents regex injection)
        expect(filter.$or[1].shelterName).toBeInstanceOf(RegExp)
        expect(filter.$or[1].shelterName.source).toBe('\\.\\*')
        expect(filter).toMatchObject({ shelterType: 'School', status: 'Active' })
        expect(res.body.shelters[0].availableCapacity).toBe(3)  // 10 - 7
    })

    it('returns shelter details with populated occupancy history and rejects malformed ids', async () => {
        Shelter.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: shelterId, capacity: 10, currentOccupancy: 6 }) })
        ShelterOccupancy.find.mockReturnValue({
            populate: vi.fn().mockReturnValue({
                sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ occupancyCount: 6 }]) })
            })
        })
        const res = makeResponse()
        await getShelter({ params: { shelterId } }, res, vi.fn())
        expect(res.body.shelter.availableCapacity).toBe(4)  // 10 - 6
        expect(res.body.occupancyHistory).toHaveLength(1)

        // Malformed ObjectId → 400, no DB call
        const badResponse = makeResponse()
        await getShelter({ params: { shelterId: 'not-an-id' } }, badResponse, vi.fn())
        expect(badResponse.status).toHaveBeenCalledWith(400)
        expect(Shelter.findById).toHaveBeenCalledTimes(1)
    })

    it('updates shelter metadata but prevents capacity below occupancy and invalid capacity', async () => {
        const existing = {
            _id: shelterId,
            shelterId: 'SH-1',
            shelterName: 'Old name',
            currentOccupancy: 8,
            capacity: 10,
            status: 'Full',
            set: vi.fn(function (updates) { Object.assign(this, updates) }),
            save: vi.fn().mockResolvedValue(undefined),
            toJSON: vi.fn(function () { return this })
        }
        Shelter.findById.mockResolvedValue(existing)
        const res = makeResponse()
        await updateShelter({ params: { shelterId }, body: shelterInput({ capacity: 12 }), user }, res, vi.fn())
        expect(existing.capacity).toBe(12)
        // 8/12 < capacity → status flips from Full back to Active
        expect(existing.status).toBe('Active')
        expect(res.body.success).toBe(true)

        // capacity 7 < currentOccupancy 8 → 400
        const rejected = makeResponse()
        await updateShelter({ params: { shelterId }, body: shelterInput({ capacity: 7 }), user }, rejected, vi.fn())
        expect(rejected.status).toHaveBeenCalledWith(400)
        expect(rejected.body.message).toMatch(/lower than current occupancy/)

        // capacity 0 → invalid
        const invalidCapacity = makeResponse()
        await updateShelter({ params: { shelterId }, body: shelterInput({ capacity: 0 }), user }, invalidCapacity, vi.fn())
        expect(invalidCapacity.body.message).toMatch(/positive whole number/)
    })

    it('records occupancy transactionally, updates status, and rejects over-capacity or missing shelters', async () => {
        const existing = {
            _id: shelterId,
            shelterId: 'SH-1',
            capacity: 5,
            currentOccupancy: 2,
            status: 'Active',
            disasterEvent: 'Storm',
            save: vi.fn().mockResolvedValue(undefined),
            toJSON: vi.fn(function () { return this }),
            session: vi.fn(function () { return this })
        }
        Shelter.findById.mockReturnValue({ session: vi.fn().mockResolvedValue(existing) })
        const res = makeResponse()
        await recordShelterOccupancy(
            { params: { shelterId }, body: { occupancyCount: '5', disasterEvent: 'Flood 2026' }, user },
            res,
            vi.fn()
        )
        expect(existing.currentOccupancy).toBe(5)
        // 5/5 → status "Full"
        expect(existing.status).toBe('Full')
        expect(res.status).toHaveBeenCalledWith(201)
        expect(res.body.occupancy.occupancyCount).toBe(5)
        expect(ShelterOccupancy.create).toHaveBeenCalledWith(
            [expect.objectContaining({ occupancyCount: 5, disasterEvent: 'Flood 2026' })],
            { session }
        )

        // 6 > capacity 5 → 400
        const overCapacity = makeResponse()
        await recordShelterOccupancy(
            { params: { shelterId }, body: { occupancyCount: 6 }, user },
            overCapacity,
            vi.fn()
        )
        expect(overCapacity.status).toHaveBeenCalledWith(400)
        expect(overCapacity.body.message).toMatch(/exceed shelter capacity/)

        // Shelter not found → 404
        Shelter.findById.mockReturnValue({ session: vi.fn().mockResolvedValue(null) })
        const missing = makeResponse()
        await recordShelterOccupancy(
            { params: { shelterId }, body: { occupancyCount: 0 }, user },
            missing,
            vi.fn()
        )
        expect(missing.status).toHaveBeenCalledWith(404)
    })

    it('recomputes status when reactivating a full shelter and forwards database errors', async () => {
      
        const existing = {
            _id: shelterId, shelterId: 'SH-1', capacity: 3, currentOccupancy: 3, status: 'Closed',
            save: vi.fn().mockResolvedValue(undefined),
            toJSON: vi.fn(function () { return this })
        }
        Shelter.findById.mockResolvedValue(existing)
        const res = makeResponse()
        await updateShelterStatus({ params: { shelterId }, body: { status: 'Active' }, user }, res, vi.fn())
        expect(existing.status).toBe('Full')

        // DB error → forwarded to Express error handler via next()
        const error = new Error('database unavailable')
        Shelter.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockRejectedValue(error) }) })
        const next = vi.fn()
        await listShelters({ query: {} }, makeResponse(), next)
        expect(next).toHaveBeenCalledWith(error)
    })

    it('handles absent shelters and rejects invalid updates and statuses', async () => {
        // Not found → 404
        Shelter.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
        const missing = makeResponse()
        await getShelter({ params: { shelterId } }, missing, vi.fn())
        expect(missing.status).toHaveBeenCalledWith(404)
        Shelter.findById.mockResolvedValue(null)

        // Invalid shelterType → 400
        const invalidType = makeResponse()
        await updateShelter({
            params: { shelterId },
            body: shelterInput({ shelterType: 'Tent' }),
            user
        }, invalidType, vi.fn())
        expect(invalidType.body.message).toMatch(/Shelter type must be one of/)

        // Cannot manually set status "Full" → 400
        const missingStatus = makeResponse()
        await updateShelterStatus({
            params: { shelterId },
            body: { status: 'Full' },
            user
        }, missingStatus, vi.fn())
        expect(missingStatus.status).toHaveBeenCalledWith(400)

        // Shelter not found → 404
        const statusNotFound = makeResponse()
        await updateShelterStatus({
            params: { shelterId },
            body: { status: 'Closed' },
            user
        }, statusNotFound, vi.fn())
        expect(statusNotFound.status).toHaveBeenCalledWith(404)
    })

    it('rejects invalid occupancy IDs and fractional counts, and forwards transaction errors', async () => {
        // Malformed ID → 400
        const invalidIdResponse = makeResponse()
        await recordShelterOccupancy({
            params: { shelterId: 'bad-id' },
            body: { occupancyCount: 1 },
            user
        }, invalidIdResponse, vi.fn())
        expect(invalidIdResponse.status).toHaveBeenCalledWith(400)

        // Fractional count → 400
        const fractionalResponse = makeResponse()
        await recordShelterOccupancy({
            params: { shelterId },
            body: { occupancyCount: 1.5 },
            user
        }, fractionalResponse, vi.fn())
        expect(fractionalResponse.body.message).toMatch(/non-negative whole number/)

        // Transaction error → forwarded to next(), session closed
        const error = new Error('transaction failed')
        session.withTransaction.mockRejectedValueOnce(error)
        const next = vi.fn()
        await recordShelterOccupancy({
            params: { shelterId },
            body: { occupancyCount: 1 },
            user
        }, makeResponse(), next)
        expect(next).toHaveBeenCalledWith(error)
        expect(session.endSession).toHaveBeenCalled()
    })

    it('preserves manually inactive shelter status when capacity changes', async () => {
        const inactive = {
            _id: shelterId,
            shelterId: 'SH-1',
            currentOccupancy: 1,
            status: 'Inactive',
            set: vi.fn(function (updates) { Object.assign(this, updates) }),
            save: vi.fn().mockResolvedValue(undefined),
            toJSON: vi.fn(function () { return this })
        }
        Shelter.findById.mockResolvedValue(inactive)
        const res = makeResponse()

        await updateShelter({
            params: { shelterId },
            body: shelterInput({ capacity: 10 }),
            user
        }, res, vi.fn())

        // Manual status "Inactive" must NOT be overwritten
        expect(inactive.status).toBe('Inactive')
        expect(inactive.capacity).toBe(10)
    })

    it('lists organizations with escaped filters and returns their contribution history', async () => {
        Organization.find.mockReturnValue({
            sort: vi.fn().mockReturnValue({
                lean: vi.fn().mockResolvedValue([{ organizationName: 'Aid Group' }])
            })
        })
        const listResponse = makeResponse()
        await listOrganizations({ query: { q: '.*', type: 'NGO' } }, listResponse, vi.fn())
        const filter = Organization.find.mock.calls[0][0]
        // Regex escaped → prevents injection
        expect(filter.$or[1].organizationName.source).toBe('\\.\\*')
        expect(filter.organizationType).toBe('NGO')
        expect(listResponse.body.organizations).toHaveLength(1)

        Organization.findById.mockReturnValue({
            lean: vi.fn().mockResolvedValue({ _id: shelterId, organizationName: 'Aid Group' })
        })
        OrganizationContribution.find.mockReturnValue({
            populate: vi.fn().mockReturnValue({
                sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ amount: 100 }]) })
            })
        })
        const detailResponse = makeResponse()
        await getOrganization({ params: { organizationId: shelterId } }, detailResponse, vi.fn())
        expect(detailResponse.body.organization.organizationName).toBe('Aid Group')
        expect(detailResponse.body.contributions).toEqual([{ amount: 100 }])
    })

    it('validates organization account creation and prevents duplicate account emails', async () => {
        const body = {
            organizationName: 'Aid Group',
            organizationType: 'NGO',
            contactPerson: 'Contact',
            email: 'aid@example.org',
            phone: '0712345678',
            address: 'Colombo',
            district: 'Colombo',
            initialPassword: 'good-password'
        }
        // Password too short → 400
        const weakPassword = makeResponse()
        await createOrganization({ body: { ...body, initialPassword: 'short' }, user }, weakPassword, vi.fn())
        expect(weakPassword.status).toHaveBeenCalledWith(400)
        expect(weakPassword.body.message).toMatch(/between 8 and 72 bytes/)

        // Invalid email → 400
        const invalidEmail = makeResponse()
        await createOrganization({ body: { ...body, email: 'bad-email' }, user }, invalidEmail, vi.fn())
        expect(invalidEmail.body.message).toMatch(/valid organization email/)

        // Duplicate email → 409, no hashing done
        UserModel.exists.mockResolvedValue(true)
        const duplicateEmail = makeResponse()
        await createOrganization({ body, user }, duplicateEmail, vi.fn())
        expect(duplicateEmail.status).toHaveBeenCalledWith(409)
        expect(bcrypt.hash).not.toHaveBeenCalled()
    })

    it('records an organization contribution and updates its verified status', async () => {
        const organization = { _id: shelterId, organizationId: 'ORG-1' }
        Organization.findById.mockResolvedValue(organization)
        const contribution = { _id: 'contribution-1', contributionType: 'Goods' }
        OrganizationContribution.create.mockResolvedValue(contribution)
        const res = makeResponse()

        await addOrganizationContribution({
            params: { organizationId: shelterId },
            body: { contributionType: 'Goods', quantity: 20, disasterEvent: 'Flood 2026' },
            user
        }, res, vi.fn())

        expect(res.status).toHaveBeenCalledWith(201)
        expect(OrganizationContribution.create).toHaveBeenCalledWith(expect.objectContaining({
            organization: shelterId,
            recordedBy: user._id,
            contributionType: 'Goods'
        }))

        // Status update 
        const activeOrganization = { _id: shelterId, organizationId: 'ORG-1', status: 'Suspended' }
        Organization.findByIdAndUpdate.mockResolvedValue(activeOrganization)
        const statusResponse = makeResponse()
        await updateOrganizationStatus({
            params: { organizationId: shelterId },
            body: { status: 'Suspended' },
            user
        }, statusResponse, vi.fn())
        expect(Organization.findByIdAndUpdate).toHaveBeenCalledWith(
            shelterId,
            { $set: { status: 'Suspended' } },
            { new: true, runValidators: true }
        )
        expect(statusResponse.body.organization.status).toBe('Suspended')
    })
})