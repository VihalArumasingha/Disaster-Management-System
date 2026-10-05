import { useEffect } from 'react'
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

const currentLocationIcon = L.divIcon({
    className: 'current-location-marker',
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
    className: 'hazard-location-marker',
    html: `
        <div style="
            width: 34px;
            height: 34px;
            border-radius: 50% 50% 50% 0;
            background: #dc2626;
            border: 3px solid white;
            transform: rotate(-45deg);
            box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        ">
            <div style="
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: white;
                position: absolute;
                top: 9px;
                left: 9px;
            "></div>
        </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34]
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

function MapCenter({ center }) {
    const map = useMap()

    useEffect(() => {
        if (!center) return

        map.setView(
            [center.lat, center.lng],
            Math.max(map.getZoom(), 14)
        )
    }, [center, map])

    return null
}

export default function HazardLocationMap({
    currentLocation,
    hazardLocation,
    onPick,
    radiusKm = 1
}) {
    const fallbackCenter = currentLocation || {
        lat: 7.8731,
        lng: 80.7718
    }

    return (
        <MapContainer
            center={[
                fallbackCenter.lat,
                fallbackCenter.lng
            ]}
            zoom={14}
            scrollWheelZoom={true}
            className="h-full w-full"
        >
            <TileLayer
                attribution='&copy; OpenStreetMap contributors'
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
                        radius={radiusKm * 1000}
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

            <MapCenter center={hazardLocation || currentLocation} />
        </MapContainer>
    )
}