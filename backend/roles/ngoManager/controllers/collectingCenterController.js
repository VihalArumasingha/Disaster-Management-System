import CollectingCenter from '../../../models/CollectingCenter.js'

const CATEGORIES = ['Food', 'Medical', 'Clothing', 'Shelter', 'Water']

/** Normalise the request body into something the schema accepts. */
function parseBody(body) {
    const rawCategories = Array.isArray(body.categories) ? body.categories : []
    return {
        name: (body.name ?? '').trim(),
        phone: String(body.phone ?? '').replace(/\D/g, ''),
        address: (body.address ?? '').trim(),
        city: (body.city ?? '').trim(),
        openingHours: (body.openingHours ?? '').trim(),
        latitude: Number(body.latitude),
        longitude: Number(body.longitude),
        categories: rawCategories.filter((c) => CATEGORIES.includes(c))
    }
}

/**
 * GET /api/collectingcenters
 * Public — list collecting centers, optionally filtered by ?q= (name/city).
 */
export async function getCollectingCenters(req, res, next) {
    try {
        const q = (req.query.q || '').trim()
        const filter = q
            ? {
                $or: [
                    { name: { $regex: q, $options: 'i' } },
                    { city: { $regex: q, $options: 'i' } },
                    { address: { $regex: q, $options: 'i' } }
                ]
            }
            : {}

        const centers = await CollectingCenter.find(filter)
            .sort({ createdAt: -1 })
            .lean()

        return res.json({ success: true, centers })
    } catch (err) {
        next(err)
    }
}

/**
 * POST /api/collectingcenters
 * NGO manager only — create a collecting center.
 */
export async function createCollectingCenter(req, res, next) {
    try {
        const center = await CollectingCenter.create(parseBody(req.body))
        return res.status(201).json({ success: true, center })
    } catch (err) {
        if (err.name === 'ValidationError') {
            const details = Object.values(err.errors).map((e) => e.message)
            return res.status(400).json({ success: false, message: details.join('. ') })
        }
        next(err)
    }
}

/**
 * PUT /api/collectingcenters/:centerId
 * NGO manager only — update a collecting center.
 */
export async function updateCollectingCenter(req, res, next) {
    try {
        const center = await CollectingCenter.findByIdAndUpdate(
            req.params.centerId,
            parseBody(req.body),
            { new: true, runValidators: true }
        )
        if (!center) {
            return res.status(404).json({ success: false, message: 'Collecting center not found' })
        }
        return res.json({ success: true, center })
    } catch (err) {
        if (err.name === 'ValidationError') {
            const details = Object.values(err.errors).map((e) => e.message)
            return res.status(400).json({ success: false, message: details.join('. ') })
        }
        next(err)
    }
}

/**
 * DELETE /api/collectingcenters/:centerId
 * NGO manager only — remove a collecting center.
 */
export async function deleteCollectingCenter(req, res, next) {
    try {
        const center = await CollectingCenter.findByIdAndDelete(req.params.centerId)
        if (!center) {
            return res.status(404).json({ success: false, message: 'Collecting center not found' })
        }
        return res.json({ success: true, message: 'Collecting center deleted' })
    } catch (err) {
        next(err)
    }
}
