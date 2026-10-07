import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.join(__dirname, '.env')
console.log('Loading .env from:', envPath)
console.log('.env file exists:', fs.existsSync(envPath))

dotenv.config({ path: envPath })

console.log('After dotenv.config() - CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing')

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import connectDB from './config/db.js'

import authRoutes from './roles/auth/routes/authRoutes.js'
import citizenRoutes from './roles/citizen/routes/citizenRoutes.js'
import dmcOfficerRoutes from './roles/dmcOfficer/routes/dmcOfficerRoutes.js'
import dutyOfficerRoutes from './roles/dutyOfficer/routes/dutyOfficerRoutes.js'
import ngoManagerRoutes from './roles/ngoManager/routes/ngoManagerRoutes.js'
import donationRoutes from './roles/ngoManager/routes/donationRoutes.js'
import { inventoryRouter, targetRouter } from './roles/ngoManager/routes/inventoryRoutes.js'
import activeDisasterRoutes from './roles/ngoManager/routes/activeDisasterRoutes.js'
import collectingCenterRoutes from './roles/ngoManager/routes/collectingCenterRoutes.js'
import volunteerRoutes from './roles/ngoManager/routes/volunteerRoutes.js'
import { operationRouter, recordRouter } from './roles/ngoManager/routes/distributionRoutes.js'
import ngoPastRoutes from './roles/ngoManager/routes/ngoPastRoutes.js'
import weatherRoutes from './roles/weather/routes/weatherRoutes.js'
import { receiveTextBeeWebhook } from './roles/webhooks/textBeeWebhookController.js'
import {
    pollQueuedTextBeeDeliveries,
    processPendingTextBeeWebhookEvents
} from './roles/dmcOfficer/services/warningDeliveryService.js'

import errorMiddleware from './middleware/errorHandling/errorMiddleware.js'
import authenticate from './middleware/authentication/authMiddleware.js'
import { getReportPhoto } from './roles/citizen/controllers/hazardReportController.js'

const app = express()

connectDB().then(() => {
    processPendingTextBeeWebhookEvents().catch((error) => {
        console.error(`TextBee webhook recovery failed: ${error.message}`)
    })
    pollQueuedTextBeeDeliveries().catch((error) => {
        console.error(`TextBee delivery-status recovery failed: ${error.message}`)
    })
})

const clientOrigins = [
    ...(process.env.CLIENT_URLS || '').split(','),
    process.env.CLIENT_URL || ''
]
    .map((origin) => origin.trim())
    .filter(Boolean)

if (clientOrigins.length === 0) {
    clientOrigins.push('http://localhost:5173', 'http://localhost:5174')
} else if (process.env.NODE_ENV !== 'production') {
    clientOrigins.push('http://localhost:5173', 'http://localhost:5174')
}

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || clientOrigins.includes(origin)) {
                return callback(null, true)
            }

            return callback(new Error('Origin is not allowed by CORS'))
        },
        credentials: true
    })
)

app.post(
    '/api/webhooks/textbee',
    express.raw({ type: 'application/json', limit: '100kb' }),
    receiveTextBeeWebhook
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Disaster Management API is running'
    })
})

app.use('/api/auth', authRoutes)

app.get('/api/hazard-report-photos/:filename', authenticate, getReportPhoto)
app.use('/api/citizen', citizenRoutes)
app.use('/api/dmcofficer', dmcOfficerRoutes)
app.use('/api/dutyofficer', dutyOfficerRoutes)
app.use('/api/ngomanager', ngoManagerRoutes)
app.use('/api/donations', donationRoutes)
app.use('/api/inventory', inventoryRouter)
app.use('/api/targetinventories', targetRouter)
app.use('/api/activedisasters', activeDisasterRoutes)
app.use('/api/collectingcenters', collectingCenterRoutes)
app.use('/api/volunteers', volunteerRoutes)
app.use('/api/operations', operationRouter)
app.use('/api/distributionrecords', recordRouter)
app.use('/api/ngopast', ngoPastRoutes)
app.use('/api/weather', weatherRoutes)

app.use(errorMiddleware)

const textBeeEventWorker = setInterval(() => {
    processPendingTextBeeWebhookEvents().catch((error) => {
        console.error(`TextBee webhook processing failed: ${error.message}`)
    })
}, 5000)
textBeeEventWorker.unref()

const textBeeStatusWorker = setInterval(() => {
    pollQueuedTextBeeDeliveries().catch((error) => {
        console.error(`TextBee delivery-status polling failed: ${error.message}`)
    })
}, 5000)
textBeeStatusWorker.unref()

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})