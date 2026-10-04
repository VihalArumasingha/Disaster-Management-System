import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, MapPin, Users } from 'lucide-react'
import api from '../../../services/api'
import TargetAreaMap from '../components/TargetAreaMap'

const areaTypes = [
    ['river-flood', 'River / Flood Risk'],
    ['coastal', 'Coastal Risk'],
    ['landslide', 'Landslide Risk'],
    ['storm', 'Storm Risk'],
    ['tsunami', 'Tsunami Risk'],
    ['other', 'Other']
]
const hazardTypes = ['flood', 'landslide', 'tsunami', 'storm', 'other']

const calculateAreaKm2 = (geometry) => {
    const ring = geometry?.coordinates?.[0]
    if (!ring || ring.length < 4) return 0

    const meanLatitude = ring.reduce((sum, point) => sum + point[1], 0) / ring.length
    const xScale = 111.32 * Math.cos((meanLatitude * Math.PI) / 180)
    const yScale = 110.574
    let twiceArea = 0

    for (let index = 0; index < ring.length - 1; index += 1) {
        const [x1, y1] = ring[index]
        const [x2, y2] = ring[index + 1]
        twiceArea += (x1 * xScale * yScale) * y2 - (x2 * xScale * yScale) * y1
    }

    return Math.abs(twiceArea / 2)
}

