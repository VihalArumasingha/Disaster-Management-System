import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock persistence and delivery dependencies.
// The actual service logic is tested; no real DB or notification provider is used.
vi.mock('../../models/User.js', () => ({
    default: { find: vi.fn(), countDocuments: vi.fn() }
}))

vi.mock('../../models/TargetArea.js', () => ({
    default: { find: vi.fn(), countDocuments: vi.fn(), create: vi.fn() }
}))

vi.mock('../../models/ReportCluster.js', () => ({
    default: { countDocuments: vi.fn() }
}))

// Mock only the weather provider; keep the DMC controller and service real.
vi.mock('axios', () => ({
    default: { get: vi.fn() }
}))

vi.mock('../../models/Warning.js', () => ({
    default: {
        create: vi.fn(),
        findOne: vi.fn(),
        findById: vi.fn(),
        findOneAndUpdate: vi.fn(),
        updateOne: vi.fn(),
        countDocuments: vi.fn(),
        find: vi.fn()
    }
}))

vi.mock('../../models/WarningDelivery.js', () => ({
    default: {
        find: vi.fn(),
        findOneAndUpdate: vi.fn(),
        updateOne: vi.fn()
    }
}))

vi.mock('../../utils/citizenTargetAreas.js', () => ({
    CITIZEN_ROLE_VALUES: ['citizen', 'CITIZEN']
}))

vi.mock('../../roles/dmcOfficer/services/warningDeliveryService.js', () => ({
    deliverWarningToCitizen: vi.fn(),
    finalizeWarningDelivery: vi.fn()
}))

import User from '../../models/User.js'
import TargetArea from '../../models/TargetArea.js'
import ReportCluster from '../../models/ReportCluster.js'
import Warning from '../../models/Warning.js'
import {
    deliverWarningToCitizen,
    finalizeWarningDelivery
} from '../../roles/dmcOfficer/services/warningDeliveryService.js'

import {
    validatePolygonGeometry,
    previewTargetArea,
    createTargetArea,
    listTargetAreas,
    createWarning,
    updateWarning,
    previewWarningRecipients,
    getWarningForReview,
    postWarningUpdate,
    issueWarning,
    resolveWarning,
    listWarnings,
    getOverview
} from '../../roles/dmcOfficer/services/dmcOfficerService.js'

import axios from 'axios'

import {
    overview as dmcOverviewController,
    targetAreas as dmcTargetAreasController,
    targetAreaPreview as dmcTargetAreaPreviewController,
    saveTargetArea as dmcSaveTargetAreaController,
    warnings as dmcWarningsController,
    saveWarning as dmcSaveWarningController,
    editWarning as dmcEditWarningController,
    addWarningUpdate as dmcAddWarningUpdateController,
    reviewWarning as dmcReviewWarningController,
    issueWarningNow as dmcIssueWarningController,
    resolveWarningNow as dmcResolveWarningController,
    warningRecipientPreview as dmcRecipientPreviewController,
    openWeatherTile,
    profile as dmcProfileController
} from '../../roles/dmcOfficer/controllers/dmcOfficerController.js'

const OFFICER_ID = '64a000000000000000000010'
const CITIZEN_ID = '64a000000000000000000020'
const NEW_CITIZEN_ID = '64a000000000000000000021'
const AREA_ID = '64a000000000000000000001'
const ADDED_AREA_ID = '64a000000000000000000002'
const WARNING_ID = '64a000000000000000000030'

const polygon = {
    type: 'Polygon',
    coordinates: [[
        [79.8, 6.9],
        [79.9, 6.9],
        [79.9, 7.0],
        [79.8, 7.0],
        [79.8, 6.9]
    ]]
}

// Mongoose-like query mock that supports the methods used by the service.
const queryReturning = (value) => {
    const query = {
        select: vi.fn(() => query),
        populate: vi.fn(() => query),
        sort: vi.fn(() => query),
        lean: vi.fn(() => query),
        limit: vi.fn(() => query),
        then: (resolve, reject) => Promise.resolve(value).then(resolve, reject)
    }

    return query
}

const makeArea = (overrides = {}) => ({
    _id: AREA_ID,
    name: 'Colombo Flood Zone',
    areaType: 'river-flood',
    hazardTypes: ['flood'],
    description: 'Flood-prone zone',
    geometry: polygon,
    citizenIds: [CITIZEN_ID],
    createdBy: OFFICER_ID,
    toObject() {
        return {
            _id: this._id,
            name: this.name,
            areaType: this.areaType,
            hazardTypes: this.hazardTypes,
            description: this.description,
            geometry: this.geometry,
            citizenIds: this.citizenIds,
            createdBy: this.createdBy
        }
    },
    ...overrides
})

const makeWarning = (overrides = {}) => ({
    _id: WARNING_ID,
    title: 'Flood Warning',
    severity: 'warning',
    hazardType: 'flood',
    message: 'Move to higher ground',
    actionSteps: ['Move to higher ground'],
    targetAreaIds: [AREA_ID],
    recipientIds: [CITIZEN_ID],
    updates: [],
    status: 'draft',
    resolvedAt: null,
    issuedAt: null,
    createdBy: OFFICER_ID,
    set: vi.fn(function (values) {
        Object.assign(this, values)
    }),
    save: vi.fn().mockResolvedValue(undefined),
    toObject() {
        return {
            _id: this._id,
            title: this.title,
            severity: this.severity,
            hazardType: this.hazardType,
            message: this.message,
            actionSteps: this.actionSteps,
            targetAreaIds: this.targetAreaIds,
            recipientIds: this.recipientIds,
            updates: this.updates,
            status: this.status,
            resolvedAt: this.resolvedAt,
            issuedAt: this.issuedAt,
            createdBy: this.createdBy,
            issuedBy: this.issuedBy,
            resolvedBy: this.resolvedBy,
            deliverySummary: this.deliverySummary
        }
    },
    ...overrides
})

