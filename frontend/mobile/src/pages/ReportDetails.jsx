import { useParams } from 'react-router-dom'

export default function ReportDetails() {
    const { reportId } = useParams()

    const report = {
        id: reportId || 'A-101',
        title: 'Flooded road near market',
        hazardType: 'Flood',
        status: 'Verified',
        description:
            'Severe water accumulation on the main access road near the market area, making it difficult for vehicles to pass.',
        location: 'Ward 4, Central Market',
    }

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-6">
            <div className="mx-auto max-w-md rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Report {report.id}
                </p>
                <h1 className="mt-2 text-2xl font-bold text-slate-900">{report.title}</h1>

                <div className="mt-4 flex items-center gap-2">
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                        {report.hazardType}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        {report.status}
                    </span>
                </div>

                <div className="mt-6 space-y-4 text-sm text-slate-700">
                    <div>
                        <p className="font-semibold text-slate-900">Location</p>
                        <p className="mt-1">{report.location}</p>
                    </div>

                    <div>
                        <p className="font-semibold text-slate-900">Description</p>
                        <p className="mt-1 leading-6">{report.description}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
