import axios from 'axios'
import crypto from 'node:crypto'
import AlertNotification from '../../../models/AlertNotification.js'
import User from '../../../models/User.js'
import Warning from '../../../models/Warning.js'
import WarningDelivery from '../../../models/WarningDelivery.js'
import TextBeeWebhookEvent from '../../../models/TextBeeWebhookEvent.js'
import { CITIZEN_ROLE_VALUES } from '../../../utils/citizenTargetAreas.js'

const getTextBeeApiBaseUrl = () => (
    process.env.TEXTBEE_BASE_URL || 'https://api.textbee.dev/api/v1'
).replace(/\/+$/, '')

const toE164Phone = (phone) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('94')) return `+${digits}`
    if (digits.startsWith('0') && digits.length === 10) return `+94${digits.slice(1)}`
    if (digits.length === 9 && digits.startsWith('7')) return `+94${digits}`
    return `+${digits}`
}

const isSmsAccepted = (delivery) => (
    ['queued', 'sent', 'delivered'].includes(delivery.sms?.status)
)

const providerErrorMessage = (error) => (
    error.response?.data?.message
    || error.response?.data?.error
    || error.message
    || 'Provider request failed'
).toString().slice(0, 500)

const sanitizeProviderError = (message) => [
    process.env.TEXTBEE_API_KEY,
    process.env.BREVO_API_KEY
].filter(Boolean).reduce(
    (safeMessage, secret) => safeMessage.split(secret).join('[redacted]'),
    message
)

const sendSms = async (recipient, warning) => {
    if (!process.env.TEXTBEE_API_KEY) {
        return { success: false, error: 'TextBee is not configured (TEXTBEE_API_KEY is required)' }
    }

    const phone = toE164Phone(recipient.phone)
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
        return { success: false, error: 'Citizen phone number is not a valid international number' }
    }

    try {
        const response = await axios.post(
            `${getTextBeeApiBaseUrl()}/gateway/send-sms`,
            {
                recipients: [phone],
                message: `${warning.title}: ${warning.message}`
            },
            {
                headers: {
                    'x-api-key': process.env.TEXTBEE_API_KEY,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                timeout: 15000
            }
        )
        const result = response.data
        const accepted = result?.data?.success === true || result?.success === true
        if (!accepted) {
            return {
                success: false,
                error: sanitizeProviderError(providerErrorMessage({ response: { data: result } }))
            }
        }
        const providerBatchId = String(result?.data?.smsBatchId || result?.smsBatchId || '')
        if (!providerBatchId) {
            return {
                success: false,
                error: 'TextBee accepted the SMS but did not return a batch ID for delivery tracking'
            }
        }
        return {
            success: true,
            status: 'queued',
            providerBatchId
        }
    } catch (error) {
        return { success: false, error: sanitizeProviderError(providerErrorMessage(error)) }
    }
}

const sendEmail = async (recipient, warning) => {
    if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
        return { success: false, error: 'Brevo is not configured (BREVO_API_KEY and BREVO_SENDER_EMAIL are required)' }
    }

    try {
        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            {
                sender: {
                    email: process.env.BREVO_SENDER_EMAIL,
                    name: process.env.BREVO_SENDER_NAME || 'Disaster Management System'
                },
                to: [{ email: recipient.email, name: recipient.name }],
                subject: `Safety ${warning.severity}: ${warning.title}`,
                textContent: `${warning.title}\nSeverity: ${warning.severity}\nHazard: ${warning.hazardType}\n\n${warning.message}`
            },
            {
                headers: {
                    'api-key': process.env.BREVO_API_KEY,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                timeout: 15000
            }
        )
        return {
            success: true,
            providerMessageId: String(response.data?.messageId || '')
        }
    } catch (error) {
        return { success: false, error: sanitizeProviderError(providerErrorMessage(error)) }
    }
}

const attemptChannel = async (delivery, channel, send) => {
    if (delivery[channel].status === 'sent') return delivery[channel]

    const attemptedAt = new Date()
    delivery = await WarningDelivery.findOneAndUpdate(
        { _id: delivery._id },
        {
            $set: {
                [`${channel}.status`]: 'sending',
                [`${channel}.attemptedAt`]: attemptedAt,
                [`${channel}.error`]: ''
            }
        },
        { new: true }
    )
    const result = await send()
    const updates = result.success
        ? {
            [`${channel}.status`]: result.status || 'sent',
            ...(result.status === 'queued'
                ? { [`${channel}.acceptedAt`]: new Date() }
                : { [`${channel}.sentAt`]: new Date() }),
            [`${channel}.providerMessageId`]: result.providerMessageId || '',
            [`${channel}.providerBatchId`]: result.providerBatchId || '',
            [`${channel}.error`]: ''
        }
        : {
            [`${channel}.status`]: 'failed',
            [`${channel}.error`]: result.error
        }

    return WarningDelivery.findOneAndUpdate(
        { _id: delivery._id },
        { $set: updates },
        { new: true }
    )
}

const isSent = (delivery, channel) => (
    ['sent', 'delivered'].includes(delivery[channel]?.status)
)

