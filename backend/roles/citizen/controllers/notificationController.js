import AlertNotification from '../../../models/AlertNotification.js'
import ReliefNotification from '../../../models/ReliefNotification.js'
import Warning from '../../../models/Warning.js'
import { getNearbyFacilities, getNearbyHazards } from '../services/nearbyHazardService.js'

export const listNotifications = async (req, res, next) => {
    try {
        const [warnings, relief] = await Promise.all([
            AlertNotification.find({ recipientId: req.user._id })
                .sort({ createdAt: -1 })
                .limit(100)
                .lean(),
            ReliefNotification.find({ recipientId: req.user._id })
                .sort({ createdAt: -1 })
                .limit(100)
                .lean()
        ])
        const notifications = [...warnings, ...relief]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 100)
        res.json({ success: true, notifications })
    } catch (error) {
        next(error)
    }
}

export const listRecentWarnings = async (req, res, next) => {
    try {
        const warnings = await Warning.find({
            status: { $in: ['issued', 'partially_issued', 'delivery_failed'] }
        })
            .select('title severity hazardType message actionSteps updates targetAreaIds issuedAt issuedBy resolvedAt resolvedBy createdBy createdAt status')
            .populate('targetAreaIds', 'name areaType geometry')
            .populate('updates.affectedAreaIds', 'name areaType')
            .populate('createdBy', 'name')
            .populate('issuedBy', 'name')
            .populate('resolvedBy', 'name')
            .sort({ issuedAt: -1, createdAt: -1 })
            .limit(5)
            .lean()
        res.json({ success: true, warnings })
    } catch (error) {
        next(error)
    }
}

export const getLatestCitizenWarning = async (req, res, next) => {
    try {
        const warning = await Warning.findOne({
            recipientIds: req.user._id,
            status: { $in: ['issued', 'partially_issued', 'delivery_failed'] }
        })
            .select('title severity hazardType message actionSteps updates targetAreaIds issuedAt issuedBy resolvedAt resolvedBy createdBy createdAt status')
            .populate('targetAreaIds', 'name areaType geometry')
            .populate('updates.affectedAreaIds', 'name areaType')
            .populate('createdBy', 'name')
            .populate('issuedBy', 'name')
            .populate('resolvedBy', 'name')
            .sort({ issuedAt: -1, createdAt: -1 })
            .lean()
        res.json({ success: true, warning })
    } catch (error) {
        next(error)
    }
}

export const nearbyHazards = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await getNearbyHazards(req.user, req.query.radiusKm || 5)) })
    } catch (error) {
        next(error)
    }
}

export const nearbyFacilities = async (req, res, next) => {
    try {
        const facilities = await getNearbyFacilities(req.user, req.query.radiusKm || 5)
        res.json({ success: true, facilities })
    } catch (error) {
        next(error)
    }
}

export const getWarningDetail = async (req, res, next) => {
    try {
        const warning = await Warning.findOne({
            _id: req.params.warningId,
            status: { $in: ['issued', 'partially_issued', 'delivery_failed'] }
        })
            .select('-recipientIds')
            .populate('targetAreaIds', 'name areaType geometry')
            .populate('updates.affectedAreaIds', 'name areaType geometry')
            .populate('updates.createdBy', 'name')
            .populate('createdBy', 'name')
            .populate('issuedBy', 'name')
            .populate('resolvedBy', 'name')
            .lean()
        if (!warning) {
            return res.status(404).json({
                success: false,
                message: 'Warning not found'
            })
        }
        res.json({ success: true, warning })
    } catch (error) {
        next(error)
    }
}

export const markNotificationRead = async (req, res, next) => {
    try {
        let notification = await AlertNotification.findOneAndUpdate(
            { _id: req.params.notificationId, recipientId: req.user._id },
            { $set: { readAt: new Date() } },
            { new: true }
        )
        if (!notification) {
            notification = await ReliefNotification.findOneAndUpdate(
                { _id: req.params.notificationId, recipientId: req.user._id },
                { $set: { readAt: new Date() } },
                { new: true }
            )
        }
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            })
        }
        res.json({ success: true, notification })
    } catch (error) {
        next(error)
    }
}
