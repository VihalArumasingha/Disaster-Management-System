import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../../models/Donation.js', () => {
  const Mock = vi.fn(function (data) { Object.assign(this, data); this._id = 'mock-id'; this.status = 'RECEIVED'; this.createdAt = new Date(); this.save = vi.fn().mockResolvedValue(true) })
  Mock.find = vi.fn()
  Mock.findById = vi.fn()
  Mock.countDocuments = vi.fn()
  Mock.findByIdAndUpdate = vi.fn()
  return { default: Mock }
})
vi.mock('mongoose', () => {
  const fn = vi.fn(() => true)
  return { default: { isValidObjectId: fn }, isValidObjectId: fn }
})
import Donation from '../../models/Donation.js'
import mongoose from 'mongoose'
import { createDonation, listDonations, getDonation, updateDonation, updateDonationStatus } from '../../roles/ngoManager/controllers/donationController.js'
const mockRes = () => { const r = {}; r.status = vi.fn().mockReturnValue(r); r.json = vi.fn().mockReturnValue(r); return r }
const listChain = (v) => ({ sort: vi.fn().mockReturnValue({ skip: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(v) }) }) }) })
beforeEach(() => vi.clearAllMocks())
describe('donationController full', () => {
// ==================== POSITIVE TESTS ====================
  it('POSITIVE: list returns data', async () => {
    Donation.find.mockReturnValue(listChain([{ _id: 'd1', amount: 5 }]))
    Donation.countDocuments.mockResolvedValue(1)
    const res = mockRes()
    await listDonations({ query: {} }, res, vi.fn())
    expect(res.json.mock.calls[0][0].data).toHaveLength(1)
  })
  it('POSITIVE: getDonation returns one', async () => {
    Donation.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'd1', amount: 100 }) })
    const res = mockRes()
    await getDonation({ params: { id: 'd1' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].data.amount).toBe(100)
  })
  it('POSITIVE: update succeeds', async () => {
    Donation.findByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'd1', amount: 200 }) })
    const res = mockRes()
    await updateDonation({ params: { id: 'd1' }, body: { donorType: 'Individual', amount: 200, donorName: 'A' }, file: null }, res, vi.fn())
    expect(res.json.mock.calls[0][0].data.amount).toBe(200)
  })
  it('POSITIVE: status update succeeds', async () => {
    Donation.findByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'd1', status: 'VERIFIED' }) })
    const res = mockRes()
    await updateDonationStatus({ params: { id: 'd1' }, body: { status: 'VERIFIED' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].data.status).toBe('VERIFIED')
  })
  it('POSITIVE: create saves and 201', async () => {
    const res = mockRes()
    await createDonation({ body: { donorType: 'Individual', amount: 100, donorName: 'A' }, file: null }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json.mock.calls[0][0].success).toBe(true)
    expect(res.json.mock.calls[0][0].data.status).toBe('RECEIVED')
  })
