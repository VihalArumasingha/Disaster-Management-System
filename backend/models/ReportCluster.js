import mongoose from 'mongoose'

const reportClusterSchema = new mongoose.Schema(
    {
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

        reportIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HazardReport'
        }],

        center: {
            type: {
                type: String,
                enum: ['Point'],
                required: true
            },

            coordinates: {
                type: [Number],
                required: true,
                validate: {
                    validator: (coordinates) => (
                        coordinates.length === 2
                        && coordinates.every(Number.isFinite)
                    ),
                    message: 'Cluster center must contain longitude and latitude'
                }
            }
        },

        reportCount: {
            type: Number,
            default: 0,
            min: 0
        },

        firstReportedAt: {
            type: Date,
            required: true
        },

        lastReportedAt: {
            type: Date,
            required: true
        },

        status: {
            type: String,
            enum: ['active', 'closed'],
            default: 'active',
            required: true
        }
    },
    {
        timestamps: true
    }
)

reportClusterSchema.index({ center: '2dsphere' })
reportClusterSchema.index({
    hazardType: 1,
    status: 1,
    lastReportedAt: -1
})

const ReportCluster = mongoose.model(
    'ReportCluster',
    reportClusterSchema
)

export default ReportCluster