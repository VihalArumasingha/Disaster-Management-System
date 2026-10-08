import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import Donation from '../../../models/Donation.js'
import ImpactRecord from '../../../models/ImpactRecord.js'
import OperationalAuditLog from '../../../models/OperationalAuditLog.js'
import Organization from '../../../models/Organization.js'
import OrganizationContribution from '../../../models/OrganizationContribution.js'
import ReliefDistribution from '../../../models/ReliefDistribution.js'
import ReliefSupply from '../../../models/ReliefSupply.js'
import Shelter from '../../../models/Shelter.js'
import User from '../../../models/User.js'
import Warning from '../../../models/Warning.js'

const contributionTypes = ['Financial', 'Goods', 'Service', 'Other']
const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
    'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy',
    'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale',
    'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa',
    'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
]

const invalid = (res, message) => res.status(400).json({ success: false, message })
const organizationFor = (req) => Organization.findOne({
    _id: req.user.organizationId,
    userAccount: req.user._id,
    status: 'Active'
})
const sanitizeProfile = (organization) => ({
    _id: organization._id,
    organizationId: organization.organizationId,
    organizationName: organization.organizationName,
    organizationType: organization.organizationType,
    registrationNumber: organization.registrationNumber,
    contactPerson: organization.contactPerson,
    email: organization.email,
    phone: organization.phone,
    address: organization.address,
    district: organization.district,
    description: organization.description,
    status: organization.status,
    createdAt: organization.createdAt
})
const inventoryPipeline = (organizationId) => [
    { $match: { organization: organizationId } },
    {
        $lookup: {
            from: 'reliefdistributions',
            let: { supplyId: '$_id' },
            pipeline: [
                {
                    $match: {
                        $expr: { $eq: ['$supply', '$$supplyId'] },
                        auditStatus: { $ne: 'Rejected' }
                    }
                },
                { $group: { _id: null, quantity: { $sum: '$quantity' } } }
            ],
            as: 'distributionTotals'
        }
    },
    {
        $set: {
            totalDistributed: { $ifNull: [{ $arrayElemAt: ['$distributionTotals.quantity', 0] }, 0] }
        }
    },
    {
        $set: {
            remainingQuantity: { $max: [0, { $subtract: ['$quantityReceived', '$totalDistributed'] }] }
        }
    },
    { $unset: 'distributionTotals' },
    { $sort: { receivedDate: -1 } },
    { $lookup: { from: 'organizations', localField: 'organization', foreignField: '_id', as: 'organization' } },
    { $unwind: { path: '$organization', preserveNullAndEmptyArrays: true } }
]

export const bindActiveOrganization = async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.user.organizationId)) {
            return res.status(403).json({ success: false, message: 'This account is not linked to an organization.' })
        }
        const organization = await organizationFor(req)
        if (!organization) {
            return res.status(403).json({ success: false, message: 'This organization account is inactive or no longer linked.' })
        }
        req.organization = organization
        next()
    } catch (error) {
        next(error)
    }
}

export const getOrganizationProfile = async (req, res) => {
    res.json({ success: true, organization: sanitizeProfile(req.organization) })
}

