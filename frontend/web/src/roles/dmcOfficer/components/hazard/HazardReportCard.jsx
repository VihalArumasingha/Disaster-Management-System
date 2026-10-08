import { useState } from 'react'
import { ArrowRight, Clock3, Image, MapPin, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import VerificationActions from './VerificationActions'

const titleCase = (value) => String(value || 'Unknown')
	.replaceAll('_', ' ')
	.replace(/\b\w/g, (letter) => letter.toUpperCase())

const formatDate = (value) => {
	if (!value || Number.isNaN(new Date(value).getTime())) return 'Not provided'
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

const getReporter = (reporter) => {
	if (!reporter || typeof reporter === 'string') return { name: 'Citizen reporter', detail: '' }
	return {
		name: reporter.name || reporter.fullName || 'Citizen reporter',
		detail: reporter.email || ''
	}
}

const getCoordinates = (location) => {
	const coordinates = location?.coordinates
	if (location?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2) return null
	const [longitude, latitude] = coordinates
	return Number.isFinite(longitude) && Number.isFinite(latitude)
		? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
		: null
}

const getPhotoUrl = (photo) => {
	const value = typeof photo === 'string' ? photo : photo?.url
	if (typeof value !== 'string' || !value.trim()) return ''
	const url = value.trim()
	if (/^https?:\/\//i.test(url) || (url.startsWith('/') && !url.startsWith('//'))) return url
	return ''
}

const statusStyles = {
	pending: 'bg-amber-50 text-amber-800 ring-amber-200',
	verified: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
	rejected: 'bg-red-50 text-red-800 ring-red-200'
}

function HazardReportCard({ report, onVerify, onReject, actionsDisabled = false, actionBusy = false, detailsUrl = null }) {
	const [photoFailed, setPhotoFailed] = useState(false)
	const reporter = getReporter(report.reporterId)
	const coordinates = getCoordinates(report.location)
	const photoUrl = getPhotoUrl(report.photo)
	const status = String(report.status || 'unknown').toLowerCase()
	const verification = report.verification || {}
	const verifiedBy = verification.verifiedBy && typeof verification.verifiedBy === 'object'
		? verification.verifiedBy.name || verification.verifiedBy.email
		: null

	const openReportAction = detailsUrl ? (
		<Link
			to={detailsUrl}
			className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
		>
			Open Report <ArrowRight size={16} />
		</Link>
	) : null

	return (
		<article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{titleCase(report.hazardType)}</p>
					<h3 className="mt-1 text-base font-semibold text-slate-900">Citizen report</h3>
				</div>
				<span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>
					{titleCase(status)}
				</span>
			</div>

			<div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_220px]">
				<div className="min-w-0">
					<div className="flex items-start gap-2 text-sm text-slate-700">
						<UserRound className="mt-0.5 shrink-0 text-slate-400" size={16} />
						<div className="min-w-0">
							<p className="font-medium text-slate-900">{reporter.name}</p>
							{reporter.detail && <p className="break-all text-xs text-slate-500">{reporter.detail}</p>}
						</div>
					</div>
					<p className="mt-4 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-slate-700">{report.description || 'No description provided.'}</p>
					<div className="mt-4 grid gap-x-6 gap-y-3 text-xs text-slate-600 sm:grid-cols-2">
						<p className="inline-flex items-start gap-2"><Clock3 className="mt-0.5 shrink-0 text-slate-400" size={14} /><span>Submitted: {formatDate(report.submittedAt)}</span></p>
						<p className="inline-flex items-start gap-2"><Clock3 className="mt-0.5 shrink-0 text-slate-400" size={14} /><span>Captured: {formatDate(report.capturedAt)}</span></p>
						<p className="inline-flex items-start gap-2 sm:col-span-2"><MapPin className="mt-0.5 shrink-0 text-slate-400" size={14} /><span>GPS: {coordinates || 'Location unavailable'}</span></p>
					</div>
					{(verification.verifiedAt || verifiedBy || verification.rejectionReason) && (
						<div className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
							<p className="font-semibold text-slate-700">Verification</p>
							{verifiedBy && <p className="mt-1">Reviewed by {verifiedBy}</p>}
							{verification.verifiedAt && <p className="mt-1">Reviewed: {formatDate(verification.verifiedAt)}</p>}
							{verification.rejectionReason && <p className="mt-1">Reason: {verification.rejectionReason}</p>}
							{!verifiedBy && verification.verifiedBy && <p className="mt-1">Reviewer recorded</p>}
						</div>
					)}
				</div>

				<div className="min-w-0">
					{photoUrl && !photoFailed ? (
						<img
							key={photoUrl}
							src={photoUrl}
							alt={`Citizen-submitted ${titleCase(report.hazardType).toLowerCase()} evidence`}
							loading="lazy"
							onError={() => setPhotoFailed(true)}
							className="aspect-4/3 w-full rounded-lg border border-slate-200 bg-slate-100 object-cover"
						/>
					) : (
						<div className="grid aspect-4/3 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 text-center text-sm text-slate-500">
							<div><Image className="mx-auto text-slate-400" size={22} /><p className="mt-2">{photoFailed ? 'Photo could not be loaded' : 'No photo attached'}</p></div>
						</div>
					)}
				</div>
			</div>

			{(status === 'pending' || detailsUrl) && (
				<div className="border-t border-slate-100 px-5 py-4">
					{status === 'pending' ? (
						<VerificationActions onVerify={onVerify} onReject={onReject} disabled={actionsDisabled} busy={actionBusy} extraAction={openReportAction} />
					) : (
						<div className="flex flex-wrap gap-2">
							{openReportAction}
						</div>
					)}
				</div>
			)}
		</article>
	)
}

export default HazardReportCard
