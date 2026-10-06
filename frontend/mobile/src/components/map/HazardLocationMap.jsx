import {
    MapContainer,
    TileLayer,
    useMap,
    useMapEvents
} from 'react-leaflet'

import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'

import CurrentLocationMarker from './CurrentLocationMarker'
import HazardPin from './HazardPin'


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

            {/* OpenStreetMap */}
            <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* User selects hazard location */}
            <MapClickHandler onPick={onPick} />

            {/* Current GPS location */}
            <CurrentLocationMarker
                location={currentLocation}
            />

            {/* Selected hazard location */}
            <HazardPin
                location={hazardLocation}
            />

            {/* Keep map centered on selected location */}
            <MapCenter
                location={hazardLocation || currentLocation}
            />

        </MapContainer>
    )
}