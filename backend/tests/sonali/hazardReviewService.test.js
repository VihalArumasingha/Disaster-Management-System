import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import HazardReport from '../../models/HazardReport.js'
import ReportCluster from '../../models/ReportCluster.js'
import {
    getHazardReviewQueue,
    getHazardReviewCluster,
    verifyHazardReport,
    rejectHazardReport
} from '../../roles/dmcOfficer/services/hazardReviewService.js'

import { calculateClusterPriority } from '../../roles/citizen/services/hazardPriorityService.js'
import { evaluateWarningEscalation } from '../../roles/dmcOfficer/services/warningEscalationService.js'

// Mock the MongoDB model so this unit test does not require a real database.
vi.mock('../../models/HazardReport.js', () => ({
    default: {
        findById: vi.fn(),
        find: vi.fn()
    }
}))

vi.mock('../../models/ReportCluster.js', () => ({
    default: {
        find: vi.fn(),
        findById: vi.fn()
    }
}))

vi.mock('mongoose', () => ({
    default: {
        isValidObjectId: vi.fn()
    }
}))

vi.mock('../../roles/citizen/services/hazardPriorityService.js', () => ({
    calculateClusterPriority: vi.fn()
}))

vi.mock('../../roles/dmcOfficer/services/warningEscalationService.js', () => ({
    evaluateWarningEscalation: vi.fn()
}))

