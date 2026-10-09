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
                allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
                resource_type: 'image'
            }
        })

        const fileFilter = (_req, file, cb) => {
            // Accept webp too: phone cameras/browsers often send image/webp
            // even when the picker label says JPEG/PNG.
            if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype)) {
                cb(null, true)
            } else {
                const err = new Error('Only JPEG, PNG or WebP images are allowed.')
                err.statusCode = 400
                cb(err, false)
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
// Multer errors (bad type, >2MB) are converted to 400 JSON instead of
// falling through to the generic 500 error handler.
const ngoPastUpload = {
    array: (...args) => (req, res, next) => {
        let handler
        try {
            handler = getNgoPastUpload().array(...args)
        } catch (err) {
            err.statusCode = err.statusCode || 500
            return next(err)
        }
        return handler(req, res, (err) => {
            if (err) {
                if (err instanceof multer.MulterError) {
                    err.statusCode = 400
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        err.message = 'Each image must be 2 MB or smaller.'
                    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                        err.message = 'A record can have at most 2 images.'
                    }
                } else if (!err.statusCode) {
                    err.statusCode = 400
                }
            }
            return next(err)
        })
    }
}

export default ngoPastUpload
