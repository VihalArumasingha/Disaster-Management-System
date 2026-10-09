import Warning from '../../../models/Warning.js'
import TargetArea from '../../../models/TargetArea.js'
import CollectingCenter from '../../../models/CollectingCenter.js'
import DistributionOperation from '../../../models/DistributionOperation.js'
import HazardEscalation from '../../../models/HazardEscalation.js'
import HazardReport from '../../../models/HazardReport.js'
import Volunteer from '../../../models/Volunteer.js'
import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'
import path from 'path'

/**
 * GET /api/ngomanager/approved-disasters
 * Returns ALL hazard escalations (Duty Officer verified, any status)
 * PLUS all DMC Officer warnings/disasters (already approved/issued).
 * Used by Assign Relief Teams page — emergency/critical first.
 */
export const getApprovedDisasters = async (req, res, next) => {
    try {
        const escalations = await HazardEscalation.find({})
            .populate('clusterId')
            .populate({
                path: 'verifiedReportIds',
                select: 'hazardType description location capturedAt submittedAt status photo reporterId clusterId',
                populate: { path: 'reporterId', select: 'name email phone' }
            })
            .populate('escalatedBy', 'name email role')
            .populate('dutyOfficer', 'name email role')
            .sort({ priorityScore: -1, escalatedAt: -1 })
            .lean()

        const warnings = await Warning.find({})
            .populate('createdBy', 'name email role')
            .populate('issuedBy', 'name email role')
            .populate('targetAreaIds', 'name')
            .sort({ createdAt: -1 })
            .lean()

        // Map DMC warnings to the same row shape as escalations
        const dmcRecords = warnings.map((w) => {
            const severity = String(w.severity || 'Medium')
            const hasEmergencyUpdate = Array.isArray(w.updates) && w.updates.some(
                (u) => String(u?.severity || '').toLowerCase() === 'emergency'
            )
            return {
                _id: `warning-${w._id}`,
                source: 'dmc_warning',
                sourceLabel: 'DMC Warning',
                hazardType: w.hazardType,
                title: w.title,
                city: w.city,
                priorityLevel: severity.toLowerCase(),
                severity,
                priorityScore: null,
                isEmergency: severity.toLowerCase() === 'critical' || hasEmergencyUpdate,
                clusterId: null,
                warningLocation: w.city || (w.manualTargetAreas || []).join(', ') || '—',
                verifiedReportCount: null,
                verifiedReportIds: [],
                escalatedBy: w.createdBy || null,
                dutyOfficer: w.issuedBy || null,
                reviewNote: w.summary || w.message || '',
                reviewedAt: w.issuedAt || w.createdAt,
                escalatedAt: w.createdAt,
                status: w.status === 'issued' ? 'approved' : w.status,
                warningStatus: w.status,
                active: w.active
            }
        })

        const verifiedReports = await HazardReport.find({ status: 'verified' })
            .populate('reporterId', 'name email phone')
            .populate('clusterId')
            .sort({ submittedAt: -1 })
            .lean()

        const individualReports = verifiedReports.map((r) => {
            const coords = r?.location?.coordinates
            const loc = Array.isArray(coords) && coords.length === 2
                ? `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}`
                : 'Unknown location'
            return {
                _id: `report-${r._id}`,
                source: 'verified_report',
                sourceLabel: 'Citizen Verified Report',
                hazardType: r.hazardType,
                title: '',
                city: loc,
                priorityLevel: 'verified',
                severity: 'Verified',
                priorityScore: null,
                isEmergency: false,
                clusterId: r.clusterId || null,
                warningLocation: loc,
                verifiedReportCount: 1,
                verifiedReportIds: [r],
                escalatedBy: r.reporterId || null,
                dutyOfficer: null,
                reviewNote: r.description || '',
                reviewedAt: r.submittedAt,
                escalatedAt: r.submittedAt,
                capturedAt: r.capturedAt,
                status: 'verified',
                photo: r.photo || null
            }
        })

        res.json({ success: true, escalations, warnings: dmcRecords, verifiedReports: individualReports })
    } catch (error) {
        next(error)
    }
}
/**
 * GET /api/ngomanager/verified-hazard-reports
 * Verified hazardreports ONLY (status === 'verified', not archived),
 * each with reporter + cluster priority (risk level).
 */
export const getVerifiedHazardReports = async (req, res, next) => {
    try {
        const reports = await HazardReport.find({ status: 'verified', archived: { $ne: true } })
            .populate('reporterId', 'name email phone')
            .populate('clusterId', 'hazardType priorityLevel priorityScore district')
            .populate('verification.verifiedBy', 'name email role')
            .sort({ submittedAt: -1 })
            .lean()
        res.json({ success: true, count: reports.length, reports })
    } catch (error) {
        next(error)
    }
}


