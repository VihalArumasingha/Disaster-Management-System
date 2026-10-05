import { Check } from 'lucide-react'

export default function ReportStepper({ currentStep }) {
    return (
        <nav aria-label={`Step ${currentStep} of 5`} className="flex items-center px-5">
            {[1, 2, 3, 4, 5].map((step, index) => {
                const completed = step < currentStep
                const current = step === currentStep

                return (
                    <div key={step} className="flex flex-1 items-center last:flex-none">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${completed ? 'border-[#0F8F83] bg-[#0F8F83] text-white' : current ? 'border-[#10203B] bg-[#10203B] text-white' : 'border-[#C9D7E6] bg-white text-[#36577D]'}`}>
                            {completed ? <Check size={15} strokeWidth={2.5} /> : step}
                        </span>
                        {index < 4 && <span className={`mx-2 h-[2px] flex-1 rounded-full ${step < currentStep ? 'bg-[#0F8F83]' : 'bg-[#C9D7E6]'}`} />}
                    </div>
                )
            })}
        </nav>
    )
}