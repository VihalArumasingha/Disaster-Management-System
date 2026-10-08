import mongoose from 'mongoose'

const warningSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        // Optional because NGO disaster appeals and DMC safety warnings share this model;
        // the NGO creation endpoint still requires these appeal-specific fields.
        city: {
            type: String,
            trim: true,
            maxlength: 100
        },
        summary: {
            type: String,
            trim: true,
            maxlength: 2000
        },
        topNeeds: {
            type: String,
            trim: true,
            maxlength: 500
        },
        accentColor: {
            type: String,
            default: '#16a34a',
            trim: true
        },
        severity: {
            type: String,
            enum: ['Low', 'Medium', 'High', 'Critical'],
            default: 'Medium'
        },
        active: {
            type: Boolean,
            default: true
        },
        showOnDonationPage: {
            type: Boolean,
            default: true
        },
        hazardType: {
            type: String,
            enum: ['flood', 'landslide', 'tsunami', 'storm', 'other'],
            required: true
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 4000
        },
        actionSteps: {
            type: [{ type: String, trim: true, maxlength: 400 }],
            default: []
        },
        updates: {
            type: [{
                title: { type: String, required: true, trim: true, maxlength: 120 },
                message: { type: String, required: true, trim: true, maxlength: 2000 },
                type: {
                    type: String,
                    enum: ['issued', 'update', 'severity', 'area', 'resolved'],
                    default: 'update'
                },
                severity: {
                    type: String,
                    enum: ['Low', 'Medium', 'High', 'Critical', 'advisory', 'watch', 'warning', 'emergency'],
                    default: null
                },
                affectedAreaIds: [{
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'TargetArea'
                }],
                createdBy: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    default: null
                },
                createdAt: { type: Date, default: Date.now }
            }],
            default: []
        },
        targetAreaIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TargetArea'
        }],
        manualTargetAreas: {
            type: [String],
            default: []
        },
        images: {
            type: [{
                url: String,
                public_id: String
            }],
            default: []
        },
        recipientIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        status: {
            type: String,
            enum: ['draft', 'issuing', 'issued', 'partially_issued', 'delivery_failed'],
            default: 'draft'
        },
        issuedAt: {
            type: Date,
            default: null
        },
        issuedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        resolvedAt: {
            type: Date,
            default: null
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        deliverySummary: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    { timestamps: true }
)

warningSchema.index({ createdAt: -1 })
warningSchema.index({ recipientIds: 1, status: 1, issuedAt: -1 })

const Warning = mongoose.model('Warning', warningSchema, 'activedisasters')

export default Warning
