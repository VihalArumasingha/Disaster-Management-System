import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database models so these remain UNIT tests
vi.mock('../../models/HazardReport.js', () => ({
    default: {
        find: vi.fn()
    }
}))

vi.mock('../../models/ReportCluster.js', () => ({
    default: {
        findById: vi.fn()
    }
}))

vi.mock('../../models/HazardEscalation.js', () => ({
    default: {
        findOne: vi.fn(),
        create: vi.fn()
    }
}))

import HazardReport from '../../models/HazardReport.js'
import ReportCluster from '../../models/ReportCluster.js'
import HazardEscalation from '../../models/HazardEscalation.js'

import {
    evaluateWarningEscalation,
    createEscalationHandoff
} from '../../roles/dmcOfficer/services/warningEscalationService.js'

describe('Warning Escalation', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    // POSITIVE: a high-priority cluster with enough verified reports should escalate
    it('should recommend escalation when the criteria are satisfied', async () => {
        ReportCluster.findById.mockResolvedValue({
            _id: 'cluster1',
            reportIds: ['report1', 'report2'],
            hazardType: 'flood',
            priorityScore: 90,
            priorityLevel: 'high'
        })

        HazardReport.find.mockReturnValue({
            select: () => ({
                lean: vi.fn().mockResolvedValue([
                    { _id: 'report1' },
                    { _id: 'report2' }
                ])
            })
        })

        const result = await evaluateWarningEscalation('cluster1')

        expect(result.shouldEscalate).toBe(true)
        expect(result.verifiedReportCount).toBe(2)
    })

    // NEGATIVE: not enough verified reports should prevent escalation
    it('should not escalate when there are not enough verified reports', async () => {
        ReportCluster.findById.mockResolvedValue({
            _id: 'cluster2',
            reportIds: ['report1'],
            hazardType: 'landslide',
            priorityScore: 80,
            priorityLevel: 'high'
        })

        HazardReport.find.mockReturnValue({
            select: () => ({
                lean: vi.fn().mockResolvedValue([])
            })
        })

        const result = await evaluateWarningEscalation('cluster2')

        expect(result.shouldEscalate).toBe(false)
        expect(result.reason).toContain('enough verified')
    })

    // NEGATIVE: a low-priority cluster should not be escalated
    it('should not escalate when priority is below the required level', async () => {
        ReportCluster.findById.mockResolvedValue({
            _id: 'cluster3',
            reportIds: ['report1'],
            hazardType: 'storm',
            priorityScore: 30,
            priorityLevel: 'low'
        })

        HazardReport.find.mockReturnValue({
            select: () => ({
                lean: vi.fn().mockResolvedValue([
                    { _id: 'report1' }
                ])
            })
        })

        const result = await evaluateWarningEscalation('cluster3')

        expect(result.shouldEscalate).toBe(false)
        expect(result.reason).toContain('priority')
    })

    // EDGE: a cluster that does not exist should return null
    it('should return null when the cluster does not exist', async () => {
        ReportCluster.findById.mockResolvedValue(null)

        const result = await evaluateWarningEscalation('missing-cluster')

        expect(result).toBeNull()
    })

    // POSITIVE: a valid escalation should create a handoff
    it('should create an escalation handoff for an eligible cluster', async () => {
        ReportCluster.findById.mockResolvedValue({
            _id: 'cluster4',
            reportIds: ['report1'],
            hazardType: 'flood',
            priorityScore: 95,
            priorityLevel: 'critical'
        })

        HazardReport.find.mockReturnValue({
            select: () => ({
                lean: vi.fn().mockResolvedValue([
                    { _id: 'report1' }
                ])
            })
        })

        HazardEscalation.findOne.mockResolvedValue(null)

        const escalation = {
            _id: 'escalation1',
            status: 'pending_dmc_review',
            populate: vi.fn().mockResolvedValue({
                _id: 'escalation1'
            })
        }

        HazardEscalation.create.mockResolvedValue(escalation)

        const result = await createEscalationHandoff(
            'cluster4',
            'officer1'
        )

        expect(HazardEscalation.create).toHaveBeenCalled()
        expect(result._id).toBe('escalation1')
    })

    // NEGATIVE: an ineligible cluster should not create an escalation
    it('should reject an escalation when criteria are not satisfied', async () => {
        ReportCluster.findById.mockResolvedValue({
            _id: 'cluster5',
            reportIds: ['report1'],
            hazardType: 'storm',
            priorityScore: 20,
            priorityLevel: 'low'
        })

        HazardReport.find.mockReturnValue({
            select: () => ({
                lean: vi.fn().mockResolvedValue([])
            })
        })

        await expect(
            createEscalationHandoff('cluster5', 'officer1')
        ).rejects.toMatchObject({
            statusCode: 400
        })

        expect(HazardEscalation.create).not.toHaveBeenCalled()
    })

    // EDGE: an existing pending escalation should be reused
    it('should return the existing pending escalation', async () => {
        ReportCluster.findById.mockResolvedValue({
            _id: 'cluster6',
            reportIds: ['report1'],
            hazardType: 'flood',
            priorityScore: 90,
            priorityLevel: 'high'
        })

        HazardReport.find.mockReturnValue({
            select: () => ({
                lean: vi.fn().mockResolvedValue([
                    { _id: 'report1' }
                ])
            })
        })

        const existingEscalation = {
            _id: 'existing1',
            status: 'pending_dmc_review',
            populate: vi.fn().mockResolvedValue({
                _id: 'existing1'
            })
        }

        HazardEscalation.findOne.mockResolvedValue(existingEscalation)

        const result = await createEscalationHandoff(
            'cluster6',
            'officer1'
        )

        expect(HazardEscalation.create).not.toHaveBeenCalled()
        expect(result._id).toBe('existing1')
    })

    // NEGATIVE: an existing non-pending escalation should be rejected
    it('should reject a duplicate escalation that is already processed', async () => {
        ReportCluster.findById.mockResolvedValue({
            _id: 'cluster7',
            reportIds: ['report1'],
            hazardType: 'flood',
            priorityScore: 90,
            priorityLevel: 'high'
        })

        HazardReport.find.mockReturnValue({
            select: () => ({
                lean: vi.fn().mockResolvedValue([
                    { _id: 'report1' }
                ])
            })
        })

        HazardEscalation.findOne.mockResolvedValue({
            _id: 'existing2',
            status: 'approved'
        })

        await expect(
            createEscalationHandoff('cluster7', 'officer1')
        ).rejects.toMatchObject({
            statusCode: 409
        })
    })

})