export const updateOrganizationProfile = async (req, res, next) => {
    const session = await mongoose.startSession()
    try {
        const allowed = ['organizationName', 'contactPerson', 'email', 'phone', 'address', 'district', 'description']
        const updates = Object.fromEntries(allowed
            .filter((field) => req.body[field] !== undefined)
            .map((field) => [field, typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field]]))
        if (Object.hasOwn(updates, 'email')) {
            updates.email = updates.email.toLowerCase()
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) return invalid(res, 'Enter a valid email address.')
        }
        if (Object.hasOwn(updates, 'district') && !districts.includes(updates.district)) return invalid(res, 'Select a valid district.')
        if (Object.hasOwn(updates, 'organizationName') && !updates.organizationName) return invalid(res, 'Organization name is required.')
        if (Object.hasOwn(updates, 'contactPerson') && !updates.contactPerson) return invalid(res, 'Contact person is required.')
        if (Object.hasOwn(updates, 'phone') && !updates.phone) return invalid(res, 'Phone is required.')
        if (Object.hasOwn(updates, 'address') && !updates.address) return invalid(res, 'Address is required.')
        let duplicate = false
        let updatedOrganization = null
        await session.withTransaction(async () => {
            const organization = await Organization.findOne({
                _id: req.organization._id,
                userAccount: req.user._id,
                status: 'Active'
            }).session(session)
            if (!organization) return
            if (updates.email) {
                duplicate = Boolean(await User.findOne({
                    email: updates.email,
                    _id: { $ne: req.user._id }
                }).session(session).select('_id'))
                if (duplicate) return
            }
            organization.set(updates)
            await organization.save({ session })
            const accountUpdates = {}
            if (updates.email) accountUpdates.email = updates.email
            if (updates.organizationName) accountUpdates.name = updates.organizationName
            if (updates.phone) accountUpdates.phone = updates.phone
            if (Object.keys(accountUpdates).length) {
                await User.updateOne(
                    { _id: req.user._id, organizationId: organization._id },
                    { $set: accountUpdates },
                    { session, runValidators: true }
                )
            }
            updatedOrganization = organization
        })
        if (duplicate) return res.status(409).json({ success: false, message: 'An account with this email already exists.' })
        if (!updatedOrganization) return res.status(404).json({ success: false, message: 'Organization not found.' })
        req.organization = updatedOrganization
        await OperationalAuditLog.create({
            actor: req.user._id,
            action: 'organization.profile_updated',
            entityType: 'Organization',
            entityId: updatedOrganization._id,
            details: { updatedFields: Object.keys(updates) }
        })
        res.json({ success: true, organization: sanitizeProfile(updatedOrganization) })
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'An account with this email already exists.' })
        next(error)
    } finally {
        await session.endSession()
    }
}

export const changeOrganizationPassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body
        if (typeof currentPassword !== 'string' || !currentPassword) return invalid(res, 'Current password is required.')
        if (typeof newPassword !== 'string' || Buffer.byteLength(newPassword, 'utf8') < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
            return invalid(res, 'New password must be between 8 and 72 bytes.')
        }
        const account = await User.findOne({
            _id: req.user._id,
            organizationId: req.organization._id
        }).select('password')
        if (!account || !(await bcrypt.compare(currentPassword, account.password))) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect.' })
        }
        account.password = await bcrypt.hash(newPassword, 12)
        await account.save()
        await OperationalAuditLog.create({
            actor: req.user._id,
            action: 'organization.password_changed',
            entityType: 'Organization',
            entityId: req.organization._id,
            details: {}
        })
        res.json({ success: true, message: 'Password changed successfully.' })
    } catch (error) {
        next(error)
    }
}

