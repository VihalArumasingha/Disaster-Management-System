import { useId, useState } from 'react'
import { BadgeCheck, Ban, LoaderCircle } from 'lucide-react'

function VerificationActions({ onVerify, onReject, disabled = false, busy = false, extraAction = null }) {
	const reasonId = useId()
	const [rejecting, setRejecting] = useState(false)
	const [reason, setReason] = useState('')
	const [error, setError] = useState('')

	const verify = async () => {
		setError('')
		try {
			await onVerify()
		} catch (actionError) {
			setError(actionError.response?.data?.message || actionError.message || 'Could not verify this report.')
		}
	}

	const reject = async (event) => {
		event.preventDefault()
		const trimmedReason = reason.trim()
		if (!trimmedReason) {
			setError('Enter a reason before rejecting this report.')
			return
		}

		setError('')
		try {
			await onReject(trimmedReason)
			setReason('')
			setRejecting(false)
		} catch (actionError) {
			setError(actionError.response?.data?.message || actionError.message || 'Could not reject this report.')
		}
	}

	return (
		<div>
			<div className="flex flex-wrap gap-2">
                {extraAction}
				<button type="button" onClick={verify} disabled={disabled || busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">
					{busy ? <LoaderCircle className="animate-spin" size={16} /> : <BadgeCheck size={16} />}
					Verify Report
				</button>
				{!rejecting && (
					<button type="button" onClick={() => { setError(''); setRejecting(true) }} disabled={disabled || busy} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60">
						<Ban size={16} /> Reject Report
					</button>
				)}
			</div>

			{rejecting && (
				<form onSubmit={reject} className="mt-4 max-w-xl rounded-lg border border-red-200 bg-red-50/60 p-4">
					<label htmlFor={reasonId} className="block text-sm font-semibold text-slate-800">Reason for rejection</label>
					<textarea
						id={reasonId}
						value={reason}
						onChange={(event) => setReason(event.target.value)}
						maxLength={1000}
						required
						rows={3}
						placeholder="Explain why this report should be rejected"
						className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
					/>
					<div className="mt-3 flex flex-wrap gap-2">
						<button type="submit" disabled={disabled || busy || !reason.trim()} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-red-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60">
							{busy && <LoaderCircle className="animate-spin" size={15} />} Confirm rejection
						</button>
						<button type="button" onClick={() => { setRejecting(false); setReason(''); setError('') }} disabled={busy} className="min-h-9 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
					</div>
				</form>
			)}
			{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
		</div>
	)
}

export default VerificationActions
