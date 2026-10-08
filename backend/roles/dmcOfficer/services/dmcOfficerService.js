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

const ALLOWED_AREA_TYPES = new Set([
    'river-flood',
    'coastal',
    'landslide',
    'storm',
    'tsunami',
    'other'
])
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
const MAX_POLYGON_VERTICES = 500
const pointOnSegment = ([x, y], [x1, y1], [x2, y2]) => (
    Math.abs((x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)) < 1e-10
    && x >= Math.min(x1, x2)
    && x <= Math.max(x1, x2)
    && y >= Math.min(y1, y2)
    && y <= Math.max(y1, y2)
)

const orientation = ([x1, y1], [x2, y2], [x3, y3]) => (
    (y2 - y1) * (x3 - x2) - (x2 - x1) * (y3 - y2)
)

const segmentsIntersect = (firstStart, firstEnd, secondStart, secondEnd) => {
    const firstOrientation = orientation(firstStart, firstEnd, secondStart)
    const secondOrientation = orientation(firstStart, firstEnd, secondEnd)
    const thirdOrientation = orientation(secondStart, secondEnd, firstStart)
    const fourthOrientation = orientation(secondStart, secondEnd, firstEnd)

    if (
        firstOrientation * secondOrientation < 0
        && thirdOrientation * fourthOrientation < 0
    ) {
        return true
    }

    return (
        pointOnSegment(secondStart, firstStart, firstEnd)
        || pointOnSegment(secondEnd, firstStart, firstEnd)
        || pointOnSegment(firstStart, secondStart, secondEnd)
        || pointOnSegment(firstEnd, secondStart, secondEnd)
    )
}

export const validatePolygonGeometry = (geometry) => {
    if (
        !geometry
        || geometry.type !== 'Polygon'
        || !Array.isArray(geometry.coordinates)
        || geometry.coordinates.length !== 1
    ) {
        return false
    }

    const [ring] = geometry.coordinates
    if (
        !Array.isArray(ring)
        || ring.length < 4
        || ring.length > MAX_POLYGON_VERTICES + 1
    ) {
        return false
    }

    const validCoordinates = ring.every((coordinate) => (
        Array.isArray(coordinate)
        && coordinate.length === 2
        && Number.isFinite(coordinate[0])
        && coordinate[0] >= -180
        && coordinate[0] <= 180
        && Number.isFinite(coordinate[1])
        && coordinate[1] >= -90
        && coordinate[1] <= 90
    ))
    if (!validCoordinates) return false

    const first = ring[0]
    const last = ring[ring.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) return false

    const openRing = ring.slice(0, -1)
    const distinctVertices = new Set(
        openRing.map(([longitude, latitude]) => `${longitude},${latitude}`)
    )
    if (distinctVertices.size < 3) return false
    if (openRing.some((point, index) => (
        index > 0
        && point[0] === openRing[index - 1][0]
        && point[1] === openRing[index - 1][1]
    ))) {
        return false
    }

    const twiceArea = openRing.reduce((area, [longitude, latitude], index) => {
        const next = openRing[(index + 1) % openRing.length]
        return area + longitude * next[1] - next[0] * latitude
    }, 0)
    if (Math.abs(twiceArea) < 1e-12) return false

    const segmentCount = ring.length - 1
    for (let firstIndex = 0; firstIndex < segmentCount; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < segmentCount; secondIndex += 1) {
            const adjacent = secondIndex === firstIndex + 1
                || (firstIndex === 0 && secondIndex === segmentCount - 1)
            if (adjacent) continue

            if (
                segmentsIntersect(
                    ring[firstIndex],
                    ring[firstIndex + 1],
                    ring[secondIndex],
                    ring[secondIndex + 1]
                )
            ) {
                return false
            }
        }
    }

    return true
}

const validateTargetArea = ({ name, areaType, hazardTypes, geometry }) => {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
        const error = new Error('Area name is required and must be 120 characters or fewer')
        error.statusCode = 400
        throw error
    }

    if (!ALLOWED_AREA_TYPES.has(areaType)) {
        const error = new Error('Choose a valid target area type')
        error.statusCode = 400
        throw error
    }

    if (
        !Array.isArray(hazardTypes)
        || hazardTypes.length === 0
        || hazardTypes.some((hazard) => !ALLOWED_HAZARDS.has(hazard))
    ) {
        const error = new Error('Select at least one valid hazard type')
        error.statusCode = 400
        throw error
    }

    if (!validatePolygonGeometry(geometry)) {
        const error = new Error('Draw a valid polygon with at least three distinct points')
        error.statusCode = 400
        throw error
    }
}

