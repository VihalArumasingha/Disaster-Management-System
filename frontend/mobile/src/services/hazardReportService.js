import api from './api'

export const createHazardReport = async (
    report,
    { forceSubmit = false } = {}
) => {
    const { latitude, longitude } = report.location

    const payload = new FormData()

    payload.append(
        'hazardType',
        report.hazardType
    )

    payload.append(
        'description',
        report.description?.trim() ||
            'No additional details provided.'
    )

    payload.append(
        'location',
        JSON.stringify({
            type: 'Point',
            coordinates: [
                longitude,
                latitude
            ]
        })
    )

    payload.append(
        'capturedAt',
        report.capturedAt
    )

    /*
     * Used when the citizen explicitly chooses
     * "Submit as new" after a duplicate warning.
     */
    payload.append(
        'forceSubmit',
        forceSubmit ? 'true' : 'false'
    )

    if (report.photo) {
        payload.append(
            'photo',
            report.photo,
            report.photo.name ||
                `hazard-photo-${Date.now()}.jpg`
        )
    }

    try {
        const { data } = await api.post(
            '/citizen/hazard-reports',
            payload,
            {
                headers: {
                    'Content-Type':
                        'multipart/form-data'
                }
            }
        )

        return data.report
    } catch (error) {
        /*
         * Preserve duplicate information so
         * ReportHazard.jsx can show the warning
         * instead of treating it as an offline failure.
         */
        if (
            error.response?.status === 409 &&
            error.response?.data?.isDuplicate
        ) {
            const duplicateError = new Error(
                error.response.data.message ||
                    'A similar report was recently submitted.'
            )

            duplicateError.isDuplicate = true
            duplicateError.existingReportId =
                error.response.data.existingReportId
            duplicateError.statusCode = 409

            throw duplicateError
        }

        throw new Error(
            error.response?.data?.message ||
                error.message ||
                'Your report could not be submitted.',
            {
                cause: error
            }
        )
    }
}

export const updateHazardReport = async (
    reportId,
    report
) => {
    const { latitude, longitude } =
        report.location

    try {
        const { data } = await api.patch(
            `/citizen/hazard-reports/${reportId}`,
            {
                hazardType: report.hazardType,
                description:
                    report.description?.trim() ||
                    'No additional details provided.',
                location: {
                    type: 'Point',
                    coordinates: [
                        longitude,
                        latitude
                    ]
                },
                capturedAt: report.capturedAt
            }
        )

        return data.data
    } catch (error) {
        throw new Error(
            error.response?.data?.message ||
                error.message ||
                'The existing report could not be updated.',
            {
                cause: error
            }
        )
    }
}