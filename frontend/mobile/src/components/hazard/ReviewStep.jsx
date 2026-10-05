import { Shield, Pencil } from 'lucide-react'

const hazardTitle = (value) => ({
	flood: 'Flood',
	landslide: 'Landslide',
	road_blockage: 'Road Blockage',
	other: 'Other'
}[value] || value)

const formatTime = (value) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

const formatCoordinates = ({ latitude, longitude }) => (
	`${Math.abs(latitude).toFixed(5)}°${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(5)}°${longitude >= 0 ? 'E' : 'W'}`
)

export default function ReviewStep({ report, onEdit }) {
	const locationLabel = report.location?.source === 'manual' ? 'Pinned map location' : 'Current GPS location'
	const rows = [
		{ title: 'Hazard', value: hazardTitle(report.hazardType), step: 1 },
		{ title: 'Photo', value: report.photo ? 'Photo added' : 'No photo added', step: 2 },
		{
			title: 'Location',
			value: report.location ? <><span className="font-semibold text-[#10233F]">{locationLabel}</span><span className="block text-xs text-[#244B78]">{report.location.source === 'gps' ? 'GPS' : 'Map pin'} · {formatCoordinates(report.location)}</span></> : 'No location selected',
			step: 3
		},
		{ title: 'Description', value: report.description.trim() || 'No description', step: 4 }
	]

	return (
		<section className="rounded-2xl border border-[#DCE4ED] bg-white p-4 shadow-[0_1px_2px_rgba(16,35,63,0.08)]">
			<h2 className="text-[17px] font-bold leading-6 text-[#10233F]">Review and submit</h2>
			<p className="mt-1 text-sm text-[#244B78]">Captured at {formatTime(report.capturedAt)}</p>

			<div className="mt-4 overflow-hidden rounded-xl border border-[#DCE4ED]">
				{rows.map(({ title, value, step }) => (
					<div key={title} className="grid grid-cols-[68px_minmax(0,1fr)_42px] items-start gap-2 border-b border-[#DCE4ED] px-3 py-3 last:border-b-0">
						<span className="pt-0.5 text-xs text-[#244B78]">{title}</span>
						<span className="min-w-0 break-words text-sm leading-5 text-[#10233F]">{value}</span>
						<button type="button" onClick={() => onEdit(step)} className="inline-flex items-center justify-end gap-1 pt-0.5 text-xs font-semibold text-[#006C68]" aria-label={`Edit ${title}`}>
							<Pencil size={12} /> Edit
						</button>
					</div>
				))}
			</div>

			<div className="mt-3 flex items-start gap-2 text-[12px] leading-[18px] text-[#244B78]">
				<Shield size={15} className="mt-0.5 shrink-0 text-[#102B4B]" />
				<p>Your report goes to Disaster Management officers for verification. Your contact details are never shown publicly.</p>
			</div>
		</section>
	)
}
