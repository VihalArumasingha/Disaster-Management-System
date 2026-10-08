import mongoose from 'mongoose'

const organizationContributionSchema = new mongoose.Schema(
    {
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true
        },
        contributionType: {
            type: String,
            enum: ['Financial', 'Goods', 'Service', 'Other'],
            required: true
        },
        description: { type: String, required: true, trim: true, maxlength: 1000 },
        amount: { type: Number, min: 0 },
        currency: { type: String, trim: true, maxlength: 10, default: 'LKR' },
        quantity: { type: Number, min: 0 },
        disasterEvent: { type: String, trim: true, maxlength: 200, default: '' },
        contributedAt: { type: Date, default: Date.now, required: true },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    },
    { timestamps: true }
)

organizationContributionSchema.index({ organization: 1, contributedAt: -1 })

export default mongoose.model('OrganizationContribution', organizationContributionSchema)
