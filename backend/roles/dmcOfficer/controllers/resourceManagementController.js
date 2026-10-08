import mongoose from 'mongoose'
import Organization from '../../../models/Organization.js'
import OrganizationContribution from '../../../models/OrganizationContribution.js'
import Shelter from '../../../models/Shelter.js'
import ShelterOccupancy from '../../../models/ShelterOccupancy.js'
import writeOperationalAudit from '../../../utils/operationalAudit.js'

const shelterTypes = ['School', 'Community Hall', 'Religious Facility', 'Government Building', 'Temporary Camp', 'Other']
const shelterStatuses = ['Active', 'Inactive', 'Full', 'Closed']
const organizationTypes = ['NGO', 'Donor', 'Government Agency', 'International Organization', 'Private Organization']
const organizationStatuses = ['Pending Verification', 'Active', 'Suspended', 'Inactive']
const contributionTypes = ['Financial', 'Goods', 'Service', 'Other']

const invalid = (res, message) => res.status(400).json({ success: false, message })
const notFound = (res, message) => res.status(404).json({ success: false, message })
const validId = (id) => mongoose.isValidObjectId(id)
const escapedRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const shelterPayload = (body) => ({
    shelterName: body.shelterName,
    district: body.district,
    address: body.address,
    shelterType: body.shelterType,
    capacity: Number(body.capacity),
    contactPerson: body.contactPerson,
    contactNumber: body.contactNumber,
    facilities: Array.isArray(body.facilities)
        ? body.facilities
        : String(body.facilities || '').split(',').map((item) => item.trim()).filter(Boolean),
    disasterEvent: body.disasterEvent || ''
})

const organizationPayload = (body) => ({
    organizationName: body.organizationName,
    organizationType: body.organizationType,
    registrationNumber: body.registrationNumber || '',
    contactPerson: body.contactPerson,
    email: body.email,
    phone: body.phone,
    address: body.address,
    district: body.district,
    description: body.description || ''
})

export const listShelters = async (req, res, next) => {
    try {
        const filter = {}
        if (req.query.q) {
            const expression = new RegExp(escapedRegex(String(req.query.q).trim()), 'i')
            filter.$or = [
                { shelterId: expression },
                { shelterName: expression },
                { district: expression },
                { address: expression }
            ]
        }
        if (shelterTypes.includes(req.query.type)) filter.shelterType = req.query.type
        if (shelterStatuses.includes(req.query.status)) filter.status = req.query.status
        const shelters = await Shelter.find(filter).sort({ updatedAt: -1 }).lean()
        res.json({
            success: true,
            shelters: shelters.map((shelter) => ({
                ...shelter,
                availableCapacity: shelter.capacity - shelter.currentOccupancy
            }))
        })
    } catch (error) {
        next(error)
    }
}

export const createShelter = async (req, res, next) => {
    const session = await mongoose.startSession()
    try {
        const payload = shelterPayload(req.body)
        const initialOccupancy = Number(req.body.currentOccupancy || 0)
        if (!Number.isInteger(initialOccupancy) || initialOccupancy < 0 || initialOccupancy > payload.capacity) {
            return invalid(res, 'Current occupancy must be a whole number between 0 and capacity.')
        }
        let shelter
        await session.withTransaction(async () => {
            shelter = new Shelter({
                ...payload,
                currentOccupancy: initialOccupancy,
                status: initialOccupancy === payload.capacity ? 'Full' : 'Active',
                createdBy: req.user._id
            })
            await shelter.save({ session })
            if (initialOccupancy > 0) {
                await ShelterOccupancy.create([{
                    shelter: shelter._id,
                    shelterId: shelter.shelterId,
                    occupancyCount: initialOccupancy,
                    recordedBy: req.user._id,
                    disasterEvent: shelter.disasterEvent
                }], { session })
            }
        })
        await writeOperationalAudit({
            actor: req.user._id,
            action: 'shelter.created',
            entityType: 'Shelter',
            entityId: shelter._id,
            details: { shelterId: shelter.shelterId, shelterName: shelter.shelterName, district: shelter.district }
        })
        if (initialOccupancy > 0) {
            await writeOperationalAudit({
                actor: req.user._id,
                action: 'shelter.occupancy_recorded',
                entityType: 'Shelter',
                entityId: shelter._id,
                details: { shelterId: shelter.shelterId, occupancyCount: initialOccupancy, disasterEvent: shelter.disasterEvent }
            })
        }
        res.status(201).json({ success: true, shelter: shelter.toJSON() })
    } catch (error) {
        next(error)
    } finally {
        await session.endSession()
    }
}

