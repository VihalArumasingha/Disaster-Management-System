import { CheckCircle2, Clock3, WifiOff } from 'lucide-react'

export default function ReportStatusCard({
    report,
    savedOffline = false,
    onAnotherReport,
}) {
    const capturedAt = report?.capturedAt
        ? new Date(report.capturedAt).toLocaleString()
        : 'Unknown'

    if (savedOffline) {
        return (
            <section className="mx-auto max-w-md rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100">
                        <WifiOff
                            size={22}
                            className="text-amber-700"
                        />
                    </div>

                    <div>
                        <h2 className="text-lg font-bold text-[#10233F]">
                            Report saved offline
                        </h2>

                        <p className="mt-1 text-sm leading-5 text-[#244B78]">
                            Your report is safely stored on this device and
                            will be submitted automatically when your
                            connection returns.
                        </p>
                    </div>
                </div>

                <div className="mt-5 rounded-xl bg-[#FFF8E7] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                        <Clock3 size={16} />
                        Waiting to sync
                    </div>

                    <p className="mt-2 text-xs leading-5 text-amber-700">
                        Captured: {capturedAt}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-amber-700">
                        The report will remain stored until the server
                        confirms successful submission.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onAnotherReport}
                    className="mt-5 min-h-[44px] w-full rounded-[10px] bg-[#0F8179] px-4 text-sm font-bold text-white"
                >
                    Report another hazard
                </button>
            </section>
        )
    }

    return (
        <section className="mx-auto max-w-md rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2
                        size={23}
                        className="text-green-700"
                    />
                </div>

                <div>
                    <h2 className="text-lg font-bold text-[#10233F]">
                        Report submitted
                    </h2>

                    <p className="mt-1 text-sm leading-5 text-[#244B78]">
                        Your hazard report has been submitted successfully
                        and is now pending verification.
                    </p>
                </div>
            </div>

            <div className="mt-5 rounded-xl bg-[#F4F6F9] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#10233F]">
                    <Clock3 size={16} />
                    Pending verification
                </div>

                <p className="mt-2 text-xs leading-5 text-[#244B78]">
                    Captured: {capturedAt}
                </p>
            </div>

            <button
                type="button"
                onClick={onAnotherReport}
                className="mt-5 min-h-[44px] w-full rounded-[10px] bg-[#0F8179] px-4 text-sm font-bold text-white"
            >
                Report another hazard
            </button>
        </section>
    )
}