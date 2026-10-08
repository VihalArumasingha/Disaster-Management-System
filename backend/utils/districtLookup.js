import axios from 'axios'

const NSDI_DISTRICT_QUERY_URL =
    'https://gisapps.nsdi.gov.lk/server/rest/services/BaseMap/BaseMap/MapServer/3/query'

const getDistrictFromCoordinates = async (
    longitude,
    latitude
) => {
    if (
        !Number.isFinite(longitude)
        || !Number.isFinite(latitude)
    ) {
        return null
    }

    try {
        const response = await axios.get(
            NSDI_DISTRICT_QUERY_URL,
            {
                params: {
                    where: '1=1',
                    geometry: `${longitude},${latitude}`,
                    geometryType: 'esriGeometryPoint',
                    inSR: '4326',
                    spatialRel: 'esriSpatialRelIntersects',
                    outFields: 'district_name',
                    returnGeometry: false,
                    f: 'json'
                },
                timeout: 5000
            }
        )

        if (
            response.data?.error
            || !Array.isArray(response.data?.features)
        ) {
            console.error(
                'NSDI district lookup returned an invalid response:',
                response.data?.error || response.data
            )

            return null
        }

        const feature = response.data.features[0]

        const district =
            feature?.attributes?.district_name

        return typeof district === 'string'
            ? district.trim()
            : null
    } catch (error) {
        console.error(
            'District lookup failed:',
            error.message
        )

        return null
    }
}

export default getDistrictFromCoordinates