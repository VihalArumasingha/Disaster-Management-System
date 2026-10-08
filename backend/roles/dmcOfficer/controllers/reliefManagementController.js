import mongoose from 'mongoose'
import Organization from '../../../models/Organization.js'
import ReliefDistribution from '../../../models/ReliefDistribution.js'
import ReliefSupply from '../../../models/ReliefSupply.js'
import Shelter from '../../../models/Shelter.js'
import TargetArea from '../../../models/TargetArea.js'
import writeOperationalAudit from '../../../utils/operationalAudit.js'

const categories = ['Food', 'Water', 'Medical', 'Shelter', 'Clothing', 'Hygiene', 'Equipment', 'Other']
const auditStatuses = ['Pending Verification', 'Verified', 'Rejected', 'Flagged']
const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
    'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy',
    'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale',
    'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa',
    'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
]

const invalid = (res, message) => res.status(400).json({ success: false, message })
const notFound = (res, message) => res.status(404).json({ success: false, message })
const validId = (id) => mongoose.isValidObjectId(id)
const escapedRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const startOfUtcDay = (date = new Date()) => (
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
)

const inventoryPipeline = (match = {}, excludeDistributionId = null) => [
    { $match: match },
    {
        $lookup: {
            from: 'reliefdistributions',
            let: { supplyId: '$_id' },
            pipeline: [
                {
                    $match: {
                        $expr: { $eq: ['$supply', '$$supplyId'] },
                        auditStatus: { $ne: 'Rejected' },
                        ...(excludeDistributionId ? { _id: { $ne: excludeDistributionId } } : {})
                    }
                },
                { $group: { _id: null, total: { $sum: '$quantity' } } }
            ],
            as: 'distributionTotals'
        }
    },
    {
        $set: {
            totalDistributed: {
                $ifNull: [{ $arrayElemAt: ['$distributionTotals.total', 0] }, 0]
            }
        }
    },
    {
        $set: {
            remainingQuantity: { $max: [0, { $subtract: ['$quantityReceived', '$totalDistributed'] }] },
            effectiveStatus: {
                $cond: [
                    { $lte: [{ $subtract: ['$quantityReceived', '$totalDistributed'] }, 0] },
                    'Depleted',
                    {
                        $cond: [
                            { $and: [{ $ne: ['$expiryDate', null] }, { $lt: ['$expiryDate', startOfUtcDay()] }] },
                            'Expired',
                            '$status'
                        ]
                    }
                ]
            }
        }
    },
    { $unset: 'distributionTotals' },
    { $sort: { receivedDate: -1 } },
    { $lookup: { from: 'organizations', localField: 'organization', foreignField: '_id', as: 'organization' } },
    { $unwind: { path: '$organization', preserveNullAndEmptyArrays: true } }
]

export const listReliefSupplyOptions = async (req, res, next) => {
    try {
        const [organizations, supplies, shelters, reliefLocations] = await Promise.all([
            Organization.find({ status: 'Active' }).select('organizationId organizationName').sort({ organizationName: 1 }).lean(),
            ReliefSupply.aggregate(inventoryPipeline({
                status: 'Available',
                $or: [{ expiryDate: null }, { expiryDate: { $gte: startOfUtcDay() } }]
            })).then((rows) => rows.filter((row) => row.remainingQuantity > 0)),
            Shelter.find({ status: 'Active' }).select('shelterId shelterName district address').sort({ shelterName: 1 }).lean(),
            TargetArea.find().select('name areaType description').sort({ name: 1 }).lean()
        ])
        res.json({
            success: true,
            organizations,
            supplies: supplies.map((supply) => ({
                ...supply,
                status: supply.effectiveStatus
            })),
            shelters,
            reliefLocations,
            districts
        })
    } catch (error) {
        next(error)
    }
}

export const listReliefSupplies = async (req, res, next) => {
    try {
        const match = {}
        if (req.query.category && categories.includes(req.query.category)) match.category = req.query.category
        if (req.query.organization && validId(req.query.organization)) {
            match.organization = new mongoose.Types.ObjectId(req.query.organization)
        }
        if (req.query.q) {
            const expression = new RegExp(escapedRegex(String(req.query.q).trim()), 'i')
            match.$or = [
                { supplyId: expression },
                { disasterEvent: expression },
                { supplyName: expression },
                { batchNumber: expression },
                { storageLocation: expression }
            ]
        }
        const supplies = await ReliefSupply.aggregate(inventoryPipeline(match))
        res.json({
            success: true,
            supplies: supplies.map((supply) => ({
                ...supply,
                organizationName: supply.organization?.organizationName || 'Unknown organization',
                status: supply.effectiveStatus
            }))
        })
    } catch (error) {
        next(error)
    }
}

