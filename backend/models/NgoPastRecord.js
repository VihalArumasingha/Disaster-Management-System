import mongoose from 'mongoose'

/**
 * An "NGO Past Record" — a note documenting an impactful moment plus
 * up to 2 Cloudinary-hosted images.
 * Served by /api/ngopast; reads are public, writes need an NGO session.
 */
const ngoPastImageSchema = new mongoose.Schema(
    {
        url: {
            type: String,
            required: true,
            trim: true
        },
        public_id: {
            type: String,
            trim: true
        }
    },
    { _id: false }
)

const ngoPastRecordSchema = new mongoose.Schema(
    {
        note: {
            type: String,
            required: [true, 'Record note is required'],
            trim: true,
            maxlength: [2000, 'Record note cannot exceed 2000 characters']
        },
        images: {
            type: [ngoPastImageSchema],
            default: [],
            validate: {
                validator: (images) => images.length <= 2,
                message: 'A record can have at most 2 images'
            }
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    { timestamps: true }
)

ngoPastRecordSchema.index({ createdAt: -1 })

const NgoPastRecord = mongoose.model('NgoPastRecord', ngoPastRecordSchema)

export default NgoPastRecord
