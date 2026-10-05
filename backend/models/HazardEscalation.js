import mongoose from 'mongoose'

const hazardEscalationSchema = new mongoose.Schema(
    {
        clusterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ReportCluster',
            required: true,
            unique: true,
            index: true
        },

        hazardType: {
            type: String,
            enum: [
                'flood',
                'landslide',
                'road_blockage',
                'other'
            ],
            required: true
        },

        priorityScore: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },

        priorityLevel: {
            type: String,
            enum: [
                'low',
                'medium',
                'high',
                'critical'
            ],
            required: true
        },

        verifiedReportIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'HazardReport'
            }
        ],

        verifiedReportCount: {
            type: Number,
            required: true,
            min: 0
        },

        status: {
            type: String,
            enum: [
                'pending_duty_verification',
                'approved',
                'rejected',
                'cancelled'
            ],
            default: 'pending_duty_verification',
            required: true,
            index: true
        },

        escalatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        escalatedAt: {
            type: Date,
            default: Date.now,
            required: true
        },

        dutyOfficer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },

        reviewedAt: {
            type: Date
        },

        reviewNote: {
            type: String,
            trim: true,
            maxlength: 2000
        }
    },
    {
        timestamps: true
    }
)

hazardEscalationSchema.index({
    status: 1,
    priorityScore: -1,
    escalatedAt: -1
})

hazardEscalationSchema.index({
    clusterId: 1,
    status: 1
})

const HazardEscalation = mongoose.model(
    'HazardEscalation',
    hazardEscalationSchema
)

export default HazardEscalation