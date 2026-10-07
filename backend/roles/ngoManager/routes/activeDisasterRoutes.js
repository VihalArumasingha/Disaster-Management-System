import express from 'express'
import { getPublicActiveDisasters } from '../controllers/activeDisasterController.js'

const activeDisasterRouter = express.Router()

// ── /api/activedisasters ─────────────────────────────────────────────────────
// GET: public (donation/support page reads active disasters + their top needs)
activeDisasterRouter.get('/', getPublicActiveDisasters)

export default activeDisasterRouter
