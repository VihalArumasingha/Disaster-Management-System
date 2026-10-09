import mongoose from 'mongoose'

const reliefDeploymentSchema = new mongoose.Schema(
    {
        reportId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'HazardReport',
            required: true
        },
        reporterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        team: {
            type: String,
            enum: ['Army', 'Police', 'Fire Brigade'],
            required: true
        },
        teamName: { type: String, required: true, trim: true, maxlength: 120 },
        dmoContact: { type: String, required: true, trim: true, maxlength: 30 },
        notes: { type: String, default: '', trim: true, maxlength: 4000 },
        special: { type: String, default: '', trim: true, maxlength: 2000 },
        risk: { type: String, default: 'medium', trim: true, maxlength: 20 },
        urgent: { type: String, default: 'Medium', trim: true, maxlength: 20 },
        status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed'],
            default: 'In Progress'
        },
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    { timestamps: true }
)

reliefDeploymentSchema.index({ reportId: 1, team: 1 })
reliefDeploymentSchema.index({ reporterId: 1, createdAt: -1 })
reliefDeploymentSchema.index({ status: 1, createdAt: -1 })

const ReliefDeployment = mongoose.model('ReliefDeployment', reliefDeploymentSchema)

export default ReliefDeployment
