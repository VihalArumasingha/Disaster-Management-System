import mongoose from 'mongoose'
import User from '../../../models/User.js'
import TargetArea from '../../../models/TargetArea.js'
import ReportCluster from '../../../models/ReportCluster.js'
import Warning from '../../../models/Warning.js'
import WarningDelivery from '../../../models/WarningDelivery.js'
import { CITIZEN_ROLE_VALUES } from '../../../utils/citizenTargetAreas.js'
import {
    deliverWarningToCitizen,
    finalizeWarningDelivery
} from './warningDeliveryService.js'

const ALLOWED_HAZARDS = new Set([
    'flood',
    'landslide',
    'tsunami',
    'storm',
    'other'
])
const ALLOWED_SEVERITIES = new Set([
    'Low',
    'Medium',
    'High',
    'Critical',
    // Keep accepting values from warnings created before the shared model enum changed.
    'advisory',
    'watch',
    'warning',
    'emergency'
])

// Keep validation in one place so every warning entry point applies the same limits and accepted values.
const validateWarningData = async (data, requireActionSteps = false) => {
    const { title, severity, hazardType, message, targetAreaIds } = data
    // Older drafts may omit action steps, so default to an empty list and enforce non-empty steps only when requested.
    const actionSteps = data.actionSteps === undefined ? [] : data.actionSteps

    // Apply the same bounded input rules to create, edit, and recipient-preview requests.
    if (
        typeof title !== 'string'
        || !title.trim()
        || title.trim().length > 160
        || typeof message !== 'string'
        || !message.trim()
        || message.trim().length > 4000
    ) {
        const error = new Error('Enter a title and warning message')
        error.statusCode = 400
        throw error
    }
    if (!ALLOWED_SEVERITIES.has(severity)) {
        const error = new Error('Choose a valid warning severity')
        error.statusCode = 400
        throw error
    }
    if (!ALLOWED_HAZARDS.has(hazardType)) {
        const error = new Error('Choose a valid hazard type')
        error.statusCode = 400
        throw error
    }
    if (
        !Array.isArray(actionSteps)
        || actionSteps.length > 10
        || actionSteps.some((step) => (
            typeof step !== 'string'
            || !step.trim()
            || step.trim().length > 400
        ))
    ) {
        const error = new Error('Add up to 10 valid safety action steps')
        error.statusCode = 400
        throw error
    }
    // Creating or editing a draft requires at least one actionable instruction; previews do not need one.
    if (requireActionSteps && actionSteps.every((step) => !step.trim())) {
        const error = new Error('Add at least one action citizens should take')
        error.statusCode = 400
        throw error
    }
    if (
        !Array.isArray(targetAreaIds)
        || targetAreaIds.length === 0
        || targetAreaIds.length > 50
        || targetAreaIds.some((id) => !mongoose.isValidObjectId(id))
    ) {
        const error = new Error('Select between 1 and 50 valid target areas')
        error.statusCode = 400
        throw error
    }

    const uniqueAreaIds = [...new Set(targetAreaIds.map(String))]
    // Deduplicate IDs before querying so repeated selections do not inflate audience calculations.
    const areas = await TargetArea.find({ _id: { $in: uniqueAreaIds } })
        .select('citizenIds geometry')
    // Compare against distinct submitted IDs so a repeated ID is not mistaken for a missing database record.
    if (areas.length !== new Set(targetAreaIds.map(String)).size) {
        const error = new Error('One or more selected target areas do not exist')
        error.statusCode = 404
        throw error
    }

    const areaById = new Map(areas.map((area) => [String(area._id), area]))
    return {
        title: title.trim(),
        severity,
        hazardType,
        message: message.trim(),
        actionSteps: actionSteps.map((step) => step.trim()),
        targetAreaIds: uniqueAreaIds.map((id) => areaById.get(id)._id),
        areas
    }
}