export const deliverWarningToCitizen = async (warning, recipient) => {
    let delivery = await WarningDelivery.findOneAndUpdate(
        { warningId: warning._id, recipientId: recipient._id },
        {
            $setOnInsert: {
                warningId: warning._id,
                recipientId: recipient._id
            }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    )

    if (!isSent(delivery, 'inApp')) {
        const attemptedAt = new Date()
        delivery = await WarningDelivery.findOneAndUpdate(
            { _id: delivery._id },
            { $set: { 'inApp.status': 'sending', 'inApp.attemptedAt': attemptedAt } },
            { new: true }
        )
        try {
            await AlertNotification.findOneAndUpdate(
                { warningId: warning._id, recipientId: recipient._id },
                {
                    $setOnInsert: {
                        warningId: warning._id,
                        recipientId: recipient._id,
                        title: warning.title,
                        message: warning.message,
                        severity: warning.severity,
                        hazardType: warning.hazardType
                    }
                },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            )
            delivery = await WarningDelivery.findOneAndUpdate(
                { _id: delivery._id },
                { $set: { 'inApp.status': 'sent', 'inApp.sentAt': new Date(), 'inApp.error': '' } },
                { new: true }
            )
        } catch (error) {
            delivery = await WarningDelivery.findOneAndUpdate(
                { _id: delivery._id },
                {
                    $set: {
                        'inApp.status': 'failed',
                        'inApp.error': 'Could not save the in-app alert'
                    }
                },
                { new: true }
            )
        }
    }

    if (!isSmsAccepted(delivery)) {
        delivery = await attemptChannel(delivery, 'sms', () => (
            recipient.phone
                ? sendSms(recipient, warning)
                : Promise.resolve({ success: false, error: 'Citizen has no phone number' })
        ))
    }

    if (
        !isSent(delivery, 'inApp')
        || delivery.sms.status === 'failed'
    ) {
        if (!isSent(delivery, 'email')) {
            delivery = await attemptChannel(delivery, 'email', () => (
                recipient.email
                    ? sendEmail(recipient, warning)
                    : Promise.resolve({ success: false, error: 'Citizen has no email address' })
            ))
        }
    } else if (delivery.email.status !== 'sent') {
        delivery = await WarningDelivery.findOneAndUpdate(
            { _id: delivery._id },
            { $set: { 'email.status': 'not_required' } },
            { new: true }
        )
    }

    return delivery
}

const refreshWarningDeliverySummary = async (warningId) => {
    const [warning, deliveries] = await Promise.all([
        Warning.findById(warningId),
        WarningDelivery.find({ warningId })
    ])
    if (!warning) return

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
    const summary = {
        recipients: deliveries.length,
        inAppSent: deliveries.filter((delivery) => delivery.inApp.status === 'sent').length,
        smsQueued: deliveries.filter((delivery) => delivery.sms.status === 'queued').length,
        smsSent: deliveries.filter((delivery) => (
            ['sent', 'delivered'].includes(delivery.sms.status)
        )).length,
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
    const hasFailedRecipient = summary.failedRecipients > 0
    warning.status = hasFailedRecipient
        ? anyDelivered ? 'partially_issued' : 'delivery_failed'
        : 'issued'
    warning.issuedAt ||= new Date()
    warning.deliverySummary = summary
    await warning.save()
}

const sendSmsFailureFallback = async (delivery) => {
    const emailClaim = await WarningDelivery.findOneAndUpdate(
        {
            _id: delivery._id,
            'email.status': { $in: ['pending', 'not_required', 'failed'] }
        },
        {
            $set: {
                'email.status': 'sending',
                'email.attemptedAt': new Date(),
                'email.error': ''
            }
        },
        { new: true }
    )
    if (!emailClaim) return

    const [warning, recipient] = await Promise.all([
        Warning.findById(delivery.warningId),
        User.findOne({
            _id: delivery.recipientId,
            role: { $in: CITIZEN_ROLE_VALUES }
        }).select('name email')
    ])
    if (!warning || !recipient?.email) {
        await WarningDelivery.updateOne(
            { _id: delivery._id },
            {
                $set: {
                    'email.status': 'failed',
                    'email.error': recipient ? 'Citizen has no email address' : 'Citizen account is no longer eligible'
                }
            }
        )
        return
    }

    const result = await sendEmail(recipient, warning)
    await WarningDelivery.updateOne(
        { _id: delivery._id },
        {
            $set: result.success
                ? {
                    'email.status': 'sent',
                    'email.sentAt': new Date(),
                    'email.providerMessageId': result.providerMessageId || '',
                    'email.error': ''
                }
                : {
                    'email.status': 'failed',
                    'email.error': result.error
                }
        }
    )
}

const applyTextBeeEvent = async (payload) => {
    if (!['MESSAGE_SENT', 'MESSAGE_DELIVERED', 'MESSAGE_FAILED', 'UNKNOWN_STATE'].includes(payload.webhookEvent)) {
        return
    }
    if (!payload.smsBatchId) {
        throw new Error('TextBee delivery event is missing its batch ID')
    }

    const matchingDelivery = await WarningDelivery.findOne({
        $or: [
            { 'sms.providerBatchId': payload.smsBatchId },
            { 'sms.providerMessageId': payload.smsBatchId }
        ]
    })
    if (!matchingDelivery) {
        throw new Error('No warning delivery matches the TextBee batch event yet')
    }

    const currentStatus = matchingDelivery.sms.status
    let update
    if (payload.webhookEvent === 'MESSAGE_SENT') {
        if (!['queued', 'pending', 'sending'].includes(currentStatus)) return
        update = {
            'sms.status': 'sent',
            'sms.sentAt': payload.sentAt ? new Date(payload.sentAt) : new Date(),
            'sms.error': ''
        }
    } else if (payload.webhookEvent === 'MESSAGE_DELIVERED') {
        if (currentStatus === 'failed') return
        update = {
            'sms.status': 'delivered',
            'sms.deliveredAt': payload.deliveredAt ? new Date(payload.deliveredAt) : new Date(),
            ...(payload.sentAt ? { 'sms.sentAt': new Date(payload.sentAt) } : {}),
            'sms.error': ''
        }
    } else if (payload.webhookEvent === 'MESSAGE_FAILED') {
        if (currentStatus === 'delivered') return
        update = {
            'sms.status': 'failed',
            'sms.error': [
                payload.errorCode ? `Code ${payload.errorCode}:` : '',
                payload.errorMessage || 'TextBee reported SMS delivery failure'
            ].filter(Boolean).join(' ')
        }
    } else {
        if (!['queued', 'pending', 'sending'].includes(currentStatus)) return
        update = {
            'sms.status': 'unknown',
            'sms.error': `TextBee reported an unclassified status: ${payload.status || 'unknown'}`
        }
    }

    const updatedDelivery = await WarningDelivery.findOneAndUpdate(
        { _id: matchingDelivery._id },
        { $set: update },
        { new: true }
    )
    if (payload.webhookEvent === 'MESSAGE_FAILED') {
        await sendSmsFailureFallback(updatedDelivery)
    }
    await refreshWarningDeliverySummary(updatedDelivery.warningId)
}

export const processTextBeeWebhookEvent = async (eventId) => {
    const event = await TextBeeWebhookEvent.findOneAndUpdate(
        {
            _id: eventId,
            status: 'pending',
            nextAttemptAt: { $lte: new Date() }
        },
        {
            $set: { status: 'processing' },
            $inc: { attempts: 1 }
        },
        { new: true }
    )
    if (!event) return

    try {
        await applyTextBeeEvent(event.payload)
        await TextBeeWebhookEvent.updateOne(
            { _id: event._id, status: 'processing' },
            {
                $set: {
                    status: 'processed',
                    processedAt: new Date(),
                    lastError: ''
                }
            }
        )
    } catch (error) {
        const delaySeconds = Math.min(300, 5 * (2 ** Math.min(event.attempts, 6)))
        await TextBeeWebhookEvent.updateOne(
            { _id: event._id, status: 'processing' },
            {
                $set: {
                    status: 'pending',
                    nextAttemptAt: new Date(Date.now() + delaySeconds * 1000),
                    lastError: sanitizeProviderError(error.message).slice(0, 500)
                }
            }
        )
    }
}

export const enqueueTextBeeWebhookEvent = async (payload) => {
    const eventPayload = {
        idempotencyKey: payload.idempotencyKey,
        webhookEvent: payload.webhookEvent,
        smsBatchId: payload.smsBatchId,
        status: payload.status,
        errorCode: payload.errorCode,
        errorMessage: payload.errorMessage,
        sentAt: payload.sentAt,
        deliveredAt: payload.deliveredAt
    }
    try {
        return await TextBeeWebhookEvent.create({
            idempotencyKey: payload.idempotencyKey,
            payload: eventPayload
        })
    } catch (error) {
        if (error.code === 11000) {
            return TextBeeWebhookEvent.findOne({ idempotencyKey: payload.idempotencyKey })
        }
        throw error
    }
}

export const processPendingTextBeeWebhookEvents = async () => {
    const staleProcessingBefore = new Date(Date.now() - 2 * 60 * 1000)
    await TextBeeWebhookEvent.updateMany(
        { status: 'processing', updatedAt: { $lt: staleProcessingBefore } },
        { $set: { status: 'pending', nextAttemptAt: new Date() } }
    )
    const events = await TextBeeWebhookEvent.find({
        status: 'pending',
        nextAttemptAt: { $lte: new Date() }
    }).select('_id').limit(25)
    await Promise.all(events.map((event) => processTextBeeWebhookEvent(event._id)))
}

export const verifyTextBeeWebhookSignature = (rawBody, signature) => {
    const signingSecret = process.env.TEXTBEE_WEBHOOK_SECRET
    if (!signingSecret || typeof signature !== 'string' || !Buffer.isBuffer(rawBody)) {
        return false
    }
    const expectedSignature = crypto
        .createHmac('sha256', signingSecret)
        .update(rawBody)
        .digest('hex')
    const provided = Buffer.from(signature, 'utf8')
    const expected = Buffer.from(expectedSignature, 'utf8')
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected)
}
