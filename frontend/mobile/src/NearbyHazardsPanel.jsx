import { useEffect, useState } from 'react'
import { Hospital, Megaphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from './authContext'
import { CITIZEN_ROLE } from './constants/roles'
import api from './services/api'
import NearbyHazardsMap from './NearbyHazardsMap'

const radii = [2, 5, 10, 25, 50]

function NearbyHazardsPanel({ fullPage = false }) {
    const { user } = useAuth()
    const [radiusKm, setRadiusKm] = useState(5)
    const [nearbyData, setNearbyData] = useState(null)
    const [loadedNearbyRadius, setLoadedNearbyRadius] = useState(null)
    const [nearbyError, setNearbyError] = useState('')
    const [showFacilities, setShowFacilities] = useState(true)
    const [facilities, setFacilities] = useState([])
    const [facilitiesError, setFacilitiesError] = useState('')
    const [loadedFacilitiesRadius, setLoadedFacilitiesRadius] = useState(null)

    useEffect(() => {
        if (!user || user.role !== CITIZEN_ROLE) return undefined
        let active = true
        api.get('/citizen/nearby-hazards', { params: { radiusKm } })
            .then(({ data }) => {
                if (!active) return
                setNearbyData(data)
                setNearbyError('')
            })
            .catch((requestError) => {
                if (!active) return
                setNearbyData(null)
                setNearbyError(
                    requestError.response?.data?.message
                    || 'Could not load nearby hazards.'
                )
            })
            .finally(() => {
                if (active) setLoadedNearbyRadius(radiusKm)
            })
        return () => {
            active = false
        }
    }, [user, radiusKm])

    useEffect(() => {
        if (!user || user.role !== CITIZEN_ROLE || !showFacilities) return undefined
        let active = true
        api.get('/citizen/nearby-facilities', { params: { radiusKm } })
            .then(({ data }) => {
                if (!active) return
                setFacilities(data.facilities)
                setFacilitiesError('')
            })
            .catch((requestError) => {
                if (!active) return
                setFacilities([])
                setFacilitiesError(
                    requestError.response?.data?.message
                    || 'Could not load nearby shelters and hospitals.'
                )
            })
            .finally(() => {
                if (active) setLoadedFacilitiesRadius(radiusKm)
            })
        return () => {
            active = false
        }
    }, [user, radiusKm, showFacilities])

    const nearbyLoading = loadedNearbyRadius !== radiusKm
    const facilitiesLoading = showFacilities && loadedFacilitiesRadius !== radiusKm
    const content = (
        <section className={`overflow-hidden border border-slate-200 bg-white shadow-sm ${fullPage ? 'rounded-3xl' : 'mx-5 mt-2 rounded-2xl'}`}>
            <div className="p-4">
                <h2 className="text-lg font-bold text-slate-950">Hazards around you</h2>
                <p className="mt-1 text-sm text-slate-600">
                    <span className="font-bold text-slate-900">
                        {nearbyLoading ? 'Loading…' : `${nearbyData?.total ?? 0} active hazards`}
                    </span>
                    {' '}within {radiusKm} km
                </p>
                <Link
                    to="/report"
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800"
                >
                    <Megaphone size={17} aria-hidden="true" />
                    Report hazard
                </Link>

                <div className="mt-4 grid grid-cols-5 rounded-xl bg-slate-100 p-1">
                    {radii.map((radius) => (
                        <button
                            key={radius}
                            type="button"
                            aria-pressed={radiusKm === radius}
                            onClick={() => setRadiusKm(radius)}
                            className={`min-h-9 rounded-lg text-xs font-semibold transition ${radiusKm === radius ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-700 hover:bg-white/60'}`}
                        >
                            {radius} km
                        </button>
                    ))}
                </div>

                <label className="mt-3 flex min-h-10 cursor-pointer items-center gap-3">
                    <input
                        type="checkbox"
                        checked={showFacilities}
                        onChange={(event) => setShowFacilities(event.target.checked)}
                        className="peer sr-only"
                    />
                    <span className="relative h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-teal-700">
                        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                    </span>
                    <span className="text-sm text-slate-700">Shelters &amp; hospitals</span>
                    <Hospital size={16} className="ml-auto text-slate-500" aria-hidden="true" />
                </label>
            </div>

            {nearbyError ? (
                <p role="alert" className="mx-4 mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                    {nearbyError}
                </p>
            ) : nearbyData && !nearbyLoading && (
                <>
                    <NearbyHazardsMap
                        center={nearbyData.center}
                        radiusKm={radiusKm}
                        hazards={nearbyData.hazards}
                        facilities={showFacilities && loadedFacilitiesRadius === radiusKm ? facilities : []}
                    />
                    <div className="space-y-3 border-t border-slate-100 p-4">
                        {showFacilities && facilitiesError && (
                            <p role="status" className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900">
                                {facilitiesError}
                            </p>
                        )}
                        {facilitiesLoading && (
                            <p className="text-xs text-slate-500">Loading nearby shelters and hospitals…</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-3 w-3 rounded-full bg-red-600" /> High
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-3 w-3 rounded-full bg-amber-500" /> Moderate
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-3 w-3 rounded-full border-2 border-slate-500" /> Low
                            </span>
                            {showFacilities && (
                                <>
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="flex h-3 w-3 items-center justify-center rounded-sm bg-teal-700 text-[8px] text-white">+</span> Shelter
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="flex h-3 w-3 items-center justify-center rounded-sm bg-slate-800 text-[8px] text-white">H</span> Hospital
                                    </span>
                                </>
                            )}
                            <span className="inline-flex items-center gap-1.5">
                                <span className="h-3 w-3 rounded-full bg-blue-600" /> You
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-500">Map data &copy; OpenStreetMap contributors</p>
                        {!fullPage && (
                            <Link to="/map" className="inline-flex items-center gap-1 text-sm font-semibold text-teal-800">
                                Open full map <span aria-hidden="true">→</span>
                            </Link>
                        )}
                    </div>
                </>
            )}
        </section>
    )

    if (!fullPage) return content
    return (
        <section className="px-5 pb-6 pt-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Local safety</p>
            <h1 className="mb-4 mt-1 text-2xl font-bold text-slate-950">Nearby hazards</h1>
            {content}
        </section>
    )
}

export default NearbyHazardsPanel
