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

// case-insensitive exact-match regex
const textMatch = (value) => new RegExp(`^${String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')

// sum a numeric field across rows
const sum = (rows, key) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0)

// group rows by a key and add up numeric fields
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

// check if a warning delivery reached the user on any channel
const deliveryReached = (delivery) => (
    delivery.inApp?.status === 'sent'
    || ['sent', 'delivered'].includes(delivery.sms?.status)
    || delivery.email?.status === 'sent'
)

// minutes between warning creation and issuance
const alertIssueElapsedMinutes = (warning) => {
    const createdAt = new Date(warning.createdAt)
    const issuedAt = new Date(warning.issuedAt)
    return warning.issuedAt
        && Number.isFinite(createdAt.getTime())
        && Number.isFinite(issuedAt.getTime())
        && issuedAt >= createdAt
        ? Number(((issuedAt - createdAt) / 60000).toFixed(1))
        : null
}

// validate all incoming filters
const validateFilters = (filters, res) => {
    if (filters.district && !districts.includes(filters.district)) return invalid(res, 'Select a valid district.')
    if (filters.hazardType && !hazardTypes.includes(filters.hazardType)) return invalid(res, 'Select a valid hazard type.')
    if (filters.organization && !mongoose.isValidObjectId(filters.organization)) return invalid(res, 'Select a valid organization.')
    if (!validDate(filters.dateFrom) || !validDate(filters.dateTo)) return invalid(res, 'Enter valid date filters.')
    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) return invalid(res, 'Date From cannot be later than Date To.')
    if (filters.disasterEvent.length > 200) return invalid(res, 'Disaster event filter cannot exceed 200 characters.')
    return null
}

// GET: return dropdown options for the analytics filter form
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

// POST: generate the full analytics report for the given filters
export const generateAnalytics = async (req, res, next) => {
    try {
        // validate filters
        const filters = normalizedFilter(req.body)
        const validation = validateFilters(filters, res)
        if (validation) return validation

        // build query fragments for each collection
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
        const scopedOrganizationIds = orgId
            ? (filters.district && !districtOrganizationIds.some((id) => String(id) === String(orgId)) ? [] : [orgId])
            : districtOrganizationIds
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
            ...((orgId || filters.district) ? { organization: { $in: scopedOrganizationIds } } : {}),
            ...(eventMatch ? { disasterEvent: eventMatch } : {}),
            ...(dateRange.$gte || dateRange.$lte ? { contributedAt: dateRange } : {})
        }
        const hazardReportQuery = {
            status: 'verified',
            $or: [
                { archived: false },
                { archived: { $exists: false } }
            ],
            ...(filters.district ? { district: filters.district } : {}),
            ...(filters.hazardType ? { hazardType: filters.hazardType } : {}),
            ...(dateRange.$gte || dateRange.$lte ? { capturedAt: dateRange } : {}),
            ...(eventMatch ? { _id: null } : {})   // no event field in this collection
        }

        // fetch all data in parallel
        const [warnings, supplies, distributions, impactRecords, shelters, occupancy, contributions, hazardReports] = await Promise.all([
            Warning.find(warningQuery).select('title city hazardType severity status issuedAt createdAt deliverySummary').lean(),
            ReliefSupply.find({
                ...supplyQuery,
                ...(dateRange.$gte || dateRange.$lte ? { receivedDate: dateRange } : {})
            }).populate('organization', 'organizationName district').sort({ receivedDate: -1 }).lean(),
            ReliefDistribution.find(distributionQuery)
                .populate('supply', 'supplyName category unit')
                .populate('organization', 'organizationName')
                .populate('shelter', 'shelterName district')
                .populate('reliefLocation', 'name areaType')
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
            OrganizationContribution.find(contributionQuery)
                .populate('organization', 'organizationName district').sort({ contributedAt: -1 }).lean(),
            HazardReport.find(hazardReportQuery).select('hazardType status capturedAt district').lean()
        ])

        // calculate alert reach per warning and unique users
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

        // match shelter occupancy records to our shelters
        const matchedShelterIds = new Set(shelters.map((shelter) => String(shelter._id)))
        const matchingOccupancy = occupancy.filter((record) => (
            record.shelter
            && matchedShelterIds.has(String(record.shelter._id))
            && (!filters.district || record.shelter.district === filters.district)
        ))
        const occupancyByShelter = new Map()
        for (const record of matchingOccupancy) {
            occupancyByShelter.set(String(record.shelter._id), record)
        }
        const hasShelterDateFilter = Boolean(filters.dateFrom || filters.dateTo)
        const hasValidOccupancy = (value) => (
            value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0
        )
        const hasValidCapacity = (value) => (
            value !== null && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0
        )
        // data quality flags
        const missingHistoricalOccupancy = hasShelterDateFilter && shelters.some((shelter) => (
            !hasValidOccupancy(occupancyByShelter.get(String(shelter._id))?.occupancyCount)
        ))
        const missingCurrentOccupancy = !hasShelterDateFilter
            && shelters.some((shelter) => !hasValidOccupancy(shelter.currentOccupancy))
        const missingShelterCapacity = shelters.some((shelter) => (
                !hasValidCapacity(shelter.capacity)
        ))
        // compare supplies received vs distributed
        const allDistributionsForSupplies = supplies.length
            ? await ReliefDistribution.aggregate([
                {
                    $match: {
                        ...distributionQuery,
                        supply: { $in: supplies.map((supply) => supply._id) },
                        auditStatus: { $ne: 'Rejected' }
                    }
                },
                { $group: { _id: '$supply', total: { $sum: '$quantity' } } }
            ])
            : []
        const distributedBySupply = new Map(allDistributionsForSupplies.map((row) => [String(row._id), row.total]))
        const totalReceived = sum(supplies, 'quantityReceived')
        const totalRemaining = supplies.reduce((total, supply) => (
            total + Math.max(0, supply.quantityReceived - (distributedBySupply.get(String(supply._id)) || 0))
        ), 0)
        // totals (null if data incomplete)
        const occupancyTotal = hasShelterDateFilter
            ? missingHistoricalOccupancy
                ? null
                : shelters.reduce((total, shelter) => (
                    total + Number(occupancyByShelter.get(String(shelter._id))?.occupancyCount || 0)
                ), 0)
            : missingCurrentOccupancy
                ? null
                : sum(shelters, 'currentOccupancy')
        const capacityTotal = missingShelterCapacity ? null : sum(shelters, 'capacity')
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
        // build chart series
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

        // document metrics that cannot be calculated
        const missingMetrics = [
            {
                metric: 'Planned-versus-actual response targets',
                reason: 'The system has no event-scoped response target records. Alert creation-to-issue elapsed time is shown where available, but cannot be compared with a target.'
            },
            {
                metric: 'Required resources and unmet resource quantities',
                reason: 'The existing inventory target is global/defaulted and is not linked to an event or affected area, so it cannot establish a valid shortage target.'
            }
        ]
        if (hasShelterDateFilter) {
            missingMetrics.push({
                metric: 'Historical shelter capacity',
                reason: 'Shelter capacity history is not recorded; capacity values use the current shelter record.'
            })
        }
        if (missingHistoricalOccupancy || missingCurrentOccupancy) {
            missingMetrics.push({
                metric: hasShelterDateFilter ? 'Historical shelter occupancy' : 'Shelter occupancy',
                reason: hasShelterDateFilter
                    ? 'At least one matching shelter has no valid occupancy snapshot in the selected date range, so the aggregate occupancy comparison is unavailable.'
                    : 'At least one matching shelter has no valid current occupancy value, so the aggregate occupancy comparison is unavailable.'
            })
        }
        if (missingShelterCapacity) {
            missingMetrics.push({
                metric: 'Shelter capacity',
                reason: 'At least one matching shelter has no valid capacity value, so the aggregate capacity comparison is unavailable.'
            })
        }
        const missingSources = [
            {
                source: 'Donation-to-distribution lineage',
                reason: 'Donation records are not linked to organization contributions, relief inventory, distributions, affected areas, or outcomes. No donor traceability is inferred.'
            }
        ]
        if (eventMatch) {
            missingSources.push({
                source: 'Verified citizen reports for the selected event',
                reason: 'Verified hazard reports have no disaster-event relationship and are omitted when a single event is selected.'
            })
        }
        // build per-shelter rows with utilization and status
        const shelterRows = shelters.map((shelter) => {
            const occupancyRecord = hasShelterDateFilter
                ? occupancyByShelter.get(String(shelter._id))
                : null
            const occupancyValue = hasShelterDateFilter
                ? occupancyRecord?.occupancyCount ?? null
                : shelter.currentOccupancy
            const capacity = Number(shelter.capacity)
            const occupancyKnown = hasValidOccupancy(occupancyValue)
            const capacityKnown = hasValidCapacity(shelter.capacity)
            return {
                shelterId: shelter.shelterId,
                shelterName: shelter.shelterName,
                district: shelter.district,
                event: shelter.disasterEvent,
                capacity: shelter.capacity,
                occupancy: occupancyValue,
                available: !occupancyKnown || !capacityKnown ? null : Math.max(0, capacity - Number(occupancyValue)),
                overCapacity: !occupancyKnown || !capacityKnown ? null : Math.max(0, Number(occupancyValue) - capacity),
                utilization: !occupancyKnown || !capacityKnown || capacity <= 0
                    ? null
                    : Number((Number(occupancyValue) / capacity * 100).toFixed(1)),
                capacityStatus: !occupancyKnown
                    ? 'Occupancy unavailable'
                    : !capacityKnown
                        ? 'Capacity unavailable'
                    : occupancyValue > capacity
                        ? 'Over capacity'
                        : capacity <= 0
                            ? 'Capacity unavailable'
                            : occupancyValue === capacity
                                ? 'At capacity'
                                : 'Below capacity',
                status: shelter.status
            }
        })
        // assemble final response
        const data = {
            generatedAt: new Date().toISOString(),
            generatedBy: req.user.name || req.user.email,
            filters,
            dataQuality: {
                status: 'partial',
                missingMetrics,
                missingSources,
                disclaimer: 'Comparisons and lineage are limited to records with explicit database relationships. No missing targets, allocations, or donor links have been inferred.'
            },
            summary: {
                totalAlerts: warnings.length,
                citizenReach: reachedUsers.size,
                reachRate: deliveries.length ? Number((reachedDeliveries / deliveries.length * 100).toFixed(1)) : 0,
                shelterCapacity: capacityTotal,
                shelterOccupancy: occupancyTotal,
                shelterUtilization: capacityTotal && occupancyTotal !== null
                    ? Number((occupancyTotal / capacityTotal * 100).toFixed(1))
                    : null,
                overcrowdedShelters: shelterRows.filter((shelter) => shelter.capacityStatus === 'Over capacity').length,
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
                    severity: warning.severity,
                    status: warning.status,
                    issuedAt: warning.issuedAt || warning.createdAt,
                    issueElapsedMinutes: alertIssueElapsedMinutes(warning),
                    recipients: reachedByWarning.get(String(warning._id))?.recipients || 0,
                    reached: reachedByWarning.get(String(warning._id))?.reached || 0
                })),
                shelters: shelterRows,
                supplies: supplies.map((supply) => ({
                    supplyId: supply.supplyId,
                    supplyName: supply.supplyName,
                    organization: supply.organization?.organizationName || 'Unknown',
                    event: supply.disasterEvent,
                    category: supply.category,
                    received: supply.quantityReceived,
                    distributed: distributedBySupply.get(String(supply._id)) || 0,
                    remaining: Math.max(0, supply.quantityReceived - (distributedBySupply.get(String(supply._id)) || 0)),
                    stockShortage: Math.max(0, (distributedBySupply.get(String(supply._id)) || 0) - supply.quantityReceived),
                    unit: supply.unit
                })),
                distributions: distributions.map((distribution) => ({
                    distributionId: distribution.distributionId,
                    event: distribution.disasterEvent,
                    organization: distribution.organization?.organizationName || 'Unknown',
                    supply: distribution.supply?.supplyName || 'Unknown',
                    category: distribution.supply?.category || 'Unknown',
                    district: distribution.district || distribution.shelter?.district || '',
                    destinationType: distribution.destinationType,
                    affectedArea: distribution.reliefLocation?.name || '',
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
                    capturedAt: report.capturedAt,
                    district: report.district || ''
                }))
            }
        }
        data.summary.hazardReports = hazardReports.length
        // save audit log
        await OperationalAuditLog.create({
            actor: req.user._id,
            action: 'analytics.generated',
            entityType: 'AnalyticsReport',
            details: {
                filters,
                generatedAt: data.generatedAt,
                format: 'JSON',
                status: 'generated',
                dataStatus: data.dataQuality.status,
                matchedRecords: Object.fromEntries(Object.entries(data.records).map(([key, rows]) => [key, rows.length]))
            }
        })
        res.json({ success: true, analytics: data, hasData: Object.values(data.records).some((rows) => rows.length > 0) })
    } catch (error) {
        next(error)
    }
}

// extract impact fields from a record
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
        if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
            return invalid(res, 'Report filters are required.')
        }
        if (typeof generatedAt !== 'string' || !Number.isFinite(new Date(generatedAt).getTime())) {
            return invalid(res, 'A valid report generation timestamp is required.')
        }
        const normalized = normalizedFilter(filters)
        const validation = validateFilters(normalized, res)
        if (validation) return validation
        await OperationalAuditLog.create({
            actor: req.user._id,
            action: 'report.exported',
            entityType: 'AnalyticsReport',
            details: { format, filters: normalized, generatedAt, status: 'generated' }
        })
        res.json({ success: true })
    } catch (error) {
        next(error)
    }
}