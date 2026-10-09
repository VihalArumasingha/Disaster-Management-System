import mongoose from 'mongoose'
import { USER_ROLES } from '../utils/constants.js'

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        nationalId: {
            type: String,
            trim: true
        },

        homeAddress: {
            type: String,
            trim: true
        },

        district: {
            type: String,
            trim: true
        },

        location: {
            type: {
                type: String,
                enum: ['Point']
            },
            coordinates: {
                type: [Number],
                validate: {
                    validator: (coordinates) => (
                        coordinates.length === 2
                        && coordinates.every(Number.isFinite)
                    ),
                    message: 'Location must contain longitude and latitude'
                }
            }
        },

        role: {
            type: String,
            enum: Object.values(USER_ROLES),
            default: USER_ROLES.citizen,
            required: true
        }
    },
    {
        timestamps: true
    }
)

userSchema.index({ location: '2dsphere' }, { sparse: true })

const User = mongoose.model('User', userSchema)

export default User