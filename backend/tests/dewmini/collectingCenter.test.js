import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../../models/CollectingCenter.js', () => ({
  default: { find: vi.fn(), create: vi.fn(), findByIdAndUpdate: vi.fn(), findByIdAndDelete: vi.fn() }
}))
import CollectingCenter from '../../models/CollectingCenter.js'
import { getCollectingCenters, createCollectingCenter, updateCollectingCenter, deleteCollectingCenter } from '../../roles/ngoManager/controllers/collectingCenterController.js'
const mockRes = () => { const r = {}; r.status = vi.fn().mockReturnValue(r); r.json = vi.fn().mockReturnValue(r); return r }
const listChain = (v) => ({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(v) }) })
beforeEach(() => vi.clearAllMocks())
describe('collectingCenterController', () => {
// ==================== POSITIVE TESTS ====================
  it('POSITIVE: list returns centers', async () => {
    CollectingCenter.find.mockReturnValue(listChain([{ _id: 'c1', name: 'Galle Hub' }]))
    const res = mockRes()
    await getCollectingCenters({ query: {} }, res, vi.fn())
    expect(CollectingCenter.find).toHaveBeenCalledWith({})
    expect(res.json.mock.calls[0][0].centers[0].name).toBe('Galle Hub')
  })
  it('POSITIVE: list filters by q', async () => {
    CollectingCenter.find.mockReturnValue(listChain([]))
    await getCollectingCenters({ query: { q: 'galle' } }, mockRes(), vi.fn())
    expect(CollectingCenter.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }))
  })
  it('POSITIVE: create returns 201', async () => {
    CollectingCenter.create.mockResolvedValue({ _id: 'n1', name: 'Hub' })
    const res = mockRes()
    await createCollectingCenter({ body: { name: 'Hub', phone: '0771', categories: ['Food'] } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(201)
  })
  it('POSITIVE: update returns center', async () => {
    CollectingCenter.findByIdAndUpdate.mockResolvedValue({ _id: 'c1', name: 'New' })
    const res = mockRes()
    await updateCollectingCenter({ params: { centerId: 'c1' }, body: { name: 'New' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].center.name).toBe('New')
  })
  it('POSITIVE: delete succeeds', async () => {
    CollectingCenter.findByIdAndDelete.mockResolvedValue({ _id: 'c1' })
    const res = mockRes()
    await deleteCollectingCenter({ params: { centerId: 'c1' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
// ==================== NEGATIVE TESTS ====================
  it('NEGATIVE: update 404 missing', async () => {
    CollectingCenter.findByIdAndUpdate.mockResolvedValue(null)
    const res = mockRes()
    await updateCollectingCenter({ params: { centerId: 'x' }, body: {} }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE: delete 404 missing', async () => {
    CollectingCenter.findByIdAndDelete.mockResolvedValue(null)
    const res = mockRes()
    await deleteCollectingCenter({ params: { centerId: 'x' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE: create 400 ValidationError', async () => {
    const e = new Error('bad'); e.name = 'ValidationError'; e.errors = { name: { message: 'Name required' } }
    CollectingCenter.create.mockRejectedValue(e)
    const res = mockRes()
    await createCollectingCenter({ body: {} }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json.mock.calls[0][0].message).toContain('Name required')
  })
// ==================== EDGE CASES ====================
  it('EDGE: empty list []', async () => {
    CollectingCenter.find.mockReturnValue(listChain([]))
    const res = mockRes()
    await getCollectingCenters({ query: {} }, res, vi.fn())
    expect(res.json.mock.calls[0][0].centers).toEqual([])
  })
// ==================== ERROR CASES ====================
  it('ERROR: list forwards DB failure', async () => {
    CollectingCenter.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('db')) }) })
    const next = vi.fn()
    await getCollectingCenters({ query: {} }, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
  it('ERROR: delete forwards DB failure', async () => {
    CollectingCenter.findByIdAndDelete.mockRejectedValue(new Error('fail'))
    const next = vi.fn()
    await deleteCollectingCenter({ params: { centerId: 'c1' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
})
