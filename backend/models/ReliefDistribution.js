import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

const reliefDistributionSchema = new mongoose.Schema(
    {
        distributionId: {
            type: String,
            unique: true,
            default: () => `DST-${randomUUID().slice(0, 8).toUpperCase()}`
        },
        supply: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ReliefSupply',
            required: true,
            index: true
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true
        },
        disasterEvent: { type: String, required: true, trim: true, maxlength: 200 },
        destinationType: {
            type: String,
            enum: ['District', 'Shelter', 'Relief Location'],
            required: true
        },
        district: { type: String, trim: true, maxlength: 100, default: '' },
        shelter: { type: mongoose.Schema.Types.ObjectId, ref: 'Shelter', default: null },
        reliefLocation: { type: mongoose.Schema.Types.ObjectId, ref: 'TargetArea', default: null },
        quantity: { type: Number, required: true, min: 0.001 },
        distributionDate: { type: Date, required: true },
        recipient: { type: String, required: true, trim: true, maxlength: 200 },
        responsibleOfficer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        purpose: { type: String, required: true, trim: true, maxlength: 500 },
        notes: { type: String, trim: true, maxlength: 2000, default: '' },
        auditStatus: {
            type: String,
            enum: ['Pending Verification', 'Verified', 'Rejected', 'Flagged'],
            default: 'Pending Verification',
            required: true
        },
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        verifiedAt: { type: Date, default: null },
        verificationNotes: { type: String, trim: true, maxlength: 2000, default: '' },
        auditHistory: [{
            auditStatus: {
                type: String,
                enum: ['Pending Verification', 'Verified', 'Rejected', 'Flagged'],
                required: true
            },
            notes: { type: String, trim: true, maxlength: 2000, default: '' },
            changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            changedAt: { type: Date, default: Date.now, required: true }
        }]
    },
    { timestamps: true }
)

reliefDistributionSchema.index({ distributionDate: -1 })
reliefDistributionSchema.index({ supply: 1, auditStatus: 1 })

export default mongoose.model('ReliefDistribution', reliefDistributionSchema)
