import { useEffect, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, Heart, LayoutGrid, X } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const imageOf = (record) => {
  const first = Array.isArray(record?.images) ? record.images[0] : undefined;
  const raw = record?.image ?? record?.photo ?? record?.imageUrl ?? record?.url ?? first ?? record?.photo ?? record?.imageUrl ?? record?.url ?? record
  if (!raw) return ''
  if (typeof raw === 'string') return raw
  if (typeof raw === 'object' && typeof raw.url === 'string') return raw.url
  return ''
}

const formatDate = (value) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleDateString([], { dateStyle: 'medium' })
}

export default function NgoPastHighlights() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ngopast`)
        const data = await res.json().catch(() => null)
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.records)
            ? data.records
            : Array.isArray(data?.data)
              ? data.data
              : []
        if (active) {
          setRecords(list.filter((r) => imageOf(r)).slice(0, 5))
          setActiveIndex(0)
        }
      } catch {
        if (active) setRecords([])
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (records.length <= 1) return undefined
    const timer = setInterval(() => {
      setActiveIndex((i) => (i + 1) % records.length)
    }, 6000)
    return () => clearInterval(timer)
  }, [activeIndex, records.length])

  if (loading || records.length === 0) return null

  const safeIndex = ((activeIndex % records.length) + records.length) % records.length
  const active = records[safeIndex]
  const image = imageOf(active)
  const note = active?.note || active?.description || active?.caption || active?.title || ''
  const date = formatDate(active?.date || active?.createdAt)
  const goPrev = () => setActiveIndex((i) => (i - 1 + records.length) % records.length)
  const goNext = () => setActiveIndex((i) => (i + 1) % records.length)

  return (
    <div>
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-600 p-4 text-white shadow-md">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
            <Camera size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-extrabold">Moments of Impact</h2>
              <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">NGO Past</span>
            </div>
            <p className="mt-0.5 text-xs text-white/80">Stories and photos from recent relief work</p>
          </div>
        </div>
        <button type="button" onClick={() => setLightbox(true)} className="relative mt-3 block w-full overflow-hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <img src={image} alt={note || `Impact moment ${safeIndex + 1}`} className="h-56 w-full object-cover" loading="lazy" />
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold">{safeIndex + 1} / {records.length}</span>
          <span role="button" tabIndex={0} aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); goPrev() }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); goPrev() } }} className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 transition hover:bg-black/70">
            <ChevronLeft size={18} />
          </span>
          <span role="button" tabIndex={0} aria-label="Next photo" onClick={(e) => { e.stopPropagation(); goNext() }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); goNext() } }} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 transition hover:bg-black/70">
            <ChevronRight size={18} />
          </span>
        </button>
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          {records.map((r, i) => (
            <button key={r?._id || i} type="button" onClick={() => setActiveIndex(i)} aria-label={`Go to photo ${i + 1}`} className={`h-1.5 rounded-full transition-all ${i === safeIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'}`} />
          ))}
        </div>
        {note ? <p className="mt-2.5 line-clamp-3 text-sm leading-5 text-white/95">{note}</p> : null}
        {date ? <p className="mt-1 text-[11px] font-medium text-white/70">{date}</p> : null}
        {records.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {records.slice(0, 6).map((r, i) => (
              <button key={r?._id || i} type="button" onClick={() => setActiveIndex(i)} className={`h-12 w-16 shrink-0 overflow-hidden rounded-lg transition ${i === safeIndex ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent' : 'opacity-70 hover:opacity-100'}`}>
                <img src={imageOf(r)} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-white/85">
            <Heart size={14} aria-hidden="true" /> {records.length} moment{records.length === 1 ? '' : 's'} documented
          </p>
          <button type="button" onClick={() => setGalleryOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[11px] font-bold transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <LayoutGrid size={13} aria-hidden="true" /> View all moments
          </button>
        </div>
      </div>
      {galleryOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 p-4" role="dialog" aria-modal="true" aria-label="All impact moments">
          <div className="mx-auto flex w-full max-w-md items-center justify-between py-2">
            <p className="text-sm font-extrabold text-white">All impact moments ({records.length})</p>
            <button type="button" onClick={() => setGalleryOpen(false)} aria-label="Close gallery" className="rounded-full bg-white/15 p-2 text-white transition hover:bg-white/30">
              <X size={18} />
            </button>
          </div>
          <div className="mx-auto grid w-full max-w-md flex-1 content-start gap-3 overflow-y-auto pb-6" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            {records.map((r, i) => {
              const src = imageOf(r);
              const cap = r?.note || r?.description || r?.caption || r?.title || '';
              const dt = formatDate(r?.date || r?.createdAt);
              return (
                <button key={r?._id || r?.id || i} type="button" onClick={() => { setActiveIndex(i); setGalleryOpen(false); }} className="group overflow-hidden rounded-2xl bg-white/10 text-left transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  <img src={src} alt={cap || ('Impact moment ' + (i + 1))} className="h-36 w-full object-cover" loading="lazy" />
                  <div className="p-2.5">
                    {cap ? <p className="line-clamp-2 text-xs leading-4 text-white/95">{cap}</p> : null}
                    {dt ? <p className="mt-1 text-[10px] font-medium text-white/60">{dt}</p> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" onClick={() => setLightbox(false)}>
          <button type="button" onClick={() => setLightbox(false)} aria-label="Close photo" className="self-end rounded-full bg-white/15 p-2 text-white transition hover:bg-white/30">
            <X size={20} />
          </button>
          <div className="flex flex-1 items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <img src={image} alt={note || 'Impact moment'} className="max-h-[75vh] w-full rounded-2xl object-contain" />
          </div>
          {note ? <p className="mx-auto mt-3 max-w-md text-center text-sm text-white/90">{note}</p> : null}
        </div>
            )}
    </div>
  )
}

