import { useEffect, useState } from 'react'
import {
    CheckCircle,
    Crosshair,
    LoaderCircle,
    MapPin
} from 'lucide-react'
import HazardLocationMap from '../map/HazardLocationMap'
import { getCurrentLocation } from '../../services/locationService'

export default function LocationStep({
    location,
    onChange
}) {
    const [currentLocation, setCurrentLocation] = useState(null)
    const [mode, setMode] = useState('detecting')
    const [error, setError] = useState('')

    const detectLocation = async () => {
        setMode('detecting')
        setError('')

        try {
            const position = await getCurrentLocation()

            setCurrentLocation(position)

            onChange({
                coords: {
                    lat: position.lat,
                    lng: position.lng
                },
                source: 'gps',
                accuracyM: position.accuracyM
            })

            setMode('detected')
        } catch (err) {
            setError(err.message)
            setMode('manual')
        }
    }

    useEffect(() => {
        if (!currentLocation && !location) {
            detectLocation()
        }
    }, [])

    const handleMapPick = (coords) => {
        onChange({
            coords,
            source: 'manual',
            accuracyM: null
        })

        setMode('manual')
        setError('')
    }

    const useCurrentLocation = async () => {
        await detectLocation()
    }

    return (
        <div>
            <h2 className="text-xl font-bold text-gray-900">
                Where is the hazard?
            </h2>

            <p className="mt-1 text-gray-600">
                Use your current location or tap the map to mark the
                actual place where the disaster is happening.
            </p>

            <div className="mt-5">
                {mode === 'detecting' && (
                    <div className="flex items-center gap-3 rounded-xl bg-gray-100 p-4">
                        <LoaderCircle className="h-6 w-6 animate-spin" />

                        <div>
                            <p className="font-semibold">
                                Detecting your location...
                            </p>

                            <p className="text-sm text-gray-600">
                                Please allow location access.
                            </p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {location && (
                    <div className="mt-3 flex items-start gap-3 rounded-xl bg-green-50 p-4">
                        {location.source === 'gps' ? (
                            <CheckCircle className="h-6 w-6 text-green-600" />
                        ) : (
                            <MapPin className="h-6 w-6 text-red-600" />
                        )}

                        <div>
                            <p className="font-bold text-gray-900">
                                {location.source === 'gps'
                                    ? 'Current location selected'
                                    : 'Hazard location pinned'}
                            </p>

                            <p className="text-sm text-gray-600">
                                Latitude: {location.coords.lat.toFixed(6)}
                                <br />
                                Longitude: {location.coords.lng.toFixed(6)}
                            </p>

                            {location.source === 'gps' &&
                                location.accuracyM && (
                                    <p className="mt-1 text-xs text-gray-500">
                                        Accuracy: approximately{' '}
                                        {Math.round(location.accuracyM)} m
                                    </p>
                                )}
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-4 h-72 overflow-hidden rounded-xl border">
                <HazardLocationMap
                    currentLocation={currentLocation}
                    hazardLocation={location?.coords}
                    onPick={handleMapPick}
                />
            </div>

            <div className="mt-4 flex flex-col gap-3">
                <button
                    type="button"
                    onClick={useCurrentLocation}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 font-semibold"
                >
                    <Crosshair className="h-5 w-5" />
                    Use my current location
                </button>

                <p className="text-center text-sm text-gray-500">
                    Or tap anywhere on the map to select the actual
                    disaster location.
                </p>
            </div>
        </div>
    )
}