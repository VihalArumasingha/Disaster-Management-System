import { ArrowUpRight, CircleCheck, Clock3, ShieldAlert } from 'lucide-react'

const escalationStatuses = {
	pending_duty_verification: 'Pending Duty Officer verification',
	approved: 'Approved by Duty Officer',
	rejected: 'Rejected by Duty Officer',
	cancelled: 'Cancelled'
}

const titleCase = (value) => String(value || 'Unknown')
	.replaceAll('_', ' ')
	.replace(/\b\w/g, (letter) => letter.toUpperCase())

function EscalationBanner({ evaluation, escalation, escalationError = '', loading = false, submitting = false, onEscalate }) {
	if (loading) {
		return <div role="status" className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Checking escalation status…</div>
	}

	if (escalation) {
		const status = escalationStatuses[escalation.status] || titleCase(escalation.status)
		return (
			<section aria-label="Escalation status" className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5">
				<div className="flex items-start gap-3">
					<span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-800">
						{escalation.status === 'approved' ? <CircleCheck size={20} /> : <Clock3 size={20} />}
					</span>
					<div className="min-w-0">
						<h2 className="font-semibold text-blue-950">{status}</h2>
						<p className="mt-1 text-sm leading-6 text-blue-900">
							{escalation.status === 'pending_duty_verification'
								? 'This verified cluster has been handed off to the Duty Officer. The DMC Officer does not issue the public warning.'
								: 'The Duty Officer has reviewed this hazard cluster. Public warning decisions remain with the authorized warning workflow.'}
						</p>
						{escalation.escalatedAt && <p className="mt-2 text-xs text-blue-800">Sent {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(escalation.escalatedAt))}</p>}
					</div>
				</div>
			</section>
		)
	}

	if (escalationError) {
		return (
			<section aria-label="Escalation status unavailable" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
				<p className="font-semibold text-amber-900">Escalation status unavailable</p>
				<p className="mt-1 text-sm leading-6 text-amber-800">{escalationError} The handoff action is disabled until the current escalation status can be confirmed.</p>
			</section>
		)
	}

	if (evaluation?.shouldEscalate) {
		return (
			<section aria-label="Escalation eligibility" className="mt-6 rounded-xl border-2 border-amber-400 bg-amber-50 p-5 shadow-sm">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-start gap-3">
						<span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800"><ShieldAlert size={21} /></span>
						<div>
							<h2 className="font-bold text-amber-950">Escalation threshold reached</h2>
							<p className="mt-1 max-w-2xl text-sm leading-6 text-amber-900">This verified hazard cluster is eligible to be sent to the Duty Officer for review. Escalating does not issue a public warning or notify citizens.</p>
							{evaluation.reason && <p className="mt-2 text-xs text-amber-900">{evaluation.reason}</p>}
						</div>
					</div>
					<button type="button" onClick={onEscalate} disabled={submitting} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-900 disabled:cursor-wait disabled:opacity-60">
						{submitting ? <Clock3 className="animate-pulse" size={16} /> : <ArrowUpRight size={16} />}
						{submitting ? 'Sending…' : 'Escalate to Duty Officer'}
					</button>
				</div>
				{evaluation.verifiedReportCount != null && (
					<p className="mt-4 border-t border-amber-200 pt-3 text-xs text-amber-900">
						{evaluation.verifiedReportCount} verified {evaluation.verifiedReportCount === 1 ? 'report' : 'reports'}
						{evaluation.escalationCriteria?.minimumVerifiedReports != null && ` · Minimum ${evaluation.escalationCriteria.minimumVerifiedReports}`}
						{evaluation.escalationCriteria?.minimumPriorityLevel && ` · Priority ${titleCase(evaluation.escalationCriteria.minimumPriorityLevel)} or above`}
					</p>
				)}
			</section>
		)
	}

	return (
		<section aria-label="Escalation eligibility" className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
			<p className="font-semibold text-slate-800">Not yet eligible for escalation</p>
			<p className="mt-1 text-sm leading-6 text-slate-600">{evaluation?.reason || 'The cluster does not currently meet the verified-report and priority criteria for Duty Officer review.'}</p>
			{evaluation?.verifiedReportCount != null && <p className="mt-2 text-xs text-slate-500">{evaluation.verifiedReportCount} verified {evaluation.verifiedReportCount === 1 ? 'report' : 'reports'}</p>}
		</section>
	)
}

export default EscalationBanner
