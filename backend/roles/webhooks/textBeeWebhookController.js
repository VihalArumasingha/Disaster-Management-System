import {
    enqueueTextBeeWebhookEvent,
    processTextBeeWebhookEvent,
    verifyTextBeeWebhookSignature
} from '../dmcOfficer/services/warningDeliveryService.js'

export const receiveTextBeeWebhook = async (req, res, next) => {
    if (!process.env.TEXTBEE_WEBHOOK_SECRET) {
        return res.status(503).json({
            success: false,
            message: 'TextBee webhook signing secret is not configured'
        })
    }

    const signature = req.get('x-signature')
    if (!verifyTextBeeWebhookSignature(req.body, signature)) {
        return res.status(401).json({
            success: false,
            message: 'Invalid TextBee webhook signature'
        })
    }

    let payload
    try {
        payload = JSON.parse(req.body.toString('utf8'))
    } catch {
        return res.status(400).json({
            success: false,
            message: 'Invalid JSON webhook payload'
        })
    }

    if (
        typeof payload.idempotencyKey !== 'string'
        || !payload.idempotencyKey
        || typeof payload.webhookEvent !== 'string'
    ) {
        return res.status(400).json({
            success: false,
            message: 'Webhook payload is missing its event identifier'
        })
    }

    try {
        const event = await enqueueTextBeeWebhookEvent(payload)
        res.status(202).json({ success: true, received: true })
        setImmediate(() => {
            processTextBeeWebhookEvent(event._id).catch((error) => {
                console.error(`TextBee webhook processing failed: ${error.message}`)
            })
        })
    } catch (error) {
        next(error)
    }
}
