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

const escapeHtml = (value) => (
    String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
)

const formatSeverity = (severity) => {
    if (!severity) return 'Unknown'

    return String(severity)
        .replaceAll('_', ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

const formatDistance = (distanceKm) => {
    if (!Number.isFinite(Number(distanceKm))) {
        return null
    }

    const distance = Number(distanceKm)

    if (distance < 1) {
        return `${Math.round(distance * 1000)} m`
    }

    return `${distance.toFixed(1)} km`
}

const formatUpdatedTime = (dateValue) => {
    if (!dateValue) return null

    const date = new Date(dateValue)

    if (Number.isNaN(date.getTime())) {
        return null
    }

    return date.toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short'
    })
}

const createMarker = (color, symbol, label) => L.divIcon({
    className: '',
    html: `
        <span
            title="${escapeHtml(label)}"
            style="
                display:flex;
                align-items:center;
                justify-content:center;
                width:28px;
                height:28px;
                border:2px solid white;
                border-radius:50%;
                background:${color};
                color:white;
                font-size:13px;
                font-weight:700;
                box-shadow:0 2px 6px #0f172a66;
            "
        >
            ${escapeHtml(symbol)}
        </span>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
})

const createHazardPopup = (hazard) => {
    const title = escapeHtml(hazard.title || 'Hazard')
    const severity = escapeHtml(formatSeverity(hazard.severity))
    const distance = formatDistance(hazard.distanceKm)
    const updated = formatUpdatedTime(hazard.lastUpdatedAt)

    const isOfficial = hazard.source === 'official-warning'

    const reportCount = Number.isFinite(Number(hazard.reportCount))
        ? Number(hazard.reportCount)
        : null

    return `
        <div style="min-width:210px;max-width:270px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

            <div style="font-size:15px;font-weight:700;color:#10233F;margin-bottom:8px;">
                ${title}
            </div>

            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">

                <span style="
                    display:inline-flex;
                    align-items:center;
                    border-radius:999px;
                    padding:3px 8px;
                    background:${hazardColor(hazard.severity)};
                    color:white;
                    font-size:11px;
                    font-weight:700;
                ">
                    ${severity}
                </span>

                <span style="
                    display:inline-flex;
                    align-items:center;
                    border-radius:999px;
                    padding:3px 8px;
                    background:#f1f5f9;
                    color:#475569;
                    font-size:11px;
                    font-weight:600;
                ">
                    ${isOfficial ? 'Official warning' : 'Citizen reports'}
                </span>

            </div>

            ${
                reportCount !== null
                    ? `
                        <div style="font-size:12px;color:#475569;margin-bottom:5px;">
                            <strong style="color:#10233F;">Reports:</strong>
                            ${reportCount}
                        </div>
                    `
                    : ''
            }

            ${
                distance
                    ? `
                        <div style="font-size:12px;color:#475569;margin-bottom:5px;">
                            <strong style="color:#10233F;">Distance:</strong>
                            ${escapeHtml(distance)}
                        </div>
                    `
                    : ''
            }

            ${
                updated
                    ? `
                        <div style="font-size:12px;color:#475569;">
                            <strong style="color:#10233F;">Updated:</strong>
                            ${escapeHtml(updated)}
                        </div>
                    `
                    : ''
            }

        </div>
    `
}

const createFacilityPopup = (facility) => {
    const name = escapeHtml(facility.name || 'Nearby facility')

    const type = facility.type === 'hospital'
        ? 'Hospital'
        : 'Shelter'

    const distance = formatDistance(facility.distanceKm)

    return `
        <div style="min-width:180px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

            <div style="font-size:14px;font-weight:700;color:#10233F;margin-bottom:6px;">
                ${name}
            </div>

            <div style="font-size:12px;color:#475569;margin-bottom:4px;">
                <strong style="color:#10233F;">Type:</strong>
                ${type}
            </div>

            ${
                distance
                    ? `
                        <div style="font-size:12px;color:#475569;">
                            <strong style="color:#10233F;">Distance:</strong>
                            ${escapeHtml(distance)}
                        </div>
                    `
                    : ''
            }

        </div>
    `
}

function NearbyHazardsMap({
    center,
    radiusKm,
    hazards = [],
    facilities = []
}) {
    const containerRef = useRef(null)

    useEffect(() => {
        if (!containerRef.current || !center?.coordinates) {
            return undefined
        }

        const [longitude, latitude] = center.coordinates

        const map = L.map(containerRef.current, {
            zoomControl: true,
            scrollWheelZoom: false
        }).setView([latitude, longitude], 13)

        L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
                maxZoom: 19,
                attribution:
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }
        ).addTo(map)

        const bounds = L.latLngBounds([
            [latitude, longitude]
        ])

        // Search radius
        L.circle([latitude, longitude], {
            radius: radiusKm * 1000,
            color: '#0f766e',
            fillColor: '#0f766e',
            fillOpacity: 0.04,
            weight: 2,
            dashArray: '5 6'
        }).addTo(map)

        // Citizen location
        L.marker([latitude, longitude], {
            icon: createMarker(
                '#2563eb',
                '●',
                'Your location'
            ),
            zIndexOffset: 1000
        })
            .bindPopup(`
                <div style="
                    min-width:150px;
                    font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
                ">
                    <div style="
                        font-size:14px;
                        font-weight:700;
                        color:#10233F;
                        margin-bottom:4px;
                    ">
                        Your location
                    </div>

                    <div style="
                        font-size:12px;
                        color:#64748b;
                    ">
                        Centre of your nearby hazard search
                    </div>
                </div>
            `)
            .addTo(map)

        // Hazards and official warnings
        hazards.forEach((hazard) => {
            if (hazard.source === 'official-warning') {
                hazard.areas?.forEach((area) => {
                    const ring = area.geometry?.coordinates?.[0]

                    if (!Array.isArray(ring) || ring.length < 4) {
                        return
                    }

                    const points = ring.map(
                        ([areaLongitude, areaLatitude]) => (
                            [areaLatitude, areaLongitude]
                        )
                    )

                    const polygon = L.polygon(points, {
                        color: hazardColor(hazard.severity),
                        fillColor: hazardColor(hazard.severity),
                        fillOpacity: 0.14,
                        weight: 2
                    })
                        .bindPopup(
                            createHazardPopup({
                                ...hazard,
                                title: `${hazard.title} · ${area.name}`
                            })
                        )

                    polygon.addTo(map)
                    bounds.extend(polygon.getBounds())
                })
            }

            if (!hazard.location?.coordinates) {
                return
            }

            const [
                hazardLongitude,
                hazardLatitude
            ] = hazard.location.coordinates

            const marker = L.marker(
                [hazardLatitude, hazardLongitude],
                {
                    icon: createMarker(
                        hazardColor(hazard.severity),
                        hazard.source === 'official-warning'
                            ? '!'
                            : '≈',
                        hazard.title
                    )
                }
            )

            marker
                .bindPopup(
                    createHazardPopup(hazard),
                    {
                        maxWidth: 300
                    }
                )
                .addTo(map)

            bounds.extend([
                hazardLatitude,
                hazardLongitude
            ])
        })

        // Shelters and hospitals
        facilities.forEach((facility) => {
            if (!facility.location?.coordinates) {
                return
            }

            const [
                facilityLongitude,
                facilityLatitude
            ] = facility.location.coordinates

            const isHospital = facility.type === 'hospital'

            L.marker(
                [facilityLatitude, facilityLongitude],
                {
                    icon: createMarker(
                        isHospital
                            ? '#1e3a5f'
                            : '#0f766e',
                        isHospital ? 'H' : '+',
                        facility.name
                    )
                }
            )
                .bindPopup(createFacilityPopup(facility))
                .addTo(map)

            bounds.extend([
                facilityLatitude,
                facilityLongitude
            ])
        })

        // Fit the visible map around available data
        if (bounds.isValid()) {
            map.fitBounds(bounds, {
                padding: [18, 18],
                maxZoom: 14
            })
        }

        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize()
        })

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