const getCurrentRecipientsForAreas = async (areas) => {
    // Area membership is a quick source of recipients, but geometry keeps audience selection accurate as users move.
    const memberIds = [...new Set(areas.flatMap((area) => (
        Array.isArray(area.citizenIds) ? area.citizenIds.map(String) : []
    )))]
    const alternatives = []
    if (memberIds.length > 0) alternatives.push({ _id: { $in: memberIds } })
    // Combine saved membership with current geometry matches to include both assigned and newly eligible citizens.
    alternatives.push(...areas.map((area) => ({
        location: { $geoWithin: { $geometry: area.geometry } }
    })))

    if (alternatives.length === 0) return []
    // The role condition applies to both membership and spatial matches, excluding accounts that are no longer citizens.
    return User.find({
        role: { $in: CITIZEN_ROLE_VALUES },
        $or: alternatives
    }).select('_id name email phone')
}

const uniqueIds = (targetAreaIds = []) => [
    // Callers may pass either raw IDs or populated Mongoose references.
    ...new Set(targetAreaIds.map((area) => String(area?._id || area)))
]

// Limit the projection to fields needed to validate areas, find recipients, and build public warning responses.
const warningAreas = async (targetAreaIds = []) => TargetArea.find({
    _id: { $in: uniqueIds(targetAreaIds) }
}).select('name areaType hazardTypes geometry citizenIds')

const shapeWarningArea = (area) => ({
    // Send only fields needed by warning clients, not target-area membership internals.
    _id: area._id,
    name: area.name,
    areaType: area.areaType,
    hazardTypes: area.hazardTypes,
    geometry: area.geometry
})

const shapeWarning = async (warning) => {
    const targetAreaIds = uniqueIds(warning.targetAreaIds)
    const areas = await warningAreas(targetAreaIds)
    const recipients = await getCurrentRecipientsForAreas(areas)
    const rawWarning = warning.toObject()
    // Keep the persisted audience private; clients receive a current count instead of member IDs.
    delete rawWarning.recipientIds
    return {
        ...rawWarning,
        // Recompute the count from eligible users rather than exposing potentially stale stored recipient IDs.
        recipientCount: recipients.length,
        targetAreaIds: areas.map(shapeWarningArea)
    }
}

export const createWarning = async (data, officerId) => {
    const validated = await validateWarningData(data, true)
    const initialUpdateTitle = typeof data.initialUpdateTitle === 'string'
        ? data.initialUpdateTitle.trim()
        : ''
    const initialUpdateMessage = typeof data.initialUpdateMessage === 'string'
        ? data.initialUpdateMessage.trim()
        : ''
    if (
        !initialUpdateTitle
        || initialUpdateTitle.length > 120
        || !initialUpdateMessage
        || initialUpdateMessage.length > 2000
    ) {
        const error = new Error('Enter the initial update headline and details')
        error.statusCode = 400
        throw error
    }
    // Capture an initial audience for draft review; issuance recalculates it to account for later changes.
    const recipients = await getCurrentRecipientsForAreas(validated.areas)
    const warning = await Warning.create({
        title: validated.title,
        severity: validated.severity,
        hazardType: validated.hazardType,
        message: validated.message,
        actionSteps: validated.actionSteps,
        // DMC operational warnings should not appear as donation-page content.
        showOnDonationPage: false,
        targetAreaIds: validated.targetAreaIds,
        updates: [{
            // Start the audit timeline with the information supplied alongside the draft.
            title: initialUpdateTitle,
            message: initialUpdateMessage,
            type: 'update',
            createdBy: officerId,
            createdAt: new Date()
        }],
        // Store the draft audience for review; delivery itself is deferred until an officer issues the warning.
        recipientIds: recipients.map((recipient) => recipient._id),
        createdBy: officerId
    })
    return shapeWarning(warning)
}

export const updateWarning = async (warningId, data) => {
    // Draft-only edits prevent changing an active warning without creating an auditable update.
    const warning = await Warning.findOne({ _id: warningId, status: 'draft' })
    if (!warning) {
        const error = new Error('Only existing draft warnings can be edited')
        error.statusCode = 404
        throw error
    }
    const validated = await validateWarningData(data, true)
    // Rebuild the stored audience preview whenever target areas change on an editable draft.
    const recipients = await getCurrentRecipientsForAreas(validated.areas)
    // Replace draft fields as a unit so its area selection and preview audience reflect the same submitted version.
    warning.set({
        title: validated.title,
        severity: validated.severity,
        hazardType: validated.hazardType,
        message: validated.message,
        actionSteps: validated.actionSteps,
        targetAreaIds: validated.targetAreaIds,
        recipientIds: recipients.map((recipient) => recipient._id)
    })
    await warning.save()
    return shapeWarning(warning)
}

