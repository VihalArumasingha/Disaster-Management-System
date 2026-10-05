import mongoose from 'mongoose'

// Individual donation item record
const inventorySchema = new mongoose.Schema(
    {
        item: {
            type: String,
            enum: ['dry_rations', 'water', 'bedding', 'medical', 'clothing', 'hygiene'],
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 0
        },
        donorName: {
            type: String,
            trim: true,
            maxlength: 200
        },
        notes: {
            type: String,
            trim: true,
            maxlength: 500
        }
    },
    { timestamps: true }
)

inventorySchema.index({ item: 1 })
inventorySchema.index({ createdAt: -1 })

const Inventory = mongoose.model('Inventory', inventorySchema)
export default Inventory
