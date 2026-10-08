import dotenv from 'dotenv'
import mongoose from 'mongoose'

import HazardReport from '../models/HazardReport.js'
import getDistrictFromCoordinates from '../utils/districtLookup.js'

dotenv.config()

const run = async () => {
    try {
        await mongoose.connect(
            process.env.MONGO_URI
        )

        console.log(
            'MongoDB connected'
        )

        const reports = await HazardReport.find({
            $or: [
                {
                    district: {
                        $exists: false
                    }
                },
                {
                    district: null
                },
                {
                    district: ''
                }
            ]
        })

        console.log(
            `Found ${reports.length} reports without districts`
        )

        let updated = 0
        let failed = 0

        for (const report of reports) {
            const coordinates =
                report.location?.coordinates

            if (
                !Array.isArray(coordinates)
                || coordinates.length !== 2
            ) {
                console.log(
                    `Skipping ${report._id}: invalid coordinates`
                )

                failed++
                continue
            }

            const [
                longitude,
                latitude
            ] = coordinates

            const district =
                await getDistrictFromCoordinates(
                    longitude,
                    latitude
                )

            if (!district) {
                console.log(
                    `Could not determine district for ${report._id}`
                )

                failed++
                continue
            }

            report.district = district

            await report.save()

            updated++

            console.log(
                `${report._id} → ${district}`
            )
        }

        console.log('')
        console.log('Backfill complete')
        console.log(`Updated: ${updated}`)
        console.log(`Failed: ${failed}`)
    } catch (error) {
        console.error(
            'District backfill failed:',
            error
        )

        process.exitCode = 1
    } finally {
        await mongoose.disconnect()
    }
}

run()