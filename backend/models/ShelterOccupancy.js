import mongoose from 'mongoose'

const shelterOccupancySchema = new mongoose.Schema(
    {
        shelter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shelter',
            required: true,
            index: true
        },
        shelterId: { type: String, required: true, index: true },
        occupancyCount: { type: Number, required: true, min: 0, validate: Number.isInteger },
        recordedAt: { type: Date, default: Date.now, required: true },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        disasterEvent: { type: String, trim: true, maxlength: 200, default: '' }
    },
    { timestamps: true }
)

export default mongoose.model('ShelterOccupancy', shelterOccupancySchema)