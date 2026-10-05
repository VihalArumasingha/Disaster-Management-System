import { useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const toLatLng = (location) => {
	const coordinates = location?.coordinates
	if (location?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2) return null
	const [longitude, latitude] = coordinates
	return Number.isFinite(longitude) && Number.isFinite(latitude)
		? [latitude, longitude]
		: null
}

function HazardReviewMap({ cluster, height = '360px' }) {
	const mapElement = useRef(null)
	const hasLocation = Boolean(toLatLng(cluster.center))
		|| (cluster.reportIds || []).some((report) => Boolean(toLatLng(report?.location)))

	useEffect(() => {
		const center = toLatLng(cluster.center)
		const reports = (cluster.reportIds || [])
			.map((report) => ({ report, point: toLatLng(report?.location) }))
			.filter(({ point }) => point)

		if (!mapElement.current || (!center && reports.length === 0)) return undefined

		const map = L.map(mapElement.current, { scrollWheelZoom: false })
		const markerLayer = L.featureGroup().addTo(map)
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution: '&copy; OpenStreetMap contributors'
		}).addTo(map)

		if (center) {
			L.circleMarker(center, {
				radius: 10,
				color: '#ffffff',
				weight: 3,
				fillColor: '#b91c1c',
				fillOpacity: 1
			}).bindTooltip('Cluster center').addTo(markerLayer)
		}

		reports.forEach(({ report, point }, index) => {
			const marker = L.circleMarker(point, {
				radius: 6,
				color: '#ffffff',
				weight: 2,
				fillColor: '#2563eb',
				fillOpacity: 0.95
			})
			marker.bindTooltip(`Report ${index + 1}${report.status ? ` · ${report.status}` : ''}`)
			marker.addTo(markerLayer)
		})

		const resizeObserver = new ResizeObserver(() => map.invalidateSize())
		resizeObserver.observe(mapElement.current)
		const bounds = markerLayer.getBounds()
		if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14 })

		return () => {
			resizeObserver.disconnect()
			map.remove()
		}
	}, [cluster])

	if (!hasLocation) {
		return (
			<div className="grid min-h-56 place-items-center rounded-xl border border-slate-200 bg-slate-50 px-5 text-center" style={{ height }}>
				<div>
					<MapPin className="mx-auto text-slate-400" size={24} />
					<p className="mt-2 text-sm font-medium text-slate-700">Location data is not available for this cluster.</p>
				</div>
			</div>
		)
	}

	return <div ref={mapElement} className="w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100" style={{ height }} aria-label="Hazard cluster and report locations" />
}

export default HazardReviewMap
