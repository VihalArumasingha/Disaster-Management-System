import { randomUUID } from 'node:crypto'
import mongoose from 'mongoose'

const reliefSupplySchema = new mongoose.Schema(
    {
        supplyId: {
            type: String,
            unique: true,
            default: () => `SUP-${randomUUID().slice(0, 8).toUpperCase()}`
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true
        },
        disasterEvent: { type: String, required: true, trim: true, maxlength: 200 },
        category: {
            type: String,
            enum: ['Food', 'Water', 'Medical', 'Shelter', 'Clothing', 'Hygiene', 'Equipment', 'Other'],
            required: true
        },
        supplyName: { type: String, required: true, trim: true, maxlength: 200 },
        unit: { type: String, required: true, trim: true, maxlength: 50 },
        quantityReceived: { type: Number, required: true, min: 0.001 },
        receivedDate: { type: Date, required: true },
        expiryDate: { type: Date, default: null },
        batchNumber: { type: String, trim: true, maxlength: 100, default: '' },
        storageLocation: { type: String, required: true, trim: true, maxlength: 300 },
        status: { type: String, enum: ['Available', 'On Hold'], default: 'Available', required: true },
        inventoryRevision: { type: Number, default: 0, select: false },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    },
    { timestamps: true }
)

reliefSupplySchema.index({ category: 1, receivedDate: -1 })
reliefSupplySchema.index({ disasterEvent: 1, status: 1 })

export default mongoose.model('ReliefSupply', reliefSupplySchema)