const citizenQueryForGeometry = (geometry) => ({
    role: { $in: CITIZEN_ROLE_VALUES },
    location: { $geoWithin: { $geometry: geometry } }
})

const getCurrentCitizenIds = async (citizenIds) => {
    if (citizenIds.length === 0) return []

    return User.find({
        _id: { $in: citizenIds },
        role: { $in: CITIZEN_ROLE_VALUES }
    }).distinct('_id')
}

const shapeTargetArea = async (area) => {
    const { citizenIds, ...publicArea } = area.toObject()
    return {
        ...publicArea,
        citizenCount: (await getCurrentCitizenIds(citizenIds)).length
    }
}

export const previewTargetArea = async (geometry) => {
    if (!validatePolygonGeometry(geometry)) {
        const error = new Error('Draw a valid polygon with at least three distinct points')
        error.statusCode = 400
        throw error
    }

    return {
        citizenCount: await User.countDocuments(citizenQueryForGeometry(geometry))
    }
}

export const createTargetArea = async (data, officerId) => {
    validateTargetArea(data)

    const citizenIds = await User.find(citizenQueryForGeometry(data.geometry))
        .distinct('_id')
    const area = await TargetArea.create({
        name: data.name.trim(),
        areaType: data.areaType,
        hazardTypes: [...new Set(data.hazardTypes)],
        description: typeof data.description === 'string'
            ? data.description.trim().slice(0, 2000)
            : '',
        geometry: data.geometry,
        citizenIds,
        createdBy: officerId
    })

    return {
        ...area.toObject(),
        citizenCount: citizenIds.length
    }
}

export const listTargetAreas = async () => {
    const areas = await TargetArea.find()
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })

    return Promise.all(areas.map(shapeTargetArea))
}

const validateWarningData = async (data, requireActionSteps = false) => {
    const { title, severity, hazardType, message, targetAreaIds } = data
    const actionSteps = data.actionSteps === undefined ? [] : data.actionSteps

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
    const areas = await TargetArea.find({ _id: { $in: uniqueAreaIds } })
        .select('citizenIds geometry')
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
    const memberIds = [...new Set(areas.flatMap((area) => (
        Array.isArray(area.citizenIds) ? area.citizenIds.map(String) : []
    )))]
    const alternatives = []
    if (memberIds.length > 0) alternatives.push({ _id: { $in: memberIds } })
    alternatives.push(...areas.map((area) => ({
        location: { $geoWithin: { $geometry: area.geometry } }
    })))

    if (alternatives.length === 0) return []
    return User.find({
        role: { $in: CITIZEN_ROLE_VALUES },
        $or: alternatives
    }).select('_id name email phone')
}

const uniqueIds = (targetAreaIds = []) => [
    ...new Set(targetAreaIds.map((area) => String(area?._id || area)))
]

const warningAreas = async (targetAreaIds = []) => TargetArea.find({
    _id: { $in: uniqueIds(targetAreaIds) }
}).select('name areaType hazardTypes geometry citizenIds')

