import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight, Send } from 'lucide-react'

import DescriptionStep from '../components/hazard/DescriptionStep'
import HazardTypeStep from '../components/hazard/HazardTypeStep'
import LocationStep from '../components/hazard/LocationStep'
import PhotoStep from '../components/hazard/PhotoStep'
import ReportStatusCard from '../components/hazard/ReportStatusCard'
import ReviewStep from '../components/hazard/ReviewStep'
import ReportStepper from '../components/report/ReportStepper'

import { createHazardReport } from '../services/hazardReportService'

import {
    saveOfflineReport,
    syncPendingReports,
} from '../services/offlineReportQueue'

const newReport = () => ({
    hazardType: '',
    photo: null,
    photoPreview: '',
    location: null,
    description: '',
    capturedAt: new Date().toISOString(),
})

export default function ReportHazard() {
    const [currentStep, setCurrentStep] = useState(1)

    const [report, setReport] = useState(newReport)

    const [submitted, setSubmitted] = useState(false)

    const [savedOffline, setSavedOffline] = useState(false)

    const [submitting, setSubmitting] = useState(false)

    const [submitError, setSubmitError] = useState('')

    const [photoError, setPhotoError] = useState('')

    /*
     * Try to synchronize any reports that were saved while
     * the device was offline.
     */
    useEffect(() => {
        let cancelled = false

        const syncReports = async () => {
            if (!navigator.onLine || cancelled) {
                return
            }

            try {
                const result = await syncPendingReports(createHazardReport)

                if (result.synced > 0) {
                    console.log(
                        `[Offline Sync] ${result.synced} pending report(s) synchronized.`
                    )
                }
            } catch (error) {
                console.warn(
                    '[Offline Sync] Could not check pending reports.',
                    error
                )
            }
        }

        const handleOnline = () => {
            console.log('[Offline Sync] Internet connection restored.')
            syncReports()
        }

        // Try once when the report page loads.
        syncReports()

        // Automatically retry when connection returns.
        window.addEventListener('online', handleOnline)

        return () => {
            cancelled = true
            window.removeEventListener('online', handleOnline)
        }
    }, [])

    /*
     * Clean up photo preview URL.
     */
    useEffect(() => {
        return () => {
            if (report.photoPreview) {
                URL.revokeObjectURL(report.photoPreview)
            }
        }
    }, [report.photoPreview])

    const updateReport = (changes) => {
        setReport((current) => ({
            ...current,
            ...changes,
        }))
    }

    const updatePhoto = ({ photo, photoPreview }) => {
        setReport((current) => {
            if (
                current.photoPreview &&
                current.photoPreview !== photoPreview
            ) {
                URL.revokeObjectURL(current.photoPreview)
            }

            return {
                ...current,
                photo,
                photoPreview,
            }
        })
    }

    const continueStep = () => {
        if (currentStep === 1 && !report.hazardType) {
            return
        }

        if (currentStep === 3 && !report.location) {
            return
        }

        setSubmitError('')

        setCurrentStep((step) => Math.min(step + 1, 5))
    }

    const goBack = () => {
        setSubmitError('')

        setCurrentStep((step) => Math.max(step - 1, 1))
    }

    const submitReport = async () => {
        if (
            submitting ||
            !report.hazardType ||
            !report.location
        ) {
            return
        }

        setSubmitting(true)
        setSubmitError('')
        setSavedOffline(false)

        try {
            /*
             * First try the normal online submission.
             */
            await createHazardReport(report)

            /*
             * Server accepted the report.
             */
            setSavedOffline(false)
            setSubmitted(true)
        } catch (error) {
            console.warn(
                '[Report Submission] Online submission failed. Attempting offline save.',
                error
            )

            try {
                /*
                 * Internet/API failed.
                 *
                 * Save the REAL report locally instead of
                 * losing the citizen's report.
                 */
                await saveOfflineReport(report)

                setSavedOffline(true)
                setSubmitted(true)

                console.log(
                    '[Offline Report] Report saved locally and marked as pending.'
                )
            } catch (offlineError) {
                console.error(
                    '[Offline Report] Could not save report locally.',
                    offlineError
                )

                setSubmitError(
                    'Your report could not be submitted or saved offline. Please try again.'
                )
            }
        } finally {
            setSubmitting(false)
        }
    }

    const startAnotherReport = () => {
        setReport(newReport())
        setCurrentStep(1)
        setSubmitted(false)
        setSavedOffline(false)
        setSubmitError('')
        setPhotoError('')
    }

    const actionButtonClass =
        'flex min-h-[42px] items-center justify-center gap-2 rounded-[10px] bg-[#0F8179] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#80BDB8]'

    const backButtonClass =
        'flex min-h-[42px] min-w-[90px] items-center justify-center gap-2 rounded-[10px] border border-[#DCE4ED] bg-white px-3 text-sm font-medium text-[#10233F]'

    if (submitted) {
        return (
            <main className="min-h-[calc(100vh-144px)] bg-[#F4F6F9] px-4 pb-28 pt-5">
                <ReportStatusCard
                    report={report}
                    savedOffline={savedOffline}
                    onAnotherReport={startAnotherReport}
                />
            </main>
        )
    }

    return (
        <main className="min-h-[calc(100vh-144px)] bg-[#F4F6F9] pb-32">
            <header className="px-5 pb-4 pt-5">
                <h1 className="text-[20px] font-bold leading-6 text-[#10233F]">
                    Report a hazard
                </h1>

                <p className="mt-1 text-[13px] leading-[19px] text-[#244B78]">
                    Only report when it's safe to do so. Your report helps
                    officers confirm hazards faster.
                </p>
            </header>

            <ReportStepper currentStep={currentStep} />

            <div className="px-4 pb-2 pt-4">
                {currentStep === 1 && (
                    <HazardTypeStep
                        value={report.hazardType}
                        onChange={(hazardType) =>
                            updateReport({ hazardType })
                        }
                    />
                )}

                {currentStep === 2 && (
                    <PhotoStep
                        photoPreview={report.photoPreview}
                        onChange={updatePhoto}
                        error={photoError}
                        onError={setPhotoError}
                    />
                )}

                {currentStep === 3 && (
                    <LocationStep
                        location={report.location}
                        onChange={(location) =>
                            updateReport({ location })
                        }
                    />
                )}

                {currentStep === 4 && (
                    <DescriptionStep
                        value={report.description}
                        onChange={(description) =>
                            updateReport({ description })
                        }
                    />
                )}

                {currentStep === 5 && (
                    <ReviewStep
                        report={report}
                        onEdit={setCurrentStep}
                    />
                )}

                {submitError && (
                    <p
                        role="alert"
                        className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-800"
                    >
                        {submitError}
                    </p>
                )}
            </div>

            <div className="fixed bottom-[74px] left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-[#E2E8F0] bg-[#F4F6F9]/95 px-4 py-2 backdrop-blur">
                <div className="flex gap-2.5">
                    {currentStep > 1 && (
                        <button
                            type="button"
                            onClick={goBack}
                            className={backButtonClass}
                        >
                            <ArrowLeft size={17} />
                            Back
                        </button>
                    )}

                    {currentStep < 5 ? (
                        <button
                            type="button"
                            onClick={continueStep}
                            disabled={
                                (currentStep === 1 &&
                                    !report.hazardType) ||
                                (currentStep === 3 &&
                                    !report.location)
                            }
                            className={`${actionButtonClass} flex-1`}
                        >
                            {currentStep === 2 && !report.photo
                                ? 'Skip photo'
                                : 'Continue'}

                            <ArrowRight size={17} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={submitReport}
                            disabled={submitting}
                            className={`${actionButtonClass} flex-1`}
                        >
                            {submitting
                                ? 'Submitting...'
                                : 'Submit report'}

                            {!submitting && <Send size={16} />}
                        </button>
                    )}
                </div>
            </div>
        </main>
    )
}