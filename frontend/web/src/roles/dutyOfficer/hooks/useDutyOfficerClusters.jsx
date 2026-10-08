import { useCallback, useEffect, useState } from 'react'
import { getHazardReviewQueue } from '../../dmcOfficer/services/hazardReviewService'

const getErrorMessage = (error) => (
    error.response?.data?.message || error.message || 'Could not load hazard clusters.'
)

function useDutyOfficerClusters() {
    const [clusters, setClusters] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [reloadKey, setReloadKey] = useState(0)

    const refresh = useCallback(() => {
        setError('')
        setLoading(true)
        setReloadKey((key) => key + 1)
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        getHazardReviewQueue({ signal: controller.signal })
            .then((result) => {
                if (!controller.signal.aborted) {
                    setClusters(Array.isArray(result) ? result : [])
                    setError('')
                }
            })
            .catch((requestError) => {
                if (!controller.signal.aborted) setError(getErrorMessage(requestError))
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })

        return () => controller.abort()
    }, [reloadKey])

    return { clusters, loading, error, refresh }
}

export default useDutyOfficerClusters