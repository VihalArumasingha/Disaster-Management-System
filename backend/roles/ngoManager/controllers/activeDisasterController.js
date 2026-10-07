import Warning from '../../../models/Warning.js'

/**
 * GET /api/activedisasters
 * Public — returns the active disasters shown on the donation/support page.
 * Only disasters that are active, not resolved and flagged
 * `showOnDonationPage` are returned, with public-safe fields only.
 */
export async function getPublicActiveDisasters(req, res, next) {
    try {
        const disasters = await Warning.find({
            active: true,
            showOnDonationPage: true,
            resolvedAt: null
        })
            .select(
                'title city summary topNeeds accentColor severity hazardType images createdAt'
            )
            .sort({ createdAt: -1 })
            .lean()

        return res.json({ success: true, disasters })
    } catch (err) {
        next(err)
    }
}