export const getOrganizationDashboard = async (req, res, next) => {
    try {
        const organization = req.organization
        const orgId = organization._id
        const [donations, supplies, distributions, contributions, disasters, impacts, shelters] = await Promise.all([
            Donation.find({
                donorType: 'Organization',
                donorEmail: organization.email
            }).select('donorName donorEmail amount currency channel status createdAt depositDate referenceNo').sort({ createdAt: -1 }).limit(100).lean(),
            ReliefSupply.aggregate(inventoryPipeline(orgId)),
            ReliefDistribution.find({ organization: orgId })
                .populate('supply', 'supplyId supplyName category unit')
                .populate('shelter', 'shelterId shelterName district')
                .populate('reliefLocation', 'name areaType')
                .populate('verifiedBy', 'name')
                .populate('auditHistory.changedBy', 'name')
                .sort({ distributionDate: -1 }).limit(100).lean(),
            OrganizationContribution.find({ organization: orgId }).populate('recordedBy', 'name').sort({ contributedAt: -1 }).limit(100).lean(),
            Warning.find({
                city: new RegExp(`^${organization.district.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                active: true,
                resolvedAt: null,
                status: { $in: ['issued', 'partially_issued', 'delivery_failed'] }
            }).select('title city summary topNeeds severity hazardType issuedAt createdAt targetAreaIds')
                .populate('targetAreaIds', 'name areaType hazardTypes description')
                .sort({ issuedAt: -1, createdAt: -1 }).lean(),
            ImpactRecord.find({ district: organization.district }).select('disasterEvent district affectedPopulation evacuatedPopulation peopleInShelters injured deaths housesDamaged schoolsAffected roadsBlocked hospitalsAffected otherImpact recordedDate').sort({ recordedDate: -1 }).limit(50).lean(),
            Shelter.find({ district: organization.district }).select('shelterId shelterName district capacity currentOccupancy status disasterEvent').sort({ shelterName: 1 }).lean()
        ])
        const reliefLocations = [...new Map(
            disasters.flatMap((disaster) => disaster.targetAreaIds || [])
                .map((location) => [String(location._id), location])
        ).values()]
        const totalReceived = supplies.reduce((total, supply) => total + supply.quantityReceived, 0)
        const remainingInventory = supplies.reduce((total, supply) => total + supply.remainingQuantity, 0)
        res.json({
            success: true,
            organization: sanitizeProfile(organization),
            summary: {
                donations: donations.length,
                supplies: supplies.length,
                totalReceived,
                totalDistributed: totalReceived - remainingInventory,
                remainingInventory,
                distributions: distributions.length,
                contributions: contributions.length,
                activeDisasters: disasters.length,
                impactRecords: impacts.length
            },
            donations,
            supplies: supplies.map((supply) => ({ ...supply, status: supply.remainingQuantity > 0 ? supply.status : 'Depleted' })),
            distributions,
            contributions,
            disasters,
            impacts,
            shelters: shelters.map((shelter) => ({
                ...shelter,
                availableCapacity: shelter.capacity - shelter.currentOccupancy
            })),
            reliefLocations,
            hazardTypes: [...new Set([
                ...disasters.map((disaster) => disaster.hazardType),
                ...reliefLocations.flatMap((location) => location.hazardTypes)
            ])]
        })
    } catch (error) {
        next(error)
    }
}

export const recordOrganizationContribution = async (req, res, next) => {
    try {
        const { contributionType, description } = req.body
        if (!contributionTypes.includes(contributionType)) return invalid(res, 'Select a valid contribution type.')
        if (typeof description !== 'string' || !description.trim()) return invalid(res, 'Contribution description is required.')
        const payload = {
            organization: req.organization._id,
            contributionType,
            description: description.trim(),
            recordedBy: req.user._id,
            disasterEvent: String(req.body.disasterEvent || '').trim(),
            contributedAt: req.body.contributedAt ? new Date(req.body.contributedAt) : new Date(),
            currency: String(req.body.currency || 'LKR').trim()
        }
        if (!Number.isFinite(payload.contributedAt.getTime())) return invalid(res, 'Contribution date is invalid.')
        if (req.body.amount !== undefined && req.body.amount !== '') {
            payload.amount = Number(req.body.amount)
            if (!Number.isFinite(payload.amount) || payload.amount < 0) return invalid(res, 'Amount must be a non-negative number.')
        }
        if (req.body.quantity !== undefined && req.body.quantity !== '') {
            payload.quantity = Number(req.body.quantity)
            if (!Number.isFinite(payload.quantity) || payload.quantity < 0) return invalid(res, 'Quantity must be a non-negative number.')
        }
        const contribution = await OrganizationContribution.create(payload)
        await OperationalAuditLog.create({
            actor: req.user._id,
            action: 'organization.contribution_recorded',
            entityType: 'OrganizationContribution',
            entityId: contribution._id,
            details: { organizationId: req.organization.organizationId, contributionType, disasterEvent: payload.disasterEvent }
        })
        res.status(201).json({ success: true, contribution })
    } catch (error) {
        next(error)
    }
}
