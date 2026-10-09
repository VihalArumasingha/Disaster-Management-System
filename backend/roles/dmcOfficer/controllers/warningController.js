import {
    createWarning,
    getWarningForReview,
    issueWarning,
    listWarnings,
    previewWarningRecipients,
    postWarningUpdate,
    updateWarning,
    resolveWarning
} from '../services/warningManagementService.js'

export const warnings = async (req, res, next) => {
    try {
        const startedAt = Date.now()
        const warningList = await listWarnings()
        const durationMs = Date.now() - startedAt
        // Expose query timing for monitoring and flag slow reads without changing the warning-list response.
        res.set('Server-Timing', `warning-list;dur=${durationMs}`)
        if (durationMs > 1500) {
            console.warn(`Warning list query took ${durationMs}ms`)
        }
        res.json({ success: true, warnings: warningList })
    } catch (error) {
        next(error)
    }
}

export const saveWarning = async (req, res, next) => {
    try {
        // Attribute authorship to the authenticated officer and return 201 for the newly created resource.
        const warning = await createWarning(req.body, req.user._id)
        res.status(201).json({ success: true, warning })
    } catch (error) {
        next(error)
    }
}

export const editWarning = async (req, res, next) => {
    try {
        // The service enforces draft-only editing; the controller passes the route ID and submitted fields through.
        const warning = await updateWarning(req.params.warningId, req.body)
        res.json({ success: true, warning })
    } catch (error) {
        next(error)
    }
}

export const addWarningUpdate = async (req, res, next) => {
    try {
        // Updates are attributed to the current officer for the warning timeline.
        res.json({
            success: true,
            ...(await postWarningUpdate(req.params.warningId, req.body, req.user._id))
        })
    } catch (error) {
        next(error)
    }
}

export const reviewWarning = async (req, res, next) => {
    try {
        res.json({ success: true, ...(await getWarningForReview(req.params.warningId)) })
    } catch (error) {
        next(error)
    }
}

export const issueWarningNow = async (req, res, next) => {
    try {
        // Issuance queues delivery work, so 202 indicates acceptance rather than completed delivery.
        const result = await issueWarning(req.params.warningId, req.user._id)
        res.status(202).json({ success: true, ...result })
    } catch (error) {
        next(error)
    }
}

export const resolveWarningNow = async (req, res, next) => {
    try {
        const result = await resolveWarning(req.params.warningId, req.user._id)
        res.json({ success: true, ...result })
    } catch (error) {
        next(error)
    }
}

export const warningRecipientPreview = async (req, res, next) => {
    try {
        // Forward only the selected area IDs; the service resolves and counts eligible citizens.
        const preview = await previewWarningRecipients(req.body.targetAreaIds)
        res.json({ success: true, ...preview })
    } catch (error) {
        next(error)
    }
}
