import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, RefreshCw, Trash2, X } from 'lucide-react'

const MAX_IMAGE_SIZE = 10 * 1024 * 1024

export default function PhotoStep({ photoPreview, onChange, error, onError }) {
	const uploadInput = useRef(null)
	const videoRef = useRef(null)
	const streamRef = useRef(null)
	const mountedRef = useRef(true)
	const [cameraOpen, setCameraOpen] = useState(false)
	const [videoReady, setVideoReady] = useState(false)
	const [capturing, setCapturing] = useState(false)
	const [cameraError, setCameraError] = useState('')

	const stopCamera = () => {
		streamRef.current?.getTracks().forEach((track) => track.stop())
		streamRef.current = null
		if (videoRef.current) videoRef.current.srcObject = null
		setCameraOpen(false)
		setVideoReady(false)
		setCapturing(false)
	}

	useEffect(() => {
		mountedRef.current = true
		return () => {
			mountedRef.current = false
			streamRef.current?.getTracks().forEach((track) => track.stop())
			streamRef.current = null
		}
	}, [])

	useEffect(() => {
		const video = videoRef.current
		if (!cameraOpen || !streamRef.current || !video) return undefined
		video.srcObject = streamRef.current
		video.play().catch(() => {
			setCameraError('The camera preview could not be started. Please try again or upload a photo instead.')
		})
		return () => {
			video.srcObject = null
		}
	}, [cameraOpen, onError])

	useEffect(() => {
		if (!cameraOpen) return undefined
		const handleKeyDown = (event) => {
			if (event.key === 'Escape') stopCamera()
		}
		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [cameraOpen])

	const processSelectedPhoto = (file) => {
		if (!file) return false

		if (!file.type.startsWith('image/')) {
			onError('Choose an image file to attach to your report.')
			return false
		}

		if (file.size > MAX_IMAGE_SIZE) {
			onError('That image is larger than 10 MB. Choose a smaller image.')
			return false
		}

		onError('')
		onChange({ photo: file, photoPreview: URL.createObjectURL(file) })
		return true
	}

	const openCamera = async () => {
		onError('')
		setCameraError('')
		setVideoReady(false)

		const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
		if (window.isSecureContext === false && !isLocalhost) {
			onError('Camera access requires a secure connection (HTTPS). You can upload a photo from your device instead.')
			return
		}

		if (!navigator.mediaDevices?.getUserMedia) {
			onError('Live camera access is not supported by this browser. You can upload a photo from your device instead.')
			return
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: { ideal: 'environment' } },
				audio: false
			})
			if (!mountedRef.current) {
				stream.getTracks().forEach((track) => track.stop())
				return
			}
			streamRef.current = stream
			setCameraOpen(true)
		} catch (cameraError) {
			if (!mountedRef.current) return
			if (cameraError.name === 'NotAllowedError' || cameraError.name === 'SecurityError') {
				onError('Camera access was denied. Please allow camera access in your browser settings or use Upload from device.')
			} else if (cameraError.name === 'NotFoundError' || cameraError.name === 'DevicesNotFoundError') {
				onError('Camera is not available on this device. You can upload a photo from your device instead.')
			} else {
				onError('The camera could not be opened. You can upload a photo from your device instead.')
			}
		}
	}

	const capturePhoto = async () => {
		const video = videoRef.current
		const track = streamRef.current?.getVideoTracks()[0]
		if (!video || !track || !video.videoWidth || !video.videoHeight) return

		setCapturing(true)
		try {
			let imageBlob = null
			if (typeof ImageCapture !== 'undefined') {
				try {
					imageBlob = await new ImageCapture(track).takePhoto()
				} catch {
					imageBlob = null
				}
			}

			if (!imageBlob) {
				const canvas = document.createElement('canvas')
				canvas.width = video.videoWidth
				canvas.height = video.videoHeight
				const context = canvas.getContext('2d')
				if (!context) throw new Error('Canvas is unavailable')
				context.drawImage(video, 0, 0, canvas.width, canvas.height)
				imageBlob = await new Promise((resolve, reject) => {
					canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Photo capture failed')), 'image/jpeg', 0.92)
				})
			}

			if (!mountedRef.current) return
			const type = imageBlob.type || 'image/jpeg'
			const extension = type === 'image/png' ? 'png' : 'jpg'
			const file = new File([imageBlob], `hazard-${Date.now()}.${extension}`, { type })
			processSelectedPhoto(file)
			stopCamera()
		} catch {
			if (!mountedRef.current) return
			setCameraError('The photo could not be captured. Please try again or upload a photo instead.')
			setCapturing(false)
		}
	}

	const selectPhoto = (event) => {
		const file = event.target.files?.[0]
		event.target.value = ''
		processSelectedPhoto(file)
	}

	const removePhoto = () => {
		if (photoPreview) URL.revokeObjectURL(photoPreview)
		onChange({ photo: null, photoPreview: '' })
		onError('')
	}

	return (
		<section className="rounded-2xl border border-[#DCE4ED] bg-white p-4 shadow-[0_1px_2px_rgba(16,35,63,0.08)]">
			<h2 className="text-[17px] font-bold leading-6 text-[#10233F]">Add a photo</h2>
			<p className="mt-1 text-sm leading-5 text-[#244B78]">
				A photo helps officers verify your report faster. Never put yourself at risk to take one.
			</p>

			{photoPreview ? (
				<div className="mt-4 overflow-hidden rounded-[14px] border border-[#DCE4ED]">
					<img src={photoPreview} alt="Selected hazard" className="h-52 w-full object-cover" />
					<div className="flex gap-2 p-3">
						<button type="button" onClick={openCamera} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] border border-[#DCE4ED] text-sm font-semibold text-[#10233F]">
							<RefreshCw size={16} /> Replace
						</button>
						<button type="button" onClick={() => uploadInput.current?.click()} className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#DCE4ED] text-[#10233F]" aria-label="Upload replacement photo">
							<ImagePlus size={17} />
						</button>
						<button type="button" onClick={removePhoto} className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#DCE4ED] text-[#9F2934]" aria-label="Remove photo">
							<Trash2 size={17} />
						</button>
					</div>
				</div>
			) : (
				<div className="mt-4 space-y-2.5">
					<button type="button" onClick={openCamera} className="flex min-h-[125px] w-full flex-col items-center justify-center rounded-[14px] bg-[#10203B] px-4 text-white">
						<Camera size={25} aria-hidden="true" />
						<span className="mt-3 text-sm font-bold">Take photo</span>
						<span className="mt-2 text-xs text-white/90">Opens your camera</span>
					</button>
					<button type="button" onClick={() => uploadInput.current?.click()} className="flex min-h-[125px] w-full flex-col items-center justify-center rounded-[14px] border border-dashed border-[#BFD0E1] bg-white px-4 text-[#10233F]">
						<ImagePlus size={25} className="text-[#244B78]" aria-hidden="true" />
						<span className="mt-3 text-sm font-bold">Upload from device</span>
						<span className="mt-2 text-xs text-[#244B78]">Choose from your gallery</span>
					</button>
				</div>
			)}

			<input ref={uploadInput} type="file" accept="image/*" onChange={selectPhoto} className="hidden" aria-label="Upload a photo" />
			{error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm leading-5 text-red-800">{error}</p>}

			{cameraOpen && (
				<div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#071326] p-4 text-white" role="dialog" aria-modal="true" aria-label="Take a hazard photo">
					<div className="w-full max-w-md">
						<div className="mb-3 flex items-center justify-between">
							<div className="flex items-center gap-2 text-sm font-semibold"><Camera size={18} /> Rear camera</div>
							<button type="button" onClick={stopCamera} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10" aria-label="Close camera"><X size={21} /></button>
						</div>
						<div className="relative overflow-hidden rounded-2xl bg-black">
							<video ref={videoRef} playsInline autoPlay muted onLoadedMetadata={() => setVideoReady(true)} className="aspect-[3/4] max-h-[70vh] w-full object-cover" />
							{!videoReady && <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white/80" role="status">Starting camera...</div>}
						</div>
						{cameraError && <p role="alert" className="mt-3 rounded-lg bg-red-950 p-3 text-sm leading-5 text-red-100">{cameraError}</p>}
						<div className="mt-5 flex items-center justify-center gap-8">
							<button type="button" onClick={stopCamera} className="min-h-11 rounded-xl px-4 text-sm font-semibold text-white">Cancel</button>
							<button type="button" onClick={capturePhoto} disabled={!videoReady || capturing} aria-label="Capture photo" className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-4 border-white bg-[#0F8F83] text-white shadow-lg disabled:opacity-50">
								<Camera size={28} />
							</button>
						</div>
					</div>
				</div>
			)}
		</section>
	)
}
