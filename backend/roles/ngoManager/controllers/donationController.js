import Donation from '../../../models/Donation.js'

/**
 * POST /api/donations
 * Public — no auth required.
 * Accepts multipart/form-data (evidence image optional).
 */
export async function createDonation(req, res, next) {
    try {
        const {
            donorType,
            donorName,
            donorEmail,
            donorPhone,
            donorAddress,
            whatsapp,
            amount,
            currency,
            channel,
            isAnonymous,
            allowNamePublic,
            bankName,
            branch,
            depositDate,
            depositorName,
            referenceNo,
            status
        } = req.body

        // Basic validation
        const errors = []

        if (!donorType || !['Individual', 'Organization'].includes(donorType)) {
            errors.push('donorType must be "Individual" or "Organization".')
        }

        const parsedAmount = parseFloat(amount)
        if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
            errors.push('amount must be a positive number.')
        }

        if (!donorName && !donorEmail && !donorPhone) {
            errors.push('Provide at least a name, email, or phone.')
        }

        if (errors.length) {
            return res.status(400).json({ success: false, message: errors[0], errors })
        }

        const doc = new Donation({
            donorType,
            donorName:      donorName      || undefined,
            donorEmail:     donorEmail     || undefined,
            donorPhone:     donorPhone     || undefined,
            donorAddress:   donorAddress   || undefined,
            whatsapp:       whatsapp       || undefined,
            amount:         parsedAmount,
            currency:       currency       || 'LKR',
            channel:        channel        || undefined,
            isAnonymous:    isAnonymous === 'true' || isAnonymous === true,
            allowNamePublic: allowNamePublic === 'true' || allowNamePublic === true,
            bankName:       bankName       || undefined,
            branch:         branch         || undefined,
            depositDate:    depositDate    ? new Date(depositDate) : undefined,
            depositorName:  depositorName  || undefined,
            referenceNo:    referenceNo    || undefined,
            evidencePath:   req.file       ? req.file.path : undefined,
            status:         status         || 'RECEIVED'
        })

        await doc.save()

        return res.status(201).json({
            success: true,
            message: 'Donation recorded successfully.',
            data: { id: doc._id, status: doc.status, createdAt: doc.createdAt }
        })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /api/donations
 * Protected — NGO Manager only (wired separately).
 */
export async function listDonations(req, res, next) {
    try {
        const page  = Math.max(1, parseInt(req.query.page  || '1', 10))
        const limit = Math.min(100, parseInt(req.query.limit || '20', 10))
        const skip  = (page - 1) * limit

        const filter = {}

        if (req.query.status)    filter.status    = req.query.status
        if (req.query.donorType) filter.donorType = req.query.donorType
        if (req.query.currency)  filter.currency  = req.query.currency
        if (req.query.channel)   filter.channel   = req.query.channel

        if (req.query.q) {
            const re = new RegExp(req.query.q, 'i')
            filter.$or = [
                { donorName:   re },
                { donorEmail:  re },
                { donorPhone:  re },
                { referenceNo: re },
                { donorType:   re },
            ]
        }

        const [donations, total] = await Promise.all([
            Donation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Donation.countDocuments(filter)
        ])

        return res.json({
            success: true,
            data: donations,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        })
    } catch (err) {
        next(err)
    }
}

/**
 * PATCH /api/donations/:id/status
 * Protected — NGO manager only.
 * Body: { status: 'RECEIVED' | 'VERIFIED' | 'REJECTED' }
 */
export async function updateDonationStatus(req, res, next) {
    try {
        const VALID = ['RECEIVED', 'VERIFIED', 'REJECTED']
        const { status } = req.body

        if (!status || !VALID.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `status must be one of: ${VALID.join(', ')}`
            })
        }

        const donation = await Donation.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        ).lean()

        if (!donation) {
            return res.status(404).json({ success: false, message: 'Donation not found.' })
        }

        return res.json({ success: true, data: donation })
    } catch (err) {
        next(err)
    }
}
