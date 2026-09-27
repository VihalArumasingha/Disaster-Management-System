import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import cookieParser from 'cookie-parser'

import connectDB from './config/db.js'

import authRoutes from './roles/auth/routes/authRoutes.js'
import citizenRoutes from './roles/citizen/routes/citizenRoutes.js'
import dmcOfficerRoutes from './roles/dmcOfficer/routes/dmcOfficerRoutes.js'
import dutyOfficerRoutes from './roles/dutyOfficer/routes/dutyOfficerRoutes.js'
import ngoManagerRoutes from './roles/ngoManager/routes/ngoManagerRoutes.js'
import weatherRoutes from './roles/weather/routes/weatherRoutes.js'

import errorMiddleware from './middleware/errorHandling/errorMiddleware.js'

dotenv.config()

const app = express()

connectDB()

app.use(
    cors({
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        credentials: true
    })
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

app.use('/api/citizen', citizenRoutes)
app.use('/api/dmc-officer', dmcOfficerRoutes)
app.use('/api/duty-officer', dutyOfficerRoutes)
app.use('/api/ngo-manager', ngoManagerRoutes)
app.use('/api/weather', weatherRoutes)

app.use(errorMiddleware)

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})