export const createReliefSupply = async (req, res, next) => {
    try {
        const quantityReceived = Number(req.body.quantityReceived)
        if (!Number.isFinite(quantityReceived) || quantityReceived <= 0) {
            return invalid(res, 'Quantity received must be a positive number.')
        }
        if (!categories.includes(req.body.category)) {
            return invalid(res, `Category must be one of: ${categories.join(', ')}.`)
        }
        if (!validId(req.body.organization)) return invalid(res, 'Select a valid organization.')
        if (!req.body.disasterEvent?.trim()) return invalid(res, 'Disaster event is required.')

        const organization = await Organization.findOne({
            _id: req.body.organization,
            status: 'Active'
        }).select('_id')
        if (!organization) return invalid(res, 'Supplies must be registered against an active organization.')

        const receivedDate = new Date(req.body.receivedDate)
        const expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null
        if (!Number.isFinite(receivedDate.getTime())) return invalid(res, 'Received date is invalid.')
        if (expiryDate && (!Number.isFinite(expiryDate.getTime()) || expiryDate < receivedDate)) {
            return invalid(res, 'Expiry date must be valid and cannot be before the received date.')
        }

        const supply = await ReliefSupply.create({
            organization: organization._id,
            disasterEvent: req.body.disasterEvent,
            category: req.body.category,
            supplyName: req.body.supplyName,
            unit: req.body.unit,
            quantityReceived,
            receivedDate,
            expiryDate,
            batchNumber: req.body.batchNumber || '',
            storageLocation: req.body.storageLocation,
            status: req.body.status === 'On Hold' ? 'On Hold' : 'Available',
            recordedBy: req.user._id
        })
        await writeOperationalAudit({
            actor: req.user._id,
            action: 'relief_supply.registered',
            entityType: 'ReliefSupply',
            entityId: supply._id,
            details: { supplyId: supply.supplyId, supplyName: supply.supplyName, quantityReceived, category: supply.category }
        })
        res.status(201).json({ success: true, supply })
    } catch (error) {
        next(error)
    }
}

export const listReliefDistributions = async (req, res, next) => {
    try {
        const filter = {}
        if (req.query.auditStatus && auditStatuses.includes(req.query.auditStatus)) {
            filter.auditStatus = req.query.auditStatus
        }
        if (req.query.q) {
            const expression = new RegExp(escapedRegex(String(req.query.q).trim()), 'i')
            filter.$or = [
                { distributionId: expression },
                { disasterEvent: expression },
                { recipient: expression },
                { district: expression },
                { purpose: expression }
            ]
        }
        const distributions = await ReliefDistribution.find(filter)
            .populate('organization', 'organizationId organizationName')
            .populate('supply', 'supplyId supplyName category unit')
            .populate('shelter', 'shelterId shelterName district')
            .populate('reliefLocation', 'name areaType')
            .populate('responsibleOfficer', 'name')
            .populate('verifiedBy', 'name')
            .populate('auditHistory.changedBy', 'name')
            .sort({ distributionDate: -1, createdAt: -1 })
            .lean()
        res.json({ success: true, distributions })
    } catch (error) {
        next(error)
    }
}

export const createReliefDistribution = async (req, res, next) => {
    const session = await mongoose.startSession()
    try {
        const { supply: supplyId, destinationType } = req.body
        const quantity = Number(req.body.quantity)
        if (!validId(supplyId)) return invalid(res, 'Select a valid supply.')
        if (!Number.isFinite(quantity) || quantity <= 0) {
            return invalid(res, 'Distribution quantity must be a positive number.')
        }
        if (!['District', 'Shelter', 'Relief Location'].includes(destinationType)) {
            return invalid(res, 'Select a valid distribution destination.')
        }
        if (!req.body.recipient?.trim() || !req.body.purpose?.trim()) {
            return invalid(res, 'Recipient and purpose are required.')
        }

        const distributionDate = new Date(req.body.distributionDate)
        if (!Number.isFinite(distributionDate.getTime())) return invalid(res, 'Distribution date is invalid.')

        let destination = { district: '', shelter: null, reliefLocation: null }
        if (destinationType === 'District') {
            if (!districts.includes(req.body.district)) return invalid(res, 'Select a valid district.')
            destination.district = req.body.district
        } else if (destinationType === 'Shelter') {
            if (!validId(req.body.shelter)) return invalid(res, 'Select a valid shelter.')
            const shelter = await Shelter.findOne({ _id: req.body.shelter, status: 'Active' }).select('_id')
            if (!shelter) return invalid(res, 'Select an active shelter.')
            destination.shelter = shelter._id
        } else {
            if (!validId(req.body.reliefLocation)) return invalid(res, 'Select an approved relief location.')
            const reliefLocation = await TargetArea.findById(req.body.reliefLocation).select('_id')
            if (!reliefLocation) return invalid(res, 'Select an approved relief location.')
            destination.reliefLocation = reliefLocation._id
        }

        let distribution
        await session.withTransaction(async () => {
            const supplyRows = await ReliefSupply.aggregate(inventoryPipeline({
                _id: new mongoose.Types.ObjectId(supplyId),
                status: 'Available',
                $or: [{ expiryDate: null }, { expiryDate: { $gte: startOfUtcDay() } }]
            })).session(session)
            const supply = supplyRows[0]
            if (!supply || supply.remainingQuantity <= 0) {
                const error = new Error('Supply is unavailable, expired, on hold, or depleted.')
                error.statusCode = 400
                throw error
            }
            if (distributionDate < supply.receivedDate) {
                const error = new Error('Distribution date cannot be before the supply received date.')
                error.statusCode = 400
                throw error
            }
            if (quantity > supply.remainingQuantity) {
                const error = new Error(`Distribution quantity exceeds available supply (${supply.remainingQuantity} ${supply.unit} remaining).`)
                error.statusCode = 400
                throw error
            }
            const inventoryLock = await ReliefSupply.updateOne(
                { _id: supply._id },
                { $inc: { inventoryRevision: 1 } },
                { session }
            )
            if (inventoryLock.modifiedCount !== 1) {
                const error = new Error('Supply inventory changed. Please retry the distribution.')
                error.statusCode = 409
                throw error
            }
            const [createdDistribution] = await ReliefDistribution.create([{
                supply: supply._id,
                organization: supply.organization._id,
                disasterEvent: supply.disasterEvent,
                destinationType,
                ...destination,
                quantity,
                distributionDate,
                recipient: req.body.recipient,
                responsibleOfficer: req.user._id,
                purpose: req.body.purpose,
                notes: req.body.notes || '',
                auditStatus: 'Pending Verification',
                auditHistory: [{
                    auditStatus: 'Pending Verification',
                    notes: 'Distribution recorded and awaiting verification.',
                    changedBy: req.user._id
                }]
            }], { session })
            distribution = createdDistribution
        })
        await writeOperationalAudit({
            actor: req.user._id,
            action: 'distribution.created',
            entityType: 'ReliefDistribution',
            entityId: distribution._id,
            details: { distributionId: distribution.distributionId, quantity, disasterEvent: distribution.disasterEvent, auditStatus: distribution.auditStatus }
        })
        res.status(201).json({ success: true, distribution })
    } catch (error) {
        next(error)
    } finally {
        await session.endSession()
    }
}

