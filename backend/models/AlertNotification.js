import mongoose from 'mongoose'

const alertNotificationSchema = new mongoose.Schema(
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
        title: { type: String, required: true },
        message: { type: String, required: true },
        severity: { type: String, required: true },
        hazardType: { type: String, required: true },
        readAt: { type: Date, default: null }
    },
    { timestamps: true }
)

alertNotificationSchema.index({ recipientId:  1, createdAt: -1 })
alertNotificationSchema.index({ warningId: 1, recipientId: 1 }, { unique: true })

const AlertNotification = mongoose.model('AlertNotification', alertNotificationSchema)

export default AlertNotification
