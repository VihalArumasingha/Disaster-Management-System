import mongoose from 'mongoose'
import ImpactRecord from '../../../models/ImpactRecord.js'
import Organization from '../../../models/Organization.js'
import OrganizationContribution from '../../../models/OrganizationContribution.js'
import OperationalAuditLog from '../../../models/OperationalAuditLog.js'
import ReliefDistribution from '../../../models/ReliefDistribution.js'
import ReliefSupply from '../../../models/ReliefSupply.js'
import Shelter from '../../../models/Shelter.js'
import ShelterOccupancy from '../../../models/ShelterOccupancy.js'
import Warning from '../../../models/Warning.js'
import WarningDelivery from '../../../models/WarningDelivery.js'
import HazardReport from '../../../models/HazardReport.js'

const districts = [
    'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo',
    'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy',
    'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale',
    'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa',
    'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'
]
const hazardTypes = ['flood', 'landslide', 'road_blockage', 'tsunami', 'storm', 'other']
const auditStatuses = ['Pending Verification', 'Verified', 'Rejected', 'Flagged']

const invalid = (res, message) => res.status(400).json({ success: false, message })
const validDate = (value) => (
    !value
    || (
        /^\d{4}-\d{2}-\d{2}$/.test(value)
        && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime())
        && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
    )
)
const dateFilter = (from, to) => {
    if (!from && !to) return {}
    return {
        $gte: from ? new Date(`${from}T00:00:00.000Z`) : new Date(0),
        $lte: to ? new Date(`${to}T23:59:59.999Z`) : new Date()
    }
}
const normalizedFilter = (body = {}) => ({
    district: String(body.district || ''),
    hazardType: String(body.hazardType || ''),
    disasterEvent: String(body.disasterEvent || '').trim(),
    dateFrom: String(body.dateFrom || ''),
    dateTo: String(body.dateTo || ''),
    organization: String(body.organization || '')
})
const textMatch = (value) => new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)
const aggregateBy = (rows, key, measure) => {
    const grouped = new Map()
    for (const row of rows) {
        const label = key(row) || 'Unknown'
        const current = grouped.get(label) || { name: label }
        for (const [field, value] of Object.entries(measure(row))) current[field] = (current[field] || 0) + (Number(value) || 0)
        grouped.set(label, current)
    }
    return [...grouped.values()]
}
const deliveryReached = (delivery) => (
    delivery.inApp?.status === 'sent'
    || ['sent', 'delivered'].includes(delivery.sms?.status)
    || delivery.email?.status === 'sent'
)

const validateFilters = (filters, res) => {
    if (filters.district && !districts.includes(filters.district)) return invalid(res, 'Select a valid district.')
    if (filters.hazardType && !hazardTypes.includes(filters.hazardType)) return invalid(res, 'Select a valid hazard type.')
    if (filters.organization && !mongoose.isValidObjectId(filters.organization)) return invalid(res, 'Select a valid organization.')
    if (!validDate(filters.dateFrom) || !validDate(filters.dateTo)) return invalid(res, 'Enter valid date filters.')
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) return invalid(res, 'Date From cannot be later than Date To.')
    if (filters.disasterEvent.length > 200) return invalid(res, 'Disaster event filter cannot exceed 200 characters.')
    return null
}

export const getAnalyticsOptions = async (req, res, next) => {
    try {
        const [events, organizations] = await Promise.all([
            Promise.all([
                ImpactRecord.distinct('disasterEvent'),
                Shelter.distinct('disasterEvent'),
                ReliefSupply.distinct('disasterEvent'),
                ReliefDistribution.distinct('disasterEvent'),
                OrganizationContribution.distinct('disasterEvent'),
                Warning.distinct('title')
            ]),
            Organization.find({}).select('organizationId organizationName').sort({ organizationName: 1 }).lean()
        ])
        res.json({
            success: true,
            districts,
            hazardTypes,
            disasterEvents: [...new Set(events.flat().filter(Boolean))].sort((a, b) => a.localeCompare(b)),
            organizations
        })
    } catch (error) {
        next(error)
    }
}

