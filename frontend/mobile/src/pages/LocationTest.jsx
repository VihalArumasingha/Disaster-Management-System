import { useState } from 'react'
import LocationStep from '../components/hazard/LocationStep'

export default function LocationTest() {
    const [location, setLocation] = useState(null)

    return (
        <div className="min-h-screen bg-gray-50 px-4 py-6">
            <div className="mx-auto max-w-xl">
                <LocationStep
                    location={location}
                    onChange={setLocation}
                />

                {location && (
                    <div className="mt-6 rounded-xl bg-gray-900 p-4 text-sm text-white">
                        <p className="mb-2 font-semibold">
                            Test data being produced:
                        </p>

                        <pre className="overflow-x-auto">
                            {JSON.stringify(location, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    )
}