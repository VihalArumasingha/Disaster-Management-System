import { useEffect, useState } from 'react'
import { CheckCircle, Crosshair, LoaderCircle, MapPin } from 'lucide-react'
import HazardLocationMap from '../map/HazardLocationMap'
import { getCurrentLocation } from '../../services/locationService'

const coordinatesForDisplay = ({ latitude, longitude }) => (
    `${Math.abs(latitude).toFixed(5)}°${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(5)}°${longitude >= 0 ? 'E' : 'W'}`
)

export default function LocationStep({ location, onChange }) {
    const [currentLocation, setCurrentLocation] = useState(location ? { lat: location.latitude, lng: location.longitude } : null)
    const [mode, setMode] = useState(location ? 'detected' : 'detecting')
    const [error, setError] = useState('')

    const detectLocation = async () => {
        setMode('detecting')
        setError('')

        try {
            const position = await getCurrentLocation()
            setCurrentLocation({ lat: position.lat, lng: position.lng })
            onChange({ latitude: position.lat, longitude: position.lng, accuracy: position.accuracyM, source: 'gps' })
            setMode('detected')
        } catch (err) {
            setError(err.message)
            setMode('error')
        }
    }

    useEffect(() => {
        if (location) return undefined
        let active = true

        getCurrentLocation()
            .then((position) => {
                if (!active) return
                setCurrentLocation({ lat: position.lat, lng: position.lng })
                onChange({ latitude: position.lat, longitude: position.lng, accuracy: position.accuracyM, source: 'gps' })
                setMode('detected')
            })
            .catch((err) => {
                if (!active) return
                setError(err.message)
                setMode('error')
            })

        return () => { active = false }
    }, [location, onChange])

    const handleMapPick = (coords) => {
        onChange({ latitude: coords.lat, longitude: coords.lng, accuracy: null, source: 'manual' })
        setMode('manual')
        setError('')
    }

    return (
        <section className="rounded-2xl border border-[#DCE4ED] bg-white p-4 shadow-[0_1px_2px_rgba(16,35,63,0.08)]">
            <h2 className="text-[17px] font-bold leading-6 text-[#10233F]">Where is the hazard?</h2>
            <p className="mt-1 text-sm leading-5 text-[#244B78]">We use your GPS location so officers know exactly where to look.</p>

            {mode === 'detecting' && (
                <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#F0F4F8] p-4" role="status">
                    <LoaderCircle className="h-5 w-5 animate-spin text-[#0F8F83]" />
                    <span className="text-sm font-semibold text-[#10233F]">Detecting your location...</span>
                </div>
            )}

            {error && (
                <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm leading-5 text-red-800">{error} Tap the map to pin the hazard location.</div>
            )}

            {location && (
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-[#E7F4EC] p-3.5">
                    {location.source === 'gps' ? <CheckCircle size={20} className="mt-0.5 shrink-0 text-[#14804A]" /> : <MapPin size={20} className="mt-0.5 shrink-0 text-[#0F8F83]" />}
                    <div className="min-w-0 text-[13px] leading-5 text-[#10233F]">
                        <p className="font-bold">{location.source === 'gps' ? 'Location detected' : 'Location pinned manually'}</p>
                        <p>{location.source === 'gps' ? 'Current GPS location' : 'Selected map location'}{location.accuracy ? ` · accurate to ${Math.round(location.accuracy)} m` : ''}</p>
                        <p className="break-words text-[#244B78]">{coordinatesForDisplay(location)}</p>
                    </div>
                </div>
            )}

            <div className="mt-3 h-[212px] overflow-hidden rounded-xl border border-[#DCE4ED]">
                <HazardLocationMap
                    currentLocation={currentLocation}
                    hazardLocation={location ? { lat: location.latitude, lng: location.longitude } : null}
                    onPick={handleMapPick}
                />
            </div>

            <p className="mt-3 text-[13px] text-[#244B78]">GPS unavailable or not accurate?</p>
            <button type="button" onClick={() => { setMode('manual'); setError('') }} className="mt-1 inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-[#006C68] underline underline-offset-2">
                Pin location manually
            </button>
            {mode === 'manual' && !location && <p className="text-xs text-[#244B78]">Tap the map to place the hazard pin.</p>}
            {mode === 'error' && <button type="button" onClick={detectLocation} className="ml-3 inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-[#244B78]"><Crosshair size={15} /> Try GPS again</button>}
        </section>
    )
}