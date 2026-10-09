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
    // Providers require international format, but citizen records can contain common Sri Lankan local formats.
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('94')) return `+${digits}`
    if (digits.startsWith('0') && digits.length === 10) return `+94${digits.slice(1)}`
    if (digits.length === 9 && digits.startsWith('7')) return `+94${digits}`
    return `+${digits}`
}

const isSmsAccepted = (delivery) => (
    // Once TextBee accepts a batch, polling/webhooks own its progress; do not submit it again.
    ['queued', 'dispatched', 'sent', 'delivered'].includes(delivery.sms?.status)
)

const providerErrorMessage = (error) => (
    error.response?.data?.message
    || error.response?.data?.error
    || error.message
    || 'Provider request failed'
).toString().slice(0, 500)

// Provider errors can echo credentials, so sanitize before storing or logging their messages.
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
    // Reject invalid numbers locally rather than spending a provider request that cannot succeed.
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
        // TextBee has returned both nested and top-level success payloads, so accept either documented shape.
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
    // A previously successful channel is idempotent: retrying must not send the same alert again.
    if (delivery[channel].status === 'sent') return delivery[channel]

    const attemptedAt = new Date()
    // Record the attempt before contacting the provider so its in-flight status and timestamp are durable.
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
    // Keep provider-specific IDs and accepted/sent timestamps for later reconciliation and support diagnostics.
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
    // For fallback decisions, "delivered" is also a completed channel outcome.
    ['sent', 'delivered'].includes(delivery[channel]?.status)
)

export const deliverWarningToCitizen = async (warning, recipient) => {
    // Upsert one record per warning/citizen pair so retries update the same delivery instead of duplicating it.
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
            // The alert is unique to this warning and citizen; upsert makes a retried worker safe.
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
            // Keep channel failure explicit, then continue because SMS/email may still reach the citizen.
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
        // Email is a fallback only when the primary in-app/SMS path did not complete successfully.
        if (!isSent(delivery, 'email')) {
            delivery = await attemptChannel(delivery, 'email', () => (
                recipient.email
                    ? sendEmail(recipient, warning)
                    : Promise.resolve({ success: false, error: 'Citizen has no email address' })
            ))
        }
    } else if (delivery.email.status !== 'sent') {
        // Mark email as intentionally skipped when a primary channel succeeded, not as an outstanding task.
        delivery = await WarningDelivery.findOneAndUpdate(
            { _id: delivery._id },
            { $set: { 'email.status': 'not_required' } },
            { new: true }
        )
    }

    return delivery
}

