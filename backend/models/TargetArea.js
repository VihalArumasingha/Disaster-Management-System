import mongoose from 'mongoose'

const targetAreaSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },
        areaType: {
            type: String,
            enum: [
                'river-flood',
                'coastal',
                'landslide',
                'storm',
                'tsunami',
                'other'
            ],
            required: true
        },
        hazardTypes: {
            type: [{
                type: String,
                enum: ['flood', 'landslide', 'tsunami', 'storm', 'other']
            }],
            required: true,
            validate: {
                validator: (hazards) => hazards.length > 0,
                message: 'Select at least one hazard type'
            }
        },
        description: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: ''
        },
        geometry: {
            type: {
                type: String,
                enum: ['Polygon'],
                required: true
            },
            coordinates: {
                type: [[[Number]]],
                required: true
            }
        },
        citizenIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    },
    { timestamps: true }
)

targetAreaSchema.index({ geometry: '2dsphere' })

const TargetArea = mongoose.model('TargetArea', targetAreaSchema)

export default TargetArea
