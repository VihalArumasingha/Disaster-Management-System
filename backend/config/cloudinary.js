import { v2 as cloudinary } from 'cloudinary'

let configured = false

const configureCloudinary = () => {
    if (!configured) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME
        const apiKey = process.env.CLOUDINARY_API_KEY
        const apiSecret = process.env.CLOUDINARY_API_SECRET

        console.log('Cloudinary config check:')
        console.log(
            'CLOUDINARY_CLOUD_NAME:',
            cloudName ? 'Set' : 'Missing'
        )
        console.log(
            'CLOUDINARY_API_KEY:',
            apiKey ? 'Set' : 'Missing'
        )
        console.log(
            'CLOUDINARY_API_SECRET:',
            apiSecret ? 'Set' : 'Missing'
        )

        if (!cloudName || !apiKey || !apiSecret) {
            throw new Error(
                'Cloudinary environment variables are missing'
            )
        }

        cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret
        })

        configured = true

        console.log('Cloudinary configured successfully')
    }

    return cloudinary
}

export default configureCloudinary