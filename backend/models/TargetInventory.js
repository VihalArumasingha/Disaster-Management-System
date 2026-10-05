import mongoose from 'mongoose'

// Single document holding the target quantities for each item type
const targetInventorySchema = new mongoose.Schema(
    {
        dry_rations: { type: Number, default: 100, min: 0 },
        water:       { type: Number, default: 100, min: 0 },
        bedding:     { type: Number, default: 50,  min: 0 },
        medical:     { type: Number, default: 50,  min: 0 },
        clothing:    { type: Number, default: 50,  min: 0 },
        hygiene:     { type: Number, default: 100, min: 0 }
    },
    { timestamps: true }
)

const TargetInventory = mongoose.model('TargetInventory', targetInventorySchema)
export default TargetInventory
