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

// ============================================================
// ASSERTIONS - easy to understand (matches slide)
// 1 assertEquals -> toBe / toEqual
// 2 assertFalse  -> toBe(false)
// 3 assertNotNull-> not.toBeNull()
// 4 assertNull   -> toBeNull()
// 5 assertTrue   -> toBe(true)
// 6 fail()       -> expect.fail()
// If any check is wrong, this test fails.
// ============================================================
describe('Assertions - activeDisaster examples', () => {
  it('1 - assertEquals: disaster title is equal', () => {
    const actual = 'Flood' // what API returned
    const expected = 'Flood' // what we wanted
    // Check: are they equal? Yes -> pass
    expect(actual).toBe(expected)
  })
  it('2 - assertFalse: no disaster means empty = false', () => {
    const hasDisasters = [].length > 0 // empty list -> false
    // Check: must be false. It IS false -> pass
    expect(hasDisasters).toBe(false)
  })
  it('3 - assertNotNull: disaster object exists', () => {
    const disaster = { title: 'Flood' } // fetched from DB
    // Check: must exist (not null) -> pass
    expect(disaster).not.toBeNull()
    expect(disaster).toBeDefined()
  })
  it('4 - assertNull: missing disaster is null', () => {
    const missing = null // DB found nothing
    // Check: must be null -> pass
    expect(missing).toBeNull()
  })
  it('5 - assertTrue: success flag is true', () => {
    const success = true // API returned success:true
    // Check: must be true -> pass
    expect(success).toBe(true)
  })
  it('6 - fail: force fail if we reach bad code', () => {
    const status = 'OK'
    if (status === 'ERROR') {
      // Only runs when something went wrong - forces failure
      expect.fail('Should never be ERROR here!')
    }
    expect(status).toBe('OK') // proves we stayed on safe path
  })
})
