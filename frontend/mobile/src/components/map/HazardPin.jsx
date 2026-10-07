import L from 'leaflet'
import { Marker } from 'react-leaflet'

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

export default function HazardPin({ location }) {
    if (!location) return null

    return (
        <Marker
            position={[location.lat, location.lng]}
            icon={hazardIcon}
        />
    )
}