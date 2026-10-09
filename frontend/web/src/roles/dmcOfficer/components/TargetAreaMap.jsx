import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'

const weatherLayers = {
    precipitation: 'precipitation_new',
    clouds: 'clouds_new',
    temperature: 'temp_new'
}

const toLeafletCoordinates = (geometry) => (
    geometry?.type === 'Polygon'
        ? geometry.coordinates[0].map(([longitude, latitude]) => [latitude, longitude])
        : []
)

function TargetAreaMap({
    geometry = null,
    overlays = [],
    onChange,
    weatherLayer = '',
    focusLocation = null,
    editable = false,
    height = '420px'
}) {
    const mapContainer = useRef(null)
    const mapRef = useRef(null)
    const featureGroupRef = useRef(null)
    const changeHandler = useRef(onChange)
    const geometryRef = useRef(geometry)
    const overlaysRef = useRef(overlays)
    const overlayGroupRef = useRef(null)
    const focusMarkerRef = useRef(null)
    const [weatherError, setWeatherError] = useState('')

    useEffect(() => {
        changeHandler.current = onChange
    }, [onChange])

    useEffect(() => {
        geometryRef.current = geometry
    }, [geometry])

    useEffect(() => {
        overlaysRef.current = overlays
        const overlayGroup = overlayGroupRef.current
        if (!overlayGroup) return
        overlayGroup.clearLayers()
        let bounds
        overlays.forEach(({ geometry: overlayGeometry, count = 1, name = 'Target area' }) => {
            const coordinates = toLeafletCoordinates(overlayGeometry)
            if (coordinates.length === 0) return
            const boundsForArea = L.latLngBounds(coordinates)
            for (let index = 0; index < count; index += 1) {
                overlayGroup.addLayer(L.polygon(coordinates, {
                    color: '#dc2626',
                    fillColor: '#ef4444',
                    fillOpacity: 0.2,
                    weight: 2
                }).bindTooltip(`${name}${count > 1 ? ` × ${count}` : ''}`))
            }
            bounds = bounds ? bounds.extend(boundsForArea) : boundsForArea
        })
        if (bounds) mapRef.current?.fitBounds(bounds, { padding: [20, 20] })
    }, [overlays])

    useEffect(() => {
        if (!mapContainer.current) return undefined

        const map = L.map(mapContainer.current, {
            scrollWheelZoom: true
        }).setView([6.9271, 79.8612], 10)
        mapRef.current = map
        L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors'
            }
        ).addTo(map)
        const featureGroup = new L.FeatureGroup().addTo(map)
        featureGroupRef.current = featureGroup
        const overlayGroup = new L.FeatureGroup().addTo(map)
        overlayGroupRef.current = overlayGroup

        let weatherOverlay
        if (weatherLayer && weatherLayers[weatherLayer]) {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
            weatherOverlay = L.tileLayer(
                `${baseUrl}/dmcofficer/map/tiles/${weatherLayers[weatherLayer]}/{z}/{x}/{y}`,
                {
                    opacity: 0.62,
                    maxZoom: 18,
                    crossOrigin: 'use-credentials',
                    attribution: '&copy; OpenWeather'
                }
            )
            weatherOverlay.on('tileerror', () => {
                setWeatherError('OpenWeather overlay is unavailable. Check OPENWEATHER_KEY and map API access.')
            })
            weatherOverlay.on('tileload', () => setWeatherError(''))
            weatherOverlay.addTo(map)
        }

        const initialCoordinates = toLeafletCoordinates(geometryRef.current)
        if (initialCoordinates.length > 0) {
            const polygon = L.polygon(initialCoordinates, {
                color: '#1677ff',
                fillColor: '#2580ff',
                fillOpacity: 0.22,
                weight: 3
            }).addTo(featureGroup)
            map.fitBounds(polygon.getBounds(), { padding: [20, 20] })
        }

        if (editable) {
            const drawControl = new L.Control.Draw({
                position: 'topright',
                draw: {
                    polygon: {
                        allowIntersection: false,
                        shapeOptions: {
                            color: '#1677ff',
                            fillColor: '#2580ff',
                            fillOpacity: 0.22,
                            weight: 3
                        }
                    },
                    polyline: false,
                    rectangle: false,
                    circle: false,
                    circlemarker: false,
                    marker: false
                },
                edit: {
                    featureGroup,
                    selectedPathOptions: {
                        maintainColor: true
                    }
                }
            })
            map.addControl(drawControl)
        }

        const publishGeometry = () => {
            const layers = featureGroup.getLayers()
            const nextGeometry = layers.length > 0
                ? layers[layers.length - 1].toGeoJSON().geometry
                : null
            changeHandler.current?.(nextGeometry)
        }

        map.on(L.Draw.Event.CREATED, (event) => {
            featureGroup.clearLayers()
            featureGroup.addLayer(event.layer)
            publishGeometry()
        })
        map.on(L.Draw.Event.EDITED, publishGeometry)
        map.on(L.Draw.Event.DELETED, publishGeometry)

        const resizeObserver = new ResizeObserver(() => map.invalidateSize())
        resizeObserver.observe(mapContainer.current)
        overlaysRef.current.forEach(({ geometry: overlayGeometry, count = 1, name = 'Target area' }) => {
            const coordinates = toLeafletCoordinates(overlayGeometry)
            for (let index = 0; index < count && coordinates.length > 0; index += 1) {
                L.polygon(coordinates, {
                    color: '#dc2626',
                    fillColor: '#ef4444',
                    fillOpacity: 0.2,
                    weight: 2
                }).bindTooltip(`${name}${count > 1 ? ` × ${count}` : ''}`).addTo(overlayGroup)
            }
        })

        return () => {
            resizeObserver.disconnect()
            focusMarkerRef.current = null
            featureGroupRef.current = null
            overlayGroupRef.current = null
            mapRef.current = null
            map.remove()
        }
    }, [editable, weatherLayer])

    useEffect(() => {
        const map = mapRef.current
        if (!map || !focusLocation) {
            focusMarkerRef.current?.remove()
            focusMarkerRef.current = null
            return
        }

        const { latitude, longitude } = focusLocation
        if (
            !Number.isFinite(latitude)
            || !Number.isFinite(longitude)
            || latitude < -90
            || latitude > 90
            || longitude < -180
            || longitude > 180
        ) {
            return
        }

        // Keep the reference pin separate from the editable polygon so locating a report cannot change saved geometry.
        focusMarkerRef.current?.remove()
        focusMarkerRef.current = L.circleMarker([latitude, longitude], {
            radius: 8,
            color: '#ffffff',
            weight: 3,
            fillColor: '#dc2626',
            fillOpacity: 1
        })
            .bindTooltip(`Reference location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
            .addTo(map)
        map.setView([latitude, longitude], Math.max(map.getZoom(), 13))
    }, [focusLocation, weatherLayer])

    return (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div ref={mapContainer} style={{ height, width: '100%' }} />
            {editable && (
                <button
                    type="button"
                    onClick={() => {
                        featureGroupRef.current?.clearLayers()
                        changeHandler.current?.(null)
                    }}
                    className="absolute left-3 top-3 z-[1000] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-700 shadow hover:bg-slate-50"
                >
                    <Trash2 size={14} /> Clear
                </button>
            )}
            {weatherError && weatherLayer && (
                <p role="status" className="border-t border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {weatherError}
                </p>
            )}
        </div>
    )
}

export default TargetAreaMap
