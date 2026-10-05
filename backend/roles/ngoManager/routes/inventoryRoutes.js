import express from 'express'
import {
    getInventory,
    addInventoryItem,
    getTargetInventory,
    updateTargetInventory
} from '../controllers/inventoryController.js'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'

const inventoryRouter = express.Router()
const targetRouter = express.Router()

// ── /api/inventory ────────────────────────────────────────────────────────────
// GET: public (donation page reads current stock)
inventoryRouter.get('/', getInventory)
// POST: NGO manager only
inventoryRouter.post('/', authenticate, authorize(USER_ROLES.ngomanager), addInventoryItem)

// ── /api/targetinventories ────────────────────────────────────────────────────
// GET: public (donation page reads targets)
targetRouter.get('/', getTargetInventory)
// PUT: NGO manager only
targetRouter.put('/', authenticate, authorize(USER_ROLES.ngomanager), updateTargetInventory)

export { inventoryRouter, targetRouter }
