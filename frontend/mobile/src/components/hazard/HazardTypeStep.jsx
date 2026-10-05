import {
	Check,
	Construction,
	Mountain,
	ShieldAlert,
	Waves
} from 'lucide-react'

const HAZARD_TYPES = [
	{
		value: 'flood',
		title: 'Flood',
		description: 'Rising water, flooded roads or homes',
		icon: Waves
	},
	{
		value: 'landslide',
		title: 'Landslide',
		description: 'Slope failure, cracks, falling rocks',
		icon: Mountain
	},
	{
		value: 'road_blockage',
		title: 'Road Blockage',
		description: 'Fallen trees, debris, collapsed road',
		icon: Construction
	},
	{
		value: 'other',
		title: 'Other',
		description: 'Fallen power lines, fire, other dangers',
		icon: ShieldAlert
	}
]

export default function HazardTypeStep({ value, onChange }) {
	return (
		<section className="rounded-2xl border border-[#DCE4ED] bg-white p-5 shadow-[0_1px_2px_rgba(16,35,63,0.08)]">
			<h2 className="text-[17px] font-bold leading-6 text-[#10233F]">
				What did you see?
			</h2>
			<p className="mt-1 text-sm leading-5 text-[#244B78]">
				Choose the closest match.
			</p>

			<div className="mt-4 grid grid-cols-2 gap-2.5">
				{HAZARD_TYPES.map(({ value: hazardValue, title, description, icon: Icon }) => {
					const selected = value === hazardValue

					return (
						<button
							key={hazardValue}
							type="button"
							aria-pressed={selected}
							onClick={() => onChange(hazardValue)}
							className={`relative min-h-[150px] rounded-[14px] border p-3.5 text-left transition-colors ${selected ? 'border-[#0F8F83] bg-[#E2F4F1]' : 'border-[#DCE4ED] bg-white'}`}
						>
							{selected && (
								<span className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#0F8F83] text-[#0F8F83]">
									<Check size={13} strokeWidth={2.5} />
								</span>
							)}
							<span className={`flex h-10 w-10 items-center justify-center rounded-[11px] ${selected ? 'bg-[#0F8F83] text-white' : 'bg-[#F0F4F8] text-[#102B4B]'}`}>
								<Icon size={20} strokeWidth={2} aria-hidden="true" />
							</span>
							<span className="mt-2.5 block pr-4 text-[15px] font-bold leading-5 text-[#10233F]">
								{title}
							</span>
							<span className="mt-1 block text-[12px] leading-[17px] text-[#244B78]">
								{description}
							</span>
						</button>
					)
				})}
			</div>
		</section>
	)
}
