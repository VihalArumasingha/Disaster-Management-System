import mongoose from 'mongoose'

const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
    'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy',
    'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale',
    'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa',
    'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
]

const impactRecordSchema = new mongoose.Schema(
    {
        disasterEvent: { type: String, required: true, trim: true, maxlength: 200 },
        district: { type: String, required: true, enum: districts },
        affectedPopulation: { type: Number, required: true, min: 0, validate: Number.isInteger },
        evacuatedPopulation: { type: Number, required: true, min: 0, validate: Number.isInteger },
        peopleInShelters: { type: Number, required: true, min: 0, validate: Number.isInteger },
        injured: { type: Number, required: true, min: 0, validate: Number.isInteger },
        deaths: { type: Number, required: true, min: 0, validate: Number.isInteger },
        housesDamaged: { type: Number, required: true, min: 0, validate: Number.isInteger },
        schoolsAffected: { type: Number, required: true, min: 0, validate: Number.isInteger },
        roadsBlocked: { type: Number, required: true, min: 0, validate: Number.isInteger },
        hospitalsAffected: { type: Number, required: true, min: 0, validate: Number.isInteger },
        otherImpact: { type: String, trim: true, maxlength: 2000, default: '' },
        recordedDate: { type: Date, required: true },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    },
    { timestamps: true }
)

impactRecordSchema.index({ district: 1, recordedDate: -1 })
impactRecordSchema.index({ disasterEvent: 1, recordedDate: -1 })

export default mongoose.model('ImpactRecord', impactRecordSchema)
