import axios from 'axios'
import AlertNotification from '../../../models/AlertNotification.js'
import WarningDelivery from '../../../models/WarningDelivery.js'

const TEXTBEE_API_BASE_URL = (
    process.env.TEXTBEE_BASE_URL || 'https://api.textbee.dev/api/v1'
).replace(/\/+$/, '')

const toE164Phone = (phone) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.startsWith('94')) return `+${digits}`
    if (digits.startsWith('0') && digits.length === 10) return `+94${digits.slice(1)}`
    if (digits.length === 9 && digits.startsWith('7')) return `+94${digits}`
    return `+${digits}`
}

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
            `${TEXTBEE_API_BASE_URL}/gateway/send-sms`,
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
        // TextBee documents HTTP 200 as queue acceptance; tolerate response-body shape variations.
        return {
            success: true,
            providerMessageId: String(
                result?.smsBatchId
                || result?.data?.smsBatchId
                || result?.data?.id
                || ''
            )
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
            [`${channel}.status`]: 'sent',
            [`${channel}.sentAt`]: new Date(),
            [`${channel}.providerMessageId`]: result.providerMessageId || '',
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

const isSent = (delivery, channel) => delivery[channel]?.status === 'sent'

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

    if (!isSent(delivery, 'sms')) {
        delivery = await attemptChannel(delivery, 'sms', () => (
            recipient.phone
                ? sendSms(recipient, warning)
                : Promise.resolve({ success: false, error: 'Citizen has no phone number' })
        ))
    }

    if (
        !isSent(delivery, 'inApp')
        || !isSent(delivery, 'sms')
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