const validAreaData = (overrides = {}) => ({
    name: ' Colombo Flood Zone ',
    areaType: 'river-flood',
    hazardTypes: ['flood', 'flood'],
    description: ' Low-lying river area ',
    geometry: polygon,
    ...overrides
})

const validWarningData = (overrides = {}) => ({
    title: ' Flood Warning ',
    severity: 'warning',
    hazardType: 'flood',
    message: ' Move to higher ground ',
    actionSteps: [' Move to higher ground '],
    targetAreaIds: [AREA_ID],
    initialUpdateTitle: ' Safety Update ',
    initialUpdateMessage: ' Follow official instructions ',
    ...overrides
})

const responseUsers = () => [{
    _id: CITIZEN_ID,
    name: 'Mock Citizen',
    email: 'citizen@example.test',
    phone: '0712345678'
}]

describe('DMC warning and target-area unit tests', () => {
    let warning
    let callbacks

    beforeEach(() => {
        vi.clearAllMocks()
        callbacks = []
        vi.stubGlobal('setImmediate', vi.fn((callback) => callbacks.push(callback)))

        warning = makeWarning()

        User.find.mockImplementation(() => ({
            select: vi.fn().mockResolvedValue(responseUsers()),
            distinct: vi.fn().mockResolvedValue([CITIZEN_ID])
        }))

        User.countDocuments.mockResolvedValue(4)

        TargetArea.find.mockReturnValue(queryReturning([makeArea()]))
        TargetArea.create.mockResolvedValue(makeArea())

        Warning.create.mockResolvedValue(warning)
        Warning.findOne.mockResolvedValue(warning)
        Warning.findById.mockReturnValue(queryReturning(warning))
        Warning.findOneAndUpdate.mockResolvedValue(warning)
        Warning.find.mockReturnValue(queryReturning([warning]))
        Warning.countDocuments.mockResolvedValue(3)

        TargetArea.countDocuments.mockResolvedValue(2)
        ReportCluster.countDocuments.mockResolvedValue(1)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    // ========================================================
    // TARGET AREA GEOMETRY
    // ========================================================

    describe('Polygon geometry validation', () => {

        // POSITIVE: a valid closed polygon is accepted.
        it('accepts a valid GeoJSON polygon', () => {
            expect(validatePolygonGeometry(polygon)).toBe(true)
        })

        // EDGE: coordinates exactly at geographic limits are valid.
        it('accepts coordinates on the longitude and latitude limits', () => {
            const worldPolygon = {
                type: 'Polygon',
                coordinates: [[
                    [-180, -90],
                    [180, -90],
                    [180, 90],
                    [-180, 90],
                    [-180, -90]
                ]]
            }

            expect(validatePolygonGeometry(worldPolygon)).toBe(true)
        })

        // NEGATIVE: missing or wrong geometry types are rejected.
        it.each([
            null,
            undefined,
            {},
            { type: 'Point', coordinates: [79.8, 6.9] },
            { type: 'Polygon', coordinates: [] },
            {
                type: 'Polygon',
                coordinates: [polygon.coordinates[0], polygon.coordinates[0]]
            }
        ])('rejects invalid geometry shape: %o', (geometry) => {
            expect(validatePolygonGeometry(geometry)).toBe(false)
        })

        // EDGE: the ring must have at least four positions including closure.
        it('rejects a ring with too few coordinates', () => {
            expect(validatePolygonGeometry({
                type: 'Polygon',
                coordinates: [[[0, 0], [1, 0], [0, 0]]]
            })).toBe(false)
        })

        // NEGATIVE: coordinates must be finite, numeric and in range.
        it.each([
            [[[181, 0], [1, 0], [0, 1], [181, 0]]],
            [[[0, 91], [1, 0], [0, 1], [0, 91]]],
            [[[NaN, 0], [1, 0], [0, 1], [NaN, 0]]],
            [[[0, Infinity], [1, 0], [0, 1], [0, Infinity]]],
            [[['0', 0], [1, 0], [0, 1], ['0', 0]]],
            [[[0, 0, 2], [1, 0], [0, 1], [0, 0, 2]]]
        ])('rejects invalid polygon coordinates: %o', (ring) => {
            expect(validatePolygonGeometry({
                type: 'Polygon',
                coordinates: ring
            })).toBe(false)
        })

        // NEGATIVE: the first and last coordinate must be identical.
        it('rejects a polygon that is not closed', () => {
            expect(validatePolygonGeometry({
                type: 'Polygon',
                coordinates: [[
                    [0, 0], [1, 0], [1, 1], [0, 1]
                ]]
            })).toBe(false)
        })

        // EDGE: repeated vertices or a zero-area polygon are invalid.
        it('rejects repeated points and zero-area polygons', () => {
            expect(validatePolygonGeometry({
                type: 'Polygon',
                coordinates: [[
                    [0, 0], [1, 0], [1, 0], [0, 1], [0, 0]
                ]]
            })).toBe(false)

            expect(validatePolygonGeometry({
                type: 'Polygon',
                coordinates: [[
                    [0, 0], [1, 0], [2, 0], [0, 0]
                ]]
            })).toBe(false)
        })

        // NEGATIVE: self-crossing polygons are rejected.
        it('rejects a self-intersecting polygon', () => {
            expect(validatePolygonGeometry({
                type: 'Polygon',
                coordinates: [[
                    [0, 0], [2, 2], [0, 2], [2, 0], [0, 0]
                ]]
            })).toBe(false)
        })

        // EDGE: the geometry validator enforces a maximum ring size.
        it('rejects an oversized polygon ring', () => {
            const points = Array.from(
                { length: 502 },
                (_, index) => [index / 10000, (index % 2) / 10000]
            )
            points[points.length - 1] = points[0]

            expect(validatePolygonGeometry({
                type: 'Polygon',
                coordinates: [points]
            })).toBe(false)
        })
    })

    // ========================================================
    // TARGET AREA SERVICE
    // ========================================================

    describe('Target area service', () => {

        // POSITIVE: previews the number of citizens in a valid polygon.
        it('previews a valid target area', async () => {
            const result = await previewTargetArea(polygon)

            expect(result).toEqual({ citizenCount: 4 })
            expect(User.countDocuments).toHaveBeenCalled()
        })

        // NEGATIVE: invalid preview geometry is rejected before a citizen query.
        it('rejects a target-area preview with invalid geometry', async () => {
            await expect(previewTargetArea({
                type: 'Point',
                coordinates: [79.8, 6.9]
            })).rejects.toMatchObject({ statusCode: 400 })

            expect(User.countDocuments).not.toHaveBeenCalled()
        })

        // POSITIVE: a new area is normalized and created with unique hazard types.
        it('creates a valid target area', async () => {
            const result = await createTargetArea(validAreaData(), OFFICER_ID)
            const saved = TargetArea.create.mock.calls[0][0]

            expect(saved.name).toBe('Colombo Flood Zone')
            expect(saved.description).toBe('Low-lying river area')
            expect(saved.hazardTypes).toEqual(['flood'])
            expect(saved.createdBy).toBe(OFFICER_ID)
            expect(result.citizenCount).toBe(1)
        })

        // EDGE: description length is capped and an omitted description becomes empty.
        it('handles an omitted or excessively long description', async () => {
            await createTargetArea(validAreaData({
                description: ` ${'x'.repeat(2100)} `
            }), OFFICER_ID)

            expect(TargetArea.create.mock.calls[0][0].description).toHaveLength(2000)

            vi.clearAllMocks()
            User.find.mockReturnValue({
                distinct: vi.fn().mockResolvedValue([])
            })
            TargetArea.create.mockResolvedValue(makeArea({ citizenIds: [] }))

            await createTargetArea(validAreaData({
                description: undefined
            }), OFFICER_ID)

            expect(TargetArea.create.mock.calls[0][0].description).toBe('')
            expect(TargetArea.create.mock.calls[0][0].citizenIds).toEqual([])
        })

        // NEGATIVE: an invalid name is rejected.
        it.each(['', '   ', 'A'.repeat(121), null])(
            'rejects invalid area name: %s',
            async (name) => {
                await expect(createTargetArea(
                    validAreaData({ name }),
                    OFFICER_ID
                )).rejects.toMatchObject({ statusCode: 400 })
            }
        )

        // NEGATIVE: only permitted area and hazard categories may be used.
        it.each([
            { areaType: 'unknown' },
            { hazardTypes: [] },
            { hazardTypes: 'flood' },
            { hazardTypes: ['earthquake'] }
        ])('rejects invalid area category data: %o', async (overrides) => {
            await expect(createTargetArea(
                validAreaData(overrides),
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 400 })
        })

        // NEGATIVE: invalid geometry must not be persisted.
        it('rejects creation with invalid geometry', async () => {
            await expect(createTargetArea(
                validAreaData({
                    geometry: { type: 'Point', coordinates: [] }
                }),
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 400 })

            expect(TargetArea.create).not.toHaveBeenCalled()
        })

        // POSITIVE: listing returns public area data and a current citizen count.
        it('lists target areas with refreshed citizen counts', async () => {
            TargetArea.find.mockReturnValue(queryReturning([makeArea()]))

            const result = await listTargetAreas()

            expect(result).toHaveLength(1)
            expect(result[0].citizenCount).toBe(1)
            expect(result[0]).not.toHaveProperty('citizenIds')
        })

        // EDGE: an empty area list returns an empty array.
        it('returns an empty list when no target areas exist', async () => {
            TargetArea.find.mockReturnValue(queryReturning([]))

            await expect(listTargetAreas()).resolves.toEqual([])
            expect(User.find).not.toHaveBeenCalled()
        })
    })

    // ========================================================
    // WARNING CREATION AND VALIDATION
    // ========================================================

    describe('Warning creation', () => {

        // POSITIVE: creates a draft with sanitized content and an initial update.
        it('creates a warning with an initial update and recipient count', async () => {
            const result = await createWarning(
                validWarningData(),
                OFFICER_ID
            )

            const saved = Warning.create.mock.calls[0][0]

            expect(saved.title).toBe('Flood Warning')
            expect(saved.message).toBe('Move to higher ground')
            expect(saved.actionSteps).toEqual(['Move to higher ground'])
            expect(saved.createdBy).toBe(OFFICER_ID)
            expect(saved.updates[0]).toMatchObject({
                title: 'Safety Update',
                message: 'Follow official instructions',
                type: 'update',
                createdBy: OFFICER_ID
            })
            expect(result.recipientCount).toBe(1)
            expect(result).not.toHaveProperty('recipientIds')
        })

        // EDGE: a warning can find current recipients from polygon geometry
        // even when an area's stored citizen list is empty.
        it('uses geometry to find recipients when an area has no stored members', async () => {
            TargetArea.find.mockReturnValue(
                queryReturning([makeArea({ citizenIds: [] })])
            )

            await createWarning(validWarningData(), OFFICER_ID)

            expect(User.find).toHaveBeenCalledWith(expect.objectContaining({
                $or: [
                    { location: { $geoWithin: { $geometry: polygon } } }
                ]
            }))
        })

        // NEGATIVE: blank or overlong title/message values are rejected.
        it.each([
            { title: '' },
            { title: ' '.repeat(3) },
            { title: 'A'.repeat(161) },
            { message: '' },
            { message: ' '.repeat(3) },
            { message: 'A'.repeat(4001) }
        ])('rejects invalid warning text: %o', async (overrides) => {
            await expect(createWarning(
                validWarningData(overrides),
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 400 })

            expect(Warning.create).not.toHaveBeenCalled()
        })

        // NEGATIVE: unsupported severity and hazard values are rejected.
        it.each([
            { severity: 'urgent' },
            { severity: null },
            { hazardType: 'earthquake' },
            { hazardType: '' }
        ])('rejects invalid warning classifications: %o', async (overrides) => {
            await expect(createWarning(
                validWarningData(overrides),
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 400 })
        })

        // NEGATIVE/EDGE: action steps must be an array with valid non-empty items.
        it.each([
            { actionSteps: null },
            { actionSteps: 'Move now' },
            { actionSteps: [] },
            { actionSteps: [' '] },
            { actionSteps: [42] },
            { actionSteps: ['A'.repeat(401)] },
            { actionSteps: Array(11).fill('Step') }
        ])('rejects invalid action steps: %o', async (overrides) => {
            await expect(createWarning(
                validWarningData(overrides),
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 400 })
        })

        // NEGATIVE: one or more valid target-area IDs must be supplied.
        it.each([
            { targetAreaIds: undefined },
            { targetAreaIds: [] },
            { targetAreaIds: ['invalid-id'] },
            { targetAreaIds: Array(51).fill(AREA_ID) },
            { targetAreaIds: 'not-an-array' }
        ])('rejects invalid target-area selections: %o', async (overrides) => {
            await expect(createWarning(
                validWarningData(overrides),
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 400 })
        })

        // NEGATIVE: every requested target area must exist.
        it('rejects a target area that cannot be found', async () => {
            TargetArea.find.mockReturnValue(queryReturning([]))

            await expect(createWarning(
                validWarningData(),
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 404 })
        })

        // NEGATIVE: initial update title/message are mandatory and length limited.
        it.each([
            { initialUpdateTitle: '' },
            { initialUpdateTitle: 'A'.repeat(121) },
            { initialUpdateMessage: '' },
            { initialUpdateMessage: 'A'.repeat(2001) }
        ])('rejects invalid initial update details: %o', async (overrides) => {
            await expect(createWarning(
                validWarningData(overrides),
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 400 })
        })
    })

    // ========================================================
    // WARNING EDITING, PREVIEW AND REVIEW
    // ========================================================

    describe('Warning editing and review', () => {

        // POSITIVE: an existing draft warning can be edited.
        it('updates an existing draft warning', async () => {
            Warning.findOne.mockResolvedValue(warning)
            Warning.findById.mockReturnValue(queryReturning(warning))

            const result = await updateWarning(
                WARNING_ID,
                validWarningData({ title: 'Updated Warning' })
            )

            expect(warning.set).toHaveBeenCalled()
            expect(warning.save).toHaveBeenCalled()
            expect(result.title).toBe('Updated Warning')
        })

        // NEGATIVE: missing/non-draft warnings cannot be edited.
        it('rejects editing a warning that is not a draft', async () => {
            Warning.findOne.mockResolvedValue(null)

            await expect(updateWarning(
                WARNING_ID,
                validWarningData()
            )).rejects.toMatchObject({ statusCode: 404 })
        })

        // POSITIVE: recipient preview returns a count without creating a warning.
        it('previews the selected recipients', async () => {
            await expect(
                previewWarningRecipients([AREA_ID])
            ).resolves.toEqual({ recipientCount: 1 })

            expect(Warning.create).not.toHaveBeenCalled()
        })

        // NEGATIVE: preview rejects a malformed or nonexistent area ID.
        it('rejects invalid recipient preview areas', async () => {
            await expect(
                previewWarningRecipients(['invalid-id'])
            ).rejects.toMatchObject({ statusCode: 400 })
        })

        // POSITIVE: review includes current recipient and notification-channel counts.
        it('returns warning review details without exposing recipient IDs', async () => {
            Warning.findById.mockReturnValue(queryReturning(warning))

            const result = await getWarningForReview(WARNING_ID)

            expect(result.warning.recipientCount).toBe(1)
            expect(result.warning).not.toHaveProperty('recipientIds')
            expect(result.deliveryAudience).toEqual({
                recipients: 1,
                smsRecipients: 1,
                emailFallbackRecipients: 1
            })
        })

        // EDGE: a warning with no target areas has an empty audience.
        it('returns an empty review audience when there are no target areas', async () => {
            warning.targetAreaIds = []
            Warning.findById.mockReturnValue(queryReturning(warning))
            TargetArea.find.mockReturnValue(queryReturning([]))

            const result = await getWarningForReview(WARNING_ID)

            expect(result.warning.targetAreaIds).toEqual([])
            expect(result.deliveryAudience.recipients).toBe(0)
        })

        // NEGATIVE: an unknown warning returns a not-found error.
        it('rejects reviewing a nonexistent warning', async () => {
            Warning.findById.mockReturnValue(queryReturning(null))

            await expect(
                getWarningForReview(WARNING_ID)
            ).rejects.toMatchObject({ statusCode: 404 })
        })
    })

    // ========================================================
    // WARNING UPDATES
    // ========================================================

    describe('Updates to an issued warning', () => {

        // POSITIVE: a regular update preserves the existing severity.
        it('records an ordinary update without changing severity', async () => {
            warning.status = 'issued'
            Warning.findOne.mockResolvedValue(warning)
            Warning.findById.mockReturnValue(queryReturning(warning))

            await postWarningUpdate(WARNING_ID, {
                title: 'River rising',
                message: 'Move inland',
                targetAreaIds: []
            }, OFFICER_ID)

            expect(warning.updates.at(-1)).toMatchObject({
                title: 'River rising',
                type: 'update',
                severity: null
            })
            expect(warning.save).toHaveBeenCalled()
            expect(setImmediate).not.toHaveBeenCalled()
        })

        // POSITIVE: a severity change is recorded in the warning history.
        it('records a severity change', async () => {
            warning.status = 'issued'
            Warning.findOne.mockResolvedValue(warning)
            Warning.findById.mockReturnValue(queryReturning(warning))

            await postWarningUpdate(WARNING_ID, {
                title: 'Severity increased',
                message: 'Move away from the river',
                severity: 'emergency',
                targetAreaIds: []
            }, OFFICER_ID)

            expect(warning.severity).toBe('emergency')
            expect(warning.updates.at(-1)).toMatchObject({
                type: 'severity',
                severity: 'emergency'
            })
        })

        // NEGATIVE: invalid update content is rejected before loading the warning.
        it.each([
            { title: '', message: 'Details' },
            { title: 'Title', message: '' },
            { title: 'A'.repeat(121), message: 'Details' },
            { title: 'Title', message: 'A'.repeat(2001) }
        ])('rejects invalid update text: %o', async (data) => {
            await expect(postWarningUpdate(
                WARNING_ID,
                data,
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 400 })

            expect(Warning.findOne).not.toHaveBeenCalled()
        })

        // NEGATIVE: a missing or resolved warning cannot receive updates.
        it('rejects updating an unavailable warning', async () => {
            Warning.findOne.mockResolvedValue(null)

            await expect(postWarningUpdate(WARNING_ID, {
                title: 'Update',
                message: 'Details'
            }, OFFICER_ID)).rejects.toMatchObject({ statusCode: 404 })
        })

        // NEGATIVE: invalid severity and affected-area IDs are rejected.
        it.each([
            { severity: 'unrecognized', targetAreaIds: [] },
            { targetAreaIds: 'not-an-array' },
            { targetAreaIds: ['bad-id'] },
            { targetAreaIds: Array(51).fill(AREA_ID) }
        ])('rejects invalid update classification/areas: %o', async (data) => {
            Warning.findOne.mockResolvedValue(warning)

            await expect(postWarningUpdate(WARNING_ID, {
                title: 'Update',
                message: 'Details',
                ...data
            }, OFFICER_ID)).rejects.toMatchObject({ statusCode: 400 })
        })

        // NEGATIVE: an affected area must exist.
        it('rejects an update that references a missing area', async () => {
            warning.targetAreaIds = [AREA_ID]
            Warning.findOne.mockResolvedValue(warning)
            TargetArea.find.mockReturnValue(queryReturning([]))

            await expect(postWarningUpdate(WARNING_ID, {
                title: 'Expanded area',
                message: 'Move inland',
                targetAreaIds: [ADDED_AREA_ID]
            }, OFFICER_ID)).rejects.toMatchObject({ statusCode: 404 })
        })

        // POSITIVE/EDGE: newly affected citizens are sent the warning update once.
        it('schedules delivery for newly affected citizens', async () => {
            warning.status = 'issued'
            warning.recipientIds = [CITIZEN_ID]
            Warning.findOne.mockResolvedValue(warning)

            const addedArea = makeArea({
                _id: ADDED_AREA_ID,
                name: 'Added Zone',
                citizenIds: [NEW_CITIZEN_ID]
            })

            TargetArea.find
                .mockReturnValueOnce(queryReturning([addedArea]))
                .mockReturnValueOnce(queryReturning([
                    makeArea(),
                    addedArea
                ]))

            User.find
                .mockReturnValueOnce({
                    select: vi.fn().mockResolvedValue([
                        { _id: NEW_CITIZEN_ID, phone: '0771234567' }
                    ])
                })
                .mockReturnValueOnce({
                    select: vi.fn().mockResolvedValue([
                        { _id: CITIZEN_ID, phone: '0712345678' },
                        { _id: NEW_CITIZEN_ID, phone: '0771234567', email: 'new@example.test' }
                    ])
                })

            Warning.findById.mockReturnValue(queryReturning(warning))

            await postWarningUpdate(WARNING_ID, {
                title: 'Expanded boundary',
                message: 'Move inland',
                targetAreaIds: [ADDED_AREA_ID]
            }, OFFICER_ID)

            expect(warning.targetAreaIds).toContain(ADDED_AREA_ID)
            expect(setImmediate).toHaveBeenCalledOnce()

            // Wait for the asynchronous delivery worker to finish.
            callbacks[0]()

            await vi.waitFor(() => {
                expect(deliverWarningToCitizen).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: expect.stringContaining('Expanded boundary')
                    }),
                    expect.objectContaining({ _id: NEW_CITIZEN_ID })
                )

                expect(finalizeWarningDelivery).toHaveBeenCalledWith(WARNING_ID)
            })
        })
    })

    // ========================================================
    // ISSUE AND RESOLVE WARNING
    // ========================================================

    describe('Issuing warnings', () => {

        // POSITIVE: issuing begins and current recipients are stored.
        it('starts issuing a warning to current recipients', async () => {
            warning.status = 'issuing'
            Warning.findOneAndUpdate.mockResolvedValue(warning)

            const result = await issueWarning(WARNING_ID, OFFICER_ID)

            expect(warning.recipientIds).toEqual([CITIZEN_ID])
            expect(warning.issuedBy).toBe(OFFICER_ID)
            expect(warning.deliverySummary.recipients).toBe(1)
            expect(result.warning.status).toBe('issuing')
            expect(setImmediate).toHaveBeenCalledOnce()
        })

        // POSITIVE: the background worker handles both delivery success and failure.
        it('handles recipient delivery errors without failing the issuer', async () => {
            warning.status = 'issuing'
            Warning.findOneAndUpdate.mockResolvedValue(warning)
            deliverWarningToCitizen.mockRejectedValue(new Error('mock SMS error'))

            const log = vi.spyOn(console, 'error').mockImplementation(() => { })

            await issueWarning(WARNING_ID, OFFICER_ID)
            callbacks[0]()
            await vi.waitFor(() => expect(finalizeWarningDelivery).toHaveBeenCalled())

            expect(log).toHaveBeenCalled()
            log.mockRestore()
        })

        // NEGATIVE: a warning with no eligible citizens returns to draft.
        it('rejects issuing when there are no current recipients', async () => {
            warning.status = 'issuing'
            Warning.findOneAndUpdate.mockResolvedValue(warning)
            User.find.mockReturnValue({
                select: vi.fn().mockResolvedValue([])
            })

            await expect(issueWarning(
                WARNING_ID,
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 400 })

            expect(warning.status).toBe('draft')
        })

        // NEGATIVE: a warning already being issued returns 409.
        it('rejects duplicate issue requests', async () => {
            Warning.findOneAndUpdate.mockResolvedValue(null)
            Warning.findById.mockReturnValue(queryReturning({
                status: 'issuing'
            }))

            await expect(issueWarning(
                WARNING_ID,
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 409 })
        })

        // EDGE: a warning that does not exist returns 404.
        it('returns not found when issuing a nonexistent warning', async () => {
            Warning.findOneAndUpdate.mockResolvedValue(null)
            Warning.findById.mockReturnValue(queryReturning(null))

            await expect(issueWarning(
                WARNING_ID,
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 404 })
        })

        // ERROR: failures while resolving target areas mark a warning as failed.
        it('marks an issuing warning as failed after an unexpected error', async () => {
            warning.status = 'issuing'
            Warning.findOneAndUpdate.mockResolvedValue(warning)
            TargetArea.find.mockReturnValue({
                select: vi.fn().mockRejectedValue(new Error('mock query failure'))
            })

            await expect(issueWarning(
                WARNING_ID,
                OFFICER_ID
            )).rejects.toThrow('mock query failure')

            expect(warning.status).toBe('delivery_failed')
            expect(warning.save).toHaveBeenCalled()
        })
    })

    describe('Resolving warnings', () => {

        // POSITIVE: a valid warning is marked as resolved with an audit update.
        it('resolves an issued warning', async () => {
            warning.status = 'issued'

            Warning.findOneAndUpdate.mockImplementation(async (_filter, update) => {
                Object.assign(warning, update.$set)

                if (update.$push?.updates) {
                    warning.updates.push(update.$push.updates)
                }

                return warning
            })

            Warning.findById.mockReturnValue(queryReturning(warning))

            await resolveWarning(WARNING_ID, OFFICER_ID)

            expect(warning.resolvedBy).toBe(OFFICER_ID)
            expect(warning.resolvedAt).toBeInstanceOf(Date)
            expect(warning.updates.at(-1)).toMatchObject({
                type: 'resolved',
                createdBy: OFFICER_ID
            })
        })

        // NEGATIVE: a previously resolved warning cannot be resolved again.
        it('rejects resolving an already resolved warning', async () => {
            Warning.findOneAndUpdate.mockResolvedValue(null)
            Warning.findById.mockReturnValue(queryReturning({
                status: 'issued',
                resolvedAt: new Date()
            }))

            await expect(resolveWarning(
                WARNING_ID,
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 409 })
        })

        // EDGE: an unknown warning cannot be resolved.
        it('returns not found when resolving a missing warning', async () => {
            Warning.findOneAndUpdate.mockResolvedValue(null)
            Warning.findById.mockReturnValue(queryReturning(null))

            await expect(resolveWarning(
                WARNING_ID,
                OFFICER_ID
            )).rejects.toMatchObject({ statusCode: 404 })
        })
    })

    // ========================================================
    // LISTS AND DASHBOARD COUNTS
    // ========================================================

    describe('Warning lists and overview', () => {

        // POSITIVE: list output returns fresh citizen counts without private IDs.
        it('lists warnings with refreshed recipient counts', async () => {
            Warning.find.mockReturnValue(queryReturning([{
                _id: WARNING_ID,
                title: 'Flood Warning',
                recipientIds: [CITIZEN_ID, NEW_CITIZEN_ID]
            }]))
            User.find.mockReturnValue({
                distinct: vi.fn().mockResolvedValue([CITIZEN_ID])
            })

            const result = await listWarnings()

            expect(result[0].recipientCount).toBe(1)
            expect(result[0]).not.toHaveProperty('recipientIds')
        })

        // EDGE: empty warning lists do not need a citizen membership query.
        it('returns an empty warning list', async () => {
            Warning.find.mockReturnValue(queryReturning([]))

            await expect(listWarnings()).resolves.toEqual([])
            expect(User.find).not.toHaveBeenCalled()
        })

        // POSITIVE: dashboard overview aggregates the four model counts.
        it('returns DMC overview counts', async () => {
            await expect(getOverview()).resolves.toEqual({
                targetAreas: 2,
                warnings: 3,
                citizens: 4,
                escalatedReports: 1
            })
        })
    })

    // ========================================================
    // DMC CONTROLLER TESTS
    // These run the real controller and service functions while
    // the model and provider dependencies remain mocked.
    // ========================================================

    const makeControllerResponse = () => ({
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        send: vi.fn().mockReturnThis()
    })

    describe('DMC controller unit tests', () => {
        beforeEach(() => {
            vi.clearAllMocks()
            vi.stubGlobal('setImmediate', vi.fn())

            TargetArea.find.mockReturnValue(queryReturning([makeArea()]))
            TargetArea.create.mockResolvedValue(makeArea())

            User.find.mockImplementation(() => ({
                select: vi.fn().mockResolvedValue([{
                    _id: CITIZEN_ID,
                    name: 'Mock Citizen',
                    email: 'citizen@example.test',
                    phone: '0712345678'
                }]),
                distinct: vi.fn().mockResolvedValue([CITIZEN_ID])
            }))

            User.countDocuments.mockResolvedValue(4)
            TargetArea.countDocuments.mockResolvedValue(2)
            Warning.countDocuments.mockResolvedValue(3)
            ReportCluster.countDocuments.mockResolvedValue(1)

            Warning.find.mockReturnValue(queryReturning([makeWarning()]))
            Warning.create.mockResolvedValue(makeWarning())
            Warning.findOne.mockResolvedValue(makeWarning())
            Warning.findById.mockReturnValue(queryReturning(makeWarning()))
            Warning.findOneAndUpdate.mockResolvedValue(
                makeWarning({ status: 'issuing' })
            )
        })

        afterEach(() => {
            vi.unstubAllGlobals()
            vi.unstubAllEnvs()
        })

        // POSITIVE: dashboard returns aggregated service counts.
        it('returns the DMC overview', async () => {
            const res = makeControllerResponse()

            await dmcOverviewController({}, res, vi.fn())

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                overview: {
                    targetAreas: 2,
                    warnings: 3,
                    citizens: 4,
                    escalatedReports: 1
                }
            })
        })

        // POSITIVE: target-area listing returns the service results.
        it('returns target areas', async () => {
            const res = makeControllerResponse()

            await dmcTargetAreasController({}, res, vi.fn())

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            )
        })

        // POSITIVE: controller forwards polygon geometry to the service.
        it('previews a target area', async () => {
            const res = makeControllerResponse()

            await dmcTargetAreaPreviewController({
                body: { geometry: polygon }
            }, res, vi.fn())

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                citizenCount: expect.any(Number)
            })
        })

        // POSITIVE: creates a target area using the authenticated officer ID.
        it('creates a target area', async () => {
            const res = makeControllerResponse()

            await dmcSaveTargetAreaController({
                body: validAreaData(),
                user: { _id: OFFICER_ID }
            }, res, vi.fn())

            expect(TargetArea.create).toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(201)
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    targetArea: expect.any(Object)
                })
            )
        })

        // POSITIVE: listing warnings returns a response and server timing.
        it('lists warnings and sets the server timing header', async () => {
            Warning.find.mockReturnValue(queryReturning([makeWarning()]))

            const res = makeControllerResponse()

            await dmcWarningsController({}, res, vi.fn())

            expect(res.set).toHaveBeenCalledWith(
                'Server-Timing',
                expect.stringMatching(/^warning-list;dur=\d+$/)
            )
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true, warnings: expect.any(Array) })
            )
        })

        // EDGE: slow warning-list requests trigger a performance warning.
        it('logs a slow warning-list query', async () => {
            Warning.find.mockReturnValue(queryReturning([makeWarning()]))

            vi.spyOn(Date, 'now')
                .mockReturnValueOnce(100)
                .mockReturnValueOnce(1800)

            const log = vi.spyOn(console, 'warn').mockImplementation(() => { })
            const res = makeControllerResponse()

            await dmcWarningsController({}, res, vi.fn())

            expect(log).toHaveBeenCalled()
            log.mockRestore()
        })

        // POSITIVE: warning creation passes the authenticated officer ID.
        it('creates a warning through the controller', async () => {
            const res = makeControllerResponse()

            await dmcSaveWarningController({
                body: validWarningData(),
                user: { _id: OFFICER_ID }
            }, res, vi.fn())

            expect(Warning.create).toHaveBeenCalled()
            expect(res.status).toHaveBeenCalledWith(201)
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            )
        })

        // POSITIVE: editing a draft warning returns the updated warning.
        it('edits a draft warning', async () => {
            Warning.findOne.mockResolvedValue(makeWarning())

            const res = makeControllerResponse()

            await dmcEditWarningController({
                params: { warningId: WARNING_ID },
                body: validWarningData()
            }, res, vi.fn())

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            )
        })

        // POSITIVE: warning updates are passed through to the service.
        it('adds an update to an issued warning', async () => {
            const warning = makeWarning({ status: 'issued' })

            Warning.findOne.mockResolvedValue(warning)
            Warning.findById.mockReturnValue(queryReturning(warning))

            const res = makeControllerResponse()

            await dmcAddWarningUpdateController({
                params: { warningId: WARNING_ID },
                body: {
                    title: 'Safety update',
                    message: 'Move inland',
                    targetAreaIds: []
                },
                user: { _id: OFFICER_ID }
            }, res, vi.fn())

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            )
        })

        // POSITIVE: review returns warning information and the delivery audience.
        it('returns warning review information', async () => {
            Warning.findById.mockReturnValue(queryReturning(makeWarning()))

            const res = makeControllerResponse()

            await dmcReviewWarningController({
                params: { warningId: WARNING_ID }
            }, res, vi.fn())

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    warning: expect.any(Object),
                    deliveryAudience: expect.any(Object)
                })
            )
        })

        // POSITIVE: issuing returns HTTP 202 for asynchronous delivery.
        it('starts warning issuance', async () => {
            Warning.findOneAndUpdate.mockResolvedValue(
                makeWarning({ status: 'issuing' })
            )

            const res = makeControllerResponse()

            await dmcIssueWarningController({
                params: { warningId: WARNING_ID },
                user: { _id: OFFICER_ID }
            }, res, vi.fn())

            expect(res.status).toHaveBeenCalledWith(202)
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            )
        })

        // POSITIVE: resolving returns the updated warning review.
        it('resolves a warning', async () => {
            const warning = makeWarning({ status: 'issued' })

            Warning.findOneAndUpdate.mockResolvedValue(warning)
            Warning.findById.mockReturnValue(queryReturning(warning))

            const res = makeControllerResponse()

            await dmcResolveWarningController({
                params: { warningId: WARNING_ID },
                user: { _id: OFFICER_ID }
            }, res, vi.fn())

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ success: true })
            )
        })

        // POSITIVE: recipient preview returns an audience count.
        it('previews warning recipients', async () => {
            const res = makeControllerResponse()

            await dmcRecipientPreviewController({
                body: { targetAreaIds: [AREA_ID] }
            }, res, vi.fn())

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                recipientCount: expect.any(Number)
            })
        })

        // NEGATIVE: service validation errors are delegated to Express.
        it('forwards invalid warning and polygon errors', async () => {
            const next = vi.fn()

            await dmcTargetAreaPreviewController({
                body: {
                    geometry: { type: 'Point', coordinates: [79, 6] }
                }
            }, makeControllerResponse(), next)

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({ statusCode: 400 })
            )

            next.mockClear()

            await dmcSaveWarningController({
                body: validWarningData({ title: '' }),
                user: { _id: OFFICER_ID }
            }, makeControllerResponse(), next)

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({ statusCode: 400 })
            )
        })

        // NEGATIVE: invalid weather tile coordinates are rejected before HTTP.
        it('rejects an invalid weather tile request', async () => {
            const res = makeControllerResponse()

            await openWeatherTile({
                params: { layer: 'invalid', z: '1', x: '0', y: '0' }
            }, res, vi.fn())

            expect(res.status).toHaveBeenCalledWith(400)
            expect(axios.get).not.toHaveBeenCalled()
        })

        // NEGATIVE: missing provider configuration returns 503.
        it('returns 503 when the weather provider is not configured', async () => {
            vi.stubEnv('OPENWEATHER_KEY', '')

            const res = makeControllerResponse()

            await openWeatherTile({
                params: { layer: 'clouds_new', z: '1', x: '0', y: '0' }
            }, res, vi.fn())

            expect(res.status).toHaveBeenCalledWith(503)
        })

        // POSITIVE: valid weather tile requests return image data and cache headers.
        it('returns a weather tile from the provider', async () => {
            vi.stubEnv('OPENWEATHER_KEY', 'mock-weather-key')

            axios.get.mockResolvedValue({
                headers: { 'content-type': 'image/png' },
                data: Buffer.from('mock-image')
            })

            const res = makeControllerResponse()

            await openWeatherTile({
                params: { layer: 'clouds_new', z: '1', x: '0', y: '0' }
            }, res, vi.fn())

            expect(res.set).toHaveBeenCalledWith('Content-Type', 'image/png')
            expect(res.set).toHaveBeenCalledWith(
                'Cache-Control',
                'public, max-age=300'
            )
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.send).toHaveBeenCalled()
        })

        // ERROR: upstream HTTP errors map to a controlled provider response.
        it('maps weather provider HTTP errors', async () => {
            vi.stubEnv('OPENWEATHER_KEY', 'mock-weather-key')
            axios.get.mockRejectedValue({ response: { status: 401 } })

            const res = makeControllerResponse()

            await openWeatherTile({
                params: { layer: 'clouds_new', z: '1', x: '0', y: '0' }
            }, res, vi.fn())

            expect(res.status).toHaveBeenCalledWith(502)
        })

        // POSITIVE/EDGE: profile returns normalized role details.
        it('returns the authenticated officer profile', () => {
            const res = makeControllerResponse()

            dmcProfileController({
                user: {
                    _id: OFFICER_ID,
                    name: 'Mock Officer',
                    email: 'officer@example.test',
                    phone: '0712345678',
                    role: 'DMC_Officer',
                    createdAt: new Date('2026-01-01')
                }
            }, res)

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    profile: expect.objectContaining({
                        id: OFFICER_ID,
                        role: 'dmcofficer'
                    })
                })
            )
        })
    })

})