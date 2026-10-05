export const toGeoJSONPoint = ({ lat, lng }) => ({
    type: 'Point',
    coordinates: [lng, lat]
})

export const fromGeoJSONPoint = (point) => {
    if (
        !point ||
        point.type !== 'Point' ||
        !Array.isArray(point.coordinates) ||
        point.coordinates.length !== 2
    ) {
        return null
    }

    return {
        lng: point.coordinates[0],
        lat: point.coordinates[1]
    }
}