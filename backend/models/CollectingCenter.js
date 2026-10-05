import mongoose from 'mongoose'

// A physical location where relief donations are collected from the public
const collectingCenterSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },
        phone: {
            type: String,
            required: true,
            trim: true,
            validate: {
                validator: (v) => /^\d{10}$/.test(v),
                message: 'Phone must be exactly 10 digits'
            }
        },
        address: {
            type: String,
            required: true,
            trim: true,
            maxlength: 300
        },
        city: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120
        },
        openingHours: {
            type: String,
            trim: true,
            maxlength: 120,
            default: ''
        },
        latitude: {
            type: Number,
            required: true,
            min: -90,
            max: 90
        },
        longitude: {
            type: Number,
            required: true,
            min: -180,
            max: 180
        },
        categories: {
            type: [{
                type: String,
                enum: ['Food', 'Medical', 'Clothing', 'Shelter', 'Water']
            }],
            default: []
        }
    },
    { timestamps: true }
)

collectingCenterSchema.index({ city: 1 })
collectingCenterSchema.index({ createdAt: -1 })

const CollectingCenter = mongoose.model('CollectingCenter', collectingCenterSchema)
export default CollectingCenter