export const updateReliefDistributionAudit = async (req, res, next) => {
    const session = await mongoose.startSession()
    try {
        if (!validId(req.params.distributionId)) return invalid(res, 'Invalid distribution id.')
        if (!auditStatuses.includes(req.body.auditStatus)) {
            return invalid(res, `Audit status must be one of: ${auditStatuses.join(', ')}.`)
        }
        const verificationNotes = String(req.body.verificationNotes || '').trim()
        if (verificationNotes.length > 2000) {
            return invalid(res, 'Verification notes cannot exceed 2000 characters.')
        }
        let distribution
        await session.withTransaction(async () => {
            const existing = await ReliefDistribution.findById(req.params.distributionId).session(session)
            if (!existing) {
                const error = new Error('Distribution record not found.')
                error.statusCode = 404
                throw error
            }
            if (
                existing.auditStatus === 'Rejected'
                && req.body.auditStatus !== 'Rejected'
            ) {
                const supplyRowsResult = await ReliefSupply.aggregate(inventoryPipeline({
                    _id: existing.supply,
                    status: 'Available',
                    $or: [{ expiryDate: null }, { expiryDate: { $gte: startOfUtcDay() } }]
                }, existing._id)).session(session)
                const supply = supplyRowsResult[0]
                if (!supply || supply.remainingQuantity < existing.quantity) {
                    const error = new Error('This distribution cannot be restored to inventory because there is not enough available supply.')
                    error.statusCode = 400
                    throw error
                }
            }
            const inventoryLock = await ReliefSupply.updateOne(
                { _id: existing.supply },
                { $inc: { inventoryRevision: 1 } },
                { session }
            )
            if (inventoryLock.modifiedCount !== 1) {
                const error = new Error('Supply inventory changed. Please retry the audit update.')
                error.statusCode = 409
                throw error
            }
            existing.auditStatus = req.body.auditStatus
            existing.verificationNotes = verificationNotes
            if (req.body.auditStatus === 'Verified') {
                existing.verifiedBy = req.user._id
                existing.verifiedAt = new Date()
            } else {
                existing.verifiedBy = null
                existing.verifiedAt = null
            }
            existing.auditHistory.push({
                auditStatus: req.body.auditStatus,
                notes: verificationNotes,
                changedBy: req.user._id
            })
            await existing.save({ session })
            distribution = existing
        })
        await writeOperationalAudit({
            actor: req.user._id,
            action: req.body.auditStatus === 'Verified' ? 'distribution.verified' : 'distribution.audit_updated',
            entityType: 'ReliefDistribution',
            entityId: distribution._id,
            details: { distributionId: distribution.distributionId, auditStatus: distribution.auditStatus, verificationNotes }
        })
        await distribution.populate([
            { path: 'organization', select: 'organizationId organizationName' },
            { path: 'supply', select: 'supplyId supplyName category unit' },
            { path: 'shelter', select: 'shelterId shelterName district' },
            { path: 'reliefLocation', select: 'name areaType' },
            { path: 'responsibleOfficer', select: 'name' },
            { path: 'verifiedBy', select: 'name' },
            { path: 'auditHistory.changedBy', select: 'name' }
        ])
        res.json({ success: true, distribution })
    } catch (error) {
        next(error)
    } finally {
        await session.endSession()
    }
}
