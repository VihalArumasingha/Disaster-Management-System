import mongoose from 'mongoose'

const reliefNotificationSchema = new mongoose.Schema(
    {
        recipientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        deploymentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ReliefDeployment',
            default: null
        },
        reportId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HazardReport',
            default: null
        },
        kind: {
            type: String,
            enum: ['relief_assigned', 'relief_completed'],
            required: true
        },
        title: { type: String, required: true },
        message: { type: String, required: true },
        severity: { type: String, default: 'info' },
        hazardType: { type: String, default: 'relief' },
        readAt: { type: Date, default: null }
    },
    { timestamps: true }
)

reliefNotificationSchema.index({ recipientId: 1, createdAt: -1 })

const ReliefNotification = mongoose.model('ReliefNotification', reliefNotificationSchema)

export default ReliefNotification
