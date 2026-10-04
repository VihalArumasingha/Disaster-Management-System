import mongoose from 'mongoose'

const channelSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: ['pending', 'sending', 'sent', 'failed', 'not_required'],
            default: 'pending'
        },
        providerMessageId: { type: String, default: '' },
        error: { type: String, default: '' },
        attemptedAt: { type: Date, default: null },
        sentAt: { type: Date, default: null }
    },
    { _id: false }
)

const warningDeliverySchema = new mongoose.Schema(
    {
        warningId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Warning',
            required: true
        },
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        inApp: { type: channelSchema, default: () => ({}) },
        sms: { type: channelSchema, default: () => ({}) },
        email: { type: channelSchema, default: () => ({ status: 'not_required' }) }
    },
    { timestamps: true }
)

warningDeliverySchema.index({ warningId: 1, recipientId: 1 }, { unique: true })

const WarningDelivery = mongoose.model('WarningDelivery', warningDeliverySchema)

export default WarningDelivery
