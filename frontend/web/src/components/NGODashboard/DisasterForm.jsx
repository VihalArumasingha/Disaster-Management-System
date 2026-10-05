import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { X, Image as ImageIcon } from 'lucide-react'
import api from '../../services/api'

const severityOptions = ['Low', 'Medium', 'High', 'Critical']

export default function DisasterForm() {
    const navigate = useNavigate()
    const { disasterId } = useParams()

    const [form, setForm] = useState({
        title: '',
        city: '',
        summary: '',
        topNeeds: '',
        accentColor: '#16a34a',
        severity: 'Medium',
        active: true,
        showOnDonationPage: true
    })

    const [images, setImages] = useState([null, null, null, null])
    const [imagePreviews, setImagePreviews] = useState([null, null, null, null])
    const [loadingDisaster, setLoadingDisaster] = useState(Boolean(disasterId))
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!disasterId) return undefined
        let active = true
        api.get(`/ngomanager/disasters/${disasterId}`)
            .then(({ data }) => {
                if (!active) return
                if (data.warning.status !== 'draft') {
                    setError('Only draft disasters can be edited.')
                    return
                }
                setForm({
                    title: data.warning.title || '',
                    city: data.warning.city || '',
                    summary: data.warning.summary || '',
                    topNeeds: data.warning.topNeeds || '',
                    accentColor: data.warning.accentColor || '#16a34a',
                    severity: data.warning.severity || 'Medium',
                    active: data.warning.active !== undefined ? data.warning.active : true,
                    showOnDonationPage: data.warning.showOnDonationPage !== undefined ? data.warning.showOnDonationPage : true
                })
                if (data.warning.images && data.warning.images.length > 0) {
                    const loadedImages = [null, null, null, null]
                    const loadedPreviews = [null, null, null, null]
                    data.warning.images.forEach((img, index) => {
                        if (index < 4) {
                            loadedImages[index] = img
                            loadedPreviews[index] = img.url
                        }
                    })
                    setImages(loadedImages)
                    setImagePreviews(loadedPreviews)
                }
            })
            .catch((requestError) => {
                if (active) {
                    setError(requestError.response?.data?.message || 'Could not load this disaster.')
                }
            })
            .finally(() => {
                if (active) setLoadingDisaster(false)
            })
        return () => {
            active = false
        }
    }, [disasterId])

    const handleImageChange = (e, index) => {
        const file = e.target.files[0]
        if (!file) return

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setError('Only PNG, JPG, or WebP images are allowed')
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            setError('Each image must be ≤ 2 MB')
            return
        }

        const newImages = [...images]
        newImages[index] = file
        setImages(newImages)

        // Create preview
        const reader = new FileReader()
        reader.onloadend = () => {
            const newPreviews = [...imagePreviews]
            newPreviews[index] = reader.result
            setImagePreviews(newPreviews)
        }
        reader.readAsDataURL(file)
    }

    const removeImage = (index) => {
        const newImages = [...images]
        const newPreviews = [...imagePreviews]
        newImages[index] = null
        newPreviews[index] = null
        setImages(newImages)
        setImagePreviews(newPreviews)
    }

    const submitDisaster = async (event) => {
        event.preventDefault()
        setError('')

        if (!form.title || !form.city || !form.summary || !form.topNeeds) {
            setError('Title, city, summary, and top needs are required')
            return
        }

        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('title', form.title)
            formData.append('city', form.city)
            formData.append('summary', form.summary)
            formData.append('topNeeds', form.topNeeds)
            formData.append('accentColor', form.accentColor)
            formData.append('severity', form.severity)
            formData.append('active', form.active)
            formData.append('showOnDonationPage', form.showOnDonationPage)

            // Append new image files (filter out null and already uploaded images)
            const newImages = images.filter(img => img && img instanceof File)
            newImages.forEach((img) => {
                formData.append('images', img)
            })

            if (disasterId) {
                await api.put(`/ngomanager/disasters/${disasterId}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
            } else {
                await api.post('/ngomanager/disasters', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                })
            }
            navigate('/ngomanager/active-disasters', {
                replace: true,
                state: disasterId ? { updated: true } : { created: true }
            })
        } catch (requestError) {
            setError(
                requestError.response?.data?.message
                || 'Could not save the disaster. Please try again.'
            )
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <h1 className="text-xl font-semibold text-gray-900">
                    {disasterId ? 'Edit Disaster' : 'Create New Disaster'}
                </h1>
                <button
                    type="button"
                    onClick={() => navigate('/ngomanager/active-disasters')}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    Cancel
                </button>
            </div>

            {error && (
                <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    {error}
                </div>
            )}

            {loadingDisaster && (
                <div className="mx-6 mt-4 text-sm text-gray-600">Loading disaster details…</div>
            )}

            <form onSubmit={submitDisaster} className="p-6 space-y-6">
                {/* Name */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name
                    </label>
                    <input
                        type="text"
                        required
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="e.g. Flood Response"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                {/* City */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        City
                    </label>
                    <input
                        type="text"
                        required
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="e.g. Ratnapura"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                {/* Summary */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Summary
                    </label>
                    <textarea
                        required
                        rows={4}
                        value={form.summary}
                        onChange={(e) => setForm({ ...form, summary: e.target.value })}
                        placeholder="Short description of the disaster and current situation..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                {/* Top Needs */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Top needs (comma-separated)
                    </label>
                    <input
                        type="text"
                        required
                        value={form.topNeeds}
                        onChange={(e) => setForm({ ...form, topNeeds: e.target.value })}
                        placeholder="e.g. Water, Dry rations, Bedding, Medical supplies"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>

                {/* Accent Color */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Accent color
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="color"
                            value={form.accentColor}
                            onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                            className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                        />
                        <input
                            type="text"
                            value={form.accentColor}
                            onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                </div>

                {/* Severity */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Severity
                    </label>
                    <select
                        value={form.severity}
                        onChange={(e) => setForm({ ...form, severity: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                        {severityOptions.map((option) => (
                            <option key={option} value={option}>{option}</option>
                        ))}
                    </select>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.active}
                            onChange={(e) => setForm({ ...form, active: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.showOnDonationPage}
                            onChange={(e) => setForm({ ...form, showOnDonationPage: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Show on Donation page</span>
                    </label>
                </div>

                {/* Images Section */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Images
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                        Add up to 4 images at once. First image becomes the cover, next three fill the gallery.
                    </p>

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        {[0, 1, 2, 3].map((index) => (
                            <div key={index} className="relative">
                                {imagePreviews[index] ? (
                                    <div className="relative h-32 w-full rounded-lg border border-gray-200 overflow-hidden">
                                        <img
                                            src={imagePreviews[index]}
                                            alt={`Gallery ${index + 1}`}
                                            className="h-full w-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(index)}
                                            className="absolute top-1 right-1 rounded-full bg-red-600 p-1 text-white hover:bg-red-700"
                                        >
                                            <X size={14} />
                                        </button>
                                        <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                                            {index === 0 ? 'Cover' : `Gallery ${index}`}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex h-32 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
                                        <ImageIcon size={24} className="text-gray-400 mb-2" />
                                        <span className="text-xs text-gray-500 mb-2">Gallery {index + 1}</span>
                                        <label className="cursor-pointer rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
                                            Choose image
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp"
                                                onChange={(e) => handleImageChange(e, index)}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                        PNG/JPG/WebP, ≤ 2 MB each
                    </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button
                        type="submit"
                        disabled={submitting || loadingDisaster}
                        className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Saving...' : disasterId ? 'Update Disaster' : 'Create Disaster'}
                    </button>
                </div>
            </form>
        </div>
    )
}