export const refreshWarningDeliverySummary = async (warningId) => {
    // Read the records together so dashboard counts and failure reasons describe one refresh operation.
    const [warning, deliveries] = await Promise.all([
        Warning.findById(warningId),
        WarningDelivery.find({ warningId })
    ])
    if (!warning) return

    const failureCounts = new Map()
    deliveries.forEach((delivery) => {
        for (const channel of ['inApp', 'sms', 'email']) {
            if (delivery[channel].status !== 'failed') continue
            // Aggregate identical failures to keep the warning summary compact while retaining actionable reasons.
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
        // Preserve separate accepted, dispatched, sent, and delivered counts for asynchronous SMS tracking.
        recipients: deliveries.length,
        inAppSent: deliveries.filter((delivery) => delivery.inApp.status === 'sent').length,
        smsQueued: deliveries.filter((delivery) => delivery.sms.status === 'queued').length,
        smsDispatched: deliveries.filter((delivery) => delivery.sms.status === 'dispatched').length,
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

    await Warning.updateOne(
        { _id: warningId },
        { $set: { deliverySummary: summary } }
    )
    return summary
}

export const finalizeWarningDelivery = async (warningId) => {
    // Recalculate from delivery records rather than trusting the worker's in-memory results.
    const summary = await refreshWarningDeliverySummary(warningId)
    const warning = await Warning.findById(warningId)
    if (!warning || !summary) return

    const deliveries = await WarningDelivery.find({ warningId })
    const anyDelivered = deliveries.some((delivery) => (
        delivery.inApp.status === 'sent'
        || ['sent', 'delivered'].includes(delivery.sms.status)
        || delivery.email.status === 'sent'
    ))
    if (!warning.updates.some((update) => update.type === 'issued')) {
        // Add the issuance timeline item once, even if finalization is retried.
        warning.updates.push({
            title: 'Warning issued',
            message: warning.message,
            type: 'issued',
            createdAt: warning.issuedAt || new Date()
        })
    }
    // Distinguish total failure from partial success so operators can prioritize follow-up correctly.
    warning.status = summary.failedRecipients > 0
        ? anyDelivered ? 'partially_issued' : 'delivery_failed'
        : 'issued'
    warning.issuedAt ||= new Date()
    await warning.save()
}

const sendSmsFailureFallback = async (delivery) => {
    // Atomically claim the email fallback so duplicate webhook/poll events cannot send it twice.
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

    // Load the latest warning and re-check citizen eligibility before sending a fallback message.
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
    // Ignore unrelated webhook kinds, but treat malformed supported events as retryable input errors.
    if (!['MESSAGE_SENT', 'MESSAGE_DELIVERED', 'MESSAGE_FAILED', 'UNKNOWN_STATE'].includes(payload.webhookEvent)) {
        return
    }
    if (!payload.smsBatchId) {
        throw new Error('TextBee delivery event is missing its batch ID')
    }

    const matchingDelivery = await WarningDelivery.findOne({
        // Providers may identify the same SMS using either its batch ID or message ID.
        $or: [
            { 'sms.providerBatchId': payload.smsBatchId },
            { 'sms.providerMessageId': payload.smsBatchId }
        ]
    })
    if (!matchingDelivery) {
        throw new Error('No warning delivery matches the TextBee batch event yet')
    }

    // Webhooks may arrive out of order; later events must not downgrade a terminal delivery result.
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
        // A failed SMS is the point at which email fallback becomes necessary.
        await sendSmsFailureFallback(updatedDelivery)
    }
    // Keep the warning-level summary synchronized with each accepted provider event.
    await refreshWarningDeliverySummary(updatedDelivery.warningId)
}

export const processTextBeeWebhookEvent = async (eventId) => {
    // Claim only due pending events; the conditional update prevents two workers processing the same event.
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
        // Exponential backoff avoids hammering on transient failures; the cap keeps retries operationally bounded.
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
    // Persist only recognized provider fields so arbitrary webhook properties are not stored or trusted downstream.
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
            // Duplicate idempotency keys represent a retry; return its original event rather than enqueueing twice.
            return TextBeeWebhookEvent.findOne({ idempotencyKey: payload.idempotencyKey })
        }
        throw error
    }
}

