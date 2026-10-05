import { Check, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'

const hazardTitle = (value) => ({
	flood: 'Flood',
	landslide: 'Landslide',
	road_blockage: 'Road Blockage',
	other: 'Other'
}[value] || value)

export default function ReportStatusCard({ report, onAnotherReport }) {
	const captured = new Date(report.capturedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

	return (
		<section className="rounded-2xl border border-[#DCE4ED] bg-white p-4 shadow-[0_1px_2px_rgba(16,35,63,0.08)]">
			<span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#E2F4F1] text-[#006C68]">
				<Check size={25} strokeWidth={2.5} />
			</span>
			<h1 className="mt-3 text-[20px] font-bold leading-7 text-[#10233F]">Report submitted</h1>
			<p className="mt-1 text-sm leading-[21px] text-[#244B78]">
				An officer will review it alongside other reports from the same area. We'll notify you when it's verified.
			</p>

			<div className="mt-5 grid grid-cols-3 gap-2 text-[11px] leading-4 text-[#10233F]">
				<div><span className="mb-1 block h-1 rounded-full bg-[#16834A]" />Submitted</div>
				<div><span className="mb-1 block h-1 rounded-full bg-[#10203B]" />Pending<br />verification</div>
				<div><span className="mb-1 block h-1 rounded-full bg-[#E1E8F0]" />Verified</div>
			</div>

			<dl className="mt-5 space-y-3 rounded-xl bg-[#F0F4F8] p-3.5 text-sm">
				<div><dt className="text-xs text-[#244B78]">Hazard</dt><dd className="font-semibold text-[#10233F]">{hazardTitle(report.hazardType)}</dd></div>
				<div><dt className="text-xs text-[#244B78]">Captured</dt><dd className="font-semibold text-[#10233F]">{captured}</dd></div>
				<div><dt className="text-xs text-[#244B78]">Status</dt><dd className="mt-1 inline-flex items-center gap-1 rounded-full border border-[#CAD7E5] bg-white px-2.5 py-1 text-xs font-medium text-[#10233F]"><Clock3 size={13} /> Pending verification</dd></div>
			</dl>

			<Link to="/dashboard" className="mt-4 flex min-h-[42px] items-center justify-center rounded-[10px] bg-[#10203B] px-4 text-sm font-bold text-white">Back to home</Link>
			<button type="button" onClick={onAnotherReport} className="mt-2.5 flex min-h-[42px] w-full items-center justify-center rounded-[10px] border border-[#DCE4ED] bg-white px-4 text-sm font-semibold text-[#10233F]">Report another hazard</button>
		</section>
	)
}
