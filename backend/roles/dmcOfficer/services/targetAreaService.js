import User from '../../../models/User.js'
import TargetArea from '../../../models/TargetArea.js'
import { CITIZEN_ROLE_VALUES } from '../../../utils/citizenTargetAreas.js'

const ALLOWED_AREA_TYPES = new Set([
    'river-flood',
    'coastal',
    'landslide',
    'storm',
    'tsunami',
    'other'
])
const ALLOWED_HAZARDS = new Set([
    'flood',
    'landslide',
    'tsunami',
    'storm',
    'other'
])
const MAX_POLYGON_VERTICES = 500

const pointOnSegment = ([x, y], [x1, y1], [x2, y2]) => (
    Math.abs((x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)) < 1e-10
    && x >= Math.min(x1, x2)
    && x <= Math.max(x1, x2)
    && y >= Math.min(y1, y2)
    && y <= Math.max(y1, y2)
)

const orientation = ([x1, y1], [x2, y2], [x3, y3]) => (
    (y2 - y1) * (x3 - x2) - (x2 - x1) * (y3 - y2)
)

const segmentsIntersect = (firstStart, firstEnd, secondStart, secondEnd) => {
    const firstOrientation = orientation(firstStart, firstEnd, secondStart)
    const secondOrientation = orientation(firstStart, firstEnd, secondEnd)
    const thirdOrientation = orientation(secondStart, secondEnd, firstStart)
    const fourthOrientation = orientation(secondStart, secondEnd, firstEnd)

    if (
        firstOrientation * secondOrientation < 0
        && thirdOrientation * fourthOrientation < 0
    ) {
        return true
    }

    return (
        pointOnSegment(secondStart, firstStart, firstEnd)
        || pointOnSegment(secondEnd, firstStart, firstEnd)
        || pointOnSegment(firstStart, secondStart, secondEnd)
        || pointOnSegment(firstEnd, secondStart, secondEnd)
    )
}

export const validatePolygonGeometry = (geometry) => {
    if (
        !geometry
        || geometry.type !== 'Polygon'
        || !Array.isArray(geometry.coordinates)
        || geometry.coordinates.length !== 1
    ) {
        return false
    }

    const [ring] = geometry.coordinates
    if (
        !Array.isArray(ring)
        || ring.length < 4
        || ring.length > MAX_POLYGON_VERTICES + 1
    ) {
        return false
    }

    const validCoordinates = ring.every((coordinate) => (
        Array.isArray(coordinate)
        && coordinate.length === 2
        && Number.isFinite(coordinate[0])
        && coordinate[0] >= -180
        && coordinate[0] <= 180
        && Number.isFinite(coordinate[1])
        && coordinate[1] >= -90
        && coordinate[1] <= 90
    ))
    if (!validCoordinates) return false

    const first = ring[0]
    const last = ring[ring.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) return false

    const openRing = ring.slice(0, -1)
    const distinctVertices = new Set(
        openRing.map(([longitude, latitude]) => `${longitude},${latitude}`)
    )
    if (distinctVertices.size < 3) return false
    if (openRing.some((point, index) => (
        index > 0
        && point[0] === openRing[index - 1][0]
        && point[1] === openRing[index - 1][1]
    ))) {
        return false
    }

    const twiceArea = openRing.reduce((area, [longitude, latitude], index) => {
        const next = openRing[(index + 1) % openRing.length]
        return area + longitude * next[1] - next[0] * latitude
    }, 0)
    if (Math.abs(twiceArea) < 1e-12) return false

    const segmentCount = ring.length - 1
    for (let firstIndex = 0; firstIndex < segmentCount; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < segmentCount; secondIndex += 1) {
            const adjacent = secondIndex === firstIndex + 1
                || (firstIndex === 0 && secondIndex === segmentCount - 1)
            if (adjacent) continue

            if (
                segmentsIntersect(
                    ring[firstIndex],
                    ring[firstIndex + 1],
                    ring[secondIndex],
                    ring[secondIndex + 1]
                )
            ) {
                return false
            }
        }
    }

    return true
}

const validateTargetArea = ({ name, areaType, hazardTypes, geometry }) => {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
        const error = new Error('Area name is required and must be 120 characters or fewer')
        error.statusCode = 400
        throw error
    }

    if (!ALLOWED_AREA_TYPES.has(areaType)) {
        const error = new Error('Choose a valid target area type')
        error.statusCode = 400
        throw error
    }

    if (
        !Array.isArray(hazardTypes)
        || hazardTypes.length === 0
        || hazardTypes.some((hazard) => !ALLOWED_HAZARDS.has(hazard))
    ) {
        const error = new Error('Select at least one valid hazard type')
        error.statusCode = 400
        throw error
    }

    if (!validatePolygonGeometry(geometry)) {
        const error = new Error('Draw a valid polygon with at least three distinct points')
        error.statusCode = 400
        throw error
    }
}

const citizenQueryForGeometry = (geometry) => ({
    role: { $in: CITIZEN_ROLE_VALUES },
    location: { $geoWithin: { $geometry: geometry } }
})

const getCurrentCitizenIds = async (citizenIds) => {
    if (citizenIds.length === 0) return []

    return User.find({
        _id: { $in: citizenIds },
        role: { $in: CITIZEN_ROLE_VALUES }
    }).distinct('_id')
}

const shapeTargetArea = async (area) => {
    const { citizenIds, ...publicArea } = area.toObject()
    return {
        ...publicArea,
        citizenCount: (await getCurrentCitizenIds(citizenIds)).length
    }
}

export const previewTargetArea = async (geometry) => {
    if (!validatePolygonGeometry(geometry)) {
        const error = new Error('Draw a valid polygon with at least three distinct points')
        error.statusCode = 400
        throw error
    }

    return {
        citizenCount: await User.countDocuments(citizenQueryForGeometry(geometry))
    }
}

export const createTargetArea = async (data, officerId) => {
    validateTargetArea(data)

    const citizenIds = await User.find(citizenQueryForGeometry(data.geometry))
        .distinct('_id')
    const area = await TargetArea.create({
        name: data.name.trim(),
        areaType: data.areaType,
        hazardTypes: [...new Set(data.hazardTypes)],
        description: typeof data.description === 'string'
            ? data.description.trim().slice(0, 2000)
            : '',
        geometry: data.geometry,
        citizenIds,
        createdBy: officerId
    })

    return {
        ...area.toObject(),
        citizenCount: citizenIds.length
    }
}

export const listTargetAreas = async () => {
    const areas = await TargetArea.find()
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })

    return Promise.all(areas.map(shapeTargetArea))
}
