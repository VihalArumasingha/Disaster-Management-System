import api from './api'

export const createHazardReport = async (report) => {
    const { latitude, longitude } = report.location

    const payload = new FormData()

    payload.append('hazardType', report.hazardType)

    payload.append(
        'description',
        report.description?.trim() || 'No additional details provided.'
    )

    payload.append(
        'location',
        JSON.stringify({
            type: 'Point',
            coordinates: [longitude, latitude],
        })
    )

    payload.append('capturedAt', report.capturedAt)

    if (report.photo) {
        payload.append(
            'photo',
            report.photo,
            report.photo.name || `hazard-photo-${Date.now()}.jpg`
        )
    }

    try {
        const { data } = await api.post(
            '/citizen/hazard-reports',
            payload,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        )

        return data.report
    } catch (error) {
        throw new Error(
            error.response?.data?.message ||
                error.message ||
                'Your report could not be submitted.',
            {
                cause: error,
            }
        )
    }
}