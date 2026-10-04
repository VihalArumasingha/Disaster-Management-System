import { AlertTriangle, ClipboardList } from 'lucide-react'

function EscalatedReportsPage() {
    return (
        <main className="mx-auto max-w-7xl px-5 pb-12 pt-20 sm:px-8 lg:pt-10">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">Incident management</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Escalated Reports</h1>
            <p className="mt-2 text-slate-600">Reports escalated for review by the DMC.</p>

            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="mx-auto max-w-lg py-8 text-center">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-700">
                        <AlertTriangle size={25} />
                    </span>
                    <h2 className="mt-5 text-lg font-semibold text-slate-900">No escalated reports to review</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        Escalated citizen incident reports will appear here when the reporting workflow is connected.
                    </p>
                    <div className="mt-5 inline-flex items-center gap-2 text-xs text-slate-500">
                        <ClipboardList size={15} /> This page is ready for the incident-report integration.
                    </div>
                </div>
            </section>
        </main>
    )
}

export default EscalatedReportsPage
