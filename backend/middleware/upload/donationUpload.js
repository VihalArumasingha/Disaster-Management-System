import multer from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import configureCloudinary from '../../config/cloudinary.js'

// Lazily build the real multer instance. This MUST NOT run at module-import
// time: in ESM, imported modules (this one included, via donationRoutes.js)
// are evaluated before server.js's own top-level code (which calls
// dotenv.config()). Configuring Cloudinary here eagerly would read empty
// env vars and throw. Building it on first use (first incoming request)
// guarantees dotenv has already loaded. Same pattern as disasterUpload.js.
let donationUploadInstance = null

const getDonationUpload = () => {
    if (!donationUploadInstance) {
        const cloudinary = configureCloudinary()

        // Donation slip/proof images are stored on Cloudinary so they are
        // reachable by URL from the dashboard (no express.static for uploads/).
        const storage = new CloudinaryStorage({
            cloudinary,
            params: {
                folder: 'ngo/donations',
                allowed_formats: ['jpg', 'jpeg', 'png'],
                resource_type: 'image'
            }
        })

        const fileFilter = (_req, file, cb) => {
            if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
                cb(null, true)
            } else {
                cb(new Error('Only PNG or JPG images are allowed.'), false)
            }
        }

        donationUploadInstance = multer({
            storage,
            fileFilter,
            limits: { fileSize: 2 * 1024 * 1024 } // 2 MB
        })
    }

    return donationUploadInstance
}

// Thin wrapper exposing the same API surface used by the routes
// (donationUpload.single('evidence')) while deferring instantiation.
const donationUpload = {
    single: (...args) => (req, res, next) => getDonationUpload().single(...args)(req, res, next)
}

export default donationUpload