const shapeWarningArea = (area) => ({
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
    delete rawWarning.recipientIds
    return {
        ...rawWarning,
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
    const recipients = await getCurrentRecipientsForAreas(validated.areas)
    const warning = await Warning.create({
        title: validated.title,
        severity: validated.severity,
        hazardType: validated.hazardType,
        message: validated.message,
        actionSteps: validated.actionSteps,
        showOnDonationPage: false,
        targetAreaIds: validated.targetAreaIds,
        updates: [{
            title: initialUpdateTitle,
            message: initialUpdateMessage,
            type: 'update',
            createdBy: officerId,
            createdAt: new Date()
        }],
        recipientIds: recipients.map((recipient) => recipient._id),
        createdBy: officerId
    })
    return shapeWarning(warning)
}

export const updateWarning = async (warningId, data) => {
    const warning = await Warning.findOne({ _id: warningId, status: 'draft' })
    if (!warning) {
        const error = new Error('Only existing draft warnings can be edited')
        error.statusCode = 404
        throw error
    }
    const validated = await validateWarningData(data, true)
    const recipients = await getCurrentRecipientsForAreas(validated.areas)
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
    const validated = await validateWarningData({
        title: 'Preview',
        severity: 'warning',
        hazardType: 'other',
        message: 'Preview',
        targetAreaIds
    })
    const recipients = await getCurrentRecipientsForAreas(validated.areas)
    return { recipientCount: recipients.length }
}

export const getWarningForReview = async (warningId) => {
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
    const areas = await warningAreas(distinctTargetAreaIds)
    const recipients = await getCurrentRecipientsForAreas(areas)
    const publicWarning = warning.toObject()
    delete publicWarning.recipientIds
    return {
        warning: {
            ...publicWarning,
            targetAreaIds: areas.map(shapeWarningArea),
            recipientCount: recipients.length
        },
        deliveryAudience: {
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
    if (!ALLOWED_SEVERITIES.has(nextSeverity)) {
        const error = new Error('Choose a valid warning severity')
        error.statusCode = 400
        throw error
    }

    const requestedAreaIds = data.targetAreaIds === undefined ? [] : data.targetAreaIds
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
    const addedAreaIds = [...new Set(requestedAreaIds.map(String))]
        .filter((id) => !currentAreaIds.has(id))
    const addedAreas = addedAreaIds.length
        ? await TargetArea.find({ _id: { $in: addedAreaIds } }).select('name geometry citizenIds')
        : []
    if (addedAreas.length !== addedAreaIds.length) {
        const error = new Error('One or more selected target areas do not exist')
        error.statusCode = 404
        throw error
    }

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

    const newRecipients = addedAreas.length
        ? await getCurrentRecipientsForAreas(addedAreas)
        : []
    const existingRecipients = new Set(uniqueIds(warning.recipientIds))
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
        setImmediate(() => {
            deliverWarningToRecipients(updateWarning, newlyAffected).catch((error) => {
                console.error(`Warning update delivery failed for ${warning._id}: ${error.message}`)
            })
        })
    }

    return getWarningForReview(warningId)
}

export const issueWarning = async (warningId, officerId) => {
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
        const areas = await warningAreas(uniqueIds(warning.targetAreaIds))
        const recipients = await getCurrentRecipientsForAreas(areas)
        if (recipients.length === 0) {
            warning.status = 'draft'
            await warning.save()
            const error = new Error('There are no current citizen-role users in the selected target areas')
            error.statusCode = 400
            throw error
        }
        warning.recipientIds = recipients.map((recipient) => recipient._id)
        warning.deliverySummary = {
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
        await warning.save()

        setImmediate(() => {
            deliverWarningToRecipients(warning, recipients).catch(async (error) => {
                console.error(`Warning delivery worker failed for ${warning._id}: ${error.message}`)
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
        if (warning.status === 'issuing') {
            warning.status = 'delivery_failed'
            await warning.save()
        }
        throw error
    }
}

export const resolveWarning = async (warningId, officerId) => {
    const resolvedAt = new Date()
    const warning = await Warning.findOneAndUpdate(
        {
            _id: warningId,
            resolvedAt: null,
            status: { $in: ['issued', 'partially_issued', 'delivery_failed'] }
        },
        {
            $set: { resolvedAt, resolvedBy: officerId },
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
    const workerCount = Math.min(8, recipients.length)
    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < recipients.length) {
            const recipient = recipients[nextIndex]
            nextIndex += 1
            try {
                await deliverWarningToCitizen(warning, recipient)
            } catch (error) {
                console.error(`Warning delivery failed for recipient ${recipient._id}: ${error.message}`)
            }
        }
    }))
    await finalizeWarningDelivery(warning._id)
}

export const listWarnings = async () => {
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
        ? await User.find({
            _id: { $in: recipientIds },
            role: { $in: CITIZEN_ROLE_VALUES }
        }).distinct('_id')
        : []
    const currentCitizenIdSet = new Set(currentCitizenIds.map(String))

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
    const [targetAreas, warnings, citizens, escalatedReports] = await Promise.all([
        TargetArea.countDocuments(),
        Warning.countDocuments(),
        User.countDocuments({ role: { $in: CITIZEN_ROLE_VALUES } }),
        ReportCluster.countDocuments({ status: 'active' })
    ])

    return { targetAreas, warnings, citizens, escalatedReports }
}