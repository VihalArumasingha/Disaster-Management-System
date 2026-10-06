import L from 'leaflet'
import { Marker, Circle } from 'react-leaflet'

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

export default function CurrentLocationMarker({ location }) {
    if (!location) return null

    return (
        <>
            <Marker
                position={[location.lat, location.lng]}
                icon={currentLocationIcon}
            />

            <Circle
                center={[location.lat, location.lng]}
                radius={1000}
                pathOptions={{
                    color: '#2563eb',
                    fillOpacity: 0.05
                }}
            />
        </>
    )
}