import { useEffect, useState } from 'react'
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Send
} from 'lucide-react'

import DescriptionStep from '../components/hazard/DescriptionStep'
import HazardTypeStep from '../components/hazard/HazardTypeStep'
import LocationStep from '../components/hazard/LocationStep'
import PhotoStep from '../components/hazard/PhotoStep'
import ReportStatusCard from '../components/hazard/ReportStatusCard'
import ReviewStep from '../components/hazard/ReviewStep'
import ReportStepper from '../components/report/ReportStepper'

import {
    createHazardReport,
    updateHazardReport
} from '../services/hazardReportService'

import {
    saveOfflineReport,
    syncPendingReports
} from '../services/offlineReportQueue'

const newReport = () => ({
    hazardType: '',
    photo: null,
    photoPreview: '',
    location: null,
    description: '',
    capturedAt: new Date().toISOString()
})

export default function ReportHazard() {
    const [currentStep, setCurrentStep] = useState(1)

    const [report, setReport] = useState(newReport)

    const [submitted, setSubmitted] =
        useState(false)

    const [savedOffline, setSavedOffline] =
        useState(false)

    const [submitting, setSubmitting] =
        useState(false)

    const [submitError, setSubmitError] =
        useState('')

    const [photoError, setPhotoError] =
        useState('')

    /*
     * Duplicate report information.
     */
    const [duplicateReport, setDuplicateReport] =
        useState(null)

    /*
     * Try to synchronize reports saved while
     * the device was offline.
     */
    useEffect(() => {
        let cancelled = false

        const syncReports = async () => {
            if (
                !navigator.onLine ||
                cancelled
            ) {
                return
            }

            try {
                const result =
                    await syncPendingReports(
                        createHazardReport
                    )

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
            console.log(
                '[Offline Sync] Internet connection restored.'
            )

            syncReports()
        }

        syncReports()

        window.addEventListener(
            'online',
            handleOnline
        )

        return () => {
            cancelled = true

            window.removeEventListener(
                'online',
                handleOnline
            )
        }
    }, [])

    /*
     * Clean up photo preview URL.
     */
    useEffect(() => {
        return () => {
            if (report.photoPreview) {
                URL.revokeObjectURL(
                    report.photoPreview
                )
            }
        }
    }, [report.photoPreview])

    const updateReport = (changes) => {
        setReport((current) => ({
            ...current,
            ...changes
        }))
    }

    const updatePhoto = ({
        photo,
        photoPreview
    }) => {
        setReport((current) => {
            if (
                current.photoPreview &&
                current.photoPreview !== photoPreview
            ) {
                URL.revokeObjectURL(
                    current.photoPreview
                )
            }

            return {
                ...current,
                photo,
                photoPreview
            }
        })
    }

    const continueStep = () => {
        if (
            currentStep === 1 &&
            !report.hazardType
        ) {
            return
        }

        if (
            currentStep === 3 &&
            !report.location
        ) {
            return
        }

        setSubmitError('')
        setCurrentStep((step) =>
            Math.min(step + 1, 5)
        )
    }

    const goBack = () => {
        setSubmitError('')
        setDuplicateReport(null)

        setCurrentStep((step) =>
            Math.max(step - 1, 1)
        )
    }

    /*
     * Normal submission.
     */
    const submitReport = async (
        forceSubmit = false
    ) => {
        if (
            submitting ||
            !report.hazardType ||
            !report.location
        ) {
            return
        }

        setSubmitting(true)
        setSubmitError('')

        try {
            await createHazardReport(
                report,
                { forceSubmit }
            )

            setSavedOffline(false)
            setDuplicateReport(null)
            setSubmitted(true)
        } catch (error) {
            /*
             * IMPORTANT:
             * A duplicate is NOT an offline failure.
             *
             * Stop here and show the duplicate warning.
             */
            if (error.isDuplicate) {
                setDuplicateReport({
                    existingReportId:
                        error.existingReportId,
                    message:
                        error.message
                })

                setSubmitting(false)
                return
            }

            /*
             * Any other submission failure falls back
             * to the existing offline queue.
             */
            console.warn(
                '[Report Submission] Online submission failed. Attempting offline save.',
                error
            )

            try {
                await saveOfflineReport(
                    report
                )

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

    /*
     * Update the existing pending report.
     */
    const handleUpdateExisting = async () => {
        if (
            !duplicateReport?.existingReportId
        ) {
            return
        }

        setSubmitting(true)
        setSubmitError('')

        try {
            await updateHazardReport(
                duplicateReport.existingReportId,
                report
            )

            setDuplicateReport(null)
            setSavedOffline(false)
            setSubmitted(true)
        } catch (error) {
            setSubmitError(
                error.message ||
                    'The existing report could not be updated.'
            )
        } finally {
            setSubmitting(false)
        }
    }

    /*
     * Explicitly submit as a new report.
     */
    const handleSubmitAsNew = async () => {
        setDuplicateReport(null)

        await submitReport(true)
    }

    const handleCancelDuplicate = () => {
        setDuplicateReport(null)
        setSubmitError('')
    }

    const startAnotherReport = () => {
        setReport(newReport())
        setCurrentStep(1)
        setSubmitted(false)
        setSavedOffline(false)
        setDuplicateReport(null)
        setSubmitError('')
        setPhotoError('')
    }

    const actionButtonClass =
        'flex min-h-[42px] items-center justify-center gap-2 rounded-[10px] bg-[#0F8179] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#80BDB8]'

    const backButtonClass =
        'flex min-h-[42px] min-w-[90px] items-center justify-center gap-2 rounded-[10px] border border-[#DCE4ED] bg-white px-3 text-sm font-medium text-[#10233F]'

    /*
     * Submitted / saved offline screen.
     */
    if (submitted) {
        return (
            <main className="min-h-[calc(100vh-144px)] bg-[#F4F6F9] px-4 pb-28 pt-5">
                <ReportStatusCard
                    report={report}
                    savedOffline={savedOffline}
                    onAnotherReport={
                        startAnotherReport
                    }
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
                    Only report when it's safe to do so.
                    Your report helps officers confirm
                    hazards faster.
                </p>
            </header>

            <ReportStepper
                currentStep={currentStep}
            />

            <div className="px-4 pb-2 pt-4">

                {currentStep === 1 && (
                    <HazardTypeStep
                        value={report.hazardType}
                        onChange={(hazardType) =>
                            updateReport({
                                hazardType
                            })
                        }
                    />
                )}

                {currentStep === 2 && (
                    <PhotoStep
                        photoPreview={
                            report.photoPreview
                        }
                        onChange={updatePhoto}
                        error={photoError}
                        onError={setPhotoError}
                    />
                )}

                {currentStep === 3 && (
                    <LocationStep
                        location={report.location}
                        onChange={(location) =>
                            updateReport({
                                location
                            })
                        }
                    />
                )}

                {currentStep === 4 && (
                    <DescriptionStep
                        value={report.description}
                        onChange={(description) =>
                            updateReport({
                                description
                            })
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

            {/* Duplicate warning */}
            {duplicateReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10233F]/45 px-5">

                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">

                        <div className="flex items-start gap-3">

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                                <AlertTriangle
                                    size={21}
                                    className="text-amber-600"
                                />
                            </div>

                            <div>
                                <h2 className="text-[18px] font-bold text-[#10233F]">
                                    Similar report found
                                </h2>

                                <p className="mt-1 text-sm leading-5 text-[#244B78]">
                                    A report for a nearby
                                    location was recently
                                    submitted.
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-2">

                            <button
                                type="button"
                                onClick={
                                    handleUpdateExisting
                                }
                                disabled={submitting}
                                className="flex min-h-[44px] w-full items-center justify-center rounded-[10px] bg-[#0F8179] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-[#80BDB8]"
                            >
                                {submitting
                                    ? 'Updating...'
                                    : 'Update existing report'}
                            </button>

                            <button
                                type="button"
                                onClick={
                                    handleSubmitAsNew
                                }
                                disabled={submitting}
                                className="flex min-h-[44px] w-full items-center justify-center rounded-[10px] border border-[#0F8179] bg-white px-4 text-sm font-bold text-[#0F8179] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Submit as new
                            </button>

                            <button
                                type="button"
                                onClick={
                                    handleCancelDuplicate
                                }
                                disabled={submitting}
                                className="min-h-[40px] w-full px-4 text-sm font-medium text-[#244B78]"
                            >
                                Cancel
                            </button>

                        </div>
                    </div>
                </div>
            )}

            <div className="fixed bottom-[74px] left-1/2 z-20 w-full max-w-md -translate-x-1/2 border-t border-[#E2E8F0] bg-[#F4F6F9]/95 px-4 py-2 backdrop-blur">

                <div className="flex gap-2.5">

                    {currentStep > 1 && (
                        <button
                            type="button"
                            onClick={goBack}
                            className={backButtonClass}
                        >
                            <ArrowLeft
                                size={17}
                            />
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
                            {currentStep === 2 &&
                            !report.photo
                                ? 'Skip photo'
                                : 'Continue'}

                            <ArrowRight
                                size={17}
                            />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() =>
                                submitReport(false)
                            }
                            disabled={submitting}
                            className={`${actionButtonClass} flex-1`}
                        >
                            {submitting
                                ? 'Submitting...'
                                : 'Submit report'}

                            {!submitting && (
                                <Send size={16} />
                            )}
                        </button>
                    )}

                </div>
            </div>
        </main>
    )
}