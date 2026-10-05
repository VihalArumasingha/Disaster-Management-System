import express from 'express'
import { getHazardReviewStatus } from '../controllers/hazardReviewController.js'

const router = express.Router()

router.get('/status', getHazardReviewStatus)

export default router