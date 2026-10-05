export default function DescriptionStep({ value, onChange }) {
	return (
		<section className="rounded-2xl border border-[#DCE4ED] bg-white p-4 shadow-[0_1px_2px_rgba(16,35,63,0.08)]">
			<h2 className="text-[17px] font-bold leading-6 text-[#10233F]">
				Describe what you see <span className="text-sm font-normal">(optional)</span>
			</h2>
			<p className="mt-1 text-sm leading-5 text-[#244B78]">
				Helpful details: water depth, roads blocked, people who need help.
			</p>
			<textarea
				value={value}
				onChange={(event) => onChange(event.target.value.slice(0, 280))}
				maxLength={280}
				rows={5}
				placeholder="e.g. Water is knee-deep on Kotikawatta Road and rising. Two houses flooded."
				className="mt-4 min-h-[136px] w-full resize-none rounded-xl border border-[#DCE4ED] bg-white p-3.5 text-sm leading-[21px] text-[#10233F] outline-none placeholder:text-[#7289A5] focus:border-[#0F8F83] focus:ring-2 focus:ring-[#0F8F83]/15"
			/>
			<p className="mt-2 text-right text-xs text-[#244B78]">{value.length}/280</p>
		</section>
	)
}
