import { describe, it, expect, vi, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import HazardReport from '../../models/HazardReport.js'
import {
    getDutyOfficerReports,
    getDutyOfficerReportById,
    archiveDutyOfficerReport
} from '../../roles/dutyOfficer/services/dutyOfficerReportService.js'

// Mock the MongoDB model so this unit test does not require a real database.
vi.mock('../../models/HazardReport.js', () => ({
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

describe('Duty Officer Report Service', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // -------------------- FUNCTION: getDutyOfficerReports --------------------
    describe('getDutyOfficerReports', () => {
        // ==================== POSITIVE TESTS ====================
        
        // Positive case: verifies that active reports are retrieved successfully.
        it('should get active reports by default', async () => {
            const mockChain = {
                populate: vi.fn().mockReturnThis(),
                sort: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([{ _id: '1' }])
            }
            HazardReport.find.mockReturnValue(mockChain)

            const result = await getDutyOfficerReports()

            expect(HazardReport.find).toHaveBeenCalledWith({ archived: { $ne: true } })
            expect(mockChain.populate).toHaveBeenCalledWith('reporterId', 'name email')
            expect(mockChain.populate).toHaveBeenCalledWith('archive.archivedBy', 'name email')
            expect(mockChain.sort).toHaveBeenCalledWith({ submittedAt: -1 })
            expect(mockChain.lean).toHaveBeenCalled()
            expect(result).toEqual([{ _id: '1' }])
        })

        // Positive case: verifies that archived reports are retrieved when requested.
        it('should get archived reports when includeArchived is true', async () => {
            const mockChain = {
                populate: vi.fn().mockReturnThis(),
                sort: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([{ _id: '2' }])
            }
            HazardReport.find.mockReturnValue(mockChain)

            const result = await getDutyOfficerReports(true)

            expect(HazardReport.find).toHaveBeenCalledWith({ archived: true })
            expect(result).toEqual([{ _id: '2' }])
        })

        // ==================== EDGE CASES ====================
        
        // Edge case: verifies behaviour when no reports are available (missing reports).
        it('should return empty array if no active reports exist', async () => {
            const mockChain = {
                populate: vi.fn().mockReturnThis(),
                sort: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue([])
            }
            HazardReport.find.mockReturnValue(mockChain)

            const result = await getDutyOfficerReports()
            expect(result).toEqual([])
        })
    })

    // -------------------- FUNCTION: getDutyOfficerReportById ----------------
    describe('getDutyOfficerReportById', () => {
        // ==================== NEGATIVE TESTS ====================

        // Negative case: verifies that an invalid report ID is rejected.
        it('should reject invalid report ID', async () => {
            mongoose.isValidObjectId.mockReturnValue(false)

            await expect(getDutyOfficerReportById('invalid-id')).rejects.toThrow('Invalid hazard report ID')
            expect(mongoose.isValidObjectId).toHaveBeenCalledWith('invalid-id')
        })

        // Negative case: verifies that null is returned for missing reports.
        it('should return null if report not found', async () => {
            mongoose.isValidObjectId.mockReturnValue(true)
            const mockChain = {
                populate: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue(null)
            }
            HazardReport.findById.mockReturnValue(mockChain)

            const result = await getDutyOfficerReportById('valid-id')
            expect(result).toBeNull()
        })

        // ==================== POSITIVE TESTS ====================

        // Positive case: verifies that a report is retrieved successfully.
        it('should get report by ID successfully', async () => {
            mongoose.isValidObjectId.mockReturnValue(true)
            const mockChain = {
                populate: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue({ _id: 'valid-id' })
            }
            HazardReport.findById.mockReturnValue(mockChain)

            const result = await getDutyOfficerReportById('valid-id')

            expect(HazardReport.findById).toHaveBeenCalledWith('valid-id')
            expect(mockChain.populate).toHaveBeenCalledWith('reporterId', 'name email')
            expect(mockChain.populate).toHaveBeenCalledWith('clusterId')
            expect(mockChain.populate).toHaveBeenCalledWith('archive.archivedBy', 'name email')
            expect(mockChain.lean).toHaveBeenCalled()
            expect(result).toEqual({ _id: 'valid-id' })
        })
    })

    // -------------------- FUNCTION: archiveDutyOfficerReport ---------------
    describe('archiveDutyOfficerReport', () => {
        // ==================== NEGATIVE TESTS ====================

        // Negative case: verifies that an invalid report ID is rejected.
        it('should reject invalid report ID', async () => {
            mongoose.isValidObjectId.mockImplementation(id => id === 'officer-id')

            await expect(archiveDutyOfficerReport('invalid-id', 'officer-id')).rejects.toThrow('Invalid hazard report ID')
        })

        // Negative case: verifies that an invalid officer ID is rejected.
        it('should reject invalid officer ID', async () => {
            mongoose.isValidObjectId.mockImplementation(id => id === 'report-id')

            await expect(archiveDutyOfficerReport('report-id', 'invalid-officer')).rejects.toThrow('Invalid officer ID')
        })

        // Negative case: verifies that the service rejects if report not found (missing reports).
        it('should reject if report not found', async () => {
            mongoose.isValidObjectId.mockReturnValue(true)
            HazardReport.findById.mockResolvedValue(null)

            await expect(archiveDutyOfficerReport('report-id', 'officer-id')).rejects.toThrow('Hazard report not found')
        })

        // Negative case: verifies that already archived reports are rejected.
        it('should reject if report is already archived', async () => {
            mongoose.isValidObjectId.mockReturnValue(true)
            HazardReport.findById.mockResolvedValue({ archived: true })

            await expect(archiveDutyOfficerReport('report-id', 'officer-id')).rejects.toThrow('This report is already archived')
        })

        // Negative case: verifies that pending reports are rejected.
        it('should reject if report is pending', async () => {
            mongoose.isValidObjectId.mockReturnValue(true)
            HazardReport.findById.mockResolvedValue({ archived: false, status: 'pending' })

            await expect(archiveDutyOfficerReport('report-id', 'officer-id')).rejects.toThrow('Pending reports cannot be archived')
        })

        // Negative case: verifies that only verified/rejected reports can be archived.
        it('should reject if report status is not verified or rejected', async () => {
            mongoose.isValidObjectId.mockReturnValue(true)
            HazardReport.findById.mockResolvedValue({ archived: false, status: 'in_progress' })

            await expect(archiveDutyOfficerReport('report-id', 'officer-id')).rejects.toThrow('Only verified or rejected reports can be archived')
        })

        // ==================== POSITIVE TESTS ====================

        // Positive case: verifies that a verified report can be archived.
        it('should archive a verified report successfully', async () => {
            mongoose.isValidObjectId.mockReturnValue(true)
            const mockSave = vi.fn()
            const mockReport = {
                _id: 'report-id',
                archived: false,
                status: 'verified',
                save: mockSave
            }
            
            const mockChain = {
                populate: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue({ ...mockReport, archived: true })
            }
            
            HazardReport.findById.mockImplementation((id) => {
                if (mockSave.mock.calls.length === 0) return Promise.resolve(mockReport)
                return mockChain
            })

            const result = await archiveDutyOfficerReport('report-id', 'officer-id')

            expect(mockReport.archived).toBe(true)
            expect(mockReport.archive.archivedBy).toBe('officer-id')
            expect(mockReport.archive.archivedAt).toBeInstanceOf(Date)
            expect(mockSave).toHaveBeenCalled()
            expect(result.archived).toBe(true)
        })

        // Positive case: verifies that a rejected report can be archived.
        it('should archive a rejected report successfully', async () => {
            mongoose.isValidObjectId.mockReturnValue(true)
            const mockSave = vi.fn()
            const mockReport = {
                _id: 'report-id',
                archived: false,
                status: 'rejected',
                save: mockSave
            }
            
            const mockChain = {
                populate: vi.fn().mockReturnThis(),
                lean: vi.fn().mockResolvedValue({ ...mockReport, archived: true })
            }
            
            HazardReport.findById.mockImplementation((id) => {
                if (mockSave.mock.calls.length === 0) return Promise.resolve(mockReport)
                return mockChain
            })

            const result = await archiveDutyOfficerReport('report-id', 'officer-id')

            expect(mockReport.archived).toBe(true)
            expect(mockSave).toHaveBeenCalled()
            expect(result.archived).toBe(true)
        })

        // ==================== EDGE CASES ====================

        // Edge case: verifies database failure propagation.
        it('should propagate errors from database during save', async () => {
            mongoose.isValidObjectId.mockReturnValue(true)
            const mockReport = {
                _id: 'report-id',
                archived: false,
                status: 'verified',
                save: vi.fn().mockRejectedValue(new Error('DB connection failed'))
            }
            HazardReport.findById.mockResolvedValue(mockReport)

            await expect(archiveDutyOfficerReport('report-id', 'officer-id')).rejects.toThrow('DB connection failed')
        })
    })
})