describe('Hazard Review Service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // -------------------- FUNCTION: getHazardReviewQueue --------------------
    describe('getHazardReviewQueue', () => {
        // ==================== POSITIVE TESTS ====================

        // Positive case: verifies active clusters are retrieved.
        it('should get active clusters successfully', async () => {
            const mockChain = {
                populate: vi.fn().mockReturnThis(),
                sort: vi.fn().mockResolvedValue([{ _id: 'cluster-1' }])
            }
            ReportCluster.find.mockReturnValue(mockChain)

            const result = await getHazardReviewQueue()

            expect(ReportCluster.find).toHaveBeenCalledWith({ status: 'active' })
            expect(mockChain.populate).toHaveBeenCalled()
            expect(mockChain.sort).toHaveBeenCalledWith({ priorityScore: -1, lastReportedAt: -1 })
            expect(result).toEqual([{ _id: 'cluster-1' }])
        })

        // ==================== NEGATIVE TESTS ====================

        // Negative case: verifies behaviour for missing reports/clusters.
        it('should return empty array if no active clusters', async () => {
            const mockChain = {
                populate: vi.fn().mockReturnThis(),
                sort: vi.fn().mockResolvedValue([])
            }
            ReportCluster.find.mockReturnValue(mockChain)
            const result = await getHazardReviewQueue()
            expect(result).toEqual([])
        })
    })

    // -------------------- FUNCTION: getHazardReviewCluster --------------------
    describe('getHazardReviewCluster', () => {
        // ==================== NEGATIVE TESTS ====================

        // Negative case: verifies invalid cluster ID rejection.
        it('should reject invalid cluster ID', async () => {
            mongoose.isValidObjectId.mockReturnValue(false)
            await expect(getHazardReviewCluster('invalid')).rejects.toThrow('Invalid hazard cluster ID')
        })

        // Negative case: verifies missing cluster behaviour.
        it('should return null if cluster not found', async () => {
            mongoose.isValidObjectId.mockReturnValue(true)
            const mockChain = {
                populate: vi.fn().mockResolvedValue(null)
            }
            ReportCluster.findById.mockReturnValue(mockChain)
            const result = await getHazardReviewCluster('valid')
            expect(result).toBeNull()
        })

        // ==================== POSITIVE TESTS ====================

        // Positive case: verifies successful cluster retrieval.
        it('should get cluster by ID successfully', async () => {
            mongoose.isValidObjectId.mockReturnValue(true)
            const mockChain = {
                populate: vi.fn().mockResolvedValue({ _id: 'valid' })
            }
            ReportCluster.findById.mockReturnValue(mockChain)

            const result = await getHazardReviewCluster('valid')

            expect(ReportCluster.findById).toHaveBeenCalledWith('valid')
            expect(mockChain.populate).toHaveBeenCalled()
            expect(result).toEqual({ _id: 'valid' })
        })
    })

    // -------------------- FUNCTION: verifyHazardReport --------------------
    describe('verifyHazardReport', () => {
        // ==================== NEGATIVE TESTS ====================

        // Negative case: verifies missing report behaviour.
        it('should return null if report not found', async () => {
            HazardReport.findById.mockResolvedValue(null)
            const result = await verifyHazardReport('report-1', 'officer-1')
            expect(result).toBeNull()
        })

        // Negative case: verifies pending vs non-pending reports logic.
        // Negative case: verifies pending vs non-pending reports logic.
        it('should reject if report is not pending', async () => {
            HazardReport.findById.mockResolvedValue({ status: 'verified' })
            await expect(verifyHazardReport('report-1', 'officer-1')).rejects.toThrow('Only pending hazard reports can be verified')
        })

        // ==================== POSITIVE TESTS ====================

        // Positive case: verifies successful report verification, priority calculation and escalation evaluation.
        it('should verify report and trigger cluster recalculation and escalation', async () => {
            const mockReportSave = vi.fn()
            const mockClusterSave = vi.fn()
            
            const report = {
                _id: 'report-1',
                status: 'pending',
                clusterId: 'cluster-1',
                save: mockReportSave
            }
            HazardReport.findById.mockResolvedValue(report)

            const cluster = {
                _id: 'cluster-1',
                reportIds: ['report-1'],
                save: mockClusterSave
            }
            ReportCluster.findById.mockResolvedValue(cluster)

            const mockActiveReports = [
                { capturedAt: new Date('2026-01-02') },
                { capturedAt: new Date('2026-01-01') }
            ]
            const mockFindChain = {
                select: vi.fn().mockResolvedValue(mockActiveReports)
            }
            HazardReport.find.mockReturnValue(mockFindChain)

            calculateClusterPriority.mockReturnValue({
                priorityScore: 8.5,
                priorityLevel: 'high'
            })

            evaluateWarningEscalation.mockResolvedValue({ shouldEscalate: true })

            const result = await verifyHazardReport('report-1', 'officer-1')

            expect(report.status).toBe('verified')
            expect(report.verification.verifiedBy).toBe('officer-1')
            expect(report.verification.verifiedAt).toBeInstanceOf(Date)
            expect(mockReportSave).toHaveBeenCalled()

            expect(cluster.reportCount).toBe(2)
            expect(cluster.lastReportedAt).toEqual(mockActiveReports[0].capturedAt)
            expect(cluster.priorityScore).toBe(8.5)
            expect(cluster.priorityLevel).toBe('high')
            expect(mockClusterSave).toHaveBeenCalled()

            expect(evaluateWarningEscalation).toHaveBeenCalledWith('cluster-1')

            expect(result.report).toBe(report)
            expect(result.cluster).toBe(cluster)
            expect(result.escalation).toEqual({ shouldEscalate: true })
        })

        // ==================== EDGE CASES ====================

        // Edge case: verifies closed cluster edge case during cluster recalculation.
        it('should close cluster if no active reports remain during recalculation', async () => {
            const mockReportSave = vi.fn()
            const mockClusterSave = vi.fn()
            
            const report = {
                _id: 'report-1',
                status: 'pending',
                clusterId: 'cluster-1',
                save: mockReportSave
            }
            HazardReport.findById.mockResolvedValue(report)

            const cluster = {
                _id: 'cluster-1',
                reportIds: ['report-1'],
                save: mockClusterSave
            }
            ReportCluster.findById.mockResolvedValue(cluster)

            // No active reports
            const mockFindChain = {
                select: vi.fn().mockResolvedValue([])
            }
            HazardReport.find.mockReturnValue(mockFindChain)
            evaluateWarningEscalation.mockResolvedValue(null)

            const result = await verifyHazardReport('report-1', 'officer-1')

            expect(cluster.reportCount).toBe(0)
            expect(cluster.priorityScore).toBe(0)
            expect(cluster.priorityLevel).toBe('low')
            expect(cluster.status).toBe('closed')
            expect(mockClusterSave).toHaveBeenCalled()
        })
        
        // Edge case: verifies cluster missing during recalculation.
        it('should return null cluster if cluster not found during recalculation', async () => {
            const mockReportSave = vi.fn()
            
            const report = {
                _id: 'report-1',
                status: 'pending',
                clusterId: 'cluster-1',
                save: mockReportSave
            }
            HazardReport.findById.mockResolvedValue(report)
            
            // Cluster not found
            ReportCluster.findById.mockResolvedValue(null)
            evaluateWarningEscalation.mockResolvedValue(null)

            const result = await verifyHazardReport('report-1', 'officer-1')
            expect(result.cluster).toBeNull()
        })
    })

    // -------------------- FUNCTION: rejectHazardReport --------------------
    describe('rejectHazardReport', () => {
        // ==================== NEGATIVE TESTS ====================

        // Negative case: verifies missing report behaviour.
        it('should return null if report not found', async () => {
            HazardReport.findById.mockResolvedValue(null)
            const result = await rejectHazardReport('report-1', 'officer-1', 'reason')
            expect(result).toBeNull()
        })

        it('should reject if report is not pending', async () => {
            HazardReport.findById.mockResolvedValue({ status: 'rejected' })
            await expect(rejectHazardReport('report-1', 'officer-1', 'reason')).rejects.toThrow('Only pending hazard reports can be rejected')
        })

        // ==================== POSITIVE TESTS ====================

        // Positive case: verifies rejection reason trimming and cluster recalculation.
        it('should reject report and trigger cluster recalculation without escalation', async () => {
            const mockReportSave = vi.fn()
            const mockClusterSave = vi.fn()
            
            const report = {
                _id: 'report-1',
                status: 'pending',
                clusterId: 'cluster-1',
                save: mockReportSave
            }
            HazardReport.findById.mockResolvedValue(report)

            const cluster = {
                _id: 'cluster-1',
                reportIds: ['report-1'],
                save: mockClusterSave
            }
            ReportCluster.findById.mockResolvedValue(cluster)

            const mockActiveReports = [
                { capturedAt: new Date('2026-01-02') }
            ]
            const mockFindChain = {
                select: vi.fn().mockResolvedValue(mockActiveReports)
            }
            HazardReport.find.mockReturnValue(mockFindChain)

            calculateClusterPriority.mockReturnValue({
                priorityScore: 5.0,
                priorityLevel: 'medium'
            })

            const result = await rejectHazardReport('report-1', 'officer-1', '  invalid data  ')

            expect(report.status).toBe('rejected')
            expect(report.verification.rejectionReason).toBe('invalid data')
            expect(mockReportSave).toHaveBeenCalled()

            expect(mockClusterSave).toHaveBeenCalled()
            expect(result.report).toBe(report)
            expect(result.cluster).toBe(cluster)
            expect(evaluateWarningEscalation).not.toHaveBeenCalled()
        })

        // ==================== EDGE CASES ====================

        // Edge case: verifies handling of cluster recalculation failure.
        it('should gracefully handle cluster recalculation failure when rejecting', async () => {
            const report = { _id: 'r1', status: 'pending', clusterId: 'c1', save: vi.fn() }
            HazardReport.findById.mockResolvedValue(report)
            ReportCluster.findById.mockResolvedValue(null) // cluster not found during recalculation

            const result = await rejectHazardReport('r1', 'officer-1', 'fake')
            expect(result.cluster).toBeNull()
        })
    })
})
