import mongoose from 'mongoose'

const operationalAuditLogSchema = new mongoose.Schema(
    {
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        action: { type: String, required: true, trim: true, maxlength: 100, index: true },
        entityType: { type: String, required: true, trim: true, maxlength: 100 },
        entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
        details: { type: mongoose.Schema.Types.Mixed, default: {} }
    },
    { timestamps: true }
)

operationalAuditLogSchema.index({ createdAt: -1 })

export default mongoose.model('OperationalAuditLog', operationalAuditLogSchema)
