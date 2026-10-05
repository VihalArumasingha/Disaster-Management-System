import axios from 'axios'
import ReportCluster from '../../../models/ReportCluster.js'
import TargetArea from '../../../models/TargetArea.js'
import Warning from '../../../models/Warning.js'
import { haversineDistanceKm } from '../../../utils/geoUtils.js'

const ALLOWED_RADII_KM = new Set([2, 5, 10, 25, 50])
const RECENT_HAZARD_WINDOW_MS = 24 * 60 * 60 * 1000
const FACILITY_CACHE_TTL_MS = 5 * 60 * 1000
const facilityCache = new Map()

const validateRadius = (radiusKm) => {
    const radius = Number(radiusKm)
    if (!ALLOWED_RADII_KM.has(radius)) {
        const error = new Error('Choose a distance of 2, 5, 10, 25, or 50 km')
        error.statusCode = 400
        throw error
    }
    return radius
}

const circlePolygon = (center, radiusKm) => {
    const [longitude, latitude] = center.coordinates
    const latitudeRadius = radiusKm / 111.32
    const longitudeRadius = radiusKm / (111.32 * Math.cos(latitude * Math.PI / 180))
    const ring = []
    for (let index = 0; index < 48; index += 1) {
        const angle = (index / 48) * Math.PI * 2
        ring.push([
            longitude + longitudeRadius * Math.cos(angle),
            latitude + latitudeRadius * Math.sin(angle)
        ])
    }
    ring.push(ring[0])
    return { type: 'Polygon', coordinates: [ring] }
}

const toNearbyWarning = (warning, areas, center) => {
    const coordinates = areas.flatMap((area) => area.geometry.coordinates[0] || [])
    if (coordinates.length === 0) return null
    const [longitude, latitude] = coordinates.reduce(
        ([sumLongitude, sumLatitude], [areaLongitude, areaLatitude]) => [
            sumLongitude + areaLongitude,
            sumLatitude + areaLatitude
        ],
        [0, 0]
    ).map((value) => value / coordinates.length)
    const nearestArea = areas.reduce((nearest, area) => {
        const ring = area.geometry.coordinates[0] || []
        const [areaLongitude, areaLatitude] = ring.reduce(
            ([sumLongitude, sumLatitude], [pointLongitude, pointLatitude]) => [
                sumLongitude + pointLongitude,
                sumLatitude + pointLatitude
            ],
            [0, 0]
        ).map((value) => value / Math.max(ring.length, 1))
        const distanceKm = haversineDistanceKm(center, {
            type: 'Point',
            coordinates: [areaLongitude, areaLatitude]
        })
        return !nearest || distanceKm < nearest.distanceKm ? { area, distanceKm } : nearest
    }, null)

    return {
        id: String(warning._id),
        source: 'official-warning',
        title: warning.title,
        hazardType: warning.hazardType,
        severity: warning.severity,
        status: warning.status,
        lastUpdatedAt: warning.updatedAt || warning.issuedAt,
        location: { type: 'Point', coordinates: [longitude, latitude] },
        distanceKm: nearestArea?.distanceKm ?? 0,
        areas: areas.map((area) => ({
            _id: area._id,
            name: area.name,
            geometry: area.geometry
        }))
    }
}

