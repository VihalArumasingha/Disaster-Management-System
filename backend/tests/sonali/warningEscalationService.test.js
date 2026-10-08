import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import HazardReport from '../../models/HazardReport.js'
import ReportCluster from '../../models/ReportCluster.js'
import HazardEscalation from '../../models/HazardEscalation.js'
import {
    evaluateWarningEscalation,
    createEscalationHandoff,
    getEscalationByCluster,
    getOutgoingHazardEscalations,
    getIncomingHazardEscalations
} from '../../roles/dmcOfficer/services/warningEscalationService.js'

// Mock the MongoDB model so this unit test does not require a real database.
vi.mock('../../models/HazardReport.js', () => ({ default: { find: vi.fn(), findById: vi.fn() } }))
vi.mock('../../models/ReportCluster.js', () => ({ default: { findById: vi.fn() } }))
vi.mock('../../models/HazardEscalation.js', () => ({ default: { findOne: vi.fn(), create: vi.fn(), find: vi.fn() } }))

describe('Warning Escalation Service', () => {
    const originalEnv = process.env

    beforeEach(() => {
        process.env = { ...originalEnv }
        // Ensure standard test thresholds
        process.env.HAZARD_ESCALATION_MIN_VERIFIED_REPORTS = '1'
        process.env.HAZARD_ESCALATION_MIN_PRIORITY_LEVEL = 'high'
        vi.clearAllMocks()
    })

    afterEach(() => {
        process.env = originalEnv
    })

    // -------------------- FUNCTION: evaluateWarningEscalation --------------------
    describe('evaluateWarningEscalation', () => {
        // ==================== NEGATIVE TESTS ====================

        // Negative case: verifies missing cluster behaviour.
        it('should return null if cluster not found', async () => {
            ReportCluster.findById.mockResolvedValue(null)
            const result = await evaluateWarningEscalation('cluster-1')
            expect(result).toBeNull()
        })

        // ==================== POSITIVE TESTS ====================

        // Positive case: verifies successful escalation when sufficient verified reports and sufficient priority.
        it('should return shouldEscalate true when both criteria pass', async () => {
            const cluster = {
                _id: 'cluster-1',
                reportIds: ['r1', 'r2'],
                priorityLevel: 'high',
                priorityScore: 8.5,
                hazardType: 'flood'
            }
            ReportCluster.findById.mockResolvedValue(cluster)

            const mockFindChain = {
                select: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([{ _id: 'r1' }, { _id: 'r2' }])
            }
            HazardReport.find.mockReturnValue(mockFindChain)

            const result = await evaluateWarningEscalation('cluster-1')

            expect(result.shouldEscalate).toBe(true)
            expect(result.reason).toBe('Verified hazard reports and cluster priority meet escalation criteria')
            expect(result.verifiedReportCount).toBe(2)
            expect(result.verifiedReportIds).toEqual(['r1', 'r2'])
        })

        // ==================== NEGATIVE TESTS ====================

        // Negative case: verifies insufficient verified reports.
        it('should return shouldEscalate false when not enough verified reports', async () => {
            const cluster = {
                _id: 'cluster-1',
                reportIds: ['r1'],
                priorityLevel: 'critical',
                priorityScore: 9.5,
                hazardType: 'fire'
            }
            ReportCluster.findById.mockResolvedValue(cluster)

            const mockFindChain = {
                select: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([])
            }
            HazardReport.find.mockReturnValue(mockFindChain)

            const result = await evaluateWarningEscalation('cluster-1')

            expect(result.shouldEscalate).toBe(false)
            expect(result.reason).toBe('Cluster does not have enough verified hazard reports')
            expect(result.verifiedReportCount).toBe(0)
        })

        // Negative case: verifies insufficient priority.
        it('should return shouldEscalate false when priority is too low', async () => {
            const cluster = {
                _id: 'cluster-1',
                reportIds: ['r1', 'r2'],
                priorityLevel: 'medium',
                priorityScore: 5.5,
                hazardType: 'landslide'
            }
            ReportCluster.findById.mockResolvedValue(cluster)

            const mockFindChain = {
                select: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([{ _id: 'r1' }, { _id: 'r2' }])
            }
            HazardReport.find.mockReturnValue(mockFindChain)

            const result = await evaluateWarningEscalation('cluster-1')

            expect(result.shouldEscalate).toBe(false)
            expect(result.reason).toBe('Cluster priority is below the escalation threshold')
        })

        // Negative case: verifies both criteria failing.
        it('should return shouldEscalate false when both criteria fail', async () => {
            const cluster = {
                _id: 'cluster-1',
                reportIds: ['r1'],
                priorityLevel: 'low',
                priorityScore: 1.5,
                hazardType: 'landslide'
            }
            ReportCluster.findById.mockResolvedValue(cluster)

            const mockFindChain = {
                select: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([])
            }
            HazardReport.find.mockReturnValue(mockFindChain)

            const result = await evaluateWarningEscalation('cluster-1')

            expect(result.shouldEscalate).toBe(false)
            // It evaluates verified reports failure first
            expect(result.reason).toBe('Cluster does not have enough verified hazard reports')
        })
    })

    // -------------------- FUNCTION: createEscalationHandoff --------------------
    describe('createEscalationHandoff', () => {
        // ==================== NEGATIVE TESTS ====================

        // Negative case: verifies missing cluster evaluation.
        it('should return null if cluster evaluation returns null', async () => {
            ReportCluster.findById.mockResolvedValue(null)
            const result = await createEscalationHandoff('cluster-1', 'officer-1')
            expect(result).toBeNull()
        })

        // Negative case: verifies failure when escalation criteria are not met.
        it('should reject if escalation criteria are not met', async () => {
            const cluster = {
                _id: 'cluster-1',
                reportIds: [],
                priorityLevel: 'low',
                priorityScore: 1.5,
                hazardType: 'landslide'
            }
            ReportCluster.findById.mockResolvedValue(cluster)
            
            const mockFindChain = {
                select: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([])
            }
            HazardReport.find.mockReturnValue(mockFindChain)

            await expect(createEscalationHandoff('cluster-1', 'officer-1'))
                .rejects.toThrow('Cluster does not have enough verified hazard reports')
        })

        // ==================== POSITIVE TESTS ====================

        // Positive case: verifies existing pending escalation is returned.
        it('should return existing pending escalation if one exists', async () => {
            // Setup evaluation to pass
            const cluster = {
                _id: 'cluster-1',
                reportIds: ['r1'],
                priorityLevel: 'high',
                priorityScore: 8.5,
                hazardType: 'flood'
            }
            ReportCluster.findById.mockResolvedValue(cluster)
            HazardReport.find.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([{ _id: 'r1' }])
            })

            const existingEscalation = {
                status: 'pending_dmc_review',
                populate: vi.fn().mockReturnThis()
            }
            HazardEscalation.findOne.mockResolvedValue(existingEscalation)

            const result = await createEscalationHandoff('cluster-1', 'officer-1')

            expect(HazardEscalation.findOne).toHaveBeenCalledWith({ clusterId: 'cluster-1' })
            expect(existingEscalation.populate).toHaveBeenCalled()
            expect(result).toBe(existingEscalation)
        })

        // ==================== EDGE CASES ====================

        // Edge case: verifies duplicate/already processed escalation.
        it('should reject if existing escalation has another status', async () => {
            const cluster = {
                _id: 'cluster-1',
                reportIds: ['r1'],
                priorityLevel: 'high',
                priorityScore: 8.5,
                hazardType: 'flood'
            }
            ReportCluster.findById.mockResolvedValue(cluster)
            HazardReport.find.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([{ _id: 'r1' }])
            })

            const existingEscalation = {
                status: 'reviewed'
            }
            HazardEscalation.findOne.mockResolvedValue(existingEscalation)

            await expect(createEscalationHandoff('cluster-1', 'officer-1'))
                .rejects.toThrow('An escalation already exists for this cluster')
        })

        // ==================== POSITIVE TESTS ====================

        // Positive case: verifies new escalation creation.
        it('should create new escalation if none exists', async () => {
            const cluster = {
                _id: 'cluster-1',
                reportIds: ['r1'],
                priorityLevel: 'high',
                priorityScore: 8.5,
                hazardType: 'flood'
            }
            ReportCluster.findById.mockResolvedValue(cluster)
            HazardReport.find.mockReturnValue({
                select: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([{ _id: 'r1' }])
            })

            HazardEscalation.findOne.mockResolvedValue(null)

            const newEscalation = {
                populate: vi.fn().mockReturnThis()
            }
            HazardEscalation.create.mockResolvedValue(newEscalation)

            const result = await createEscalationHandoff('cluster-1', 'officer-1')

            expect(HazardEscalation.create).toHaveBeenCalledWith(expect.objectContaining({
                clusterId: 'cluster-1',
                hazardType: 'flood',
                priorityScore: 8.5,
                priorityLevel: 'high',
                verifiedReportIds: ['r1'],
                verifiedReportCount: 1,
                escalatedBy: 'officer-1',
                status: 'pending_dmc_review'
            }))
            expect(newEscalation.populate).toHaveBeenCalled()
            expect(result).toBe(newEscalation)
        })
    })

    // -------------------- FUNCTION: getEscalationByCluster --------------------
    describe('getEscalationByCluster', () => {
        // ==================== POSITIVE TESTS ====================

        // Positive case: verifies successful retrieval.
        it('should get escalation by cluster id successfully', async () => {
            const mockChain = {
                populate: vi.fn().mockReturnThis()
            }
            // Need to mock the last populate in chain to return the final value
            const finalMockChain = {
                ...mockChain,
                populate: vi.fn().mockImplementation((arg1, arg2) => {
                    if (arg1 === 'escalatedBy') return Promise.resolve({ _id: 'esc-1' })
                    return finalMockChain
                })
            }
            HazardEscalation.findOne.mockReturnValue(finalMockChain)

            const result = await getEscalationByCluster('cluster-1')

            expect(HazardEscalation.findOne).toHaveBeenCalledWith({ clusterId: 'cluster-1' })
            expect(result).toEqual({ _id: 'esc-1' })
        })
    })

    // -------------------- FUNCTION: getOutgoingHazardEscalations --------------------
    describe('getOutgoingHazardEscalations', () => {
        // ==================== POSITIVE TESTS ====================

        // Positive case: verifies incoming/outgoing filtering logic.
        it('should get outgoing escalations by officerId', async () => {
            const mockChain = {
                populate: vi.fn().mockReturnThis(),
                sort: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([{ _id: 'esc-1' }])
            }
            HazardEscalation.find.mockReturnValue(mockChain)

            const result = await getOutgoingHazardEscalations('officer-1')

            expect(HazardEscalation.find).toHaveBeenCalledWith({ escalatedBy: 'officer-1' })
            expect(mockChain.populate).toHaveBeenCalled()
            expect(mockChain.sort).toHaveBeenCalledWith({ escalatedAt: -1 })
            expect(mockChain.limit).toHaveBeenCalledWith(20)
            expect(result).toEqual([{ _id: 'esc-1' }])
        })
    })

    // -------------------- FUNCTION: getIncomingHazardEscalations --------------------
    describe('getIncomingHazardEscalations', () => {
        // ==================== POSITIVE TESTS ====================

        // Positive case: verifies incoming/outgoing filtering logic.
        it('should get incoming pending escalations', async () => {
            const mockChain = {
                populate: vi.fn().mockReturnThis(),
                sort: vi.fn().mockResolvedValue([{ _id: 'esc-1' }])
            }
            HazardEscalation.find.mockReturnValue(mockChain)

            const result = await getIncomingHazardEscalations()

            expect(HazardEscalation.find).toHaveBeenCalledWith({ status: 'pending_dmc_review' })
            expect(mockChain.populate).toHaveBeenCalledTimes(3)
            expect(mockChain.sort).toHaveBeenCalledWith({ escalatedAt: -1 })
            expect(result).toEqual([{ _id: 'esc-1' }])
        })
    })
})