export const previewWarningRecipients = async (targetAreaIds) => {
    // Reuse normal validation so the preview count matches the audience rules used by warning creation.
    const validated = await validateWarningData({
        title: 'Preview',
        severity: 'warning',
        hazardType: 'other',
        message: 'Preview',
        targetAreaIds
    })
    // Use the same recipient resolver as create/issue so the UI preview reflects the actual audience rules.
    const recipients = await getCurrentRecipientsForAreas(validated.areas)
    return { recipientCount: recipients.length }
}

export const getWarningForReview = async (warningId) => {
    // Populate officer and area labels needed by review while avoiding a second client-side lookup.
    const warning = await Warning.findById(warningId)
        .populate('targetAreaIds', 'name areaType hazardTypes geometry')
        .populate('updates.affectedAreaIds', 'name')
        .populate('createdBy', 'name')
        .populate('issuedBy', 'name')
        .populate('resolvedBy', 'name')
    if (!warning) {
        const error = new Error('Warning not found')
        error.statusCode = 404
        throw error
    }
    const distinctTargetAreaIds = uniqueIds(warning.targetAreaIds)
    // Resolve areas again by ID so review output is consistent whether references were populated or stored as IDs.
    const areas = await warningAreas(distinctTargetAreaIds)
    const recipients = await getCurrentRecipientsForAreas(areas)
    const publicWarning = warning.toObject()
    // Review callers need audience totals for channel planning, not the private recipient ID list.
    delete publicWarning.recipientIds
    return {
        warning: {
            ...publicWarning,
            targetAreaIds: areas.map(shapeWarningArea),
            recipientCount: recipients.length
        },
        deliveryAudience: {
            // These counts help officers understand which channels can reach the audience before issuing.
            recipients: recipients.length,
            smsRecipients: recipients.filter((recipient) => recipient.phone).length,
            emailFallbackRecipients: recipients.filter((recipient) => recipient.email).length
        }
    }
}

export const postWarningUpdate = async (warningId, data, officerId) => {
    const title = typeof data.title === 'string' ? data.title.trim() : ''
    const message = typeof data.message === 'string' ? data.message.trim() : ''
    if (!title || title.length > 120 || !message || message.length > 2000) {
        const error = new Error('Enter an update title and details')
        error.statusCode = 400
        throw error
    }

    const warning = await Warning.findOne({
        _id: warningId,
        resolvedAt: null,
        status: { $in: ['issued', 'partially_issued', 'delivery_failed'] }
    })
    if (!warning) {
        const error = new Error('Only an issued warning can receive updates')
        error.statusCode = 404
        throw error
    }

    const nextSeverity = data.severity || warning.severity
    // If severity is omitted, preserve the current level; if supplied, reject unsupported values before mutation.
    if (!ALLOWED_SEVERITIES.has(nextSeverity)) {
        const error = new Error('Choose a valid warning severity')
        error.statusCode = 400
        throw error
    }

    const requestedAreaIds = data.targetAreaIds === undefined ? [] : data.targetAreaIds
    // Updates may omit affected areas; when supplied, validate the entire list before changing warning state.
    if (
        !Array.isArray(requestedAreaIds)
        || requestedAreaIds.length > 50
        || requestedAreaIds.some((id) => !mongoose.isValidObjectId(id))
    ) {
        const error = new Error('Choose valid affected areas')
        error.statusCode = 400
        throw error
    }
    const currentAreaIds = new Set(uniqueIds(warning.targetAreaIds))
    // Only newly added areas can introduce recipients; existing audience members must not get duplicate alerts.
    const addedAreaIds = [...new Set(requestedAreaIds.map(String))]
        .filter((id) => !currentAreaIds.has(id))
    const addedAreas = addedAreaIds.length
        ? await TargetArea.find({ _id: { $in: addedAreaIds } }).select('name geometry citizenIds')
        : []
    // Treat deleted or invalid area references as a request error instead of silently issuing to a partial audience.
    if (addedAreas.length !== addedAreaIds.length) {
        const error = new Error('One or more selected target areas do not exist')
        error.statusCode = 404
        throw error
    }

    // Classify the update for the timeline so clients can distinguish escalation, area expansion, and routine notes.
    const severityChanged = nextSeverity !== warning.severity
    const type = severityChanged ? 'severity' : addedAreas.length ? 'area' : 'update'
    warning.severity = nextSeverity
    warning.targetAreaIds.push(...addedAreas.map((area) => area._id))
    warning.updates.push({
        title,
        message,
        type,
        severity: severityChanged ? nextSeverity : null,
        affectedAreaIds: addedAreas.map((area) => area._id),
        createdBy: officerId,
        createdAt: new Date()
    })

    // New areas can add people to the audience; severity-only and text-only updates keep the existing audience.
    const newRecipients = addedAreas.length
        ? await getCurrentRecipientsForAreas(addedAreas)
        : []
    const existingRecipients = new Set(uniqueIds(warning.recipientIds))
    // A citizen may lie in multiple selected areas; alert only those not already recorded on this warning.
    const newlyAffected = newRecipients.filter((recipient) => (
        !existingRecipients.has(String(recipient._id))
    ))
    warning.recipientIds.push(...newlyAffected.map((recipient) => recipient._id))
    await warning.save()

    if (newlyAffected.length > 0) {
        const updateWarning = {
            ...warning.toObject(),
            title: `${warning.title}: ${title}`,
            message
        }
        // Do not hold the HTTP request open while notifications are sent to newly covered citizens.
        setImmediate(() => {
            deliverWarningToRecipients(updateWarning, newlyAffected).catch((error) => {
                console.error(`Warning update delivery failed for ${warning._id}: ${error.message}`)
            })
        })
    }

    return getWarningForReview(warningId)
}

