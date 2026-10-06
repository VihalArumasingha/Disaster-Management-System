import mongoose from 'mongoose'

// A volunteer (individual or team) registered for NGO operations.
// Bound explicitly to the pre-existing `volunteers` collection in MongoDB Atlas.
const assignmentSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: ['ASSIGNED', 'UNASSIGNED'],
            default: 'UNASSIGNED'
        },
        operationName: { type: String, default: '' },
        date: { type: String, default: '' }
    },
    { _id: false }
)

const volunteerSchema = new mongoose.Schema(
    {
        volunteerType: {
            type: String,
            enum: ['individual', 'team'],
            default: 'individual'
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 160
        },
        phone: {
            type: String,
            required: true,
            trim: true,
            maxlength: 30
        },
        email: { type: String, trim: true, maxlength: 160, default: '' },
        whatsapp: { type: String, trim: true, maxlength: 30, default: '' },
        livingArea: { type: String, trim: true, maxlength: 160, default: '' },
        group: { type: String, trim: true, maxlength: 160, default: '' },
        roles: { type: [String], default: [] },
        languages: { type: [String], default: [] },
        availableDate: { type: String, default: '' },
        availableTime: {
            type: String,
            enum: ['daytime', 'night', 'both'],
            default: 'both'
        },
        operationId: { type: String, default: '' },
        operationName: { type: String, trim: true, maxlength: 200, default: '' },
        members: { type: Number, min: 1, default: 1 },
        notes: { type: String, default: '', maxlength: 1000 },
        assignment: {
            type: assignmentSchema,
            default: () => ({ status: 'UNASSIGNED' })
        }
    },
    {
        timestamps: true,
        // Tolerate documents already present in the collection (e.g. posted by
        // the mobile app) that may carry extra/missing fields.
        strict: false,
        collection: 'volunteers'
    }
)

volunteerSchema.index({ fullName: 1 })
volunteerSchema.index({ 'assignment.status': 1 })
volunteerSchema.index({ createdAt: -1 })

const Volunteer = mongoose.model('Volunteer', volunteerSchema)
export default Volunteer
