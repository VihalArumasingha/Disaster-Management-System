import mongoose from 'mongoose'

const textBeeWebhookEventSchema = new mongoose.Schema(
    {
        idempotencyKey: { type: String, required: true, unique: true },
        payload: { type: mongoose.Schema.Types.Mixed, required: true },
        status: {
            type: String,
            enum: ['pending', 'processing', 'processed'],
            default: 'pending'
        },
        attempts: { type: Number, default: 0 },
        nextAttemptAt: { type: Date, default: Date.now },
        lastError: { type: String, default: '' },
        processedAt: { type: Date, default: null }
    },
    { timestamps: true }
)

textBeeWebhookEventSchema.index({ status: 1, nextAttemptAt: 1 })

const TextBeeWebhookEvent = mongoose.model('TextBeeWebhookEvent', textBeeWebhookEventSchema)

export default TextBeeWebhookEvent
