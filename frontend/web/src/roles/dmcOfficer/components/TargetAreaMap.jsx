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
    onChange,
    weatherLayer = '',
    editable = false,
    height = '420px'
}) {
    const mapContainer = useRef(null)
    const featureGroupRef = useRef(null)
    const changeHandler = useRef(onChange)
    const geometryRef = useRef(geometry)
    const [weatherError, setWeatherError] = useState('')

    useEffect(() => {
        changeHandler.current = onChange
    }, [onChange])

    useEffect(() => {
        geometryRef.current = geometry
    }, [geometry])

    useEffect(() => {
        if (!mapContainer.current) return undefined

        const map = L.map(mapContainer.current, {
            scrollWheelZoom: true
        }).setView([6.9271, 79.8612], 10)
        L.tileLayer(
            'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors'
            }
        ).addTo(map)
        const featureGroup = new L.FeatureGroup().addTo(map)
        featureGroupRef.current = featureGroup

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

        return () => {
            resizeObserver.disconnect()
            featureGroupRef.current = null
            map.remove()
        }
    }, [editable, weatherLayer])

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
