import DistributionOperation from '../../../models/DistributionOperation.js'
import DistributionRecord from '../../../models/DistributionRecord.js'

/* ── shared helpers ─────────────────────────────────────────────── */

/** Shared error responder for validation / cast errors. Returns true when handled. */
function sendValidationError(err, res) {
    if (err.name === 'ValidationError') {
        const details = Object.values(err.errors).map((e) => e.message)
        res.status(400).json({ success: false, message: details.join('. ') })
        return true
    }
    if (err.name === 'CastError') {
        res.status(400).json({ success: false, message: 'Invalid value supplied.' })
        return true
    }
    return false
}

/** Non-negative integer coercion (returns `fallback` when unusable). */
function toCount(value, fallback) {
    const n = Number(value)
    if (!Number.isFinite(n)) return fallback
    return Math.max(0, Math.floor(n))
}

/** Build operation fields from a full request body (create). */
function parseOperationBody(body) {
    const op = {
        name: String(body.name ?? '').trim(),
        location: String(body.location ?? '').trim(),
        requiredVolunteers: toCount(body.requiredVolunteers, 0)
    }
    const status = String(body.status ?? '').trim().toUpperCase()
    if (status === 'ACTIVE' || status === 'PENDING' || status === 'COMPLETED') op.status = status
    if (body.stage !== undefined && body.stage !== null && body.stage !== '') {
        op.stage = Math.min(6, toCount(body.stage, 0))
    }
    return op
}

/** Apply only the provided fields so partial PUTs (e.g. { stage }) work. */
function applyOperationBody(operation, body) {
    if (body.name !== undefined) operation.name = String(body.name).trim()
    if (body.location !== undefined) operation.location = String(body.location).trim()
    if (body.requiredVolunteers !== undefined) {
        operation.requiredVolunteers = toCount(body.requiredVolunteers, operation.requiredVolunteers)
    }
    if (body.status !== undefined) {
        const status = String(body.status).trim().toUpperCase()
        if (status === 'ACTIVE' || status === 'PENDING' || status === 'COMPLETED') operation.status = status
    }
    if (body.stage !== undefined && body.stage !== null && body.stage !== '') {
        operation.stage = Math.min(6, toCount(body.stage, operation.stage))
    }
}

/* ══════════════════════════════════════════════════════════════ */
/* ── relief-distribution operations (/api/operations) ─────────── */
/* ══════════════════════════════════════════════════════════════ */

/**
 * GET /api/operations?q=
 * Public — list operations, optionally filtered by ?q= (name/location/status).
 * Returned as `data` (mobile sign-up form expects that key) and `operations`.
 */
export async function getOperations(req, res, next) {
    try {
        const q = (req.query.q || '').trim()
        const filter = q
            ? {
                $or: [
                    { name: { $regex: q, $options: 'i' } },
                    { location: { $regex: q, $options: 'i' } },
                    { status: { $regex: q, $options: 'i' } }
                ]
            }
            : {}

        const operations = await DistributionOperation.find(filter)
            .sort({ createdAt: -1 })
            .lean()

        return res.json({ success: true, data: operations, operations })
    } catch (err) {
        next(err)
    }
}

/** GET /api/operations/:operationId — public, a single operation. */
export async function getOperationById(req, res, next) {
    try {
        const operation = await DistributionOperation.findById(req.params.operationId).lean()
        if (!operation) {
            return res.status(404).json({ success: false, message: 'Operation not found' })
        }
        return res.json({ success: true, operation })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}

/**
 * POST /api/operations
 * Public — create an operation (NGO "New Operation" modal; the NGO layout
 * already gates the UI, same approach as volunteer creation).
 */
export async function createOperation(req, res, next) {
    try {
        const operation = await DistributionOperation.create(parseOperationBody(req.body))
        return res.status(201).json({ success: true, operation })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}

/** PUT /api/operations/:operationId — NGO manager only; partial updates supported. */
export async function updateOperation(req, res, next) {
    try {
        const operation = await DistributionOperation.findById(req.params.operationId)
        if (!operation) {
            return res.status(404).json({ success: false, message: 'Operation not found' })
        }
        applyOperationBody(operation, req.body)
        await operation.save()
        return res.json({ success: true, operation })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}

/** DELETE /api/operations/:operationId — NGO manager only. */
export async function deleteOperation(req, res, next) {
    try {
        const operation = await DistributionOperation.findByIdAndDelete(req.params.operationId)
        if (!operation) {
            return res.status(404).json({ success: false, message: 'Operation not found' })
        }
        return res.json({ success: true, message: 'Operation deleted' })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}

/* ══════════════════════════════════════════════════════════════ */
/* ── distribution quantities (/api/distributionrecords) ──────── */
/* ══════════════════════════════════════════════════════════════ */

/**
 * Validate distribution-quantity fields. Returns the parsed values,
 * or responds with 400 and returns null.
 */
function parseRecordBody(body, res) {
    const date = String(body.date ?? '').trim()
    const families = Number(body.familiesAssisted)
    const resources = Number(body.resourcesDistributed)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ success: false, message: 'Date must be in YYYY-MM-DD format.' })
        return null
    }
    if (!Number.isFinite(families) || families < 0) {
        res.status(400).json({ success: false, message: 'Families assisted must be 0 or more.' })
        return null
    }
    if (!Number.isFinite(resources) || resources < 0) {
        res.status(400).json({ success: false, message: 'Resources distributed must be 0 or more.' })
        return null
    }
    return {
        date,
        familiesAssisted: Math.floor(families),
        resourcesDistributed: Math.floor(resources)
    }
}

/**
 * GET /api/distributionrecords?q=
 * Public — list quantity records, newest date first, optional ?q= on the date.
 */
export async function getRecords(req, res, next) {
    try {
        const q = (req.query.q || '').trim()
        const filter = q ? { date: { $regex: q, $options: 'i' } } : {}

        const records = await DistributionRecord.find(filter)
            .sort({ date: -1, createdAt: -1 })
            .lean()

        return res.json({ success: true, records })
    } catch (err) {
        next(err)
    }
}

/** GET /api/distributionrecords/:recordId — public, a single record. */
export async function getRecordById(req, res, next) {
    try {
        const record = await DistributionRecord.findById(req.params.recordId).lean()
        if (!record) {
            return res.status(404).json({ success: false, message: 'Distribution record not found' })
        }
        return res.json({ success: true, record })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}

/** POST /api/distributionrecords — add a "Track Distribution Quantities" entry. */
export async function createRecord(req, res, next) {
    try {
        const parsed = parseRecordBody(req.body, res)
        if (!parsed) return
        const record = await DistributionRecord.create(parsed)
        return res.status(201).json({ success: true, record })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}

/** PUT /api/distributionrecords/:recordId — NGO manager only. */
export async function updateRecord(req, res, next) {
    try {
        const record = await DistributionRecord.findById(req.params.recordId)
        if (!record) {
            return res.status(404).json({ success: false, message: 'Distribution record not found' })
        }
        const parsed = parseRecordBody({ ...record.toObject(), ...req.body }, res)
        if (!parsed) return
        record.set(parsed)
        await record.save()
        return res.json({ success: true, record })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}

/** DELETE /api/distributionrecords/:recordId — NGO manager only. */
export async function deleteRecord(req, res, next) {
    try {
        const record = await DistributionRecord.findByIdAndDelete(req.params.recordId)
        if (!record) {
            return res.status(404).json({ success: false, message: 'Distribution record not found' })
        }
        return res.json({ success: true, message: 'Distribution record deleted' })
    } catch (err) {
        if (sendValidationError(err, res)) return
        next(err)
    }
}
