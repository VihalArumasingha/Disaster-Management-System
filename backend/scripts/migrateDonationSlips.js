/**
 * One-time migration: donation slips that were uploaded while the API used
 * local multer disk storage (backend stored an absolute Windows path like
 * C:\...\uploads\donations\x.jpg, which was never publicly served).
 *
 * Uploads each local file to Cloudinary (folder: ngo/donations) and rewrites
 * Donation.evidencePath to the Cloudinary secure URL. Idempotent — rows that
 * already hold an http(s) URL are skipped.
 *
 * Usage (from backend/):  node scripts/migrateDonationSlips.js
 */
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { v2 as cloudinary } from 'cloudinary'
import Donation from '../models/Donation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.join(__dirname, '..', '.env') })

// Locations where the old diskStorage could have written files
const LEGACY_ROOTS = [
    path.join(__dirname, '..', '..', 'uploads', 'donations'), // NGO/uploads/donations
    path.join(__dirname, '..', 'uploads', 'donations')        // backend/uploads/donations
]

const resolveLocalFile = (stored) => {
    if (stored && fs.existsSync(stored)) return stored
    const base = path.basename(String(stored || ''))
    if (!base) return null
    for (const root of LEGACY_ROOTS) {
        const candidate = path.join(root, base)
        if (fs.existsSync(candidate)) return candidate
    }
    return null
}

async function main() {
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, MONGO_URI } = process.env

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
        console.error('Missing Cloudinary env vars in backend/.env — aborting.')
        process.exit(1)
    }
    if (!MONGO_URI) {
        console.error('Missing MONGO_URI in backend/.env — aborting.')
        process.exit(1)
    }

    cloudinary.config({
        cloud_name: CLOUDINARY_CLOUD_NAME,
        api_key: CLOUDINARY_API_KEY,
        api_secret: CLOUDINARY_API_SECRET
    })

    await mongoose.connect(MONGO_URI)
    console.log('MongoDB connected')

    // Rows whose evidencePath is not already an absolute URL
    const rows = await Donation.find({
        evidencePath: { $exists: true, $ne: null, $not: /^https?:\/\//i }
    }).lean()

    console.log(`Found ${rows.length} donation(s) with legacy local slip path(s).`)

    let migrated = 0
    let skipped = 0
    const failures = []

    for (const row of rows) {
        const label = `${row._id} (${row.donorName || row.donorEmail || 'unknown donor'})`

        const localFile = resolveLocalFile(row.evidencePath)
        if (!localFile) {
            console.warn(`  ! SKIP ${label} — local file not found for: ${row.evidencePath}`)
            failures.push({ id: String(row._id), reason: 'local file missing' })
            skipped++
            continue
        }

        try {
            const result = await cloudinary.uploader.upload(localFile, {
                folder: 'ngo/donations',
                resource_type: 'image'
            })

            await Donation.updateOne(
                { _id: row._id },
                { $set: { evidencePath: result.secure_url } }
            )

            console.log(`  ✓ ${label}`)
            console.log(`      ${row.evidencePath}`)
            console.log(`   -> ${result.secure_url}`)
            migrated++
        } catch (err) {
            console.error(`  ! FAIL ${label} — ${err.message}`)
            failures.push({ id: String(row._id), reason: err.message })
        }
    }

    console.log('\n──── Summary ────')
    console.log(`Migrated: ${migrated}`)
    console.log(`Skipped:  ${skipped}`)
    if (failures.length) {
        console.log('Failures:', JSON.stringify(failures, null, 2))
    }

    await mongoose.disconnect()
    process.exit(failures.length ? 1 : 0)
}

main().catch(err => {
    console.error('Migration failed:', err)
    process.exit(1)
})