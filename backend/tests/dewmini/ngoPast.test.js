import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../../models/NgoPastRecord.js', () => ({
  default: { find: vi.fn(), findById: vi.fn(), findByIdAndDelete: vi.fn(), create: vi.fn() }
}))
vi.mock('../../config/cloudinary.js', () => ({ default: vi.fn() }))
vi.mock('cloudinary', () => ({ v2: { api: { delete_resources: vi.fn() } } }))
vi.mock('mongoose', () => {
  const fn = vi.fn(() => true)
  return { default: { isValidObjectId: fn }, isValidObjectId: fn }
})
import NgoPastRecord from '../../models/NgoPastRecord.js'
import mongoose from 'mongoose'
import { v2 as cloudinary } from 'cloudinary'
import { getPastRecords, getPastRecordById, createPastRecord, updatePastRecord, deletePastRecord } from '../../roles/ngoManager/controllers/ngoPastController.js'
const mockRes = () => {
  const r = {}
  r.status = vi.fn().mockReturnValue(r)
  r.json = vi.fn().mockReturnValue(r)
  return r
}
const chain = (v) => ({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(v) }) })
beforeEach(() => vi.clearAllMocks())
describe('ngoPastController', () => {
// ==================== POSITIVE TESTS ====================
  it('POSITIVE: getPastRecords returns all newest-first', async () => {
    NgoPastRecord.find.mockReturnValue(chain([{ _id: 'a1', note: 'Flood relief', images: [] }]))
    const res = mockRes()
    await getPastRecords({ query: {} }, res, vi.fn())
    expect(NgoPastRecord.find).toHaveBeenCalledWith({})
    expect(res.json.mock.calls[0][0].success).toBe(true)
    expect(res.json.mock.calls[0][0].records[0].id).toBe('a1')
    expect(res.json.mock.calls[0][0].records[0].note).toBe('Flood relief')
  })
  it('POSITIVE: getPastRecords filters by q', async () => {
    NgoPastRecord.find.mockReturnValue(chain([]))
    await getPastRecords({ query: { q: '  flood ' } }, mockRes(), vi.fn())
    expect(NgoPastRecord.find).toHaveBeenCalledWith({ note: { $regex: 'flood', $options: 'i' } })
  })
  it('POSITIVE: getPastRecordById returns record', async () => {
    NgoPastRecord.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'r1', note: 'Camp', images: [{ url: 'u', public_id: 'p' }] }) })
    const res = mockRes()
    await getPastRecordById({ params: { recordId: 'r1' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
    expect(res.json.mock.calls[0][0].record.images).toEqual([{ url: 'u', public_id: 'p' }])
  })
  it('POSITIVE: createPastRecord 201 with note', async () => {
    NgoPastRecord.create.mockResolvedValue({ toObject: () => ({ _id: 'n1', note: 'Help', images: [] }) })
    const res = mockRes()
    await createPastRecord({ body: { note: '  Help ' }, files: [], user: { _id: 'u1' } }, res, vi.fn())
    expect(NgoPastRecord.create).toHaveBeenCalledWith(expect.objectContaining({ note: 'Help' }))
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json.mock.calls[0][0].record.note).toBe('Help')
  })
  it('POSITIVE: updatePastRecord updates note', async () => {
    const rec = { note: 'old', images: [], save: vi.fn().mockResolvedValue(true), toObject() { return { _id: 'r1', note: this.note, images: [] } } }
    NgoPastRecord.findById.mockResolvedValue(rec)
    const res = mockRes()
    await updatePastRecord({ params: { recordId: 'r1' }, body: { note: 'new' }, files: [] }, res, vi.fn())
    expect(rec.note).toBe('new')
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('POSITIVE: update replaces images when new files uploaded', async () => {
    const rec = { note: 'o', images: [{ url: 'old', public_id: 'old1' }], save: vi.fn().mockResolvedValue(true), toObject() { return { _id: 'r1', note: this.note, images: this.images } } }
    NgoPastRecord.findById.mockResolvedValue(rec)
    const res = mockRes()
    await updatePastRecord({ params: { recordId: 'r1' }, body: {}, files: [{ path: 'new', filename: 'new1' }] }, res, vi.fn())
    expect(rec.images).toEqual([{ url: 'new', public_id: 'new1' }])
    expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(['old1'])
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('POSITIVE: deletePastRecord deletes', async () => {
    NgoPastRecord.findByIdAndDelete.mockResolvedValue({ _id: 'd1', images: [] })
    const res = mockRes()
    await deletePastRecord({ params: { recordId: 'd1' } }, res, vi.fn())
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, message: 'NGO Past record deleted' }))
  })
// ==================== NEGATIVE TESTS ====================
  it('NEGATIVE: byId 400 on invalid id', async () => {
    mongoose.isValidObjectId.mockReturnValueOnce(false)
    const res = mockRes()
    await getPastRecordById({ params: { recordId: 'bad' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].success).toBe(false)
  })
  it('NEGATIVE: byId 404 when missing', async () => {
    NgoPastRecord.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const res = mockRes()
    await getPastRecordById({ params: { recordId: '68f1' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE: create 400 when note missing', async () => {
    const res = mockRes()
    await createPastRecord({ body: { note: '   ' }, files: [{ path: 'u', filename: 'p' }] }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(['p'])
  })
  it('NEGATIVE: create 400 on ValidationError', async () => {
    const e = new Error('bad'); e.name = 'ValidationError'; e.errors = { note: { message: 'Record note cannot exceed 2000 characters' } }
    NgoPastRecord.create.mockRejectedValue(e)
    const res = mockRes()
    await createPastRecord({ body: { note: 'x' }, files: [] }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].message).toContain('2000')
  })
  it('NEGATIVE: update 404 when missing', async () => {
    NgoPastRecord.findById.mockResolvedValue(null)
    const res = mockRes()
    await updatePastRecord({ params: { recordId: 'a' }, body: {}, files: [] }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE: delete 404 when missing', async () => {
    NgoPastRecord.findByIdAndDelete.mockResolvedValue(null)
    const res = mockRes()
    await deletePastRecord({ params: { recordId: 'a' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
// ==================== EDGE CASES ====================
  it('EDGE: null images mapped to []', async () => {
    NgoPastRecord.find.mockReturnValue(chain([{ _id: 'x', note: 'n', images: null }]))
    const res = mockRes()
    await getPastRecords({ query: {} }, res, vi.fn())
    expect(res.json.mock.calls[0][0].records[0].images).toEqual([])
  })
  it('EDGE: undefined files on create still 400', async () => {
    const res = mockRes()
    await createPastRecord({ body: {}, files: undefined }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('EDGE: empty-string note on update 400', async () => {
    NgoPastRecord.findById.mockResolvedValue({ note: 'o', images: [], save: vi.fn() })
    const res = mockRes()
    await updatePastRecord({ params: { recordId: 'r1' }, body: { note: '   ' }, files: [] }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
// ==================== ERROR CASES ====================
  it('ERROR: list forwards DB failure', async () => {
    NgoPastRecord.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('db')) }) })
    const next = vi.fn()
    await getPastRecords({ query: {} }, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
  it('ERROR: byId forwards DB failure', async () => {
    NgoPastRecord.findById.mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('boom')) })
    const next = vi.fn()
    await getPastRecordById({ params: { recordId: 'r1' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('ERROR: create forwards unexpected error', async () => {
    NgoPastRecord.create.mockRejectedValue(new Error('down'))
    const next = vi.fn()
    await createPastRecord({ body: { note: 'ok' }, files: [] }, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
  it('ERROR: delete forwards DB failure', async () => {
    NgoPastRecord.findByIdAndDelete.mockRejectedValue(new Error('fail'))
    const next = vi.fn()
    await deletePastRecord({ params: { recordId: 'd1' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
})




// ============================================================
// ASSERTIONS - easy to understand (matches slide)
// ============================================================
describe('Assertions - ngoPast examples', () => {
  it('1 - assertEquals: note is equal', () => {
    expect('Flood relief').toBe('Flood relief')
  })
  it('2 - assertFalse: empty note invalid = false', () => {
    const ok = '   '.trim().length > 0 // false
    expect(ok).toBe(false)
  })
  it('3 - assertNotNull: record exists', () => {
    expect({ note: 'Camp' }).not.toBeNull()
    expect({ note: 'Camp' }).toBeDefined()
  })
  it('4 - assertNull: missing record is null', () => {
    expect(null).toBeNull()
  })
  it('5 - assertTrue: success is true', () => {
    expect(true).toBe(true)
  })
  it('6 - fail: force fail if empty note saved', () => {
    const note = 'Help'
    if (note.trim() === '') {
      expect.fail('Empty note should never be saved!')
    }
    expect(note).toBe('Help')
  })
})
