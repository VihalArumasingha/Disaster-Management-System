import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

function WarningMap({ areas = [], height = 220 }) {
    const containerRef = useRef(null)

    useEffect(() => {
        if (!containerRef.current) return undefined
        const map = L.map(containerRef.current, {
            zoomControl: true,
            scrollWheelZoom: false
        })
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map)

        const polygons = []
        areas.forEach((area) => {
            const geometry = area.geometry
            if (geometry?.type !== 'Polygon' || !Array.isArray(geometry.coordinates?.[0])) return
            const points = geometry.coordinates[0]
                .filter((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2)
                .map(([longitude, latitude]) => [latitude, longitude])
            if (points.length < 4) return
            polygons.push(L.polygon(points, {
                color: '#b91c1c',
                fillColor: '#ef4444',
                fillOpacity: 0.22,
                weight: 3
            }).bindTooltip(area.name || 'Affected area'))
        })

        const areaLayer = L.featureGroup(polygons).addTo(map)
        if (areaLayer.getLayers().length > 0) {
            map.fitBounds(areaLayer.getBounds(), { padding: [20, 20], maxZoom: 15 })
        } else {
            map.setView([6.9271, 79.8612], 10)
        }

        const resizeObserver = new ResizeObserver(() => map.invalidateSize())
        resizeObserver.observe(containerRef.current)
        return () => {
            resizeObserver.disconnect()
            map.remove()
        }
    }, [areas])

    return (
        <div
            ref={containerRef}
            role="img"
            aria-label="Map showing the warning's affected area"
            className="z-0 w-full overflow-hidden rounded-2xl"
            style={{ height }}
        />
    )
}

export default WarningMap