function CreateTargetAreaPage() {
    const navigate = useNavigate()
    const [form, setForm] = useState({
        name: '',
        areaType: 'river-flood',
        hazardTypes: ['flood'],
        description: ''
    })
    const [geometry, setGeometry] = useState(null)
    const [weatherLayer, setWeatherLayer] = useState('')
    const [citizenCount, setCitizenCount] = useState(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleGeometryChange = (nextGeometry) => {
        setGeometry(nextGeometry)
        setError('')
        setPreviewLoading(false)
    }

    useEffect(() => {
        if (!geometry) return undefined

        let active = true
        const timer = setTimeout(() => {
            setPreviewLoading(true)
            api.post('/dmcofficer/target-areas/preview', { geometry })
                .then(({ data }) => {
                    if (active) setCitizenCount(data.citizenCount)
                })
                .catch((requestError) => {
                    if (active) {
                        setCitizenCount(null)
                        setError(
                            requestError.response?.data?.message
                            || 'Could not estimate affected citizens.'
                        )
                    }
                })
                .finally(() => {
                    if (active) setPreviewLoading(false)
                })
        }, 350)

        return () => {
            active = false
            clearTimeout(timer)
        }
    }, [geometry])

    const toggleHazard = (hazard) => {
        setForm((current) => ({
            ...current,
            hazardTypes: current.hazardTypes.includes(hazard)
                ? current.hazardTypes.filter((item) => item !== hazard)
                : [...current.hazardTypes, hazard]
        }))
    }

    const saveArea = async (event) => {
        event.preventDefault()
        setError('')
        if (!geometry) {
            setError('Draw a polygon around the target area before creating it.')
            return
        }
        if (form.hazardTypes.length === 0) {
            setError('Select at least one hazard type.')
            return
        }

        setSubmitting(true)
        try {
            await api.post('/dmcofficer/target-areas', {
                ...form,
                geometry
            })
            navigate('/dmcofficer/target-areas', {
                replace: true,
                state: { created: true }
            })
        } catch (requestError) {
            setError(
                requestError.response?.data?.message
                || 'Could not create the target area. Please try again.'
            )
        } finally {
            setSubmitting(false)
        }
    }

    const vertexCount = geometry?.coordinates?.[0]
        ? geometry.coordinates[0].length - 1
        : 0
    const areaKm2 = calculateAreaKm2(geometry)

    return (
        <main className="mx-auto max-w-6xl px-4 pb-12 pt-20 sm:px-8 lg:pt-10">
            <Link to="/dmcofficer/target-areas" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-700">
                <ArrowLeft size={16} /> Target Areas
            </Link>
            <div className="mt-5">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Risk mapping</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Create Target Area</h1>
                <p className="mt-2 text-slate-600">Define a risk boundary and match citizens who shared a location inside it.</p>
            </div>

            {error && (
                <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    {error}
                </p>
            )}

            <form onSubmit={saveArea} className="mt-7 space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="grid gap-5 md:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-800">
                        Area Name <span className="text-red-600">*</span>
                        <input
                            required
                            maxLength={120}
                            value={form.name}
                            onChange={(event) => setForm({ ...form, name: event.target.value })}
                            placeholder="e.g. Galani River Basin"
                            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>
                    <label className="block text-sm font-semibold text-slate-800">
                        Area Type <span className="text-red-600">*</span>
                        <select
                            value={form.areaType}
                            onChange={(event) => setForm({ ...form, areaType: event.target.value })}
                            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        >
                            {areaTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    </label>
                </div>

                <fieldset>
                    <legend className="text-sm font-semibold text-slate-800">
                        Hazard Types <span className="text-red-600">*</span>
                    </legend>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {hazardTypes.map((hazard) => (
                            <label
                                key={hazard}
                                className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm capitalize ${
                                    form.hazardTypes.includes(hazard)
                                        ? 'border-blue-300 bg-blue-50 text-blue-800'
                                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={form.hazardTypes.includes(hazard)}
                                    onChange={() => toggleHazard(hazard)}
                                    className="accent-blue-700"
                                />
                                {hazard}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <label className="block text-sm font-semibold text-slate-800">
                    Description
                    <textarea
                        rows={3}
                        maxLength={2000}
                        value={form.description}
                        onChange={(event) => setForm({ ...form, description: event.target.value })}
                        placeholder="Describe the risk area and any useful context."
                        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                    />
                </label>

                <section>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                        <div>
                            <h2 className="text-sm font-semibold text-slate-800">Define Area on Map <span className="text-red-600">*</span></h2>
                            <p className="mt-1 text-xs text-slate-500">
                                Use the polygon draw tool to outline the affected boundary. OpenWeather layer is optional.
                            </p>
                        </div>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                            Weather layer
                            <select
                                value={weatherLayer}
                                onChange={(event) => setWeatherLayer(event.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800"
                            >
                                <option value="">None</option>
                                <option value="precipitation">OpenWeather precipitation</option>
                                <option value="clouds">OpenWeather clouds</option>
                                <option value="temperature">OpenWeather temperature</option>
                            </select>
                        </label>
                    </div>
                    <div className="mt-3">
                        <TargetAreaMap
                            geometry={geometry}
                            onChange={handleGeometryChange}
                            weatherLayer={weatherLayer}
                            editable
                            height="min(60vh, 520px)"
                        />
                    </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-2" aria-live="polite">
                    <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4">
                        <MapPin className="shrink-0 text-blue-700" size={21} />
                        <div>
                            <p className="text-xs font-medium text-slate-600">Selected Area</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {vertexCount ? `${vertexCount} vertices · approx. ${areaKm2.toFixed(1)} km²` : 'Draw a polygon on the map'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-blue-50 p-4">
                        <Users className="shrink-0 text-blue-700" size={21} />
                        <div>
                            <p className="text-xs font-medium text-slate-600">Estimated Citizens</p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                                {previewLoading ? 'Checking locations…' : citizenCount ?? 'Draw area to estimate'}
                            </p>
                        </div>
                    </div>
                </section>
                <p className="text-xs leading-5 text-slate-500">
                    Counts include only citizen accounts with a shared location inside this boundary. Citizens who skipped location sharing will not be included.
                </p>

                <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row">
                    <Link
                        to="/dmcofficer/target-areas"
                        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                        Cancel
                    </Link>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="min-h-11 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? 'Creating…' : 'Create Target Area'}
                    </button>
                </div>
            </form>
        </main>
    )
}

export default CreateTargetAreaPage