export const generateAnalytics = async (req, res, next) => {
    try {
        const filters = normalizedFilter(req.body)
        const validation = validateFilters(filters, res)
        if (validation) return validation

        const dateRange = dateFilter(filters.dateFrom, filters.dateTo)
        const eventMatch = filters.disasterEvent ? textMatch(filters.disasterEvent) : null
        const orgId = filters.organization ? new mongoose.Types.ObjectId(filters.organization) : null
        const warningQuery = {
            status: { $in: ['issued', 'partially_issued', 'delivery_failed'] },
            ...(filters.hazardType ? { hazardType: filters.hazardType } : {}),
            ...(filters.district ? { city: textMatch(filters.district) } : {}),
            ...(eventMatch ? { title: eventMatch } : {}),
            ...(dateRange.$gte || dateRange.$lte ? {
                $or: [
                    { issuedAt: dateRange },
                    { issuedAt: null, createdAt: dateRange }
                ]
            } : {})
        }
        const districtShelterIds = filters.district
            ? await Shelter.find({ district: filters.district }).distinct('_id')
            : []
        const districtOrganizationIds = filters.district
            ? await Organization.find({ district: filters.district }).distinct('_id')
            : []
        const supplyOrganizationIds = orgId
            ? (filters.district && !districtOrganizationIds.some((id) => String(id) === String(orgId)) ? [] : [orgId])
            : districtOrganizationIds
        const supplyQuery = {
            ...((orgId || filters.district) ? { organization: { $in: supplyOrganizationIds } } : {}),
            ...(eventMatch ? { disasterEvent: eventMatch } : {})
        }
        const distributionQuery = {
            ...(orgId ? { organization: orgId } : {}),
            ...(filters.district ? {
                $or: [
                    { district: filters.district },
                    { shelter: { $in: districtShelterIds } }
                ]
            } : {}),
            ...(eventMatch ? { disasterEvent: eventMatch } : {}),
            ...(dateRange.$gte || dateRange.$lte ? { distributionDate: dateRange } : {})
        }
        const impactQuery = {
            ...(filters.district ? { district: filters.district } : {}),
            ...(eventMatch ? { disasterEvent: eventMatch } : {}),
            ...(dateRange.$gte || dateRange.$lte ? { recordedDate: dateRange } : {})
        }
        const shelterQuery = {
            ...(filters.district ? { district: filters.district } : {}),
            ...(eventMatch ? { disasterEvent: eventMatch } : {})
        }
        const contributionQuery = {
            ...((orgId || filters.district) ? {
                organization: {
                    $in: orgId
                        ? (filters.district && !districtOrganizationIds.some((id) => String(id) === String(orgId)) ? [] : [orgId])
                        : districtOrganizationIds
                }
            } : {}),
            ...(eventMatch ? { disasterEvent: eventMatch } : {}),
            ...(dateRange.$gte || dateRange.$lte ? { contributedAt: dateRange } : {})
        }

        const [warnings, supplies, distributions, impactRecords, shelters, occupancy, contributions, hazardReports] = await Promise.all([
            Warning.find(warningQuery).select('title city hazardType issuedAt createdAt deliverySummary').lean(),
            ReliefSupply.find({
                ...supplyQuery,
                ...(dateRange.$gte || dateRange.$lte ? { receivedDate: dateRange } : {})
            }).populate('organization', 'organizationName district').sort({ receivedDate: -1 }).lean(),
            ReliefDistribution.find(distributionQuery)
                .populate('supply', 'supplyName category unit')
                .populate('organization', 'organizationName')
                .populate('shelter', 'shelterName district')
                .populate('verifiedBy', 'name')
                .populate('responsibleOfficer', 'name')
                .populate('auditHistory.changedBy', 'name')
                .sort({ distributionDate: -1 }).lean(),
            ImpactRecord.find(impactQuery).populate('recordedBy', 'name').sort({ recordedDate: -1 }).lean(),
            Shelter.find(shelterQuery).sort({ shelterName: 1 }).lean(),
            ShelterOccupancy.find({
                ...(dateRange.$gte || dateRange.$lte ? { recordedAt: dateRange } : {}),
                ...(eventMatch ? { disasterEvent: eventMatch } : {})
            }).populate('shelter', 'district disasterEvent shelterName capacity').sort({ recordedAt: 1 }).lean(),
            OrganizationContribution.find({
                ...(orgId ? { organization: orgId } : {}),
                ...(eventMatch ? { disasterEvent: eventMatch } : {}),
                ...(dateRange.$gte || dateRange.$lte ? { contributedAt: dateRange } : {})
            }).populate('organization', 'organizationName district').sort({ contributedAt: -1 }).lean(),
            HazardReport.find({
                ...(filters.hazardType ? { hazardType: filters.hazardType } : {}),
                ...(dateRange.$gte || dateRange.$lte ? { capturedAt: dateRange } : {})
            }).select('hazardType status capturedAt submittedAt').lean()
        ])

        const warningIds = warnings.map((warning) => warning._id)
        const deliveries = warningIds.length
            ? await WarningDelivery.find({ warningId: { $in: warningIds } }).select('warningId recipientId inApp.status sms.status email.status').lean()
            : []
        const reachedByWarning = new Map()
        const reachedUsers = new Set()
        let reachedDeliveries = 0
        for (const delivery of deliveries) {
            if (!reachedByWarning.has(String(delivery.warningId))) reachedByWarning.set(String(delivery.warningId), { reached: 0, recipients: 0 })
            const totals = reachedByWarning.get(String(delivery.warningId))
            totals.recipients += 1
            if (deliveryReached(delivery)) {
                totals.reached += 1
                reachedUsers.add(String(delivery.recipientId))
                reachedDeliveries += 1
            }
        }

        const matchedShelterIds = new Set(shelters.map((shelter) => String(shelter._id)))
        const matchingOccupancy = occupancy.filter((record) => (
            record.shelter
            && matchedShelterIds.has(String(record.shelter._id))
            && (!filters.district || record.shelter.district === filters.district)
        ))
        const allDistributionsForSupplies = supplies.length
            ? await ReliefDistribution.aggregate([
                { $match: { supply: { $in: supplies.map((supply) => supply._id) }, auditStatus: { $ne: 'Rejected' } } },
                { $group: { _id: '$supply', total: { $sum: '$quantity' } } }
            ])
            : []
        const distributedBySupply = new Map(allDistributionsForSupplies.map((row) => [String(row._id), row.total]))
        const totalReceived = sum(supplies, 'quantityReceived')
        const totalRemaining = supplies.reduce((total, supply) => (
            total + Math.max(0, supply.quantityReceived - (distributedBySupply.get(String(supply._id)) || 0))
        ), 0)
        const occupancyTotal = sum(shelters, 'currentOccupancy')
        const capacityTotal = sum(shelters, 'capacity')
        const contributionAmount = sum(contributions.filter((record) => (record.currency || 'LKR') === 'LKR'), 'amount')
        const contributionTotalsByCurrency = aggregateBy(
            contributions,
            (record) => record.currency || 'LKR',
            (record) => ({ amount: record.amount })
        )
        const impactSummary = {
            affectedPopulation: sum(impactRecords, 'affectedPopulation'),
            evacuatedPopulation: sum(impactRecords, 'evacuatedPopulation'),
            peopleInShelters: sum(impactRecords, 'peopleInShelters'),
            injured: sum(impactRecords, 'injured'),
            deaths: sum(impactRecords, 'deaths'),
            housesDamaged: sum(impactRecords, 'housesDamaged'),
            schoolsAffected: sum(impactRecords, 'schoolsAffected'),
            roadsBlocked: sum(impactRecords, 'roadsBlocked'),
            hospitalsAffected: sum(impactRecords, 'hospitalsAffected')
        }
        const auditSummary = Object.fromEntries(auditStatuses.map((status) => [
            status,
            distributions.filter((distribution) => distribution.auditStatus === status).length
        ]))
        const alertReachTrend = new Map()
        for (const warning of warnings) {
            const alertDate = warning.issuedAt || warning.createdAt
            if (!alertDate) continue
            const date = new Date(alertDate).toISOString().slice(0, 10)
            const point = alertReachTrend.get(date) || { date, total: 0, reached: 0 }
            point.total += 1
            point.reached += reachedByWarning.get(String(warning._id))?.reached || 0
            alertReachTrend.set(date, point)
        }
        const shelterOccupancyByDay = new Map()
        for (const record of matchingOccupancy) {
            const date = new Date(record.recordedAt).toISOString().slice(0, 10)
            shelterOccupancyByDay.set(`${date}:${record.shelter._id}`, { date, shelter: String(record.shelter._id), occupancy: record.occupancyCount })
        }
        const shelterOccupancyTrend = new Map()
        for (const snapshot of shelterOccupancyByDay.values()) {
            shelterOccupancyTrend.set(snapshot.date, (shelterOccupancyTrend.get(snapshot.date) || 0) + snapshot.occupancy)
        }

        const data = {
            generatedAt: new Date().toISOString(),
            generatedBy: req.user.name || req.user.email,
            filters,
            summary: {
                totalAlerts: warnings.length,
                citizenReach: reachedUsers.size,
                reachRate: deliveries.length ? Number((reachedDeliveries / deliveries.length * 100).toFixed(1)) : 0,
                shelterCapacity: capacityTotal,
                shelterOccupancy: occupancyTotal,
                shelterUtilization: capacityTotal ? Number((occupancyTotal / capacityTotal * 100).toFixed(1)) : 0,
                suppliesReceived: totalReceived,
                suppliesDistributed: sum(distributions.filter((distribution) => distribution.auditStatus !== 'Rejected'), 'quantity'),
                remainingInventory: totalRemaining,
                organizationContributions: contributionAmount,
                organizationContributionsByCurrency: contributionTotalsByCurrency,
                impactRecords: impactRecords.length,
                distributionAudit: auditSummary,
                districtImpact: impactSummary
            },
            charts: {
                alertReachTrend: [...alertReachTrend.values()].sort((a, b) => a.date.localeCompare(b.date)),
                shelterOccupancyTrend: [...shelterOccupancyTrend].sort(([a], [b]) => a.localeCompare(b))
                    .map(([date, occupancy]) => ({ date, occupancy })),
                distributionByCategory: aggregateBy(
                    distributions.filter((distribution) => distribution.auditStatus !== 'Rejected'),
                    (distribution) => distribution.supply?.category,
                    (distribution) => ({ quantity: distribution.quantity })
                ),
                organizationContributions: aggregateBy(
                    [...contributions.map((record) => ({ ...record, kind: 'contribution' })), ...supplies.map((supply) => ({ ...supply, kind: 'supply' }))],
                    (record) => record.organization?.organizationName,
                    (record) => record.kind === 'contribution'
                        ? { contributionAmount: (record.currency || 'LKR') === 'LKR' ? record.amount : 0, supplyQuantity: 0 }
                        : { contributionAmount: 0, supplyQuantity: record.quantityReceived }
                ),
                districtImpact: aggregateBy(impactRecords, (record) => record.district, (record) => ({
                    affected: record.affectedPopulation,
                    injured: record.injured,
                    deaths: record.deaths
                }))
            },
            records: {
                alerts: warnings.map((warning) => ({
                    event: warning.title,
                    district: warning.city,
                    hazardType: warning.hazardType,
                    issuedAt: warning.issuedAt || warning.createdAt,
                    recipients: reachedByWarning.get(String(warning._id))?.recipients || 0,
                    reached: reachedByWarning.get(String(warning._id))?.reached || 0
                })),
                shelters: shelters.map((shelter) => ({
                    shelterId: shelter.shelterId,
                    shelterName: shelter.shelterName,
                    district: shelter.district,
                    event: shelter.disasterEvent,
                    capacity: shelter.capacity,
                    occupancy: shelter.currentOccupancy,
                    available: Math.max(0, shelter.capacity - shelter.currentOccupancy),
                    status: shelter.status
                })),
                supplies: supplies.map((supply) => ({
                    supplyId: supply.supplyId,
                    supplyName: supply.supplyName,
                    organization: supply.organization?.organizationName || 'Unknown',
                    event: supply.disasterEvent,
                    category: supply.category,
                    received: supply.quantityReceived,
                    distributed: distributedBySupply.get(String(supply._id)) || 0,
                    remaining: Math.max(0, supply.quantityReceived - (distributedBySupply.get(String(supply._id)) || 0)),
                    unit: supply.unit
                })),
                distributions: distributions.map((distribution) => ({
                    distributionId: distribution.distributionId,
                    event: distribution.disasterEvent,
                    organization: distribution.organization?.organizationName || 'Unknown',
                    supply: distribution.supply?.supplyName || 'Unknown',
                    category: distribution.supply?.category || 'Unknown',
                    district: distribution.district || distribution.shelter?.district || '',
                    quantity: distribution.quantity,
                    date: distribution.distributionDate,
                    recipient: distribution.recipient,
                    auditStatus: distribution.auditStatus,
                    verifiedBy: distribution.verifiedBy?.name || '',
                    verifiedAt: distribution.verifiedAt || null,
                    verificationNotes: distribution.verificationNotes || '',
                    auditHistory: (distribution.auditHistory || []).map((entry) => ({
                        status: entry.auditStatus,
                        notes: entry.notes,
                        changedBy: entry.changedBy?.name || '',
                        changedAt: entry.changedAt
                    }))
                })),
                contributions: contributions.map((record) => ({
                    organization: record.organization?.organizationName || 'Unknown',
                    district: record.organization?.district || '',
                    type: record.contributionType,
                    description: record.description,
                    amount: record.amount || 0,
                    currency: record.currency || 'LKR',
                    quantity: record.quantity || 0,
                    event: record.disasterEvent,
                    date: record.contributedAt
                })),
                impacts: impactRecords.map((record) => ({
                    event: record.disasterEvent,
                    district: record.district,
                    ...impactSummaryRow(record),
                    date: record.recordedDate
                })),
                hazardReports: hazardReports.map((report) => ({
                    hazardType: report.hazardType,
                    status: report.status,
                    capturedAt: report.capturedAt
                }))
            }
        }
        data.summary.hazardReports = hazardReports.length
        await OperationalAuditLog.create({
            actor: req.user._id,
            action: 'analytics.generated',
            entityType: 'AnalyticsReport',
            details: { filters, matchedRecords: Object.fromEntries(Object.entries(data.records).map(([key, rows]) => [key, rows.length])) }
        })
        res.json({ success: true, analytics: data, hasData: Object.values(data.records).some((rows) => rows.length > 0) })
    } catch (error) {
        next(error)
    }
}

const impactSummaryRow = (record) => ({
    affectedPopulation: record.affectedPopulation,
    evacuatedPopulation: record.evacuatedPopulation,
    peopleInShelters: record.peopleInShelters,
    injured: record.injured,
    deaths: record.deaths,
    housesDamaged: record.housesDamaged,
    schoolsAffected: record.schoolsAffected,
    roadsBlocked: record.roadsBlocked,
    hospitalsAffected: record.hospitalsAffected,
    otherImpact: record.otherImpact
})

export const logReportExport = async (req, res, next) => {
    try {
        const { format, filters, generatedAt } = req.body
        if (!['PDF', 'CSV'].includes(format)) return invalid(res, 'Report format must be PDF or CSV.')
        await OperationalAuditLog.create({
            actor: req.user._id,
            action: 'report.exported',
            entityType: 'AnalyticsReport',
            details: { format, filters: normalizedFilter(filters), generatedAt }
        })
        res.json({ success: true })
    } catch (error) {
        next(error)
    }
}