export const getNearbyHazards = async (user, requestedRadius) => {
    const radiusKm = validateRadius(requestedRadius)
    const center = user.location
    if (center?.type !== 'Point' || !Array.isArray(center.coordinates) || center.coordinates.length !== 2) {
        const error = new Error('Add a location to your citizen profile to see nearby hazards')
        error.statusCode = 400
        throw error
    }
    const recentAfter = new Date(Date.now() - RECENT_HAZARD_WINDOW_MS)

    const [clusters, nearbyAreas] = await Promise.all([
        ReportCluster.find({
            status: 'active',
            reportCount: { $gt: 0 },
            lastReportedAt: { $gte: recentAfter },
            center: {
                $near: {
                    $geometry: center,
                    $maxDistance: radiusKm * 1000
                }
            }
        })
            .select('hazardType center reportCount priorityLevel lastReportedAt')
            .limit(100)
            .lean(),
        TargetArea.find({
            geometry: { $geoIntersects: { $geometry: circlePolygon(center, radiusKm) } }
        }).select('name geometry')
    ])

    const warnings = nearbyAreas.length
        ? await Warning.find({
            targetAreaIds: { $in: nearbyAreas.map((area) => area._id) },
            resolvedAt: null,
            status: { $in: ['issued', 'partially_issued'] }
        })
            .select('title hazardType severity status targetAreaIds issuedAt updatedAt')
            .sort({ issuedAt: -1 })
            .limit(50)
            .lean()
        : []
    const areaById = new Map(nearbyAreas.map((area) => [String(area._id), area]))
    const warningHazards = warnings.map((warning) => {
        const areas = warning.targetAreaIds
            .map((areaId) => areaById.get(String(areaId)))
            .filter(Boolean)
        return toNearbyWarning(warning, areas, center)
    }).filter(Boolean)

    const reportedHazards = clusters.map((cluster) => ({
        id: String(cluster._id),
        source: 'citizen-report',
        title: `${cluster.hazardType.replaceAll('_', ' ')} reports`,
        hazardType: cluster.hazardType,
        severity: cluster.priorityLevel,
        reportCount: cluster.reportCount,
        lastUpdatedAt: cluster.lastReportedAt,
        location: cluster.center,
        distanceKm: haversineDistanceKm(center, cluster.center)
    }))
    const hazards = [...warningHazards, ...reportedHazards]
        .sort((first, second) => first.distanceKm - second.distanceKm)

    return {
        center,
        radiusKm,
        hazards,
        total: hazards.length,
        activeHazards: reportedHazards.length,
        officialWarnings: warningHazards.length,
        hazardReports: reportedHazards,
        warnings: warningHazards
    }
}

export const getNearbyFacilities = async (user, requestedRadius) => {
    const radiusKm = validateRadius(requestedRadius)
    const center = user.location
    if (center?.type !== 'Point' || !Array.isArray(center.coordinates) || center.coordinates.length !== 2) {
        const error = new Error('Add a location to your citizen profile to find nearby shelters and hospitals')
        error.statusCode = 400
        throw error
    }

    const [longitude, latitude] = center.coordinates
    const cacheKey = `${latitude.toFixed(4)}:${longitude.toFixed(4)}:${radiusKm}`
    const cached = facilityCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.facilities

    const radiusMeters = radiusKm * 1000
    const query = `[out:json][timeout:12];(nwr(around:${radiusMeters},${latitude},${longitude})["amenity"~"shelter|hospital"];nwr(around:${radiusMeters},${latitude},${longitude})["emergency"="shelter"];nwr(around:${radiusMeters},${latitude},${longitude})["healthcare"="hospital"];);out center tags;`
    let response
    try {
        response = await axios.post(
            'https://overpass-api.de/api/interpreter',
            new URLSearchParams({ data: query }).toString(),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000
            }
        )
    } catch (cause) {
        const error = new Error('Nearby shelters and hospitals are temporarily unavailable')
        error.statusCode = 503
        error.cause = cause
        throw error
    }

    if (!Array.isArray(response.data?.elements)) {
        const error = new Error('Nearby places service returned an invalid response')
        error.statusCode = 502
        throw error
    }
    const facilityEntries = response.data.elements.flatMap((element) => {
        const facilityLatitude = element.lat ?? element.center?.lat
        const facilityLongitude = element.lon ?? element.center?.lon
        if (!Number.isFinite(facilityLatitude) || !Number.isFinite(facilityLongitude)) return []
        const tags = element.tags || {}
        const isHospital = tags.amenity === 'hospital' || tags.healthcare === 'hospital'
        const location = { type: 'Point', coordinates: [facilityLongitude, facilityLatitude] }
        const facility = {
            id: `${element.type}-${element.id}`,
            name: tags.name || (isHospital ? 'Hospital' : 'Shelter'),
            type: isHospital ? 'hospital' : 'shelter',
            location,
            distanceKm: haversineDistanceKm(center, location)
        }
        return [[facility.id, facility]]
    }).slice(0, 100)
    const facilities = [...new Map(facilityEntries).values()]
        .sort((first, second) => first.distanceKm - second.distanceKm)
    facilityCache.set(cacheKey, { facilities, expiresAt: Date.now() + FACILITY_CACHE_TTL_MS })
    return facilities
}
