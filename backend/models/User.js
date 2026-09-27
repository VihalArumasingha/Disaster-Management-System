import mongoose from 'mongoose'

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

        role: {
            type: String,
            enum: [
                'CITIZEN',
                'DMC_OFFICER',
                'DUTY_OFFICER',
                'NGO_MANAGER'
            ],
            required: true
        }
    },
    {
        timestamps: true
    }
)

const User = mongoose.model('User', userSchema)

export default User