import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../../models/DistributionOperation.js', () => ({
  default: { find: vi.fn(), findById: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() }
}))
vi.mock('../../models/DistributionRecord.js', () => ({
  default: { find: vi.fn(), findById: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() }
}))
import DistributionOperation from '../../models/DistributionOperation.js'
import DistributionRecord from '../../models/DistributionRecord.js'
import { getOperations, getOperationById, createOperation, updateOperation, deleteOperation, getRecords, getRecordById, createRecord, updateRecord, deleteRecord } from '../../roles/ngoManager/controllers/distributionController.js'
const mockRes = () => { const r = {}; r.status = vi.fn().mockReturnValue(r); r.json = vi.fn().mockReturnValue(r); return r }
const opChain = (v) => ({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(v) }) })
const recChain = (v) => ({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(v) }) })
beforeEach(() => vi.clearAllMocks())
describe('distributionController', () => {
// ==================== POSITIVE TESTS ====================
  it('POSITIVE: list operations', async () => {
    DistributionOperation.find.mockReturnValue(opChain([{ _id: 'o1', name: 'Galle Relief' }]))
    const res = mockRes()
    await getOperations({ query: {} }, res, vi.fn())
    expect(DistributionOperation.find).toHaveBeenCalledWith({})
    expect(res.json.mock.calls[0][0].data[0].name).toBe('Galle Relief')
  })
  it('POSITIVE: create operation', async () => {
    DistributionOperation.create.mockResolvedValue({ _id: 'n1', name: 'Op' })
    const res = mockRes()
    await createOperation({ body: { name: 'Op', location: 'Galle' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(201)
  })
  it('POSITIVE: create quantity record', async () => {
    DistributionRecord.create.mockResolvedValue({ _id: 'r1' })
    const res = mockRes()
    await createRecord({ body: { date: '2026-10-01', familiesAssisted: 10, resourcesDistributed: 50 } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(201)
  })
  it('POSITIVE: list quantity records', async () => {
    DistributionRecord.find.mockReturnValue(recChain([{ _id: 'r1', date: '2026-10-01' }]))
    const res = mockRes()
    await getRecords({ query: {} }, res, vi.fn())
    expect(res.json.mock.calls[0][0].records).toHaveLength(1)
  })
// ==================== NEGATIVE TESTS ====================
  it('NEGATIVE: operation 404 missing', async () => {
    DistributionOperation.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const res = mockRes()
    await getOperationById({ params: { operationId: 'x' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE: record rejects bad date', async () => {
    const res = mockRes()
    await createRecord({ body: { date: '01-10-2026', familiesAssisted: 5, resourcesDistributed: 5 } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE: record rejects negative families', async () => {
    const res = mockRes()
    await createRecord({ body: { date: '2026-10-01', familiesAssisted: -2, resourcesDistributed: 5 } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE: delete operation 404', async () => {
    DistributionOperation.findByIdAndDelete.mockResolvedValue(null)
    const res = mockRes()
    await deleteOperation({ params: { operationId: 'x' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE: delete record 404', async () => {
    DistributionRecord.findByIdAndDelete.mockResolvedValue(null)
    const res = mockRes()
    await deleteRecord({ params: { recordId: 'x' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
// ==================== EDGE CASES ====================
  it('EDGE: empty operations []', async () => {
    DistributionOperation.find.mockReturnValue(opChain([]))
    const res = mockRes()
    await getOperations({ query: {} }, res, vi.fn())
    expect(res.json.mock.calls[0][0].data).toEqual([])
  })
  it('EDGE: zero families/resources allowed', async () => {
    DistributionRecord.create.mockResolvedValue({ _id: 'z1' })
    const res = mockRes()
    await createRecord({ body: { date: '2026-10-01', familiesAssisted: 0, resourcesDistributed: 0 } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(201)
  })
// ==================== ERROR CASES ====================
  it('ERROR: operations forwards DB failure', async () => {
    DistributionOperation.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('db')) }) })
    const next = vi.fn()
    await getOperations({ query: {} }, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
  it('ERROR: records forwards DB failure', async () => {
    DistributionRecord.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('db')) }) })
    const next = vi.fn()
    await getRecords({ query: {} }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
// ==================== EXTRA BRANCH COVERAGE (unit, mocked) ====================
  it('POSITIVE-EXTRA: getOperationById returns op', async () => {
    DistributionOperation.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'o1' }) })
    const res = mockRes()
    await getOperationById({ params: { operationId: 'o1' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('POSITIVE-EXTRA: updateOperation partial stage', async () => {
    const op = { name: 'A', save: vi.fn().mockResolvedValue(true) }
    DistributionOperation.findById.mockResolvedValue(op)
    const res = mockRes()
    await updateOperation({ params: { operationId: 'o1' }, body: { stage: 3, status: 'ACTIVE', name: 'B', location: 'Galle', requiredVolunteers: 10 } }, res, vi.fn())
    expect(op.stage).toBe(3)
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('POSITIVE-EXTRA: createOperation with status+stage', async () => {
    DistributionOperation.create.mockResolvedValue({ _id: 'n1' })
    const res = mockRes()
    await createOperation({ body: { name: 'Op', location: 'X', status: 'pending', stage: 9, requiredVolunteers: '4.7' } }, res, vi.fn())
    expect(DistributionOperation.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }))
    expect(res.status).toHaveBeenCalledWith(201)
  })
  it('NEGATIVE-EXTRA: updateOperation 404', async () => {
    DistributionOperation.findById.mockResolvedValue(null)
    const res = mockRes()
    await updateOperation({ params: { operationId: 'x' }, body: {} }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('EDGE-EXTRA: getOperations with q filter', async () => {
    DistributionOperation.find.mockReturnValue(opChain([]))
    await getOperations({ query: { q: 'galle' } }, mockRes(), vi.fn())
    expect(DistributionOperation.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }))
  })
  it('POSITIVE-EXTRA: getRecordById returns record', async () => {
    DistributionRecord.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'r1' }) })
    const res = mockRes()
    await getRecordById({ params: { recordId: 'r1' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('NEGATIVE-EXTRA: getRecordById 404', async () => {
    DistributionRecord.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const res = mockRes()
    await getRecordById({ params: { recordId: 'x' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('POSITIVE-EXTRA: updateRecord saves', async () => {
    const rec = { toObject: () => ({ date: '2026-10-01', familiesAssisted: 1, resourcesDistributed: 1 }), set: vi.fn(), save: vi.fn().mockResolvedValue(true) }
    DistributionRecord.findById.mockResolvedValue(rec)
    const res = mockRes()
    await updateRecord({ params: { recordId: 'r1' }, body: { familiesAssisted: 5 } }, res, vi.fn())
    expect(rec.save).toHaveBeenCalled()
  })
  it('NEGATIVE-EXTRA: updateRecord 404', async () => {
    DistributionRecord.findById.mockResolvedValue(null)
    const res = mockRes()
    await updateRecord({ params: { recordId: 'x' }, body: {} }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE-EXTRA: updateRecord 400 bad date', async () => {
    const rec = { toObject: () => ({ date: '2026-10-01', familiesAssisted: 1, resourcesDistributed: 1 }), set: vi.fn(), save: vi.fn() }
    DistributionRecord.findById.mockResolvedValue(rec)
    const res = mockRes()
    await updateRecord({ params: { recordId: 'r1' }, body: { date: 'bad' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('EDGE-EXTRA: getRecords with q', async () => {
    DistributionRecord.find.mockReturnValue(recChain([]))
    await getRecords({ query: { q: '2026' } }, mockRes(), vi.fn())
    expect(DistributionRecord.find).toHaveBeenCalledWith(expect.objectContaining({ date: expect.anything() }))
  })
  it('ERROR-EXTRA: createOperation ValidationError 400', async () => {
    const e = new Error('bad'); e.name = 'ValidationError'; e.errors = { name: { message: 'req' } }
    DistributionOperation.create.mockRejectedValue(e)
    const res = mockRes()
    await createOperation({ body: {} }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR-EXTRA: getOperationById CastError 400', async () => {
    const e = new Error('cast'); e.name = 'CastError'
    DistributionOperation.findById.mockReturnValue({ lean: vi.fn().mockRejectedValue(e) })
    const res = mockRes()
    await getOperationById({ params: { operationId: 'bad' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR-EXTRA: getOperationById forwards other', async () => {
    DistributionOperation.findById.mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('db')) })
    const next = vi.fn()
    await getOperationById({ params: { operationId: 'o1' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('ERROR-EXTRA: createRecord ValidationError 400', async () => {
    const e = new Error('bad'); e.name = 'ValidationError'; e.errors = { date: { message: 'req' } }
    DistributionRecord.create.mockRejectedValue(e)
    const res = mockRes()
    await createRecord({ body: { date: '2026-10-01', familiesAssisted: 1, resourcesDistributed: 1 } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR-EXTRA: createRecord forwards other', async () => {
    DistributionRecord.create.mockRejectedValue(new Error('down'))
    const next = vi.fn()
    await createRecord({ body: { date: '2026-10-01', familiesAssisted: 1, resourcesDistributed: 1 } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('ERROR-EXTRA: updateRecord save ValidationError 400', async () => {
    const e = new Error('bad'); e.name = 'ValidationError'; e.errors = { date: { message: 'req' } }
    const rec = { toObject: () => ({ date: '2026-10-01', familiesAssisted: 1, resourcesDistributed: 1 }), set: vi.fn(), save: vi.fn().mockRejectedValue(e) }
    DistributionRecord.findById.mockResolvedValue(rec)
    const res = mockRes()
    await updateRecord({ params: { recordId: 'r1' }, body: { familiesAssisted: 9 } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR-EXTRA: updateRecord forwards other', async () => {
    DistributionRecord.findById.mockRejectedValue(new Error('db'))
    const next = vi.fn()
    await updateRecord({ params: { recordId: 'r1' }, body: {} }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('ERROR-EXTRA: deleteRecord CastError 400', async () => {
    const e = new Error('cast'); e.name = 'CastError'
    DistributionRecord.findByIdAndDelete.mockRejectedValue(e)
    const res = mockRes()
    await deleteRecord({ params: { recordId: 'bad' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR-EXTRA: deleteRecord forwards other', async () => {
    DistributionRecord.findByIdAndDelete.mockRejectedValue(new Error('db'))
    const next = vi.fn()
    await deleteRecord({ params: { recordId: 'r1' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('ERROR-EXTRA: updateOperation ValidationError 400', async () => {
    const e = new Error('bad'); e.name = 'ValidationError'; e.errors = { name: { message: 'req' } }
    const op = { save: vi.fn().mockRejectedValue(e) }
    DistributionOperation.findById.mockResolvedValue(op)
    const res = mockRes()
    await updateOperation({ params: { operationId: 'o1' }, body: { name: 'x' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR-EXTRA: updateOperation forwards other', async () => {
    DistributionOperation.findById.mockRejectedValue(new Error('db'))
    const next = vi.fn()
    await updateOperation({ params: { operationId: 'o1' }, body: {} }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('ERROR-EXTRA: deleteOperation forwards other', async () => {
    DistributionOperation.findByIdAndDelete.mockRejectedValue(new Error('db'))
    const next = vi.fn()
    await deleteOperation({ params: { operationId: 'o1' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
})

// ============================================================
// ASSERTIONS - easy to understand (matches slide)
// ============================================================
describe('Assertions - distribution examples', () => {
  it('1 - assertEquals: operation name is equal', () => {
    expect('Galle Relief').toBe('Galle Relief')
  })
  it('2 - assertFalse: negative families invalid = false', () => {
    const ok = -2 >= 0 // false
    expect(ok).toBe(false)
  })
  it('3 - assertNotNull: operation exists', () => {
    expect({ _id: 'o1' }).not.toBeNull()
    expect({ _id: 'o1' }).toBeDefined()
  })
  it('4 - assertNull: missing operation is null', () => {
    expect(null).toBeNull()
  })
  it('5 - assertTrue: create success is true', () => {
    expect(true).toBe(true)
  })
  it('6 - fail: force fail on bad date', () => {
    const date = '2026-10-01'
    if (date === '01-10-2026') {
      expect.fail('Wrong date format should never pass!')
    }
    expect(date).toBe('2026-10-01')
  })
})