export const getDisasters = async (req, res, next) => {
    try {
        const { severity, hazardType, status, q } = req.query

        const filter = {}

        if (severity) filter.severity = severity
        if (hazardType) filter.hazardType = hazardType
        if (status) filter.status = status
        if (q) {
            filter.$or = [
                { title: { $regex: q, $options: 'i' } },
                { message: { $regex: q, $options: 'i' } }
            ]
        }

        console.log('Fetching disasters with filter:', filter)
        // NGO "Active Disasters" page shows EVERY unresolved DB record
        // (drafts included — NGO-created records start as drafts).
        // Only resolved ones (resolvedAt set) are hidden. An explicit
        // ?status= still narrows (filter dropdown / tests).
        if (!status) {
            filter.resolvedAt = null
        }
        const warnings = await Warning.find(filter)
            .populate('targetAreaIds', 'name geometry')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })

        console.log('Found warnings:', warnings.length)
        res.json({ success: true, warnings })
    } catch (error) {
        console.error('Error in getDisasters:', error)
        next(error)
    }
}

export const getDisasterById = async (req, res, next) => {
    try {
        const warning = await Warning.findById(req.params.disasterId)
            .populate('targetAreaIds', 'name geometry')
            .populate('createdBy', 'name email')
            .populate('issuedBy', 'name email')

        if (!warning) {
            return res.status(404).json({
                success: false,
                message: 'Disaster not found'
            })
        }

        res.json({ success: true, warning })
    } catch (error) {
        next(error)
    }
}

export const createDisaster = async (req, res, next) => {
    try {
        console.log('=== CREATE DISASTER START ===')
        console.log('Request body:', req.body)
        console.log('Request files:', req.files)

        const {
            title,
            city,
            summary,
            topNeeds,
            accentColor,
            severity,
            active,
            showOnDonationPage,
            hazardType,
            message,
            actionSteps,
            targetAreaIds,
            manualTargetAreas
        } = req.body

        if (!title || !city || !summary || !topNeeds) {
            return res.status(400).json({
                success: false,
                message: 'Title, city, summary, and top needs are required'
            })
        }

        // Verify existing target areas if provided
        let validTargetAreaIds = []
        if (targetAreaIds && targetAreaIds.length > 0) {
            const areas = await TargetArea.find({ _id: { $in: targetAreaIds } })
            validTargetAreaIds = areas.map(a => a._id)
        }

        // Process uploaded images
        console.log('Uploaded files:', req.files ? req.files.length : 0)
        const images = (req.files || []).map(file => ({
            url: file.path,
            public_id: file.filename
        }))
        console.log('Image metadata to save:', images)

        const warning = await Warning.create({
            title,
            city,
            summary,
            topNeeds,
            accentColor: accentColor || '#16a34a',
            severity: severity || 'Medium',
            active: active !== undefined ? active : true,
            showOnDonationPage: showOnDonationPage !== undefined ? showOnDonationPage : true,
            hazardType: hazardType || 'other',
            message: message || '',
            actionSteps: actionSteps || [],
            targetAreaIds: validTargetAreaIds,
            manualTargetAreas: manualTargetAreas || [],
            images,
            createdBy: req.user._id,
            status: 'draft'
        })

        console.log('Disaster saved to MongoDB with ID:', warning._id)
        console.log('Images in saved document:', warning.images)

        const populatedWarning = await Warning.findById(warning._id)
            .populate('targetAreaIds', 'name geometry')
            .populate('createdBy', 'name email')

        res.status(201).json({ success: true, warning: populatedWarning })
    } catch (error) {
        console.error('=== CREATE DISASTER ERROR ===')
        console.error('Error name:', error.name)
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
        next(error)
    }
}

