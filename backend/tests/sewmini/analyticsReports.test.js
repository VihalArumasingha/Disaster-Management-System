import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../models/ImpactRecord.js', () => ({ default: { find: vi.fn(), distinct: vi.fn() } }))
vi.mock('../../models/Organization.js', () => ({ default: { find: vi.fn(), distinct: vi.fn() } }))
vi.mock('../../models/OrganizationContribution.js', () => ({ default: { find: vi.fn(), distinct: vi.fn() } }))
vi.mock('../../models/OperationalAuditLog.js', () => ({ default: { create: vi.fn() } }))
vi.mock('../../models/ReliefDistribution.js', () => ({ default: { find: vi.fn(), aggregate: vi.fn(), distinct: vi.fn() } }))
vi.mock('../../models/ReliefSupply.js', () => ({ default: { find: vi.fn(), distinct: vi.fn() } }))
vi.mock('../../models/Shelter.js', () => ({ default: { find: vi.fn(), distinct: vi.fn() } }))
vi.mock('../../models/ShelterOccupancy.js', () => ({ default: { find: vi.fn() } }))
vi.mock('../../models/Warning.js', () => ({ default: { find: vi.fn(), distinct: vi.fn() } }))
vi.mock('../../models/WarningDelivery.js', () => ({ default: { find: vi.fn() } }))
vi.mock('../../models/HazardReport.js', () => ({ default: { find: vi.fn() } }))

import ImpactRecord from '../../models/ImpactRecord.js'
import Organization from '../../models/Organization.js'
import OrganizationContribution from '../../models/OrganizationContribution.js'
import OperationalAuditLog from '../../models/OperationalAuditLog.js'
import ReliefDistribution from '../../models/ReliefDistribution.js'
import ReliefSupply from '../../models/ReliefSupply.js'
import Shelter from '../../models/Shelter.js'
import ShelterOccupancy from '../../models/ShelterOccupancy.js'
import Warning from '../../models/Warning.js'
import WarningDelivery from '../../models/WarningDelivery.js'
import HazardReport from '../../models/HazardReport.js'
import {
    generateAnalytics,
    getAnalyticsOptions,
    logReportExport
} from '../../roles/dmcOfficer/controllers/analyticsController.js'

// Fake user for testing
const user = { _id: '507f1f77bcf86cd799439011', name: 'DMC Officer' }

// Fake Express response 
const makeResponse = () => ({
    status: vi.fn(function () { return this }),
    json: vi.fn(function (body) { this.body = body; return this })
})

// Fake Mongoose query chain 
const queryResult = (rows) => {
    const query = {
        select: vi.fn(() => query),
        populate: vi.fn(() => query),
        sort: vi.fn(() => query),
        lean: vi.fn().mockResolvedValue(rows),
        distinct: vi.fn().mockResolvedValue([])
    }
    return query
}

// Default empty state for all models
const emptyFixtures = () => {
    Warning.find.mockImplementation(() => queryResult([]))
    ReliefSupply.find.mockImplementation(() => queryResult([]))
    ReliefDistribution.find.mockImplementation(() => queryResult([]))
    ImpactRecord.find.mockImplementation(() => queryResult([]))
    Shelter.find.mockImplementation(() => queryResult([]))
    ShelterOccupancy.find.mockImplementation(() => queryResult([]))
    OrganizationContribution.find.mockImplementation(() => queryResult([]))
    HazardReport.find.mockImplementation(() => queryResult([]))
    WarningDelivery.find.mockImplementation(() => queryResult([]))
    ReliefDistribution.aggregate.mockResolvedValue([])
    Shelter.distinct.mockResolvedValue([])
    Organization.distinct.mockResolvedValue([])
}