export const issueWarning = async (warningId, officerId) => {
    // Claim the draft atomically so concurrent requests cannot start duplicate delivery jobs.
    const warning = await Warning.findOneAndUpdate(
        {
            _id: warningId,
            resolvedAt: null,
            status: { $in: ['draft', 'partially_issued', 'delivery_failed'] }
        },
        { $set: { status: 'issuing' } },
        { new: true }
    )
    if (!warning) {
        // Distinguish a duplicate concurrent issue (409) from a missing warning (404) for actionable callers.
        const existing = await Warning.findById(warningId).select('status')
        const error = new Error(
            existing?.status === 'issuing'
                ? 'This warning is already being issued'
                : 'This warning is already issued or does not exist'
        )
        error.statusCode = existing ? 409 : 404
        throw error
    }

    try {
        // Recompute the audience at issue time because citizen roles and locations may have changed since drafting.
        const areas = await warningAreas(uniqueIds(warning.targetAreaIds))
        const recipients = await getCurrentRecipientsForAreas(areas)
        if (recipients.length === 0) {
            // Restore draft state because no delivery job will run for an empty audience.
            warning.status = 'draft'
            await warning.save()
            const error = new Error('There are no current citizen-role users in the selected target areas')
            error.statusCode = 400
            throw error
        }
        warning.recipientIds = recipients.map((recipient) => recipient._id)
        // Reset delivery totals for this issue attempt; previous partial attempts must not be mixed with new results.
        warning.deliverySummary = {
            // Initialize every counter so clients see a stable summary before asynchronous delivery completes.
            recipients: recipients.length,
            inAppSent: 0,
            smsQueued: 0,
            smsDispatched: 0,
            smsSent: 0,
            smsDelivered: 0,
            smsFailed: 0,
            smsUnknown: 0,
            emailFallbackSent: 0,
            emailFallbackFailed: 0,
            failedRecipients: 0,
            failureDetails: []
        }
        warning.issuedBy = officerId
        // Save issuance ownership and audience before scheduling the worker so the response reflects accepted work.
        await warning.save()

        setImmediate(() => {
            // Delivery runs after the issue response; finalizeWarningDelivery records outcomes when workers finish.
            deliverWarningToRecipients(warning, recipients).catch(async (error) => {
                console.error(`Warning delivery worker failed for ${warning._id}: ${error.message}`)
                // Only alter a warning still marked as issuing; a completed finalizer may already have set its status.
                await Warning.updateOne(
                    { _id: warning._id, status: 'issuing' },
                    { $set: { status: 'delivery_failed' } }
                )
            })
        })

        return {
            warning: {
                _id: warning._id,
                status: warning.status,
                issuedAt: warning.issuedAt
            },
            deliverySummary: warning.deliverySummary
        }
    } catch (error) {
        // If setup failed after the atomic claim, do not leave the warning stuck in the transient issuing state.
        if (warning.status === 'issuing') {
            warning.status = 'delivery_failed'
            await warning.save()
        }
        throw error
    }
}