export const updateDisaster = async (req, res, next) => {
    try {
        const {
            title,
            city,
            summary,
            topNeeds,
            accentColor,
            severity,
            active,
            showOnDonationPage,
            hazardType,
            message,
            actionSteps,
            targetAreaIds,
            manualTargetAreas
        } = req.body

        const warning = await Warning.findById(req.params.disasterId)

        if (!warning) {
            return res.status(404).json({
                success: false,
                message: 'Disaster not found'
            })
        }

        // Saved (issued/active) disasters are editable. Only resolved
        // disasters are locked — the old draft-only rule blocked every
        // DB-saved active disaster from being edited.
        if (warning.resolvedAt || warning.status === 'resolved') {
            return res.status(400).json({
                success: false,
                message: 'Resolved disasters can no longer be edited'
            })
        }

        // Verify existing target areas if provided
        let validTargetAreaIds = []
        if (targetAreaIds && targetAreaIds.length > 0) {
            const areas = await TargetArea.find({ _id: { $in: targetAreaIds } })
            validTargetAreaIds = areas.map(a => a._id)
        }

        // Process uploaded images (add to existing images)
        console.log('Update - Uploaded files:', req.files ? req.files.length : 0)
        let images = warning.images || []
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => ({
                url: file.path,
                public_id: file.filename
            }))
            images = [...images, ...newImages]
            console.log('Updated image metadata:', images)
        }

        const updates = {}
        if (title !== undefined) updates.title = title
        if (city !== undefined) updates.city = city
        if (summary !== undefined) updates.summary = summary
        if (topNeeds !== undefined) updates.topNeeds = topNeeds
        if (accentColor !== undefined) updates.accentColor = accentColor
        if (severity !== undefined) updates.severity = severity
        if (active !== undefined) updates.active = active
        if (showOnDonationPage !== undefined) updates.showOnDonationPage = showOnDonationPage
        if (hazardType !== undefined) updates.hazardType = hazardType
        if (message !== undefined) updates.message = message
        if (actionSteps !== undefined) updates.actionSteps = actionSteps
        if (targetAreaIds !== undefined) updates.targetAreaIds = validTargetAreaIds
        if (manualTargetAreas !== undefined) updates.manualTargetAreas = manualTargetAreas
        if (req.files && req.files.length > 0) updates.images = images

        const updatedWarning = await Warning.findByIdAndUpdate(
            req.params.disasterId,
            updates,
            { new: true }
        )
            .populate('targetAreaIds', 'name geometry')
            .populate('createdBy', 'name email')

        res.json({ success: true, warning: updatedWarning })
    } catch (error) {
        next(error)
    }
}

export const deleteDisaster = async (req, res, next) => {
    try {
        const warning = await Warning.findById(req.params.disasterId)

        if (!warning) {
            return res.status(404).json({
                success: false,
                message: 'Disaster not found'
            })
        }

        // Delete images from Cloudinary
        if (warning.images && warning.images.length > 0) {
            const publicIds = warning.images.map(img => img.public_id).filter(Boolean)
            if (publicIds.length > 0) {
                try {
                    await cloudinary.api.delete_resources(publicIds)
                    console.log(`Deleted ${publicIds.length} images from Cloudinary`)
                } catch (cloudErr) {
                    console.error('Failed to delete images from Cloudinary:', cloudErr.message)
                }
            }
        }

        await Warning.findByIdAndDelete(req.params.disasterId)

        res.json({ success: true, message: 'Disaster deleted successfully' })
    } catch (error) {
        next(error)
    }
}

export const getTargetAreas = async (req, res, next) => {
    try {
        const areas = await TargetArea.find().sort({ name: 1 })
        res.json({ success: true, targetAreas: areas })
    } catch (error) {
        next(error)
    }
}

export const getOverviewMetrics = async (req, res, next) => {
    try {
        // Get collection centers count
        const totalCollectionCenters = await CollectingCenter.countDocuments()

        // Get operations counts by status
        const operationsInProgress = await DistributionOperation.countDocuments({ status: 'ACTIVE' })
        const operationsCompleted = await DistributionOperation.countDocuments({ status: 'COMPLETED' })
        const operationsPending = await DistributionOperation.countDocuments({ status: 'PENDING' })

        // Get volunteer counts
        const totalRegisteredVolunteers = await Volunteer.countDocuments()
        const totalAssignedVolunteers = await Volunteer.countDocuments({ 'assignment.status': 'ASSIGNED' })

        // Get top 5 operations by volunteer need
        const topOperations = await DistributionOperation.find()
            .sort({ requiredVolunteers: -1 })
            .limit(5)
            .select('name requiredVolunteers status location')

        // Get volunteer type breakdown
        const individualVolunteers = await Volunteer.countDocuments({ volunteerType: 'individual' })
        const teamVolunteers = await Volunteer.countDocuments({ volunteerType: 'team' })
        const totalVolunteers = individualVolunteers + teamVolunteers

        // Get collection center categories distribution
        const centers = await CollectingCenter.find()
        const categoryDistribution = {
            Food: 0,
            Medical: 0,
            Clothing: 0,
            Shelter: 0,
            Water: 0
        }

        centers.forEach(center => {
            const categories = Array.isArray(center?.categories) ? center.categories : []
            categories.forEach(category => {
                if (categoryDistribution.hasOwnProperty(category)) {
                    categoryDistribution[category]++
                }
            })
        })

        res.json({
            success: true,
            metrics: {
                totalCollectionCenters,
                operationsInProgress,
                operationsCompleted,
                operationsPending,
                totalRegisteredVolunteers,
                totalAssignedVolunteers,
                topOperations,
                volunteerTypeBreakdown: {
                    individuals: individualVolunteers,
                    teamLeads: teamVolunteers,
                    total: totalVolunteers
                },
                categoryDistribution
            }
        })
    } catch (error) {
        console.error('Error in getOverviewMetrics:', error)
        next(error)
    }
}
