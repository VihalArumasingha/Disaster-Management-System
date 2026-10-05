export default function MyReports() {
    const reports = [
        { id: 'A-101', title: 'Flooded road near market', status: 'Verified' },
        { id: 'A-102', title: 'Power outage in housing block', status: 'In review' },
        { id: 'A-103', title: 'Blocked bridge after storm', status: 'Resolved' },
    ]

    return (
        <div className="min-h-screen bg-slate-50 px-4 py-6">
            <div className="mx-auto max-w-md">
                <div className="mb-5 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-slate-900">My reports</h1>
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                        {reports.length} active
                    </span>
                </div>

                <div className="space-y-3">
                    {reports.map((report) => (
                        <div
                            key={report.id}
                            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                        {report.id}
                                    </p>
                                    <h2 className="mt-1 text-base font-semibold text-slate-800">
                                        {report.title}
                                    </h2>
                                </div>
                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                                    {report.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
