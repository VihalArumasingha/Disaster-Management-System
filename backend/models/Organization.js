import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

const organizationSchema = new mongoose.Schema(
    {
        organizationId: {
            type: String,
            unique: true,
            default: () => `ORG-${randomUUID().slice(0, 8).toUpperCase()}`
        },
        organizationName: { type: String, required: true, trim: true, maxlength: 200 },
        organizationType: {
            type: String,
            enum: ['NGO', 'Donor', 'Government Agency', 'International Organization', 'Private Organization'],
            required: true
        },
        registrationNumber: { type: String, trim: true, maxlength: 100, default: '' },
        contactPerson: { type: String, required: true, trim: true, maxlength: 200 },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            maxlength: 200,
            match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address']
        },
        phone: { type: String, required: true, trim: true, maxlength: 30 },
        address: { type: String, required: true, trim: true, maxlength: 500 },
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
        description: { type: String, trim: true, maxlength: 2000, default: '' },
        status: {
            type: String,
            enum: ['Pending Verification', 'Active', 'Suspended', 'Inactive'],
            default: 'Pending Verification'
        },
        userAccount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    },
    { timestamps: true }
)

organizationSchema.index({ organizationName: 1 })
organizationSchema.index({ organizationType: 1, status: 1 })
organizationSchema.index(
    { userAccount: 1 },
    { unique: true, partialFilterExpression: { userAccount: { $type: 'objectId' } } }
)

export default mongoose.model('Organization', organizationSchema)