export const getShelter = async (req, res, next) => {
    try {
        if (!validId(req.params.shelterId)) return invalid(res, 'Invalid shelter id.')
        const [shelter, occupancyHistory] = await Promise.all([
            Shelter.findById(req.params.shelterId).lean(),
            ShelterOccupancy.find({ shelter: req.params.shelterId })
                .populate('recordedBy', 'name')
                .sort({ recordedAt: -1 })
                .lean()
        ])
        if (!shelter) return notFound(res, 'Shelter not found.')
        res.json({
            success: true,
            shelter: { ...shelter, availableCapacity: shelter.capacity - shelter.currentOccupancy },
            occupancyHistory
        })
    } catch (error) {
        next(error)
    }
}

export const updateShelter = async (req, res, next) => {
    try {
        if (!validId(req.params.shelterId)) return invalid(res, 'Invalid shelter id.')
        const payload = shelterPayload(req.body)
        if (!Number.isInteger(payload.capacity) || payload.capacity < 1) {
            return invalid(res, 'Capacity must be a positive whole number.')
        }
        if (!shelterTypes.includes(payload.shelterType)) {
            return invalid(res, `Shelter type must be one of: ${shelterTypes.join(', ')}.`)
        }

        const existing = await Shelter.findById(req.params.shelterId)
        if (!existing) return notFound(res, 'Shelter not found.')

        if (payload.capacity < existing.currentOccupancy) {
            return invalid(res, 'Capacity cannot be lower than current occupancy.')
        }

        // Apply the whitelisted fields
        existing.set(payload)

        // Recompute status based on new capacity vs current occupancy,
        // but only auto-toggle between Active and Full (leave Inactive/Closed alone).
        if (existing.status === 'Active' || existing.status === 'Full') {
            existing.status = existing.currentOccupancy >= existing.capacity ? 'Full' : 'Active'
        }

        await existing.save()
        await writeOperationalAudit({
            actor: req.user._id,
            action: 'shelter.updated',
            entityType: 'Shelter',
            entityId: existing._id,
            details: { shelterId: existing.shelterId, shelterName: existing.shelterName, district: existing.district }
        })
        res.json({ success: true, shelter: existing.toJSON() })
    } catch (error) {
        next(error)
    }
}

export const updateShelterStatus = async (req, res, next) => {
    try {
        if (!validId(req.params.shelterId)) return invalid(res, 'Invalid shelter id.')
        const { status } = req.body
        if (!['Active', 'Inactive', 'Closed'].includes(status)) {
            return invalid(res, 'Status must be Active, Inactive, or Closed.')
        }

        const shelter = await Shelter.findById(req.params.shelterId)
        if (!shelter) return notFound(res, 'Shelter not found.')

        if (status === 'Active') {
            shelter.status = shelter.currentOccupancy >= shelter.capacity ? 'Full' : 'Active'
        } else {
            shelter.status = status
        }

        await shelter.save()
        await writeOperationalAudit({
            actor: req.user._id,
            action: 'shelter.status_updated',
            entityType: 'Shelter',
            entityId: shelter._id,
            details: { shelterId: shelter.shelterId, status: shelter.status }
        })
        res.json({ success: true, shelter: shelter.toJSON() })
    } catch (error) {
        next(error)
    }
}
export const recordShelterOccupancy = async (req, res, next) => {
    const session = await mongoose.startSession()
    try {
        if (!validId(req.params.shelterId)) {
            return invalid(res, 'Invalid shelter id.')
        }
        const occupancyCount = Number(req.body.occupancyCount)
        if (!Number.isInteger(occupancyCount) || occupancyCount < 0) {
            return invalid(res, 'Occupancy count must be a non-negative whole number.')
        }

        let shelter
        let history
        await session.withTransaction(async () => {
            shelter = await Shelter.findById(req.params.shelterId).session(session)
            if (!shelter) {
                const error = new Error('Shelter not found.')
                error.statusCode = 404
                throw error
            }
            if (occupancyCount > shelter.capacity) {
                const error = new Error('Occupancy cannot exceed shelter capacity.')
                error.statusCode = 400
                throw error
            }

            shelter.currentOccupancy = occupancyCount
            if (req.body.disasterEvent) {
                shelter.disasterEvent = req.body.disasterEvent
            }
            if (shelter.status === 'Active' || shelter.status === 'Full') {
                shelter.status = occupancyCount >= shelter.capacity ? 'Full' : 'Active'
            }
            await shelter.save({ session })

            history = await ShelterOccupancy.create([{
                shelter: shelter._id,
                shelterId: shelter.shelterId,
                occupancyCount,
                recordedBy: req.user._id,
                disasterEvent: req.body.disasterEvent ?? shelter.disasterEvent
            }], { session })
        })
        await writeOperationalAudit({
            actor: req.user._id,
            action: 'shelter.occupancy_recorded',
            entityType: 'Shelter',
            entityId: shelter._id,
            details: { shelterId: shelter.shelterId, occupancyCount, disasterEvent: shelter.disasterEvent }
        })
        res.status(201).json({
            success: true,
            shelter: shelter.toJSON(),
            occupancy: history[0]
        })
    } catch (error) {
        if (error.statusCode) {
            return res.status(error.statusCode).json({ success: false, message: error.message })
        }
        next(error)
    } finally {
        await session.endSession()
    }
}
export const listOrganizations = async (req, res, next) => {
    try {
        const filter = {}
        if (req.query.q) {
            const expression = new RegExp(escapedRegex(String(req.query.q).trim()), 'i')
            filter.$or = [
                { organizationId: expression },
                { organizationName: expression },
                { registrationNumber: expression },
                { contactPerson: expression },
                { email: expression },
                { district: expression }
            ]
        }
        if (organizationTypes.includes(req.query.type)) filter.organizationType = req.query.type
        const organizations = await Organization.find(filter).sort({ updatedAt: -1 }).lean()
        res.json({ success: true, organizations })
    } catch (error) {
        next(error)
    }
}

