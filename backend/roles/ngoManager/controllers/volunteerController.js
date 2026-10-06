import Volunteer from '../../../models/Volunteer.js'

/** Normalise the request body into something the schema accepts. */
function parseBody(body) {
    const members = Number(body.members)
    return {
        volunteerType: body.volunteerType === 'team' ? 'team' : 'individual',
        fullName: String(body.fullName ?? '').trim(),
        phone: String(body.phone ?? '').trim(),
        email: String(body.email ?? '').trim(),
        whatsapp: String(body.whatsapp ?? '').trim(),
        livingArea: String(body.livingArea ?? '').trim(),
        group: String(body.group ?? '').trim(),
        roles: Array.isArray(body.roles)
            ? body.roles.map((r) => String(r).trim()).filter(Boolean)
            : [],
        languages: Array.isArray(body.languages)
            ? body.languages.map((l) => String(l).trim()).filter(Boolean)
            : [],
        availableDate: String(body.availableDate ?? '').trim(),
        availableTime: ['daytime', 'night', 'both'].includes(body.availableTime)
            ? body.availableTime
            : 'both',
        operationId: String(body.operationId ?? '').trim(),
        operationName: String(body.operationName ?? '').trim(),
        members: Number.isFinite(members) && members >= 1 ? Math.floor(members) : 1,
        notes: String(body.notes ?? '').trim()
    }
}

/** Shared error responder for validation / cast errors. Returns true if handled. */
function sendValidationError(err, res) {
    if (err.name === 'ValidationError') {
        const details = Object.values(err.errors).map((e) => e.message)
        res.status(400).json({ success: false, message: details.join('. ') })
        return true
    }
    if (err.name === 'CastError') {
        res.status(400).json({ success: false, message: 'Invalid id format.' })
        return true
    }
    return false
}

/**
 * GET /api/volunteers
 * Public — list volunteers, optionally filtered by ?q=.
 */
export async function getVolunteers(req, res, next) {
    try {
        const q = (req.query.q || '').trim()
        const filter = q
            ? {
                $or: [
                    { fullName: { $regex: q, $options: 'i' } },
                    { email: { $regex: q, $options: 'i' } },
                    { phone: { $regex: q, $options: 'i' } },
                    { livingArea: { $regex: q, $options: 'i' } },
                    { operationName: { $regex: q, $options: 'i' } },
                    { notes: { $regex: q, $options: 'i' } },
                    { roles: { $regex: q, $options: 'i' } },
                    { languages: { $regex: q, $options: 'i' } }
                ]
            }
            : {}

        const volunteers = await Volunteer.find(filter)
            .sort({ createdAt: -1 })
            .lean()

        return res.json({ success: true, volunteers })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /api/volunteers/:volunteerId
 * Public — a single volunteer (used by the edit form).
 */
export async function getVolunteerById(req, res, next) {
    try {
        const volunteer = await Volunteer.findById(req.params.volunteerId).lean()
        if (!volunteer) {
            return res.status(404).json({ success: false, message: 'Volunteer not found' })
        }
        return res.json({ success: true, volunteer })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}

/**
 * POST /api/volunteers
 * Public — register a volunteer (citizen mobile app + NGO "Add volunteer").
 * New records always start UNASSIGNED.
 */
export async function createVolunteer(req, res, next) {
    try {
        const volunteer = await Volunteer.create({
            ...parseBody(req.body),
            assignment: { status: 'UNASSIGNED' }
        })
        return res.status(201).json({ success: true, volunteer })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}

/**
 * PUT /api/volunteers/:volunteerId
 * NGO manager only — update a volunteer.
 * `assignment` is intentionally not accepted here; use the assignment route.
 */
export async function updateVolunteer(req, res, next) {
    try {
        const volunteer = await Volunteer.findByIdAndUpdate(
            req.params.volunteerId,
            parseBody(req.body),
            { new: true, runValidators: true }
        )
        if (!volunteer) {
            return res.status(404).json({ success: false, message: 'Volunteer not found' })
        }
        return res.json({ success: true, volunteer })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}

/**
 * PATCH /api/volunteers/:volunteerId/assignment
 * NGO manager only — assign / unassign a volunteer.
 * On assign, stamps the volunteer's operation name and today's date.
 */
export async function updateVolunteerAssignment(req, res, next) {
    try {
        const status = String(req.body?.status || '').toUpperCase()
        if (status !== 'ASSIGNED' && status !== 'UNASSIGNED') {
            return res.status(400).json({
                success: false,
                message: 'status must be ASSIGNED or UNASSIGNED'
            })
        }

        const volunteer = await Volunteer.findById(req.params.volunteerId)
        if (!volunteer) {
            return res.status(404).json({ success: false, message: 'Volunteer not found' })
        }

        volunteer.assignment =
            status === 'ASSIGNED'
                ? {
                    status: 'ASSIGNED',
                    operationName: volunteer.operationName || '',
                    date: new Date().toISOString().slice(0, 10)
                }
                : { status: 'UNASSIGNED', operationName: '', date: '' }

        await volunteer.save()
        return res.json({ success: true, volunteer })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}

/**
 * DELETE /api/volunteers/:volunteerId
 * NGO manager only — remove a volunteer.
 */
export async function deleteVolunteer(req, res, next) {
    try {
        const volunteer = await Volunteer.findByIdAndDelete(req.params.volunteerId)
        if (!volunteer) {
            return res.status(404).json({ success: false, message: 'Volunteer not found' })
        }
        return res.json({ success: true, message: 'Volunteer deleted' })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}

