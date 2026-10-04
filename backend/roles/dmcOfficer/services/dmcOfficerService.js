import mongoose from 'mongoose'
import User from '../../../models/User.js'
import TargetArea from '../../../models/TargetArea.js'
import Warning from '../../../models/Warning.js'
import WarningDelivery from '../../../models/WarningDelivery.js'
import { CITIZEN_ROLE_VALUES } from '../../../utils/citizenTargetAreas.js'
import { deliverWarningToCitizen } from './warningDeliveryService.js'

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

const validateWarningData = async (data) => {
    const { title, severity, hazardType, message, targetAreaIds } = data

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
    if (!['advisory', 'watch', 'warning', 'emergency'].includes(severity)) {
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
    const validated = await validateWarningData(data)
    const recipients = await getCurrentRecipientsForAreas(validated.areas)
    const warning = await Warning.create({
        title: validated.title,
        severity: validated.severity,
        hazardType: validated.hazardType,
        message: validated.message,
        targetAreaIds: validated.targetAreaIds,
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
    const validated = await validateWarningData(data)
    const recipients = await getCurrentRecipientsForAreas(validated.areas)
    warning.set({
        title: validated.title,
        severity: validated.severity,
        hazardType: validated.hazardType,
        message: validated.message,
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
        .populate('createdBy', 'name')
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

export const issueWarning = async (warningId) => {
    const warning = await Warning.findOneAndUpdate(
        {
            _id: warningId,
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
        await warning.save()

        let nextIndex = 0
        const workerCount = Math.min(8, recipients.length)
        await Promise.all(Array.from({ length: workerCount }, async () => {
            while (nextIndex < recipients.length) {
                const recipient = recipients[nextIndex]
                nextIndex += 1
                await deliverWarningToCitizen(warning, recipient)
            }
        }))

        const deliveries = await WarningDelivery.find({
            warningId: warning._id,
            recipientId: { $in: recipients.map((recipient) => recipient._id) }
        })
        const failureCounts = new Map()
        deliveries.forEach((delivery) => {
            for (const channel of ['inApp', 'sms', 'email']) {
                if (delivery[channel].status !== 'failed') continue
                const reason = delivery[channel].error || 'Delivery failed'
                const key = `${channel}:${reason}`
                failureCounts.set(key, {
                    channel,
                    reason,
                    count: (failureCounts.get(key)?.count || 0) + 1
                })
            }
        })
        const counts = {
            recipients: recipients.length,
            inAppSent: deliveries.filter((delivery) => delivery.inApp.status === 'sent').length,
            smsQueued: deliveries.filter((delivery) => delivery.sms.status === 'queued').length,
            smsSent: deliveries.filter((delivery) => ['sent', 'delivered'].includes(delivery.sms.status)).length,
            smsDelivered: deliveries.filter((delivery) => delivery.sms.status === 'delivered').length,
            smsFailed: deliveries.filter((delivery) => delivery.sms.status === 'failed').length,
            smsUnknown: deliveries.filter((delivery) => delivery.sms.status === 'unknown').length,
            emailFallbackSent: deliveries.filter((delivery) => delivery.email.status === 'sent').length,
            emailFallbackFailed: deliveries.filter((delivery) => delivery.email.status === 'failed').length,
            failedRecipients: deliveries.filter((delivery) => (
                delivery.inApp.status === 'failed'
                && delivery.sms.status === 'failed'
                && delivery.email.status === 'failed'
            )).length,
            failureDetails: [...failureCounts.values()]
        }
        const anyDelivered = deliveries.some((delivery) => (
            delivery.inApp.status === 'sent'
            || ['sent', 'delivered'].includes(delivery.sms.status)
            || delivery.email.status === 'sent'
        ))
        warning.status = counts.failedRecipients === 0
            ? 'issued'
            : anyDelivered
                ? 'partially_issued'
                : 'delivery_failed'
        warning.issuedAt = warning.status === 'issued' ? new Date() : warning.issuedAt
        warning.deliverySummary = counts
        await warning.save()
        return {
            warning: {
                _id: warning._id,
                status: warning.status,
                issuedAt: warning.issuedAt
            },
            deliverySummary: counts
        }
    } catch (error) {
        if (warning.status === 'issuing') {
            warning.status = 'delivery_failed'
            await warning.save()
        }
        throw error
    }
}

export const listWarnings = async () => {
    const warnings = await Warning.find()
        .populate('targetAreaIds', 'name areaType')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })

    const recipientIds = uniqueIds(warnings.flatMap((warning) => warning.recipientIds))
    const currentCitizenIds = recipientIds.length > 0
        ? await User.find({
            _id: { $in: recipientIds },
            role: { $in: CITIZEN_ROLE_VALUES }
        }).distinct('_id')
        : []
    const currentCitizenIdSet = new Set(currentCitizenIds.map(String))

    return warnings.map((warning) => {
        const publicWarning = warning.toObject()
        const warningRecipientIds = publicWarning.recipientIds || []
        delete publicWarning.recipientIds
        return {
            ...publicWarning,
            recipientCount: warningRecipientIds.filter((id) => (
                currentCitizenIdSet.has(String(id))
            )).length
        }
    })
}

export const getOverview = async () => {
    const [targetAreas, warnings, citizens] = await Promise.all([
        TargetArea.countDocuments(),
        Warning.countDocuments(),
        User.countDocuments({ role: { $in: CITIZEN_ROLE_VALUES } })
    ])

    return { targetAreas, warnings, citizens, escalatedReports: 0 }
}