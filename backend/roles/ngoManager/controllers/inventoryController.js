import Inventory from '../../../models/Inventory.js'
import TargetInventory from '../../../models/TargetInventory.js'

const VALID_ITEMS = ['dry_rations', 'water', 'bedding', 'medical', 'clothing', 'hygiene']

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
        const { item, quantity, unit, center, date, donorName, notes } = req.body

        if (!item || !VALID_ITEMS.includes(item)) {
            return res.status(400).json({ success: false, message: 'Invalid item type.' })
        }
        const qty = Number(quantity)
        if (!quantity || isNaN(qty) || qty <= 0) {
            return res.status(400).json({ success: false, message: 'quantity must be a positive number.' })
        }

        let parsedDate
        if (date) {
            parsedDate = new Date(date)
            if (Number.isNaN(parsedDate.getTime())) {
                return res.status(400).json({ success: false, message: 'date must be a valid date.' })
            }
        }

        const doc = await Inventory.create({
            item,
            quantity: qty,
            unit: typeof unit === 'string' ? unit.trim() : undefined,
            center: typeof center === 'string' ? center.trim() : undefined,
            date: parsedDate,
            donorName,
            notes
        })
        return res.status(201).json({ success: true, data: doc })
    } catch (err) {
        next(err)
    }
}

/**
 * PUT /api/inventory/:itemId
 * Update an inventory item (NGO manager only)
 */
export async function updateInventoryItem(req, res, next) {
    try {
        const doc = await Inventory.findById(req.params.itemId)
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Inventory item not found.' })
        }

        const { item, quantity, unit, center, date, donorName, notes } = req.body

        if (item !== undefined) {
            if (!VALID_ITEMS.includes(item)) {
                return res.status(400).json({ success: false, message: 'Invalid item type.' })
            }
            doc.item = item
        }
        if (quantity !== undefined) {
            const qty = Number(quantity)
            if (isNaN(qty) || qty < 0) {
                return res.status(400).json({ success: false, message: 'quantity must be a non-negative number.' })
            }
            doc.quantity = qty
        }
        if (unit !== undefined) doc.unit = String(unit).trim()
        if (center !== undefined) doc.center = String(center).trim()
        if (date !== undefined) {
            const parsedDate = new Date(date)
            if (Number.isNaN(parsedDate.getTime())) {
                return res.status(400).json({ success: false, message: 'date must be a valid date.' })
            }
            doc.date = parsedDate
        }
        if (donorName !== undefined) doc.donorName = donorName
        if (notes !== undefined) doc.notes = notes

        await doc.save()
        return res.json({ success: true, data: doc })
    } catch (err) {
        next(err)
    }
}

/**
 * DELETE /api/inventory/:itemId
 * Remove an inventory item (NGO manager only)
 */
export async function deleteInventoryItem(req, res, next) {
    try {
        const doc = await Inventory.findByIdAndDelete(req.params.itemId)
        if (!doc) {
            return res.status(404).json({ success: false, message: 'Inventory item not found.' })
        }
        return res.json({ success: true, data: doc })
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
