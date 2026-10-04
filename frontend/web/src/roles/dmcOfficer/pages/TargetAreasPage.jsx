import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MapPin, Plus, Users } from 'lucide-react'
import api from '../../../services/api'
import TargetAreaMap from '../components/TargetAreaMap'

const areaLabels = {
    'river-flood': 'River / Flood Risk',
    coastal: 'Coastal Risk',
    landslide: 'Landslide Risk',
    storm: 'Storm Risk',
    tsunami: 'Tsunami Risk',
    other: 'Other'
}

function TargetAreasPage() {
    const location = useLocation()
    const [areas, setAreas] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        api.get('/dmcofficer/target-areas')
            .then(({ data }) => {
                if (active) setAreas(data.targetAreas)
            })
            .catch((requestError) => {
                if (active) {
                    setError(
                        requestError.response?.data?.message
                        || 'Could not load target areas.'
                    )
                }
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
        }
    }, [])

    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Risk mapping</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">Target Areas</h1>
                    <p className="mt-2 text-slate-600">View boundaries and matched citizen counts.</p>
                </div>
                <Link
                    to="/dmcofficer/target-areas/create"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                >
                    <Plus size={17} /> Create Target Area
                </Link>
            </div>

            {location.state?.created && (
                <p role="status" className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                    Target area created and matched with citizens who shared locations inside its boundary.
                </p>
            )}
            {error && <p role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
            {loading ? (
                <p className="mt-8 text-sm text-slate-600">Loading target areas…</p>
            ) : areas.length === 0 ? (
                <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                    <MapPin className="mx-auto text-slate-400" size={30} />
                    <h2 className="mt-4 font-semibold text-slate-900">No target areas yet</h2>
                    <p className="mt-2 text-sm text-slate-600">Draw a risk boundary to identify citizens in affected locations.</p>
                </section>
            ) : (
                <section className="mt-8 grid gap-5 xl:grid-cols-2">
                    {areas.map((area) => (
                        <article key={area._id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">{area.name}</h2>
                                    <p className="mt-1 text-sm text-slate-600">{areaLabels[area.areaType] || area.areaType}</p>
                                </div>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800">
                                    <Users size={15} /> {area.citizenCount} citizens
                                </span>
                            </div>
                            <div className="px-5 pb-5">
                                <TargetAreaMap geometry={area.geometry} height="260px" />
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {area.hazardTypes.map((hazard) => (
                                        <span key={hazard} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                                            {hazard}
                                        </span>
                                    ))}
                                </div>
                                {area.description && <p className="mt-3 text-sm leading-6 text-slate-600">{area.description}</p>}
                                <p className="mt-3 text-xs text-slate-500">
                                    Created by {area.createdBy?.name || 'DMC Officer'} · {new Date(area.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        </article>
                    ))}
                </section>
            )}
        </main>
    )
}

export default TargetAreasPage
