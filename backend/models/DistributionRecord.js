import mongoose from 'mongoose'

/**
 * One "Track Distribution Quantities" entry: how many families were assisted
 * and how many resource units were handed out on a given date.
 * Served by /api/distributionrecords and charted on the Relief Distribution page.
 */
const distributionRecordSchema = new mongoose.Schema(
    {
        date: {
            type: String,
            required: [true, 'Date is required'],
            trim: true,
            match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format']
        },
        familiesAssisted: {
            type: Number,
            required: [true, 'Families assisted is required'],
            min: [0, 'Families assisted cannot be negative']
        },
        resourcesDistributed: {
            type: Number,
            required: [true, 'Resources distributed is required'],
            min: [0, 'Resources distributed cannot be negative']
        }
    },
    { timestamps: true }
)

distributionRecordSchema.index({ date: -1 })

const DistributionRecord = mongoose.model('DistributionRecord', distributionRecordSchema)

export default DistributionRecord