import multer from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import configureCloudinary from '../../config/cloudinary.js'

// Lazily build the real multer instance. This MUST NOT run at module-import
// time: in ESM, imported modules (this one included, via ngoManagerRoutes.js)
// are evaluated before server.js's own top-level code (which calls
// dotenv.config()). Configuring Cloudinary here eagerly would read empty
// env vars and throw. Building it on first use (first incoming request)
// guarantees dotenv has already loaded.
let disasterUploadInstance = null

const getDisasterUpload = () => {
    if (!disasterUploadInstance) {
        const cloudinary = configureCloudinary()

        const storage = new CloudinaryStorage({
            cloudinary,
            params: {
                folder: 'ngo/disasters',
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

        disasterUploadInstance = multer({
            storage,
            fileFilter,
            limits: { fileSize: 2 * 1024 * 1024 } // 2 MB
        })
    }

    return disasterUploadInstance
}

// Thin wrapper exposing the same API surface used by the routes
// (disasterUpload.array('images', 4)) while deferring instantiation.
const disasterUpload = {
    array: (...args) => (req, res, next) => getDisasterUpload().array(...args)(req, res, next)
}

export default disasterUpload

