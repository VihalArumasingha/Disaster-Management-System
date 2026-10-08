import express from 'express'
import {
    generateAnalytics,
    getAnalyticsOptions,
    logReportExport
} from '../controllers/analyticsController.js'

const router = express.Router()

router.get('/analytics/options', getAnalyticsOptions)
router.post('/analytics/generate', generateAnalytics)
router.post('/analytics/exports', logReportExport)

export default router
