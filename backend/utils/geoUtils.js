export const validateGeoPoint = (point, { requireType = true } = {}) => {
    if (!point || typeof point !== 'object') {
        return false
    }

    if (requireType && point.type !== 'Point') {
        return false
    }

    if (
        !Array.isArray(point.coordinates)
        || point.coordinates.length !== 2
    ) {
        return false
    }

    const [longitude, latitude] = point.coordinates

    if (
        !Number.isFinite(longitude)
        || !Number.isFinite(latitude)
    ) {
        return false
    }

    if (longitude < -180 || longitude > 180) {
        return false
    }

    if (latitude < -90 || latitude > 90) {
        return false
    }

    return true
}

export const haversineDistanceKm = (firstPoint, secondPoint) => {
    if (
        !validateGeoPoint(firstPoint)
        || !validateGeoPoint(secondPoint)
    ) {
        throw new Error(
            'Both points must be valid GeoJSON Point coordinates'
        )
    }

    const [longitude1, latitude1] = firstPoint.coordinates
    const [longitude2, latitude2] = secondPoint.coordinates

    const earthRadiusKm = 6371

    const toRadians = (value) => (
        value * Math.PI / 180
    )

    const latitude1Rad = toRadians(latitude1)
    const latitude2Rad = toRadians(latitude2)

    const deltaLatitude = toRadians(
        latitude2 - latitude1
    )

    const deltaLongitude = toRadians(
        longitude2 - longitude1
    )

    const a =
        Math.sin(deltaLatitude / 2) ** 2
        + Math.cos(latitude1Rad)
        * Math.cos(latitude2Rad)
        * Math.sin(deltaLongitude / 2) ** 2

    return (
        2
        * earthRadiusKm
        * Math.asin(Math.sqrt(a))
    )
}

export const isWithinRadius = (
    firstPoint,
    secondPoint,
    radiusKm
) => {
    if (
        !Number.isFinite(radiusKm)
        || radiusKm < 0
    ) {
        throw new Error(
            'Radius must be a non-negative number in kilometers'
        )
    }

    return (
        haversineDistanceKm(firstPoint, secondPoint)
        <= radiusKm
    )
}

export default {
    validateGeoPoint,
    haversineDistanceKm,
    isWithinRadius
}