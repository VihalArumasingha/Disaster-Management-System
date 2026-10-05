import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import multer from 'multer'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const uploadDirectory = fileURLToPath(
    new URL('../../uploads/hazard-reports/', import.meta.url)
)

const imageExtensions = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/avif': '.avif',
    'image/heic': '.heic',
    'image/heif': '.heif'
}

mkdirSync(uploadDirectory, { recursive: true })

const storage = multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDirectory),
    filename: (_req, file, callback) => {
        const extension = imageExtensions[file.mimetype.toLowerCase()]
        callback(null, `${randomUUID()}${extension}`)
    }
})

const parsePhoto = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    fileFilter: (_req, file, callback) => {
        if (!imageExtensions[file.mimetype.toLowerCase()]) {
            const error = new Error('Choose a supported image file (JPEG, PNG, WebP, GIF, AVIF, or HEIC).')
            error.statusCode = 400
            callback(error)
            return
        }
        callback(null, true)
    }
}).single('photo')

const uploadMiddleware = (req, res, next) => {
    parsePhoto(req, res, (error) => {
        if (!error) return next()

        if (error.code === 'LIMIT_FILE_SIZE') {
            error.message = 'Photo must be 10 MB or smaller.'
            error.statusCode = 413
        } else if (!error.statusCode) {
            error.statusCode = 400
        }
        next(error)
    })
}

export default uploadMiddleware