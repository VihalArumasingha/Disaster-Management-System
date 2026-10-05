/**
 * Seed script: sample collecting centers for the NGO dashboard demo.
 * Idempotent — skips a center whose name already exists.
 *
 * Usage (from backend/):  node scripts/seedCollectingCenters.js
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import CollectingCenter from '../models/CollectingCenter.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const SAMPLE_CENTERS = [
    {
        name: 'CenterWater',
        phone: '0718569320',
        address: 'Negombo Road, Battaramulla',
        city: 'Battaramulla',
        openingHours: '9.00 - 5.00',
        latitude: 6.9041,
        longitude: 79.8858,
        categories: ['Water']
    },
    {
        name: 'ClothingOne',
        phone: '0715623690',
        address: 'Colombo Road, Anuradhapura',
        city: 'Anuradhapura',
        openingHours: '8.00 - 10.00',
        latitude: 8.3516,
        longitude: 80.3910,
        categories: ['Clothing']
    },
    {
        name: 'Colombo Relief Center',
        phone: '0112345678',
        address: '123 Main Street, Colombo',
        city: 'Colombo',
        openingHours: '9.00 AM – 6.00 PM',
        latitude: 6.9271,
        longitude: 79.8612,
        categories: ['Food', 'Shelter', 'Water']
    }
]

async function main() {
    if (!process.env.MONGO_URI) {
        console.error('Missing MONGO_URI in backend/.env — aborting.')
        process.exit(1)
    }

    await mongoose.connect(process.env.MONGO_URI)
    console.log('MongoDB connected')

    let created = 0
    let skipped = 0
    for (const sample of SAMPLE_CENTERS) {
        const exists = await CollectingCenter.findOne({ name: sample.name })
        if (exists) {
            skipped += 1
            continue
        }
        await CollectingCenter.create(sample)
        created += 1
        console.log(`  + ${sample.name} (${sample.city})`)
    }

    console.log(`Done — created: ${created}, skipped (already present): ${skipped}`)
    await mongoose.disconnect()
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