describe('Post-event analytics and report exports', () => {
    // Reset mocks before every test → clean state
    beforeEach(() => {
        vi.clearAllMocks()
        emptyFixtures()
        OperationalAuditLog.create.mockResolvedValue({})
    })

    it('generates the analytics options from available event and organization data', async () => {
        // distinct() merges events from many sources; null removed, sorted
        ImpactRecord.distinct.mockResolvedValue(['Flood', null])
        Shelter.distinct.mockResolvedValue(['Flood', 'Storm'])
        ReliefSupply.distinct.mockResolvedValue(['Storm'])
        ReliefDistribution.distinct.mockResolvedValue(['Flood'])
        OrganizationContribution.distinct.mockResolvedValue(['Storm'])
        Warning.distinct.mockResolvedValue(['Coastal Warning'])
        Organization.find.mockReturnValue({
            select: vi.fn().mockReturnThis(),
            sort: vi.fn().mockReturnThis(),
            lean: vi.fn().mockResolvedValue([{ organizationName: 'Aid Group' }])
        })
        const res = makeResponse()

        await getAnalyticsOptions({}, res, vi.fn())

        // Events sorted alphabetically, null removed
        expect(res.body.disasterEvents).toEqual(['Coastal Warning', 'Flood', 'Storm'])
        expect(res.body.organizations).toEqual([{ organizationName: 'Aid Group' }])
        expect(res.body.districts).toContain('Colombo')
        expect(res.body.hazardTypes).toContain('flood')
    })

    // Parameterized tests — one test, many invalid inputs
    it.each([
        [{ district: 'Atlantis' }, /valid district/],
        [{ hazardType: 'meteor' }, /valid hazard type/],
        [{ dateFrom: '2026-02-30' }, /valid date filters/],       // invalid date
        [{ dateFrom: '2026-10-09', dateTo: '2026-10-08' }, /later than Date To/], // from > to
        [{ disasterEvent: 'x'.repeat(201) }, /cannot exceed 200 characters/],     // too long
        [{ organization: 'bad-id' }, /valid organization/]        // invalid ObjectId
    ])('rejects invalid analytics filters %#', async (body, message) => {
        const res = makeResponse()
        await generateAnalytics({ body, user }, res, vi.fn())
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.body.message).toMatch(message)
        // Validation fails → no DB queries, no audit log
        expect(Warning.find).not.toHaveBeenCalled()
        expect(OperationalAuditLog.create).not.toHaveBeenCalled()
    })

    it('aggregates alerts, reach, shelters, supplies, audits, contributions, and impact records', async () => {
        const shelterId = '507f191e810c19729de860ea'
        const supplyId = '507f191e810c19729de860eb'
        const warningId = 'warning-1'
        Warning.find.mockImplementation(() => queryResult([{
            _id: warningId,
            title: 'Flood 2026',
            city: 'Colombo',
            hazardType: 'flood',
            severity: 'High',
            status: 'issued',
            createdAt: new Date('2026-10-08T11:30:00Z'),
            issuedAt: new Date('2026-10-08T12:00:00Z')
        }]))
        // 2 deliveries for same citizen: 1 sent, 1 failed → reach rate = 50%
        WarningDelivery.find.mockImplementation(() => queryResult([
            { warningId, recipientId: 'citizen-1', inApp: { status: 'sent' } },
            { warningId, recipientId: 'citizen-1', sms: { status: 'failed' } }
        ]))
        ReliefSupply.find.mockImplementation(() => queryResult([{
            _id: supplyId,
            supplyId: 'SUP-1',
            supplyName: 'Rice',
            category: 'Food',
            quantityReceived: 10,
            unit: 'bags',
            disasterEvent: 'Flood 2026',
            organization: { organizationName: 'Aid Group', district: 'Colombo' }
        }]))
        // 2 distributions: 1 Verified, 1 Rejected → audit counts
        ReliefDistribution.find.mockImplementation(() => queryResult([
            {
                _id: 'd1',
                distributionId: 'DST-1',
                supply: { _id: supplyId, supplyName: 'Rice', category: 'Food' },
                organization: { organizationName: 'Aid Group' },
                quantity: 3,
                auditStatus: 'Verified',
                distributionDate: new Date('2026-10-08'),
                recipient: 'Shelter residents',
                auditHistory: []
            },
            {
                _id: 'd2',
                supply: { _id: supplyId, supplyName: 'Rice', category: 'Food' },
                quantity: 7,
                auditStatus: 'Rejected',
                distributionDate: new Date('2026-10-08'),
                recipient: 'Duplicate request'
            }
        ]))
        // Aggregate returns only verified quantity (3)
        ReliefDistribution.aggregate.mockResolvedValue([{ _id: supplyId, total: 3 }])
        ImpactRecord.find.mockImplementation(() => queryResult([{
            disasterEvent: 'Flood 2026',
            district: 'Colombo',
            recordedDate: new Date('2026-10-08'),
            affectedPopulation: 100,
            evacuatedPopulation: 20,
            peopleInShelters: 15,
            injured: 2,
            deaths: 1,
            housesDamaged: 5,
            schoolsAffected: 1,
            roadsBlocked: 2,
            hospitalsAffected: 0,
            otherImpact: 'Road closures'
        }]))
        Shelter.find.mockImplementation(() => queryResult([{
            _id: shelterId,
            shelterId: 'SH-1',
            shelterName: 'Central School',
            district: 'Colombo',
            capacity: 20,
            currentOccupancy: 15,
            status: 'Active'
        }]))
        // 2 occupancy records → only LATEST used for chart
        ShelterOccupancy.find.mockImplementation(() => queryResult([
            { shelter: { _id: shelterId, district: 'Colombo' }, recordedAt: new Date('2026-10-08T08:00:00Z'), occupancyCount: 5 },
            { shelter: { _id: shelterId, district: 'Colombo' }, recordedAt: new Date('2026-10-08T18:00:00Z'), occupancyCount: 6 }
        ]))
        // 2 contributions: LKR + USD → currency conversion
        OrganizationContribution.find.mockImplementation(() => queryResult([
            { organization: { organizationName: 'Aid Group', district: 'Colombo' }, amount: 100, currency: 'LKR', contributedAt: new Date('2026-10-08') },
            { organization: { organizationName: 'Overseas Aid' }, amount: 25, currency: 'USD' }
        ]))
        HazardReport.find.mockImplementation(() => queryResult([
            { hazardType: 'flood', status: 'verified', capturedAt: new Date('2026-10-08'), district: 'Colombo' }
        ]))
        const res = makeResponse()

        await generateAnalytics({ body: {}, user }, res, vi.fn())

        expect(res.body.hasData).toBe(true)
        expect(res.body.analytics.generatedBy).toBe('DMC Officer')
        expect(res.body.analytics.dataQuality.status).toBe('partial')
        expect(res.body.analytics.dataQuality.missingMetrics).toEqual(expect.arrayContaining([
            expect.objectContaining({ metric: 'Planned-versus-actual response targets' })
        ]))
        expect(res.body.analytics.dataQuality.missingSources).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'Donation-to-distribution lineage' })
        ]))
        // reachRate = 1/2 = 50%, utilization = 15/20 = 75%, remaining = 10-3 = 7
        expect(res.body.analytics.summary).toMatchObject({
            totalAlerts: 1,
            citizenReach: 1,
            reachRate: 50,
            shelterCapacity: 20,
            shelterOccupancy: 15,
            shelterUtilization: 75,
            suppliesReceived: 10,
            suppliesDistributed: 3,
            remainingInventory: 7,
            organizationContributions: 100,
            impactRecords: 1,
            hazardReports: 1
        })
        expect(res.body.analytics.summary.distributionAudit).toMatchObject({
            Verified: 1,
            Rejected: 1,
            Flagged: 0
        })
        expect(res.body.analytics.charts.distributionByCategory).toEqual([{ name: 'Food', quantity: 3 }])
        expect(res.body.analytics.records.supplies[0]).toMatchObject({ distributed: 3, remaining: 7 })
        expect(res.body.analytics.records.alerts[0]).toMatchObject({
            severity: 'High',
            status: 'issued',
            issueElapsedMinutes: 30
        })
        expect(res.body.analytics.records.shelters[0]).toMatchObject({
            capacityStatus: 'Below capacity',
            utilization: 75,
            overCapacity: 0
        })
        expect(HazardReport.find).toHaveBeenCalledWith({
            status: 'verified',
            $or: [
                { archived: false },
                { archived: { $exists: false } }
            ]
        })
        expect(res.body.analytics.records.impacts[0]).toMatchObject({
            affectedPopulation: 100,
            deaths: 1,
            otherImpact: 'Road closures'
        })
        // Only latest occupancy record (6) used for trend chart
        expect(res.body.analytics.charts.shelterOccupancyTrend).toEqual([
            { date: '2026-10-08', occupancy: 6 }
        ])
        // Generating report must create an audit log
        expect(OperationalAuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
            actor: user._id,
            action: 'analytics.generated',
            entityType: 'AnalyticsReport'
        }))
    })

    it('uses distinct district matches and escaped exact event filters in scoped analytics', async () => {
        // When district filter is set, shelter IDs come from a distinct() query
        let shelterSearchCount = 0
        Shelter.find.mockImplementation((filter) => {
            if (filter.district) {
                shelterSearchCount += 1
                if (shelterSearchCount === 1) {
                    return { distinct: vi.fn().mockResolvedValue(['shelter-in-colombo']) }
                }
            }
            return queryResult([])
        })
        Organization.find.mockImplementation((filter) => {
            if (filter.district) {
                return { distinct: vi.fn().mockResolvedValue(['507f191e810c19729de860ea']) }
            }
            return { select: vi.fn().mockReturnThis(), sort: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) }
        })
        const res = makeResponse()

        await generateAnalytics({
            body: {
                district: 'Colombo',
                disasterEvent: 'Flood (2026)',  // special chars ( )
                dateFrom: '2026-10-01',
                dateTo: '2026-10-08'
            },
            user
        }, res, vi.fn())

        const warningFilter = Warning.find.mock.calls[0][0]
        // City filter must be a case-insensitive RegExp
        expect(warningFilter.city).toBeInstanceOf(RegExp)
        // Event name escaped → exact match: '^Flood \\(2026\\)$'
        expect(warningFilter.title.source).toBe('^Flood \\(2026\\)$')
        // District filter = $or (direct district OR via shelter)
        expect(ReliefDistribution.find.mock.calls[0][0].$or).toEqual([
            { district: 'Colombo' },
            { shelter: { $in: ['shelter-in-colombo'] } }
        ])
        expect(res.body.analytics.filters.dateFrom).toBe('2026-10-01')
    })

    it('applies the selected event and dates to distribution reconciliation and contributions', async () => {
        ReliefSupply.find.mockImplementation(() => queryResult([{
            _id: '507f191e810c19729de860eb',
            quantityReceived: 4,
            disasterEvent: 'Flood 2026',
            receivedDate: new Date('2026-10-08')
        }]))
        const res = makeResponse()

        await generateAnalytics({
            body: {
                disasterEvent: 'Flood 2026',
                dateFrom: '2026-10-08',
                dateTo: '2026-10-08'
            },
            user
        }, res, vi.fn())

        const distributionMatch = ReliefDistribution.aggregate.mock.calls[0][0][0].$match
        expect(distributionMatch.disasterEvent.source).toBe('^Flood 2026$')
        expect(distributionMatch.distributionDate).toEqual({
            $gte: new Date('2026-10-08T00:00:00.000Z'),
            $lte: new Date('2026-10-08T23:59:59.999Z')
        })
        expect(OrganizationContribution.find.mock.calls[0][0]).toMatchObject({
            disasterEvent: expect.any(RegExp),
            contributedAt: distributionMatch.distributionDate
        })
        expect(HazardReport.find.mock.calls[0][0]._id).toBeNull()
        expect(res.body.analytics.dataQuality.missingSources).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'Verified citizen reports for the selected event' })
        ]))
    })

    it('returns empty analytics with zero percentages and skips delivery and inventory aggregation queries', async () => {
        const res = makeResponse()
        await generateAnalytics({ body: {}, user }, res, vi.fn())
        expect(res.body.hasData).toBe(false)
        // Empty delivery rates are zero; shelter utilization is undefined without capacity.
        expect(res.body.analytics.summary).toMatchObject({
            reachRate: 0,
            suppliesReceived: 0,
            remainingInventory: 0
        })
        // No warnings → skip deliveries query (optimization)
        expect(WarningDelivery.find).not.toHaveBeenCalled()
        // No supplies → skip aggregate query
        expect(ReliefDistribution.aggregate).not.toHaveBeenCalled()
        expect(res.body.analytics.summary.shelterUtilization).toBeNull()
    })

    it('reports over-capacity shelters and recorded stock shortages without dividing by zero', async () => {
        const supplyId = '507f191e810c19729de860eb'
        ReliefSupply.find.mockImplementation(() => queryResult([{
            _id: supplyId,
            supplyName: 'Water',
            quantityReceived: 5,
            disasterEvent: 'Flood 2026'
        }]))
        ReliefDistribution.find.mockImplementation(() => queryResult([{
            supply: { _id: supplyId, supplyName: 'Water', category: 'Water' },
            quantity: 8,
            auditStatus: 'Verified'
        }]))
        ReliefDistribution.aggregate.mockResolvedValue([{ _id: supplyId, total: 8 }])
        Shelter.find.mockImplementation(() => queryResult([{
            _id: 'shelter-1',
            shelterId: 'SH-1',
            shelterName: 'Overflow Site',
            capacity: 0,
            currentOccupancy: 2,
            status: 'Active'
        }]))
        const res = makeResponse()

        await generateAnalytics({ body: {}, user }, res, vi.fn())

        expect(res.body.analytics.summary.shelterUtilization).toBeNull()
        expect(res.body.analytics.summary.overcrowdedShelters).toBe(1)
        expect(res.body.analytics.records.shelters[0]).toMatchObject({
            utilization: null,
            overCapacity: 2,
            capacityStatus: 'Over capacity'
        })
        expect(res.body.analytics.records.supplies[0]).toMatchObject({
            received: 5,
            distributed: 8,
            stockShortage: 3,
            remaining: 0
        })
    })

    it('logs PDF and CSV exports, rejects other formats, and surfaces database errors', async () => {
        // Filters trimmed: ' Flood ' → 'Flood'
        const filters = { district: 'Colombo', disasterEvent: ' Flood ' }
        for (const format of ['PDF', 'CSV']) {
            const res = makeResponse()
            await logReportExport({ body: { format, filters, generatedAt: '2026-10-08T12:00:00Z' }, user }, res, vi.fn())
            expect(res.body).toEqual({ success: true })
            expect(OperationalAuditLog.create).toHaveBeenLastCalledWith(expect.objectContaining({
                actor: user._id,
                action: 'report.exported',
                details: expect.objectContaining({
                    format,
                    status: 'generated',
                    filters: expect.objectContaining({ district: 'Colombo', disasterEvent: 'Flood' })
                })
            }))
        }

        // Unsupported format → 400
        const invalid = makeResponse()
        await logReportExport({ body: { format: 'XLSX' }, user }, invalid, vi.fn())
        expect(invalid.status).toHaveBeenCalledWith(400)

        // DB error → forwarded to Express error handler via next()
        const error = new Error('audit database unavailable')
        OperationalAuditLog.create.mockRejectedValue(error)
        const next = vi.fn()
        await logReportExport({
            body: {
                format: 'PDF',
                filters,
                generatedAt: '2026-10-08T12:00:00Z'
            },
            user
        }, makeResponse(), next)
        expect(next).toHaveBeenCalledWith(error)
    })

    it('does not return generated analytics when report history cannot be saved', async () => {
        const error = new Error('report history unavailable')
        OperationalAuditLog.create.mockRejectedValue(error)
        const res = makeResponse()
        const next = vi.fn()

        await generateAnalytics({ body: {}, user }, res, next)

        expect(next).toHaveBeenCalledWith(error)
        expect(res.json).not.toHaveBeenCalled()
    })

    it('passes analytics option database failures to Express error handling', async () => {
        // DB error → forwarded to Express error handler via next()
        const error = new Error('database unavailable')
        ImpactRecord.distinct.mockRejectedValue(error)
        const next = vi.fn()
        await getAnalyticsOptions({}, makeResponse(), next)
        expect(next).toHaveBeenCalledWith(error)
    })
})