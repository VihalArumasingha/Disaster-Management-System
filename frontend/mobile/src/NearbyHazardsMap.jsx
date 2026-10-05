import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const hazardColor = (severity) => ({
    critical: '#b91c1c',
    high: '#dc2626',
    emergency: '#b91c1c',
    warning: '#ea580c',
    medium: '#f59e0b',
    moderate: '#f59e0b',
    low: '#64748b',
    watch: '#f59e0b',
    advisory: '#64748b'
})[String(severity || '').toLowerCase()] || '#dc2626'

const createMarker = (color, symbol, label) => L.divIcon({
    className: '',
    html: `<span title="${label}" style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border:2px solid white;border-radius:50%;background:${color};color:white;font-size:13px;font-weight:700;box-shadow:0 2px 6px #0f172a66">${symbol}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
})

function NearbyHazardsMap({ center, radiusKm, hazards, facilities }) {
    const containerRef = useRef(null)

    useEffect(() => {
        if (!containerRef.current || !center?.coordinates) return undefined
        const [longitude, latitude] = center.coordinates
        const map = L.map(containerRef.current, {
            zoomControl: true,
            scrollWheelZoom: false
        }).setView([latitude, longitude], 13)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map)

        const bounds = L.latLngBounds([[latitude, longitude]])
        L.circle([latitude, longitude], {
            radius: radiusKm * 1000,
            color: '#0f766e',
            fillColor: '#0f766e',
            fillOpacity: 0.04,
            weight: 2,
            dashArray: '5 6'
        }).addTo(map)
        L.marker([latitude, longitude], {
            icon: createMarker('#2563eb', '●', 'Your location'),
            zIndexOffset: 1000
        }).bindTooltip('You are here').addTo(map)

        hazards.forEach((hazard) => {
            if (hazard.source === 'official-warning') {
                hazard.areas?.forEach((area) => {
                    const ring = area.geometry?.coordinates?.[0]
                    if (!Array.isArray(ring) || ring.length < 4) return
                    const points = ring.map(([areaLongitude, areaLatitude]) => [areaLatitude, areaLongitude])
                    const polygon = L.polygon(points, {
                        color: hazardColor(hazard.severity),
                        fillColor: hazardColor(hazard.severity),
                        fillOpacity: 0.14,
                        weight: 2
                    }).bindTooltip(`${hazard.title} · ${area.name}`)
                    polygon.addTo(map)
                    bounds.extend(polygon.getBounds())
                })
            }
            if (!hazard.location?.coordinates) return
            const [hazardLongitude, hazardLatitude] = hazard.location.coordinates
            L.marker([hazardLatitude, hazardLongitude], {
                icon: createMarker(
                    hazardColor(hazard.severity),
                    hazard.source === 'official-warning' ? '!' : '≈',
                    hazard.title
                )
            }).bindTooltip(`${hazard.title}${hazard.reportCount ? ` · ${hazard.reportCount} reports` : ''}`)
                .addTo(map)
            bounds.extend([hazardLatitude, hazardLongitude])
        })

        facilities.forEach((facility) => {
            const [facilityLongitude, facilityLatitude] = facility.location.coordinates
            const isHospital = facility.type === 'hospital'
            L.marker([facilityLatitude, facilityLongitude], {
                icon: createMarker(isHospital ? '#1e3a5f' : '#0f766e', isHospital ? 'H' : '+', facility.name)
            }).bindTooltip(facility.name).addTo(map)
            bounds.extend([facilityLatitude, facilityLongitude])
        })

        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [18, 18], maxZoom: 14 })
        }
        const resizeObserver = new ResizeObserver(() => map.invalidateSize())
        resizeObserver.observe(containerRef.current)
        return () => {
            resizeObserver.disconnect()
            map.remove()
        }
    }, [center, radiusKm, hazards, facilities])

    return (
        <div
            ref={containerRef}
            role="img"
            aria-label={`Map of hazards within ${radiusKm} km`}
            className="z-0 w-full"
            style={{ height: 320 }}
        />
    )
}

export default NearbyHazardsMap
