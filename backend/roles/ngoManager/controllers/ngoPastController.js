import mongoose from 'mongoose'
import { v2 as cloudinary } from 'cloudinary'
import NgoPastRecord from '../../../models/NgoPastRecord.js'
import configureCloudinary from '../../../config/cloudinary.js'

const toPublicRecord = (record) => ({
    id: String(record._id),
    note: record.note,
    images: Array.isArray(record.images)
        ? record.images.map((img) => ({ url: img.url, public_id: img.public_id }))
        : [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
})

const uploadedImagesOf = (req) =>
    (req.files || []).map((file) => ({
        url: file.path,
        public_id: file.filename
    }))

async function deleteCloudinaryImages(images) {
    const publicIds = (images || []).map((img) => img.public_id).filter(Boolean)
    if (publicIds.length === 0) return
    try {
        configureCloudinary()
        await cloudinary.api.delete_resources(publicIds)
    } catch (error) {
        console.error('Failed to delete NGO Past images:', error.message)
    }
}

/**
 * GET /api/ngopast?q=
 * Public — list records, newest first, optional ?q= search on the note.
 * Citizen mobile reads this too (expects `{ records }`).
 */
export async function getPastRecords(req, res, next) {
    try {
        const q = (req.query.q || '').trim()
        const filter = q ? { note: { $regex: q, $options: 'i' } } : {}
        const records = await NgoPastRecord.find(filter).sort({ createdAt: -1 }).lean()
        return res.json({ success: true, records: records.map(toPublicRecord) })
    } catch (err) {
        next(err)
    }
}

/** GET /api/ngopast/:recordId — public, a single record. */
export async function getPastRecordById(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.recordId)) {
            return res.status(400).json({ success: false, message: 'Invalid record id.' })
        }
        const record = await NgoPastRecord.findById(req.params.recordId).lean()
        if (!record) {
            return res.status(404).json({ success: false, message: 'NGO Past record not found' })
        }
        return res.json({ success: true, record: toPublicRecord(record) })
    } catch (err) {
        next(err)
    }
}
/**
 * POST /api/ngopast — NGO manager only.
 * Multipart form-data: `note` (required) + `images` (optional, max 2).
 */
export async function createPastRecord(req, res, next) {
    let created = null
    try {
        const note = String(req.body.note ?? '').trim()
        if (!note) {
            await deleteCloudinaryImages(uploadedImagesOf(req))
            return res.status(400).json({ success: false, message: 'Record note is required.' })
        }
        created = await NgoPastRecord.create({
            note,
            images: uploadedImagesOf(req),
            createdBy: req.user?._id
        })
        return res.status(201).json({ success: true, record: toPublicRecord(created.toObject()) })
    } catch (err) {
        if (!created) await deleteCloudinaryImages(uploadedImagesOf(req))
        if (err.name === 'ValidationError') {
            const details = Object.values(err.errors).map((e) => e.message)
            return res.status(400).json({ success: false, message: details.join('. ') })
        }
        next(err)
    }
}

/**
 * PUT /api/ngopast/:recordId — NGO manager only.
 * Multipart form-data: `note` (optional) + `images` (optional, max 2 —
 * replaces existing images only when new files are uploaded).
 */
export async function updatePastRecord(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.recordId)) {
            await deleteCloudinaryImages(uploadedImagesOf(req))
            return res.status(400).json({ success: false, message: 'Invalid record id.' })
        }
        const record = await NgoPastRecord.findById(req.params.recordId)
        if (!record) {
            await deleteCloudinaryImages(uploadedImagesOf(req))
            return res.status(404).json({ success: false, message: 'NGO Past record not found' })
        }
        if (req.body.note !== undefined) {
            const note = String(req.body.note ?? '').trim()
            if (!note) {
                await deleteCloudinaryImages(uploadedImagesOf(req))
                return res.status(400).json({ success: false, message: 'Record note is required.' })
            }
            record.note = note
        }
        const freshUploads = uploadedImagesOf(req)
        if (freshUploads.length > 0) {
            await deleteCloudinaryImages(record.images)
            record.images = freshUploads
        }
        await record.save()
        return res.json({ success: true, record: toPublicRecord(record.toObject()) })
    } catch (err) {
        if (err.name === 'ValidationError') {
            const details = Object.values(err.errors).map((e) => e.message)
            return res.status(400).json({ success: false, message: details.join('. ') })
        }
        next(err)
    }
}

/** DELETE /api/ngopast/:recordId — NGO manager only. */
export async function deletePastRecord(req, res, next) {
    try {
        if (!mongoose.isValidObjectId(req.params.recordId)) {
            return res.status(400).json({ success: false, message: 'Invalid record id.' })
        }
        const record = await NgoPastRecord.findByIdAndDelete(req.params.recordId)
        if (!record) {
            return res.status(404).json({ success: false, message: 'NGO Past record not found' })
        }
        await deleteCloudinaryImages(record.images)
        return res.json({ success: true, message: 'NGO Past record deleted' })
    } catch (err) {
        next(err)
    }
}
