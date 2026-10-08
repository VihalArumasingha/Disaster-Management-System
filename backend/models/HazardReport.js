import mongoose from 'mongoose'

const hazardReportSchema = new mongoose.Schema(
    {
        reporterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        clusterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ReportCluster'
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

        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 4000
        },

        photo: {
            url: {
                type: String,
                trim: true
            },
            capturedAt: {
                type: Date
            }
        },

        location: {
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
                    message: 'Location must contain longitude and latitude'
                }
            }
        },

        district: {
            type: String,
            trim: true,
            maxlength: 50
        },

        capturedAt: {
            type: Date,
            required: true
        },

        submittedAt: {
            type: Date,
            default: Date.now
        },

        status: {
            type: String,
            enum: ['pending', 'verified', 'rejected'],
            default: 'pending',
            required: true
        },

        archived: {
            type: Boolean,
            default: false,
            index: true
        },

        archive: {
            archivedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            archivedAt: {
                type: Date
            }
        },

        syncStatus: {
            type: String,
            enum: ['synced'],
            default: 'synced',
            required: true
        },

        verification: {
            verifiedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            verifiedAt: {
                type: Date
            },
            rejectionReason: {
                type: String,
                trim: true,
                maxlength: 1000
            }
        }
    },
    {
        timestamps: true
    }
)

hazardReportSchema.index({ location: '2dsphere' })
hazardReportSchema.index({ reporterId: 1, createdAt: -1 })
hazardReportSchema.index({ status: 1, createdAt: -1 })
hazardReportSchema.index({ district: 1, status: 1, createdAt: -1 })
hazardReportSchema.index({ archived: 1, status: 1, submittedAt: -1 })


const HazardReport = mongoose.model(
    'HazardReport',
    hazardReportSchema
)

export default HazardReport