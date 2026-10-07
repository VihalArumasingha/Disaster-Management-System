import multer from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import configureCloudinary from '../../config/cloudinary.js'

// Lazily build the real multer instance. This MUST NOT run at module-import
// time: in ESM, imported modules are evaluated before server.js's own
// top-level code (which calls dotenv.config()). Configuring Cloudinary here
// eagerly would read empty env vars and throw. Building it on first use
// (first incoming request) guarantees dotenv has already loaded.
// Same pattern as disasterUpload.js / donationUpload.js.
let ngoPastUploadInstance = null

const getNgoPastUpload = () => {
    if (!ngoPastUploadInstance) {
        const cloudinary = configureCloudinary()

        // NGO Past record images (max 2 per record) stored on Cloudinary so
        // they are reachable by URL from the dashboard (no express.static).
        const storage = new CloudinaryStorage({
            cloudinary,
            params: {
                folder: 'ngo/past',
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

        ngoPastUploadInstance = multer({
            storage,
            fileFilter,
            limits: { fileSize: 2 * 1024 * 1024 } // 2 MB
        })
    }

    return ngoPastUploadInstance
}

// Thin wrapper exposing the same API surface used by the routes
// (ngoPastUpload.array('images', 2)) while deferring instantiation.
const ngoPastUpload = {
    array: (...args) => (req, res, next) => getNgoPastUpload().array(...args)(req, res, next)
}

export default ngoPastUpload
