import { useCallback, useEffect, useState } from 'react'
import { getHazardReviewQueue } from '../services/hazardReviewService'

function getErrorMessage(error) {
	return error.response?.data?.message || error.message || 'Could not load hazard clusters.'
}

function useHazardReviews() {
	const [clusters, setClusters] = useState([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')

	const loadQueue = useCallback((signal) => getHazardReviewQueue({ signal }), [])

	const refresh = useCallback(async () => {
		setLoading(true)
		setError('')

		try {
			const result = await loadQueue()
			setClusters(Array.isArray(result) ? result : [])
		} catch (requestError) {
			setError(getErrorMessage(requestError))
		} finally {
			setLoading(false)
		}
	}, [loadQueue])

	useEffect(() => {
		const controller = new AbortController()
		loadQueue(controller.signal)
			.then((result) => {
				if (!controller.signal.aborted) setClusters(Array.isArray(result) ? result : [])
			})
			.catch((requestError) => {
				if (!controller.signal.aborted) setError(getErrorMessage(requestError))
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false)
			})
		return () => controller.abort()
	}, [loadQueue])

	return { clusters, loading, error, refresh }
}

export default useHazardReviews
