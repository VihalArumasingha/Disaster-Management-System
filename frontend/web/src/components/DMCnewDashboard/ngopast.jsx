import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, ImagePlus, Printer, RefreshCw, Search, Trash2, Pencil, X } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'
const MAX_IMAGES = 2

function fmtDate(v) {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleString()
}

function imgUrl(path) {
  if (path && typeof path === 'object') return path.url || ''
  if (!path || typeof path !== 'string') return ''
  if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path
  return API_BASE + path
}

export default function NgoPastPage() {
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [note, setNote] = useState('')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [formOk, setFormOk] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const [editing, setEditing] = useState(null)
  const [editNote, setEditNote] = useState('')
  const [editFiles, setEditFiles] = useState([])
  const [editPreviews, setEditPreviews] = useState([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const editInputRef = useRef(null)

  const [lightbox, setLightbox] = useState(null)
  const searchTimeout = useRef(null)

  const load = useCallback(async (needle) => {
    const q = typeof needle === 'string' ? needle : search
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (q && q.trim()) params.set('q', q.trim())
      const qs = params.toString()
      const url = API_BASE + '/api/ngopast' + (qs ? '?' + qs : '')
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load records (' + res.status + ')')
      const data = await res.json()
      setRecords(Array.isArray(data.records) ? data.records : [])
      setTotal(data.total ?? (data.records ? data.records.length : 0))
    } catch (e) {
      setError(e.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [search])
  useEffect(() => { load('') }, [load])
  useEffect(() => () => {
    previews.forEach((p) => URL.revokeObjectURL(p.url))
    editPreviews.forEach((p) => { if (p.url && p.local) URL.revokeObjectURL(p.url) })
  }, [])

  function filterValidImages(list) {
    return Array.from(list || []).filter((f) => f && (f.type === 'image/jpeg' || f.type === 'image/jpg' || f.type === 'image/png' || f.type === 'image/webp'))
  }

  function pickFiles(list, isEdit) {
    const valid = filterValidImages(list)
    if (valid.length < (list || []).length) {
      if (isEdit) setEditError('Only JPEG/PNG/WebP images allowed')
      else setFormError('Only JPEG/PNG/WebP images allowed')
    }
    if (isEdit) {
      const next = [...editFiles, ...valid].slice(0, MAX_IMAGES)
      setEditFiles(next)
      setEditPreviews(next.map((f) => ({ url: URL.createObjectURL(f), local: true })))
    } else {
      const next = [...files, ...valid].slice(0, MAX_IMAGES)
      setFiles(next)
      setPreviews(next.map((f) => ({ url: URL.createObjectURL(f) })))
      if (next.length >= MAX_IMAGES && valid.length > 0) setFormError('')
    }
  }

  function removeFile(idx, isEdit) {
    if (isEdit) {
      const next = editFiles.filter((_, i) => i !== idx)
      setEditFiles(next)
      setEditPreviews(next.map((f) => ({ url: URL.createObjectURL(f), local: true })))
    } else {
      const next = files.filter((_, i) => i !== idx)
      setFiles(next)
      setPreviews(next.map((f) => ({ url: URL.createObjectURL(f) })))
    }
  }

  async function submitRecord(e) {
    e.preventDefault()
    setFormError('')
    setFormOk('')
    if (!note.trim()) { setFormError('Note is required'); return }
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('note', note.trim())
      files.forEach((f) => fd.append('images', f))
      const res = await fetch(API_BASE + '/api/ngopast', { method: 'POST', body: fd, credentials: 'include' })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.message || ('Submit failed (' + res.status + ')'))
      setNote('')
      setFiles([])
      setPreviews([])
      setFormOk('Record saved')
      load(search)
    } catch (err) {
      setFormError(err.message || 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  function openEdit(r) {
    setEditing(r)
    setEditNote(r.note || '')
    setEditFiles([])
    const imgs = r.images || []
    setEditPreviews(imgs.map((p) => ({ url: imgUrl(p), local: false })))
    setEditError('')
  }

  async function saveEdit(e) {
    e.preventDefault()
    if (!editing) return
    setEditError('')
    if (!editNote.trim()) { setEditError('Note is required'); return }
    setEditSaving(true)
    try {
      const fd = new FormData()
      fd.append('note', editNote.trim())
      editFiles.forEach((f) => fd.append('images', f))
      const id = editing._id || editing.id
      const res = await fetch(API_BASE + '/api/ngopast/' + id, { method: 'PUT', body: fd, credentials: 'include' })
      if (!res.ok) throw new Error('Update failed (' + res.status + ')')
      setEditing(null)
      load(search)
    } catch (err) {
      setEditError(err.message || 'Update failed')
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteRecord(r) {
    const id = r._id || r.id
    if (!window.confirm('Delete this record?')) return
    try {
      const res = await fetch(API_BASE + '/api/ngopast/' + id, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) throw new Error('Delete failed (' + res.status + ')')
      load(search)
    } catch (err) {
      setError(err.message || 'Delete failed')
    }
  }

  function onSearchChange(v) {
    setSearch(v)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => load(v), 400)
  }

  function exportCsv() {
    const rows = [['Date', 'Note', 'Image1', 'Image2']]
    records.forEach((r) => {
      const imgs = r.images || []
      rows.push([fmtDate(r.createdAt || r.date), (r.note || '').replace(/\n/g, ' '), imgs[0] ? imgUrl(imgs[0]) : '', imgs[1] ? imgUrl(imgs[1]) : ''])
    })
    const csv = rows.map((row) => row.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'ngo-past-records.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">NGO Past Records</h1>
            <p className="text-sm text-slate-500">History of past relief work with notes and photos ({total} records)</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">
              <Download size={16} /> Export CSV
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-slate-50">
              <Printer size={16} /> Print
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">📝 Add New Record</h2>
        <form onSubmit={submitRecord} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">Record Note</label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="Describe the past relief activity..."
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          <label className="block text-sm font-medium text-slate-700">Upload Images (max {MAX_IMAGES}, JPEG/PNG)</label>
          <div onClick={() => fileInputRef.current && fileInputRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFiles(e.dataTransfer.files, false) }}
            className={'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-sm text-slate-500 ' + (dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300')}>
            <ImagePlus size={24} />
            <span>Click to browse or drag and drop images here</span>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/jpg" multiple hidden
              onChange={(e) => pickFiles(e.target.files, false)} />
          </div>
          {previews.length > 0 && (
            <div className="flex gap-2">
              {previews.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p.url} alt="preview" className="h-20 w-20 rounded-lg object-cover" />
                  <button type="button" onClick={() => removeFile(i, false)}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          {formOk && <p className="text-sm text-emerald-600">{formOk}</p>}
          <button type="submit" disabled={submitting || !note.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {submitting ? 'Saving...' : 'Submit Record'}
          </button>
        </form>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search notes..."
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <button onClick={() => load(search)} className="flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm hover:bg-slate-50">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && records.length === 0 && !error && <p className="text-sm text-slate-500">No records found.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {records.map((r) => (
          <div key={r._id || r.id} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-400">{fmtDate(r.createdAt || r.date)}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.note}</p>
            {(r.images || []).length > 0 && (
              <div className="mt-2 flex gap-2">
                {(r.images || []).slice(0, MAX_IMAGES).map((p, i) => (
                  <img key={i} src={imgUrl(p)} alt="record" onClick={() => setLightbox(imgUrl(p))}
                    className="h-24 w-24 cursor-pointer rounded-lg object-cover" />
                ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button onClick={() => openEdit(r)} className="flex items-center gap-1 rounded-lg border px-3 py-1 text-xs hover:bg-slate-50">
                <Pencil size={14} /> Edit
              </button>
              <button onClick={() => deleteRecord(r)} className="flex items-center gap-1 rounded-lg border px-3 py-1 text-xs text-red-600 hover:bg-red-50">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Record</h3>
              <button onClick={() => setEditing(null)}><X size={18} /></button>
            </div>
            <form onSubmit={saveEdit} className="space-y-3">
              <textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={4}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
              <div onClick={() => editInputRef.current && editInputRef.current.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 p-4 text-sm text-slate-500">
                <ImagePlus size={20} />
                <span>Add/replace images (max {MAX_IMAGES})</span>
                <input ref={editInputRef} type="file" accept="image/jpeg,image/png,image/jpg" multiple hidden
                  onChange={(e) => pickFiles(e.target.files, true)} />
              </div>
              {editPreviews.length > 0 && (
                <div className="flex gap-2">
                  {editPreviews.map((p, i) => (
                    <div key={i} className="relative">
                      <img src={p.url} alt="edit preview" className="h-20 w-20 rounded-lg object-cover" />
                      {p.local && (
                        <button type="button" onClick={() => removeFile(i, true)}
                          className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"><X size={12} /></button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={editSaving || !editNote.trim()}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {editSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <img src={lightbox} alt="full" className="max-h-[90vh] max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}