// ==================== NEGATIVE TESTS ====================
  it('NEGATIVE: update 400 invalid id', async () => {
    mongoose.isValidObjectId.mockReturnValueOnce(false)
    const res = mockRes()
    await updateDonation({ params: { id: 'bad' }, body: {}, file: null }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE: update 404 missing', async () => {
    Donation.findByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const res = mockRes()
    await updateDonation({ params: { id: 'd1' }, body: { donorType: 'Individual', amount: 50, donorName: 'A' }, file: null }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE: status rejects bad value', async () => {
    const res = mockRes()
    await updateDonationStatus({ params: { id: 'd1' }, body: { status: 'NOPE' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE: status 404 missing', async () => {
    Donation.findByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const res = mockRes()
    await updateDonationStatus({ params: { id: 'd1' }, body: { status: 'VERIFIED' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE: getDonation 400 invalid id', async () => {
    mongoose.isValidObjectId.mockReturnValueOnce(false)
    const res = mockRes()
    await getDonation({ params: { id: 'bad' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE: getDonation 404 missing', async () => {
    Donation.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const res = mockRes()
    await getDonation({ params: { id: 'd1' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
// ==================== EDGE CASES ====================
  it('EDGE: list with filters', async () => {
    Donation.find.mockReturnValue(listChain([]))
    Donation.countDocuments.mockResolvedValue(0)
    await listDonations({ query: { status: 'RECEIVED', donorType: 'Individual', q: 'amal' } }, mockRes(), vi.fn())
    expect(Donation.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'RECEIVED' }))
  })
  it('EDGE: update with slip file', async () => {
    Donation.findByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'd1' }) })
    const res = mockRes()
    await updateDonation({ params: { id: 'd1' }, body: { donorType: 'Individual', amount: 10, donorName: 'A' }, file: { path: 'slip.png' } }, res, vi.fn())
    expect(Donation.findByIdAndUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ evidencePath: 'slip.png' }), expect.anything())
  })
  it('EDGE: update with removeSlip clears slip', async () => {
    Donation.findByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'd1' }) })
    const res = mockRes()
    await updateDonation({ params: { id: 'd1' }, body: { donorType: 'Individual', amount: 10, donorName: 'A', removeSlip: 'true' }, file: null }, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
// ==================== ERROR CASES ====================
  it('ERROR: list forwards DB failure', async () => {
    Donation.find.mockImplementation(() => { throw new Error('db') })
    const next = vi.fn()
    await listDonations({ query: {} }, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
  it('ERROR: update forwards DB failure', async () => {
    Donation.findByIdAndUpdate.mockRejectedValue(new Error('fail'))
    const next = vi.fn()
    await updateDonation({ params: { id: 'd1' }, body: { donorType: 'Individual', amount: 100, donorName: 'A' }, file: null }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('ERROR: getDonation forwards DB failure', async () => {
    Donation.findById.mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('boom')) })
    const next = vi.fn()
    await getDonation({ params: { id: 'd1' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
// ==================== EXTRA BRANCH COVERAGE ====================
  it('POSITIVE-EXTRA: create with file + anon flags + full fields', async () => {
    const res = mockRes()
    await createDonation({ body: { donorType: 'Organization', donorName: 'Org', donorEmail: 'a@b.c', amount: '250.5', currency: 'USD', channel: 'bank', isAnonymous: 'true', allowNamePublic: true, bankName: 'B', branch: 'G', depositDate: '2026-01-01', depositorName: 'D', referenceNo: 'R1' }, file: { path: 'cloud://slip' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(201)
  })
  it('NEGATIVE-EXTRA: create 400 bad donorType', async () => {
    const res = mockRes()
    await createDonation({ body: { donorType: 'Alien', amount: 10, donorName: 'A' }, file: null }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE-EXTRA: create 400 zero amount', async () => {
    const res = mockRes()
    await createDonation({ body: { donorType: 'Individual', amount: 0, donorName: 'A' }, file: null }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE-EXTRA: create 400 NaN amount', async () => {
    const res = mockRes()
    await createDonation({ body: { donorType: 'Individual', amount: 'abc', donorName: 'A' }, file: null }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE-EXTRA: create 400 no contact', async () => {
    const res = mockRes()
    await createDonation({ body: { donorType: 'Individual', amount: 10 }, file: null }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR-EXTRA: create forwards save failure', async () => {
    Donation.mockImplementationOnce(function () { this.save = vi.fn().mockRejectedValue(new Error('db')) })
    const next = vi.fn()
    await createDonation({ body: { donorType: 'Individual', amount: 10, donorName: 'A' }, file: null }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('EDGE-EXTRA: list pagination + all filters', async () => {
    Donation.find.mockReturnValue(listChain([]))
    Donation.countDocuments.mockResolvedValue(0)
    await listDonations({ query: { page: '2', limit: '5', status: 'VERIFIED', donorType: 'Organization', currency: 'LKR', channel: 'bank', q: 'test' } }, mockRes(), vi.fn())
    expect(Donation.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'VERIFIED', currency: 'LKR' }))
  })
  it('EDGE-EXTRA: list bad page + huge limit', async () => {
    Donation.find.mockReturnValue(listChain([]))
    Donation.countDocuments.mockResolvedValue(0)
    await listDonations({ query: { page: 'abc', limit: '500' } }, mockRes(), vi.fn())
    expect(Donation.countDocuments).toHaveBeenCalled()
  })
  it('NEGATIVE-EXTRA: update 400 bad donorType', async () => {
    const res = mockRes()
    await updateDonation({ params: { id: 'd1' }, body: { donorType: 'X', amount: 10, donorName: 'A' }, file: null }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE-EXTRA: update 400 bad amount', async () => {
    const res = mockRes()
    await updateDonation({ params: { id: 'd1' }, body: { donorType: 'Individual', amount: -5, donorName: 'A' }, file: null }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE-EXTRA: update 400 no contact', async () => {
    const res = mockRes()
    await updateDonation({ params: { id: 'd1' }, body: { donorType: 'Individual', amount: 10 }, file: null }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE-EXTRA: status 400 missing status', async () => {
    const res = mockRes()
    await updateDonationStatus({ params: { id: 'd1' }, body: {} }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR-EXTRA: status forwards DB failure', async () => {
    Donation.findByIdAndUpdate.mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('db')) })
    const next = vi.fn()
    await updateDonationStatus({ params: { id: 'd1' }, body: { status: 'VERIFIED' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('ERROR-EXTRA: list forwards failure on count', async () => {
    Donation.find.mockReturnValue(listChain([]))
    Donation.countDocuments.mockRejectedValue(new Error('count fail'))
    const next = vi.fn()
    await listDonations({ query: {} }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
})

