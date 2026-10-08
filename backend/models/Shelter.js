import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

const shelterSchema = new mongoose.Schema(
    {
        shelterId: {
            type: String,
            unique: true,
            default: () => `SH-${randomUUID().slice(0, 8).toUpperCase()}`
        },
        shelterName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },
        district: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
            enum: [
                'Ampara',
                'Anuradhapura',
                'Badulla',
                'Batticaloa',
                'Colombo',
                'Galle',
                'Gampaha',
                'Hambantota',
                'Jaffna',
                'Kalutara',
                'Kandy',
                'Kegalle',
                'Kilinochchi',
                'Kurunegala',
                'Mannar',
                'Matale',
                'Matara',
                'Monaragala',
                'Mullaitivu',
                'Nuwara Eliya',
                'Polonnaruwa',
                'Puttalam',
                'Ratnapura',
                'Trincomalee',
                'Vavuniya'
            ]
        },
        address: { type: String, required: true, trim: true, maxlength: 500 },
        shelterType: {
            type: String,
            enum: ['School', 'Community Hall', 'Religious Facility', 'Government Building', 'Temporary Camp', 'Other'],
            required: true
        },
        capacity: { type: Number, required: true, min: 1, validate: Number.isInteger },
        currentOccupancy: {
            type: Number,
            default: 0,
            min: 0,
            validate: [
                { validator: Number.isInteger, message: 'Current occupancy must be a whole number' },
                {
                    validator: function (value) {
                        return value <= this.capacity
                    },
                    message: 'Current occupancy cannot exceed shelter capacity'
                }
            ]
        },
        contactPerson: { type: String, required: true, trim: true, maxlength: 200 },
        contactNumber: { type: String, required: true, trim: true, maxlength: 30 },
        facilities: [{ type: String, trim: true, maxlength: 100 }],
        disasterEvent: { type: String, trim: true, maxlength: 200, default: '' },
        status: {
            type: String,
            enum: ['Active', 'Inactive', 'Full', 'Closed'],
            default: 'Active'
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    },
    { timestamps: true }
)

shelterSchema.virtual('availableCapacity').get(function () {
    return this.capacity - this.currentOccupancy
})

shelterSchema.set('toJSON', { virtuals: true })
shelterSchema.set('toObject', { virtuals: true })
shelterSchema.index({ district: 1, status: 1 })

export default mongoose.model('Shelter', shelterSchema)