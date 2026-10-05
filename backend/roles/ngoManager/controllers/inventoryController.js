import Inventory from '../../../models/Inventory.js'
import TargetInventory from '../../../models/TargetInventory.js'

/**
 * GET /api/inventory
 * Public — returns all inventory items grouped summary
 */
export async function getInventory(req, res, next) {
    try {
        const items = await Inventory.find({}).lean()
        return res.json({ success: true, items })
    } catch (err) {
        next(err)
    }
}

/**
 * POST /api/inventory
 * Add an inventory item (NGO manager only, wired separately)
 */
export async function addInventoryItem(req, res, next) {
    try {
        const { item, quantity, donorName, notes } = req.body
        const VALID_ITEMS = ['dry_rations', 'water', 'bedding', 'medical', 'clothing', 'hygiene']

        if (!item || !VALID_ITEMS.includes(item)) {
            return res.status(400).json({ success: false, message: 'Invalid item type.' })
        }
        const qty = Number(quantity)
        if (!quantity || isNaN(qty) || qty <= 0) {
            return res.status(400).json({ success: false, message: 'quantity must be a positive number.' })
        }

        const doc = await Inventory.create({ item, quantity: qty, donorName, notes })
        return res.status(201).json({ success: true, data: doc })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /api/targetinventories
 * Public — returns target quantities (creates default if none exists)
 */
export async function getTargetInventory(req, res, next) {
    try {
        let target = await TargetInventory.findOne({}).lean()
        if (!target) {
            // Auto-seed defaults on first request
            target = await TargetInventory.create({})
        }
        return res.json(target)
    } catch (err) {
        next(err)
    }
}

/**
 * PUT /api/targetinventories
 * Update target quantities (NGO manager only)
 */
export async function updateTargetInventory(req, res, next) {
    try {
        const VALID_KEYS = ['dry_rations', 'water', 'bedding', 'medical', 'clothing', 'hygiene']
        const updates = {}
        for (const key of VALID_KEYS) {
            if (req.body[key] !== undefined) {
                const val = Number(req.body[key])
                if (!isNaN(val) && val >= 0) updates[key] = val
            }
        }

        let target = await TargetInventory.findOne({})
        if (!target) target = new TargetInventory({})
        Object.assign(target, updates)
        await target.save()

        return res.json({ success: true, data: target })
    } catch (err) {
        next(err)
    }
}
