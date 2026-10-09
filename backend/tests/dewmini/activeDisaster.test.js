import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../../models/Warning.js', () => ({ default: { find: vi.fn() } }))
import Warning from '../../models/Warning.js'
import { getPublicActiveDisasters } from '../../roles/ngoManager/controllers/activeDisasterController.js'
const mockRes = () => { const r = {}; r.status = vi.fn().mockReturnValue(r); r.json = vi.fn().mockReturnValue(r); return r }
const chain = (v) => ({ select: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(v) }) }) })
beforeEach(() => vi.clearAllMocks())
describe('activeDisasterController', () => {
// ==================== POSITIVE TESTS ====================
  it('POSITIVE: returns active disasters', async () => {
    Warning.find.mockReturnValue(chain([{ _id: 'w1', title: 'Flood', city: 'Colombo' }]))
    const res = mockRes()
    await getPublicActiveDisasters({}, res, vi.fn())
    expect(Warning.find).toHaveBeenCalledWith({ active: true, showOnDonationPage: true, resolvedAt: null })
    expect(res.json.mock.calls[0][0].success).toBe(true)
    expect(res.json.mock.calls[0][0].disasters).toHaveLength(1)
    expect(res.json.mock.calls[0][0].disasters[0].title).toBe('Flood')
  })
// ==================== NEGATIVE TESTS ====================
// (no input validation in controller - filter is fixed, so negative = no records path covered via empty below)
// ==================== EDGE CASES ====================
  it('EDGE: empty returns []', async () => {
    Warning.find.mockReturnValue(chain([]))
    const res = mockRes()
    await getPublicActiveDisasters({}, res, vi.fn())
    expect(res.json.mock.calls[0][0].disasters).toEqual([])
  })
// ==================== ERROR CASES ====================
  it('ERROR: forwards DB failure', async () => {
    Warning.find.mockReturnValue({ select: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('db')) }) }) })
    const next = vi.fn()
    await getPublicActiveDisasters({}, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
})