export const resolveWarning = async (warningId, officerId) => {
    const resolvedAt = new Date()
    // The status and unresolved checks prevent drafts or already-resolved warnings from being closed.
    const warning = await Warning.findOneAndUpdate(
        {
            _id: warningId,
            resolvedAt: null,
            status: { $in: ['issued', 'partially_issued', 'delivery_failed'] }
        },
        {
            $set: { resolvedAt, resolvedBy: officerId },
            // Resolution is part of the same atomic update so the status timestamp and audit history cannot diverge.
            $push: {
                updates: {
                    title: 'Warning resolved',
                    message: 'A DMC officer has marked this warning as resolved.',
                    type: 'resolved',
                    createdBy: officerId,
                    createdAt: resolvedAt
                }
            }
        },
        { new: true }
    )
    if (!warning) {
        // A follow-up read distinguishes a missing ID from a valid warning in a state that cannot be resolved.
        const existing = await Warning.findById(warningId).select('resolvedAt status')
        const error = new Error(
            existing?.resolvedAt
                ? 'This warning has already been resolved'
                : 'Only an issued warning can be resolved'
        )
        error.statusCode = existing ? 409 : 404
        throw error
    }
    return getWarningForReview(warningId)
}

const deliverWarningToRecipients = async (warning, recipients) => {
    let nextIndex = 0
    // Bound parallel provider requests to protect the service while still delivering large audiences promptly.
    const workerCount = Math.min(8, recipients.length)
    // Workers share an index to distribute recipients without launching one promise per citizen at once.
    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < recipients.length) {
            const recipient = recipients[nextIndex]
            nextIndex += 1
            try {
                await deliverWarningToCitizen(warning, recipient)
            } catch (error) {
                // One citizen's provider or persistence failure should not prevent attempts for the rest of the audience.
                console.error(`Warning delivery failed for recipient ${recipient._id}: ${error.message}`)
            }
        }
    }))
    // Finalization reads persisted channel outcomes after all this batch's delivery attempts have settled.
    await finalizeWarningDelivery(warning._id)
}

export const listWarnings = async () => {
    // Select only list-view fields and populate display labels to avoid exposing full documents.
    const warnings = await Warning.find()
        .select('title severity hazardType message targetAreaIds recipientIds status issuedAt issuedBy resolvedAt resolvedBy deliverySummary createdBy createdAt updatedAt')
        .populate('targetAreaIds', 'name areaType')
        .populate('createdBy', 'name')
        .populate('issuedBy', 'name')
        .populate('resolvedBy', 'name')
        .sort({ createdAt: -1 })
        .lean()

    const recipientIds = uniqueIds(warnings.flatMap((warning) => warning.recipientIds))
    const currentCitizenIds = recipientIds.length > 0
        // A stored recipient may since have been deleted or changed roles; count only currently eligible citizens.
        ? await User.find({
            _id: { $in: recipientIds },
            role: { $in: CITIZEN_ROLE_VALUES }
        }).distinct('_id')
        : []
    const currentCitizenIdSet = new Set(currentCitizenIds.map(String))

    // Remove the stored recipient list from each response and derive a safe, up-to-date count instead.
    return warnings.map((warning) => {
        const { recipientIds = [], ...publicWarning } = warning
        return {
            ...publicWarning,
            recipientCount: recipientIds.filter((id) => (
                currentCitizenIdSet.has(String(id))
            )).length
        }
    })
}

export const getOverview = async () => {
    // Independent dashboard totals run concurrently to reduce the aggregate response wait time.
    const [targetAreas, warnings, citizens, escalatedReports] = await Promise.all([
        TargetArea.countDocuments(),
        Warning.countDocuments(),
        User.countDocuments({ role: { $in: CITIZEN_ROLE_VALUES } }),
        ReportCluster.countDocuments({ status: 'active' })
    ])

    return { targetAreas, warnings, citizens, escalatedReports }
}