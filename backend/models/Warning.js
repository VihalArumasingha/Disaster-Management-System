import mongoose from 'mongoose'

const warningSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        severity: {
            type: String,
            enum: ['advisory', 'watch', 'warning', 'emergency'],
            required: true
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
        targetAreaIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TargetArea',
            required: true
        }],
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

const Warning = mongoose.model('Warning', warningSchema)

export default Warning
