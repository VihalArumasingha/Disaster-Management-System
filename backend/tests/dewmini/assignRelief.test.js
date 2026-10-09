import { describe, it, expect, vi, beforeEach } from 'vitest'
// UNIT TESTS ONLY: all DB + cloudinary deps mocked via vi.mock (no real DB)
vi.mock('../../models/Warning.js', () => ({ default: { find: vi.fn(), findById: vi.fn(), create: vi.fn(), findByIdAndUpdate: vi.fn(), findByIdAndDelete: vi.fn() } }))
vi.mock('../../models/TargetArea.js', () => ({ default: { find: vi.fn() } }))
vi.mock('../../models/CollectingCenter.js', () => ({ default: { find: vi.fn(), countDocuments: vi.fn() } }))
vi.mock('../../models/DistributionOperation.js', () => ({ default: { find: vi.fn(), countDocuments: vi.fn() } }))
vi.mock('../../models/HazardEscalation.js', () => ({ default: { find: vi.fn() } }))
vi.mock('../../models/HazardReport.js', () => ({ default: { find: vi.fn() } }))
vi.mock('../../models/Volunteer.js', () => ({ default: { find: vi.fn(), countDocuments: vi.fn() } }))
vi.mock('cloudinary', () => ({ v2: { api: { delete_resources: vi.fn().mockResolvedValue(true) } } }))
import HazardEscalation from '../../models/HazardEscalation.js'
import HazardReport from '../../models/HazardReport.js'
import Warning from '../../models/Warning.js'
import TargetArea from '../../models/TargetArea.js'
import CollectingCenter from '../../models/CollectingCenter.js'
import DistributionOperation from '../../models/DistributionOperation.js'
import Volunteer from '../../models/Volunteer.js'
import { v2 as cloudinary } from 'cloudinary'
import { getApprovedDisasters, getVerifiedHazardReports, getDisasters, getDisasterById, createDisaster, updateDisaster, deleteDisaster, getTargetAreas, getOverviewMetrics } from '../../roles/ngoManager/controllers/ngoManagerController.js'
const mockRes = () => { const r = {}; r.status = vi.fn().mockReturnValue(r); r.json = vi.fn().mockReturnValue(r); return r }
const escChain = (v) => ({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(v) }) }) }) }) }) })
const warnChain = (v) => ({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(v) }) }) }) }) })
const repChain = (v) => ({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(v) }) }) }) })
beforeEach(() => vi.clearAllMocks())
describe('assignRelief: getApprovedDisasters', () => {
// ==================== POSITIVE TESTS ====================
  it('POSITIVE: returns escalations + warnings + reports', async () => {
    HazardEscalation.find.mockReturnValue(escChain([{ _id: 'e1', hazardType: 'flood' }]))
    Warning.find.mockReturnValue(warnChain([{ _id: 'w1', hazardType: 'flood', severity: 'High', status: 'issued', city: 'Galle', active: true }]))
    HazardReport.find.mockReturnValue(repChain([]))
    const res = mockRes()
    await getApprovedDisasters({}, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
    expect(res.json.mock.calls[0][0].escalations).toHaveLength(1)
    expect(res.json.mock.calls[0][0].warnings[0].source).toBe('dmc_warning')
  })
  it('POSITIVE: critical warning flagged emergency', async () => {
    HazardEscalation.find.mockReturnValue(escChain([]))
    Warning.find.mockReturnValue(warnChain([{ _id: 'w2', hazardType: 'flood', severity: 'Critical', status: 'draft', city: 'X', active: true, updates: [] }]))
    HazardReport.find.mockReturnValue(repChain([]))
    const res = mockRes()
    await getApprovedDisasters({}, res, vi.fn())
    expect(res.json.mock.calls[0][0].warnings[0].isEmergency).toBe(true)
  })
  it('POSITIVE: individual verified reports mapped', async () => {
    HazardEscalation.find.mockReturnValue(escChain([]))
    Warning.find.mockReturnValue(warnChain([]))
    HazardReport.find.mockReturnValue(repChain([{ _id: 'r1', hazardType: 'flood', description: 'Help', status: 'verified', location: { coordinates: [80, 6] } }]))
    const res = mockRes()
    await getApprovedDisasters({}, res, vi.fn())
    expect(res.json.mock.calls[0][0].verifiedReports).toHaveLength(1)
    expect(res.json.mock.calls[0][0].verifiedReports[0].source).toBe('verified_report')
  })
// ==================== NEGATIVE TESTS ====================
// (no user input - fixed queries; invalid-data path = malformed warning handled)
// ==================== EDGE CASES ====================
  it('EDGE: all empty returns empty arrays', async () => {
    HazardEscalation.find.mockReturnValue(escChain([]))
    Warning.find.mockReturnValue(warnChain([]))
    HazardReport.find.mockReturnValue(repChain([]))
    const res = mockRes()
    await getApprovedDisasters({}, res, vi.fn())
    expect(res.json.mock.calls[0][0].escalations).toEqual([])
    expect(res.json.mock.calls[0][0].warnings).toEqual([])
    expect(res.json.mock.calls[0][0].verifiedReports).toEqual([])
  })
  it('EDGE: emergency update flags warning', async () => {
    HazardEscalation.find.mockReturnValue(escChain([]))
    Warning.find.mockReturnValue(warnChain([{ _id: 'w3', hazardType: 'x', severity: 'Low', status: 'issued', updates: [{ severity: 'emergency' }] }]))
    HazardReport.find.mockReturnValue(repChain([]))
    const res = mockRes()
    await getApprovedDisasters({}, res, vi.fn())
    expect(res.json.mock.calls[0][0].warnings[0].isEmergency).toBe(true)
  })
// ==================== ERROR CASES ====================
  it('ERROR: forwards DB failure', async () => {
    HazardEscalation.find.mockImplementation(() => { throw new Error('db') })
    const next = vi.fn()
    await getApprovedDisasters({}, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})
describe('assignRelief: getVerifiedHazardReports (verified only)', () => {
  const vChain = (v) => ({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(v) }) }) }) }) })
  it('POSITIVE: queries verified + non-archived only', async () => {
    HazardReport.find.mockReturnValue(vChain([{ _id: 'r1', status: 'verified' }]))
    const res = mockRes()
    await getVerifiedHazardReports({}, res, vi.fn())
    expect(HazardReport.find).toHaveBeenCalledWith({ status: 'verified', archived: { $ne: true } })
    expect(res.json.mock.calls[0][0].reports).toHaveLength(1)
  })
  it('POSITIVE: normalizeRole strips spaces so NGO Manager passes', async () => {
    const { normalizeRole } = await import('../../utils/constants.js')
    expect(normalizeRole('NGO Manager')).toBe('ngomanager')
  })
  it('ERROR: forwards DB failure', async () => {
    HazardReport.find.mockImplementation(() => { throw new Error('db') })
    const next = vi.fn()
    await getVerifiedHazardReports({}, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})
const warnListChain = (v) => ({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue(v) }) }) })
describe('ngoManager disasters CRUD - UNIT (mocked)', () => {
  it('POSITIVE: getDisasters with filters', async () => {
    Warning.find.mockReturnValue(warnListChain([{ _id: 'w1' }, { _id: 'w2' }]))
    const res = mockRes()
    await getDisasters({ query: { severity: 'High', hazardType: 'flood', status: 'draft', q: 'galle' } }, res, vi.fn())
    expect(Warning.find).toHaveBeenCalledWith(expect.objectContaining({ severity: 'High' }))
    expect(res.json.mock.calls[0][0].warnings).toHaveLength(2)
  })
  it('POSITIVE: getDisasters no filters shows all unresolved DB records', async () => {
    Warning.find.mockReturnValue(warnListChain([]))
    const res = mockRes()
    await getDisasters({ query: {} }, res, vi.fn())
    expect(Warning.find).toHaveBeenCalledWith({ resolvedAt: null })
  })
  it('POSITIVE: getDisasters explicit status still narrows', async () => {
    Warning.find.mockReturnValue(warnListChain([]))
    await getDisasters({ query: { status: 'draft' } }, mockRes(), vi.fn())
    expect(Warning.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }))
  })
  it('ERROR: getDisasters forwards failure', async () => {
    Warning.find.mockImplementation(() => { throw new Error('db') })
    const next = vi.fn()
    await getDisasters({ query: {} }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('POSITIVE: getDisasterById returns warning', async () => {
    Warning.findById.mockReturnValue({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockResolvedValue({ _id: 'w1' }) }) }) })
    const res = mockRes()
    await getDisasterById({ params: { disasterId: 'w1' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('NEGATIVE: getDisasterById 404', async () => {
    Warning.findById.mockReturnValue({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockResolvedValue(null) }) }) })
    const res = mockRes()
    await getDisasterById({ params: { disasterId: 'x' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('ERROR: getDisasterById forwards failure', async () => {
    Warning.findById.mockImplementation(() => { throw new Error('db') })
    const next = vi.fn()
    await getDisasterById({ params: { disasterId: 'w1' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('POSITIVE: createDisaster 201', async () => {
    TargetArea.find.mockResolvedValue([{ _id: 'a1' }])
    Warning.create.mockResolvedValue({ _id: 'w1', images: [] })
    Warning.findById.mockReturnValue({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockResolvedValue({ _id: 'w1' }) }) })
    const res = mockRes()
    await createDisaster({ body: { title: 'T', city: 'Galle', summary: 'S', topNeeds: ['food'], targetAreaIds: ['a1'] }, files: [{ path: 'u', filename: 'p' }], user: { _id: 'u1' } }, res, vi.fn())
    expect(Warning.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'T', status: 'draft' }))
    expect(res.status).toHaveBeenCalledWith(201)
  })
  it('NEGATIVE: createDisaster 400 missing fields', async () => {
    const res = mockRes()
    await createDisaster({ body: { title: '', city: 'G' }, files: [], user: { _id: 'u1' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('POSITIVE: getTargetAreas returns areas', async () => {
    TargetArea.find.mockReturnValue({ sort: vi.fn().mockResolvedValue([{ _id: 'a1' }]) })
    const res = mockRes()
    await getTargetAreas({}, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('ERROR: getTargetAreas forwards failure', async () => {
    TargetArea.find.mockReturnValue({ sort: vi.fn().mockRejectedValue(new Error('db')) })
    const next = vi.fn()
    await getTargetAreas({}, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
})
describe('ngoManager update/delete/metrics - UNIT (mocked)', () => {
  it('POSITIVE: updateDisaster edits issued active disaster', async () => {
    Warning.findById.mockResolvedValue({ _id: 'w1', status: 'issued', images: [] })
    TargetArea.find.mockResolvedValue([{ _id: 'a1' }])
    Warning.findByIdAndUpdate.mockReturnValue({ populate: vi.fn().mockReturnValue({ populate: vi.fn().mockResolvedValue({ _id: 'w1' }) }) })
    const res = mockRes()
    await updateDisaster({ params: { disasterId: 'w1' }, body: { title: 'New', city: 'C', targetAreaIds: ['a1'] }, files: [{ path: 'u', filename: 'p' }] }, res, vi.fn())
    expect(Warning.findByIdAndUpdate).toHaveBeenCalled()
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('NEGATIVE: updateDisaster 404', async () => {
    Warning.findById.mockResolvedValue(null)
    const res = mockRes()
    await updateDisaster({ params: { disasterId: 'x' }, body: {}, files: [] }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE: updateDisaster 400 resolved', async () => {
    Warning.findById.mockResolvedValue({ _id: 'w1', status: 'resolved' })
    const res = mockRes()
    await updateDisaster({ params: { disasterId: 'w1' }, body: {}, files: [] }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR: updateDisaster forwards failure', async () => {
    Warning.findById.mockRejectedValue(new Error('db'))
    const next = vi.fn()
    await updateDisaster({ params: { disasterId: 'w1' }, body: {}, files: [] }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('POSITIVE: deleteDisaster with images', async () => {
    Warning.findById.mockResolvedValue({ _id: 'w1', images: [{ public_id: 'p1' }, { url: 'x' }] })
    Warning.findByIdAndDelete.mockResolvedValue({ _id: 'w1' })
    const res = mockRes()
    await deleteDisaster({ params: { disasterId: 'w1' } }, res, vi.fn())
    expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(['p1'])
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('POSITIVE: deleteDisaster no images', async () => {
    Warning.findById.mockResolvedValue({ _id: 'w1', images: [] })
    Warning.findByIdAndDelete.mockResolvedValue({ _id: 'w1' })
    const res = mockRes()
    await deleteDisaster({ params: { disasterId: 'w1' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('NEGATIVE: deleteDisaster 404', async () => {
    Warning.findById.mockResolvedValue(null)
    const res = mockRes()
    await deleteDisaster({ params: { disasterId: 'x' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('POSITIVE: getOverviewMetrics returns metrics', async () => {
    CollectingCenter.countDocuments.mockResolvedValue(2)
    DistributionOperation.countDocuments.mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(0)
    Volunteer.countDocuments.mockResolvedValueOnce(10).mockResolvedValueOnce(4).mockResolvedValueOnce(8).mockResolvedValueOnce(2)
    DistributionOperation.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue([]) }) }) })
    CollectingCenter.find.mockResolvedValue([{ categories: ['Food', 'Unknown'] }, { categories: null }])
    const res = mockRes()
    await getOverviewMetrics({}, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
    expect(res.json.mock.calls[0][0].metrics.totalCollectionCenters).toBe(2)
  })
  it('ERROR: getOverviewMetrics forwards failure', async () => {
    CollectingCenter.countDocuments.mockRejectedValue(new Error('db'))
    const next = vi.fn()
    await getOverviewMetrics({}, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
})
