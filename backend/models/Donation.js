import mongoose from 'mongoose'

const donationSchema = new mongoose.Schema(
    {
        donorType: {
            type: String,
            enum: ['Individual', 'Organization'],
            required: true
        },
        donorName: {
            type: String,
            trim: true,
            maxlength: 200
        },
        donorEmail: {
            type: String,
            trim: true,
            lowercase: true,
            maxlength: 200
        },
        donorPhone: {
            type: String,
            trim: true,
            maxlength: 20
        },
        donorAddress: {
            type: String,
            trim: true,
            maxlength: 500
        },
        whatsapp: {
            type: String,
            trim: true,
            maxlength: 20
        },

        amount: {
            type: Number,
            required: true,
            min: 0
        },
        currency: {
            type: String,
            trim: true,
            default: 'LKR',
            maxlength: 10
        },
        channel: {
            type: String,
            trim: true,
            maxlength: 100
        },

        isAnonymous: {
            type: Boolean,
            default: false
        },
        allowNamePublic: {
            type: Boolean,
            default: true
        },

        // Bank deposit fields
        bankName: {
            type: String,
            trim: true,
            maxlength: 200
        },
        branch: {
            type: String,
            trim: true,
            maxlength: 200
        },
        depositDate: {
            type: Date
        },
        depositorName: {
            type: String,
            trim: true,
            maxlength: 200
        },
        referenceNo: {
            type: String,
            trim: true,
            maxlength: 200
        },

        // Uploaded proof image path (relative to uploads/)
        evidencePath: {
            type: String,
            trim: true
        },

        status: {
            type: String,
            enum: ['RECEIVED', 'VERIFIED', 'REJECTED'],
            default: 'RECEIVED'
        }
    },
    {
        timestamps: true
    }
)

donationSchema.index({ createdAt: -1 })
donationSchema.index({ donorEmail: 1 })
donationSchema.index({ status: 1 })

const Donation = mongoose.model('Donation', donationSchema)

export default Donation
