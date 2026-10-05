import {
    MapContainer,
    TileLayer,
    Marker,
    Circle,
    useMap,
    useMapEvents
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'

const currentLocationIcon = L.divIcon({
    className: '',
    html: `
        <div style="
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #2563eb;
            border: 3px solid white;
            box-shadow: 0 1px 6px rgba(0,0,0,0.35);
        "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
})

const hazardIcon = L.divIcon({
    className: '',
    html: `
        <div style="
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            background: #dc2626;
            border: 3px solid white;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
            position: relative;
        ">
            <div style="
                width: 9px;
                height: 9px;
                border-radius: 50%;
                background: white;
                position: absolute;
                top: 8px;
                left: 8px;
            "></div>
        </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32]
})

function MapClickHandler({ onPick }) {
    useMapEvents({
        click(event) {
            onPick({
                lat: event.latlng.lat,
                lng: event.latlng.lng
            })
        }
    })

    return null
}

function MapCenter({ location }) {
    const map = useMap()

    useEffect(() => {
        if (!location) return

        map.setView(
            [location.lat, location.lng],
            Math.max(map.getZoom(), 14)
        )
    }, [location, map])

    return null
}

export default function HazardLocationMap({
    currentLocation,
    hazardLocation,
    onPick
}) {
    const initialLocation = currentLocation || {
        lat: 7.8731,
        lng: 80.7718
    }

    return (
        <MapContainer
            center={[
                initialLocation.lat,
                initialLocation.lng
            ]}
            zoom={14}
            scrollWheelZoom
            className="h-full w-full"
        >
            <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler onPick={onPick} />

            {currentLocation && (
                <>
                    <Marker
                        position={[
                            currentLocation.lat,
                            currentLocation.lng
                        ]}
                        icon={currentLocationIcon}
                    />

                    <Circle
                        center={[
                            currentLocation.lat,
                            currentLocation.lng
                        ]}
                        radius={1000}
                        pathOptions={{
                            color: '#2563eb',
                            fillOpacity: 0.05
                        }}
                    />
                </>
            )}

            {hazardLocation && (
                <Marker
                    position={[
                        hazardLocation.lat,
                        hazardLocation.lng
                    ]}
                    icon={hazardIcon}
                />
            )}

            <MapCenter
                location={hazardLocation || currentLocation}
            />
        </MapContainer>
    )
}