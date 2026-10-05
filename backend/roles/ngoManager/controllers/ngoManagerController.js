import Warning from '../../../models/Warning.js'
import TargetArea from '../../../models/TargetArea.js'

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

        const warnings = await Warning.find(filter)
            .populate('targetAreaIds', 'name geometry')
            .populate('createdBy', 'name email')
            .sort({ createdAt: -1 })

        res.json({ success: true, warnings })
    } catch (error) {
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
        const images = (req.files || []).map(file => ({
            url: `/uploads/disasters/${file.filename}`,
            filename: file.filename
        }))

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

        const populatedWarning = await Warning.findById(warning._id)
            .populate('targetAreaIds', 'name geometry')
            .populate('createdBy', 'name email')

        res.status(201).json({ success: true, warning: populatedWarning })
    } catch (error) {
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

        // Only allow editing draft warnings
        if (warning.status !== 'draft') {
            return res.status(400).json({
                success: false,
                message: 'Only draft disasters can be edited'
            })
        }

        // Verify existing target areas if provided
        let validTargetAreaIds = []
        if (targetAreaIds && targetAreaIds.length > 0) {
            const areas = await TargetArea.find({ _id: { $in: targetAreaIds } })
            validTargetAreaIds = areas.map(a => a._id)
        }

        // Process uploaded images (add to existing images)
        let images = warning.images || []
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => ({
                url: `/uploads/disasters/${file.filename}`,
                filename: file.filename
            }))
            images = [...images, ...newImages]
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

        // Only allow deleting draft warnings
        if (warning.status !== 'draft') {
            return res.status(400).json({
                success: false,
                message: 'Only draft disasters can be deleted'
            })
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
