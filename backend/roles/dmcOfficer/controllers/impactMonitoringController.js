import mongoose from 'mongoose'
import ImpactRecord from '../../../models/ImpactRecord.js'
import writeOperationalAudit from '../../../utils/operationalAudit.js'

const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
    'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy',
    'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale',
    'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa',
    'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
]
const populationFields = [
    'affectedPopulation',
    'evacuatedPopulation',
    'peopleInShelters',
    'injured',
    'deaths',
    'housesDamaged',
    'schoolsAffected',
    'roadsBlocked',
    'hospitalsAffected'
]
const invalid = (res, message) => res.status(400).json({ success: false, message })
const validId = (id) => mongoose.isValidObjectId(id)
const escapedRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const impactPayload = (body) => {
    const payload = {
        disasterEvent: String(body.disasterEvent || '').trim(),
        district: body.district,
        otherImpact: body.otherImpact || ''
    }
    for (const field of populationFields) {
        payload[field] = Number(body[field])
        if (!Number.isInteger(payload[field]) || payload[field] < 0) {
            return { error: `${field} must be a non-negative whole number.` }
        }
    }
    payload.recordedDate = new Date(body.recordedDate)
    if (!Number.isFinite(payload.recordedDate.getTime())) return { error: 'Recorded date is invalid.' }
    if (!payload.disasterEvent) return { error: 'Disaster event is required.' }
    if (!districts.includes(payload.district)) return { error: 'Select a valid district.' }
    return { payload }
}

export const listImpactRecords = async (req, res, next) => {
    try {
        const filter = {}
        if (req.query.district && districts.includes(req.query.district)) {
            filter.district = req.query.district
        }
        if (req.query.event) {
            filter.disasterEvent = new RegExp(escapedRegex(String(req.query.event).trim()), 'i')
        }
        if (req.query.q) {
            const expression = new RegExp(escapedRegex(String(req.query.q).trim()), 'i')
            filter.$or = [
                { disasterEvent: expression },
                { district: expression },
                { otherImpact: expression }
            ]
        }
        const records = await ImpactRecord.find(filter)
            .populate('recordedBy', 'name')
            .sort({ recordedDate: -1, createdAt: -1 })
            .lean()
        res.json({ success: true, records, districts })
    } catch (error) {
        next(error)
    }
}

export const createImpactRecord = async (req, res, next) => {
    try {
        const { payload, error } = impactPayload(req.body)
        if (error) return invalid(res, error)
        const record = await ImpactRecord.create({ ...payload, recordedBy: req.user._id })
        await writeOperationalAudit({
            actor: req.user._id,
            action: 'impact.recorded',
            entityType: 'ImpactRecord',
            entityId: record._id,
            details: { disasterEvent: record.disasterEvent, district: record.district }
        })
        await record.populate('recordedBy', 'name')
        res.status(201).json({ success: true, record })
    } catch (error) {
        next(error)
    }
}

export const updateImpactRecord = async (req, res, next) => {
    try {
        if (!validId(req.params.recordId)) return invalid(res, 'Invalid impact record id.')
        const { payload, error } = impactPayload(req.body)
        if (error) return invalid(res, error)
        const record = await ImpactRecord.findByIdAndUpdate(
            req.params.recordId,
            { $set: { ...payload, recordedBy: req.user._id } },
            { new: true, runValidators: true }
        ).populate('recordedBy', 'name')
        if (!record) return res.status(404).json({ success: false, message: 'Impact record not found.' })
        await writeOperationalAudit({
            actor: req.user._id,
            action: 'impact.updated',
            entityType: 'ImpactRecord',
            entityId: record._id,
            details: { disasterEvent: record.disasterEvent, district: record.district }
        })
        res.json({ success: true, record })
    } catch (error) {
        next(error)
    }
}
