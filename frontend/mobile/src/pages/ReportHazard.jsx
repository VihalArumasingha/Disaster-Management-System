import { useState } from 'react'
import {
    Waves,
    Mountain,
    Construction,
    ShieldAlert,
    ArrowRight,
    ArrowLeft,
    Check
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
        title: 'Road blockage',
        description: 'Blocked or unsafe roads and routes',
        icon: Construction
    },
    {
        value: 'other',
        title: 'Other',
        description: 'Another hazard or dangerous situation',
        icon: ShieldAlert
    }
]

const STEPS = [1, 2, 3, 4, 5]

export default function ReportHazard() {
    const [step, setStep] = useState(1)
    const [hazardType, setHazardType] = useState('')

    const canContinue = Boolean(hazardType)

    const handleContinue = () => {
        if (!canContinue) return

        setStep((current) => Math.min(current + 1, 5))
    }

    const handleBack = () => {
        setStep((current) => Math.max(current - 1, 1))
    }

    return (
        <div className="min-h-full bg-[#F5F7FA]">
            {/* Page header */}
            <div className="px-5 pb-4 pt-6">
                <h1 className="text-[25px] font-extrabold leading-tight tracking-[-0.5px] text-[#10233F]">
                    Report a hazard
                </h1>

                <p className="mt-1 max-w-[340px] text-[15px] leading-6 text-[#244B78]">
                    Only report when it's safe to do so. Your report
                    helps officers confirm hazards faster.
                </p>
            </div>

            {/* Progress */}
            <div className="px-5 pt-1">
                <div className="flex items-center">
                    {STEPS.map((item, index) => {
                        const active = item === step
                        const completed = item < step

                        return (
                            <div
                                key={item}
                                className="flex flex-1 items-center last:flex-none"
                            >
                                <div
                                    className={[
                                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-all',
                                        active
                                            ? 'border-[#102B4E] bg-[#102B4E] text-white shadow-[0_4px_10px_rgba(16,43,78,0.18)]'
                                            : completed
                                              ? 'border-[#102B4E] bg-[#102B4E] text-white'
                                              : 'border-[#B8C9DC] bg-white text-[#45617F]'
                                    ].join(' ')}
                                >
                                    {completed ? (
                                        <Check className="h-4 w-4" strokeWidth={3} />
                                    ) : (
                                        item
                                    )}
                                </div>

                                {index < STEPS.length - 1 && (
                                    <div
                                        className={[
                                            'mx-2 h-[2px] flex-1 rounded-full transition-all',
                                            item < step
                                                ? 'bg-[#102B4E]'
                                                : 'bg-[#C9D5E3]'
                                        ].join(' ')}
                                    />
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Main content */}
            <div className="px-5 pb-32 pt-5">
                {step === 1 && (
                    <div>
                        {/* Question card */}
                        <div className="rounded-[24px] border border-[#E0E7EF] bg-white p-5 shadow-[0_4px_18px_rgba(22,43,70,0.06)]">
                            <div>
                                <h2 className="text-[20px] font-extrabold tracking-[-0.2px] text-[#10233F]">
                                    What did you see?
                                </h2>

                                <p className="mt-1 text-[15px] text-[#36577D]">
                                    Choose the closest match.
                                </p>
                            </div>

                            {/* Hazard cards */}
                            <div className="mt-5 grid grid-cols-2 gap-3">
                                {HAZARD_TYPES.map((hazard) => {
                                    const Icon = hazard.icon
                                    const selected =
                                        hazardType === hazard.value

                                    return (
                                        <button
                                            key={hazard.value}
                                            type="button"
                                            onClick={() =>
                                                setHazardType(hazard.value)
                                            }
                                            className={[
                                                'relative min-h-[184px] rounded-[19px] border-2 p-4 text-left transition-all duration-200',
                                                selected
                                                    ? 'border-[#5D8FCE] bg-[#F7FAFE] shadow-[0_6px_18px_rgba(61,111,170,0.10)]'
                                                    : 'border-[#DCE4ED] bg-white hover:border-[#AFC2D9] hover:bg-[#FAFCFE]'
                                            ].join(' ')}
                                        >
                                            {/* Selection indicator */}
                                            <div
                                                className={[
                                                    'absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border transition-all',
                                                    selected
                                                        ? 'border-[#16365E] bg-[#16365E] text-white'
                                                        : 'border-[#C6D2DF] bg-white'
                                                ].join(' ')}
                                            >
                                                {selected && (
                                                    <Check
                                                        className="h-3.5 w-3.5"
                                                        strokeWidth={3}
                                                    />
                                                )}
                                            </div>

                                            {/* Icon */}
                                            <div
                                                className={[
                                                    'flex h-12 w-12 items-center justify-center rounded-xl transition-all',
                                                    selected
                                                        ? 'bg-[#E6EFFA] text-[#234C7D]'
                                                        : 'bg-[#F1F5F9] text-[#1B3556]'
                                                ].join(' ')}
                                            >
                                                <Icon
                                                    className="h-6 w-6"
                                                    strokeWidth={2.2}
                                                />
                                            </div>

                                            <h3 className="mt-4 text-[17px] font-extrabold text-[#10233F]">
                                                {hazard.title}
                                            </h3>

                                            <p className="mt-1 max-w-[130px] text-[13px] leading-5 text-[#49627E]">
                                                {hazard.description}
                                            </p>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Safety hint */}
                        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#DCE7F2] bg-[#EEF5FC] p-4">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#234C7D]">
                                <ShieldAlert className="h-4 w-4" />
                            </div>

                            <div>
                                <p className="text-sm font-bold text-[#193B62]">
                                    Stay safe
                                </p>

                                <p className="mt-0.5 text-xs leading-5 text-[#466582]">
                                    Do not enter dangerous areas just to
                                    collect information for this report.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {step > 1 && (
                    <div className="rounded-[24px] border border-[#E0E7EF] bg-white p-6 shadow-[0_4px_18px_rgba(22,43,70,0.06)]">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E8F0F9] text-[#234C7D]">
                            <span className="text-xl font-extrabold">
                                {step}
                            </span>
                        </div>

                        <h2 className="mt-5 text-xl font-extrabold text-[#10233F]">
                            Step {step}
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-[#4B6683]">
                            This step will contain the next part of the
                            hazard reporting flow.
                        </p>

                        <div className="mt-5 rounded-xl bg-[#F5F8FB] p-4 text-sm text-[#49627E]">
                            Selected hazard:{' '}
                            <span className="font-bold text-[#10233F]">
                                {
                                    HAZARD_TYPES.find(
                                        (item) =>
                                            item.value === hazardType
                                    )?.title
                                }
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom action area */}
            <div className="fixed bottom-[74px] left-0 right-0 z-30 border-t border-[#E2E8F0] bg-white/95 px-5 py-3 backdrop-blur-md">
                <div className="mx-auto flex max-w-md gap-3">
                    {step > 1 && (
                        <button
                            type="button"
                            onClick={handleBack}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white text-[#193B62] transition hover:bg-[#F5F8FB]"
                            aria-label="Go back"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleContinue}
                        disabled={!canContinue}
                        className={[
                            'flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[15px] font-extrabold transition-all',
                            canContinue
                                ? 'bg-[#7EBEBC] text-white shadow-[0_5px_14px_rgba(83,147,145,0.18)] hover:bg-[#6FB2B0] active:scale-[0.99]'
                                : 'cursor-not-allowed bg-[#D5E2E7] text-white'
                        ].join(' ')}
                    >
                        Continue
                        <ArrowRight className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    )
}