export const createOrganization = async (req, res, next) => {
    try {
        const organization = await Organization.create({
            ...organizationPayload(req.body),
            createdBy: req.user._id
        })
        await writeOperationalAudit({
            actor: req.user._id,
            action: 'organization.created',
            entityType: 'Organization',
            entityId: organization._id,
            details: { organizationId: organization.organizationId, organizationName: organization.organizationName, organizationType: organization.organizationType }
        })
        res.status(201).json({ success: true, organization })
    } catch (error) {
        next(error)
    }
}

export const getOrganization = async (req, res, next) => {
    try {
        if (!validId(req.params.organizationId)) return invalid(res, 'Invalid organization id.')
        const organization = await Organization.findById(req.params.organizationId).lean()
        if (!organization) return notFound(res, 'Organization not found.')
        const contributions = await OrganizationContribution.find({ organization: organization._id })
            .populate('recordedBy', 'name')
            .sort({ contributedAt: -1 })
            .lean()
        res.json({ success: true, organization, contributions })
    } catch (error) {
        next(error)
    }
}

export const updateOrganization = async (req, res, next) => {
    try {
        if (!validId(req.params.organizationId)) return invalid(res, 'Invalid organization id.')
        const updates = organizationPayload(req.body)
        const organization = await Organization.findByIdAndUpdate(
            req.params.organizationId,
            { $set: updates },
            { new: true, runValidators: true }
        )
        if (!organization) return notFound(res, 'Organization not found.')
        await writeOperationalAudit({
            actor: req.user._id,
            action: 'organization.updated',
            entityType: 'Organization',
            entityId: organization._id,
            details: { organizationId: organization.organizationId, organizationName: organization.organizationName }
        })
        res.json({ success: true, organization })
    } catch (error) {
        next(error)
    }
}

export const updateOrganizationStatus = async (req, res, next) => {
    try {
        if (!validId(req.params.organizationId)) return invalid(res, 'Invalid organization id.')
        if (!organizationStatuses.includes(req.body.status)) {
            return invalid(res, `Status must be one of: ${organizationStatuses.join(', ')}.`)
        }
        const organization = await Organization.findByIdAndUpdate(
            req.params.organizationId,
            { $set: { status: req.body.status } },
            { new: true, runValidators: true }
        )
        if (!organization) return notFound(res, 'Organization not found.')
        await writeOperationalAudit({
            actor: req.user._id,
            action: 'organization.status_updated',
            entityType: 'Organization',
            entityId: organization._id,
            details: { organizationId: organization.organizationId, status: organization.status }
        })
        res.json({ success: true, organization })
    } catch (error) {
        next(error)
    }
}

export const addOrganizationContribution = async (req, res, next) => {
    try {
        if (!validId(req.params.organizationId)) return invalid(res, 'Invalid organization id.')
        if (!contributionTypes.includes(req.body.contributionType)) {
            return invalid(res, `Contribution type must be one of: ${contributionTypes.join(', ')}.`)
        }
        const organization = await Organization.findById(req.params.organizationId)
        if (!organization) return notFound(res, 'Organization not found.')
        const contribution = await OrganizationContribution.create({
            ...req.body,
            organization: organization._id,
            recordedBy: req.user._id
        })
        await writeOperationalAudit({
            actor: req.user._id,
            action: 'organization.contribution_recorded',
            entityType: 'OrganizationContribution',
            entityId: contribution._id,
            details: { organizationId: organization.organizationId, contributionType: contribution.contributionType, disasterEvent: contribution.disasterEvent }
        })
        res.status(201).json({ success: true, contribution })
    } catch (error) {
        next(error)
    }
}