export const processPendingTextBeeWebhookEvents = async () => {
    // Requeue work abandoned by a crashed worker, then process a bounded batch to limit each poll's load.
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

export const pollQueuedTextBeeDeliveries = async () => {
    if (!process.env.TEXTBEE_API_KEY) return

    const pollBefore = new Date(Date.now() - 10000)
    // Only check accepted, non-terminal batches whose last poll is old enough to avoid excessive provider traffic.
    const deliveries = await WarningDelivery.find({
        'sms.status': { $in: ['queued', 'dispatched', 'unknown'] },
        'sms.providerBatchId': { $ne: '' },
        $or: [
            { 'sms.lastPolledAt': null },
            { 'sms.lastPolledAt': { $lte: pollBefore } }
        ]
    })
        .sort({ 'sms.acceptedAt': 1 })
        .limit(20)

    await Promise.all(deliveries.map(async (delivery) => {
        // The conditional update acts as a short polling lease when multiple app instances share the queue.
        const pollingClaim = await WarningDelivery.findOneAndUpdate(
            {
                _id: delivery._id,
                'sms.status': { $in: ['queued', 'dispatched', 'unknown'] },
                $or: [
                    { 'sms.lastPolledAt': null },
                    { 'sms.lastPolledAt': { $lte: pollBefore } }
                ]
            },
            { $set: { 'sms.lastPolledAt': new Date() } },
            { new: true }
        )
        if (!pollingClaim) return
        try {
            const recipient = await User.findOne({
                _id: delivery.recipientId,
                role: { $in: CITIZEN_ROLE_VALUES }
            }).select('_id')
            if (!recipient) return

            const response = await axios.get(
                `${getTextBeeApiBaseUrl()}/gateway/messages`,
                {
                    headers: {
                        'x-api-key': process.env.TEXTBEE_API_KEY,
                        Accept: 'application/json'
                    },
                    params: {
                        direction: 'sent',
                        smsBatchId: delivery.sms.providerBatchId,
                        limit: 100
                    },
                    timeout: 10000
                }
            )
            const messageData = response.data?.data
            // TextBee deployments return history as either a direct array or an object containing messages.
            const messages = Array.isArray(messageData)
                ? messageData
                : Array.isArray(messageData?.messages)
                    ? messageData.messages
                    : null
            if (!messages) {
                throw new Error('TextBee message-history response has an unexpected format')
            }
            const message = messages.find((candidate) => (
                (candidate.smsBatch || candidate.smsBatchId || candidate.batchId)
                    === delivery.sms.providerBatchId
            ))
            if (!message) {
                // No matching history is not proof of failure; leave the batch unchanged for a later poll.
                if (!delivery.sms.lastPolledAt) {
                    console.warn('TextBee status lookup returned no matching message; leaving SMS queued')
                }
                return
            }

            const providerStatus = String(message.status || message.state || '').toLowerCase()
            const messageStatus = providerStatus === 'pending'
                ? 'queued'
                : providerStatus || 'unknown'
            if (!['queued', 'dispatched', 'sent', 'delivered', 'failed', 'unknown'].includes(messageStatus)) {
                throw new Error(`TextBee returned an unsupported SMS status: ${providerStatus || 'empty'}`)
            }
            if (['delivered', 'failed'].includes(delivery.sms.status)) return
            if (delivery.sms.status === messageStatus) return

            // Map the provider response into the application's status vocabulary and timestamps.
            let updates
            if (messageStatus === 'sent') {
                updates = {
                    'sms.status': 'sent',
                    'sms.sentAt': message.sentAt ? new Date(message.sentAt) : new Date(),
                    'sms.error': ''
                }
            } else if (messageStatus === 'delivered') {
                updates = {
                    'sms.status': 'delivered',
                    'sms.sentAt': message.sentAt ? new Date(message.sentAt) : delivery.sms.sentAt,
                    'sms.deliveredAt': message.deliveredAt ? new Date(message.deliveredAt) : new Date(),
                    'sms.error': ''
                }
            } else if (messageStatus === 'failed') {
                updates = {
                    'sms.status': 'failed',
                    'sms.error': [
                        message.errorCode ? `Code ${message.errorCode}:` : '',
                        message.errorMessage || 'TextBee reported SMS delivery failure'
                    ].filter(Boolean).join(' ')
                }
            } else if (messageStatus === 'unknown') {
                updates = {
                    'sms.status': 'unknown',
                    'sms.error': message.errorMessage || 'TextBee could not confirm the SMS status'
                }
            } else {
                updates = {
                    'sms.status': messageStatus,
                    'sms.error': ''
                }
            }

            const updatedDelivery = await WarningDelivery.findOneAndUpdate(
                {
                    _id: delivery._id,
                    'sms.status': { $in: ['queued', 'dispatched', 'unknown'] }
                },
                { $set: updates },
                { new: true }
            )
            // The conditional claim ensures a late polling response cannot overwrite a concurrent webhook result.
            if (!updatedDelivery) return
            console.info(`TextBee SMS status updated: ${delivery.sms.status} -> ${messageStatus}`)
            if (messageStatus === 'failed') {
                await sendSmsFailureFallback(updatedDelivery)
            }
            await refreshWarningDeliverySummary(updatedDelivery.warningId)
        } catch (error) {
            // A single provider failure should not prevent the remaining queued deliveries from being checked.
            console.error(`TextBee status check failed for delivery ${delivery._id}: ${sanitizeProviderError(error.message)}`)
        }
    }))
}

export const verifyTextBeeWebhookSignature = (rawBody, signature) => {
    const signingSecret = process.env.TEXTBEE_WEBHOOK_SECRET
    // Reject missing configuration or malformed inputs before computing a signature.
    if (!signingSecret || typeof signature !== 'string' || !Buffer.isBuffer(rawBody)) {
        return false
    }
    const expectedSignature = crypto
        .createHmac('sha256', signingSecret)
        .update(rawBody)
        .digest('hex')
    const provided = Buffer.from(signature, 'utf8')
    const expected = Buffer.from(expectedSignature, 'utf8')
    // Use constant-time comparison so response duration does not reveal signature-prefix matches.
    return provided.length === expected.length && crypto.timingSafeEqual(provided, expected)
}
