import { useEffect, useRef } from 'react'
import { MapPin } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const priorityColors = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#ca8a04',
    low: '#16a34a'
}

const titleCase = (value) => String(value || 'Unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const getCoordinates = (location) => {
    const coordinates = location?.coordinates
    if (location?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2) return null
    const [longitude, latitude] = coordinates
    return Number.isFinite(longitude) && Number.isFinite(latitude)
        ? [latitude, longitude]
        : null
}

const formatCoordinates = ([latitude, longitude]) => `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`

const getClusterPoint = (cluster) => (
    getCoordinates(cluster.center)
    || (cluster.reportIds || []).map((report) => getCoordinates(report?.location)).find(Boolean)
)

const createPopup = (cluster, coordinates, navigate) => {
    const popup = document.createElement('div')
    popup.className = 'min-w-52 space-y-1 text-sm'

    const heading = document.createElement('p')
    heading.className = 'font-semibold text-slate-900'
    heading.textContent = titleCase(cluster.hazardType)
    popup.append(heading)

    const priority = String(cluster.priorityLevel || 'low').toLowerCase()
    const details = [
        `Priority: ${titleCase(priority)}`,
        `Priority score: ${cluster.priorityScore ?? '—'}`,
        `Reports: ${cluster.reportCount ?? cluster.reportIds?.length ?? 0}`,
        `Coordinates: ${formatCoordinates(coordinates)}`
    ]

    details.forEach((detail) => {
        const line = document.createElement('p')
        line.className = 'text-slate-600'
        line.textContent = detail
        popup.append(line)
    })

    const review = document.createElement('button')
    review.type = 'button'
    review.className = 'mt-2 inline-flex min-h-9 items-center rounded-lg bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800'
    review.textContent = 'Review cluster'
    review.addEventListener('click', () => {
        const clusterId = cluster._id || cluster.id
        if (clusterId) navigate(`/dutyofficer/hazard-reviews/clusters/${encodeURIComponent(clusterId)}`)
    })
    popup.append(review)

    return popup
}

function DutyOfficerHazardMap({ clusters, loading = false }) {
    const mapElement = useRef(null)
    const navigate = useNavigate()
    const activeClusters = clusters.filter((cluster) => cluster.status === 'active')

    useEffect(() => {
        const mapClusters = clusters.filter((cluster) => cluster.status === 'active')
        if (!mapElement.current || mapClusters.length === 0) return undefined

        const map = L.map(mapElement.current, { scrollWheelZoom: false })
        const markers = L.featureGroup().addTo(map)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map)

        mapClusters.forEach((cluster) => {
            const coordinates = getClusterPoint(cluster)
            if (!coordinates) return

            const priority = String(cluster.priorityLevel || 'low').toLowerCase()
            L.circleMarker(coordinates, {
                radius: priority === 'critical' ? 10 : 8,
                color: '#ffffff',
                weight: 2,
                fillColor: priorityColors[priority] || priorityColors.low,
                fillOpacity: 0.88
            })
                .bindPopup(createPopup(cluster, coordinates, navigate), { maxWidth: 280 })
                .addTo(markers)
        })

        const resizeObserver = new ResizeObserver(() => map.invalidateSize())
        resizeObserver.observe(mapElement.current)
        const bounds = markers.getBounds()
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 })
        else map.setView([7.8731, 80.7718], 7)

        return () => {
            resizeObserver.disconnect()
            map.remove()
        }
    }, [clusters, navigate])

    return (
        <section aria-label="Hazard situation map" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
                <div role="status" aria-label="Loading hazard map" className="h-[320px] animate-pulse bg-slate-200 sm:h-[400px] lg:h-[430px]" />
            ) : activeClusters.length === 0 ? (
                <div className="grid h-[320px] place-items-center bg-slate-50 px-6 text-center sm:h-[400px] lg:h-[430px]">
                    <div>
                        <MapPin className="mx-auto text-slate-400" size={28} />
                        <p className="mt-3 font-semibold text-slate-800">No active clusters to display</p>
                        <p className="mt-1 text-sm text-slate-600">Cluster locations will appear here when available.</p>
                    </div>
                </div>
            ) : (
                <div ref={mapElement} className="h-[320px] w-full bg-slate-100 sm:h-[400px] lg:h-[430px]" aria-label="Active hazard cluster map" />
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-200 px-4 py-3 text-xs font-medium text-slate-600 sm:px-5">
                <span className="font-semibold text-slate-700">Priority</span>
                {Object.entries(priorityColors).map(([priority, color]) => (
                    <span key={priority} className="inline-flex items-center gap-2 capitalize">
                        <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white" style={{ backgroundColor: color }} />
                        {priority}
                    </span>
                ))}
            </div>
        </section>
    )
}

export default DutyOfficerHazardMap