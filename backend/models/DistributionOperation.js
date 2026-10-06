import mongoose from 'mongoose'

/**
 * A relief-distribution field operation created by the NGO manager.
 * Served by /api/operations — the "Relief Distribution" dashboard page
 * manages these documents and the volunteer sign-up forms list them
 * as assignment options.
 */
const distributionOperationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Operation name is required'],
            trim: true
        },
        location: { type: String, default: '', trim: true },
        requiredVolunteers: {
            type: Number,
            default: 0,
            min: [0, 'Required volunteers cannot be negative']
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'PENDING'],
            default: 'PENDING',
            uppercase: true
        },
        /**
         * Progress through the action timeline shown on the dashboard.
         * Number of completed steps out of TIMELINE_STEPS (6):
         * 0 = nothing done yet, 6 = operation complete.
         */
        stage: {
            type: Number,
            default: 0,
            min: [0, 'Stage cannot be negative'],
            max: [6, 'Stage cannot exceed 6']
        }
    },
    { timestamps: true }
)

distributionOperationSchema.index({ name: 1 })

const DistributionOperation = mongoose.model('DistributionOperation', distributionOperationSchema)

export default DistributionOperation