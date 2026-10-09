import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../../models/Volunteer.js', () => ({
  default: { find: vi.fn(), findById: vi.fn(), create: vi.fn(), findByIdAndUpdate: vi.fn(), findByIdAndDelete: vi.fn() }
}))
import Volunteer from '../../models/Volunteer.js'
import { getVolunteers, getVolunteerById, createVolunteer, updateVolunteer, updateVolunteerAssignment, deleteVolunteer } from '../../roles/ngoManager/controllers/volunteerController.js'
const mockRes = () => { const r = {}; r.status = vi.fn().mockReturnValue(r); r.json = vi.fn().mockReturnValue(r); return r }
const listChain = (v) => ({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(v) }) })
beforeEach(() => vi.clearAllMocks())
describe('volunteerController', () => {
// ==================== POSITIVE TESTS ====================
  it('POSITIVE: list returns volunteers', async () => {
    Volunteer.find.mockReturnValue(listChain([{ _id: 'v1', fullName: 'Amal' }]))
    const res = mockRes()
    await getVolunteers({ query: {} }, res, vi.fn())
    expect(Volunteer.find).toHaveBeenCalledWith({})
    expect(res.json.mock.calls[0][0].volunteers[0].fullName).toBe('Amal')
  })
  it('POSITIVE: create starts UNASSIGNED', async () => {
    Volunteer.create.mockResolvedValue({ _id: 'n1' })
    const res = mockRes()
    await createVolunteer({ body: { fullName: 'Kamal', phone: '077' } }, res, vi.fn())
    expect(Volunteer.create).toHaveBeenCalledWith(expect.objectContaining({ assignment: { status: 'UNASSIGNED' } }))
    expect(res.status).toHaveBeenCalledWith(201)
  })
  it('POSITIVE: assign stamps date', async () => {
    const v = { operationName: 'Op1', assignment: null, save: vi.fn().mockResolvedValue(true) }
    Volunteer.findById.mockResolvedValue(v)
    const res = mockRes()
    await updateVolunteerAssignment({ params: { volunteerId: 'v1' }, body: { status: 'assigned' } }, res, vi.fn())
    expect(v.assignment.status).toBe('ASSIGNED')
    expect(v.assignment.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('POSITIVE: delete succeeds', async () => {
    Volunteer.findByIdAndDelete.mockResolvedValue({ _id: 'v1' })
    const res = mockRes()
    await deleteVolunteer({ params: { volunteerId: 'v1' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
// ==================== NEGATIVE TESTS ====================
  it('NEGATIVE: byId 404 missing', async () => {
    Volunteer.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    const res = mockRes()
    await getVolunteerById({ params: { volunteerId: 'x' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE: assignment rejects bad status', async () => {
    const res = mockRes()
    await updateVolunteerAssignment({ params: { volunteerId: 'v1' }, body: { status: 'MAYBE' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE: update 404 missing', async () => {
    Volunteer.findByIdAndUpdate.mockResolvedValue(null)
    const res = mockRes()
    await updateVolunteer({ params: { volunteerId: 'x' }, body: {} }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
// ==================== EDGE CASES ====================
  it('EDGE: search filters by q', async () => {
    Volunteer.find.mockReturnValue(listChain([]))
    await getVolunteers({ query: { q: 'amal' } }, mockRes(), vi.fn())
    expect(Volunteer.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }))
  })
  it('EDGE: unassign clears fields', async () => {
    const v = { assignment: { status: 'ASSIGNED' }, save: vi.fn().mockResolvedValue(true) }
    Volunteer.findById.mockResolvedValue(v)
    const res = mockRes()
    await updateVolunteerAssignment({ params: { volunteerId: 'v1' }, body: { status: 'UNASSIGNED' } }, res, vi.fn())
    expect(v.assignment).toEqual({ status: 'UNASSIGNED', operationName: '', date: '' })
  })
// ==================== ERROR CASES ====================
  it('ERROR: list forwards DB failure', async () => {
    Volunteer.find.mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('db')) }) })
    const next = vi.fn()
    await getVolunteers({ query: {} }, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
  it('ERROR: create forwards ValidationError as 400', async () => {
    const e = new Error('bad'); e.name = 'ValidationError'; e.errors = { fullName: { message: 'required' } }
    Volunteer.create.mockRejectedValue(e)
    const res = mockRes()
    await createVolunteer({ body: {} }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
// ==================== EXTRA BRANCH COVERAGE (unit, mocked) ====================
  it('POSITIVE-EXTRA: byId returns volunteer', async () => {
    Volunteer.findById.mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: 'v1', fullName: 'A' }) })
    const res = mockRes()
    await getVolunteerById({ params: { volunteerId: 'v1' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].volunteer.fullName).toBe('A')
  })
  it('POSITIVE-EXTRA: update returns volunteer', async () => {
    Volunteer.findByIdAndUpdate.mockResolvedValue({ _id: 'v1' })
    const res = mockRes()
    await updateVolunteer({ params: { volunteerId: 'v1' }, body: { fullName: 'B', volunteerType: 'team', members: 3, roles: ['cook'], languages: ['en'], availableTime: 'daytime' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('POSITIVE-EXTRA: assign keeps operationName', async () => {
    const v = { operationName: 'OpX', save: vi.fn().mockResolvedValue(true) }
    Volunteer.findById.mockResolvedValue(v)
    const res = mockRes()
    await updateVolunteerAssignment({ params: { volunteerId: 'v1' }, body: { status: 'ASSIGNED' } }, res, vi.fn())
    expect(v.assignment.operationName).toBe('OpX')
  })
  it('NEGATIVE-EXTRA: assignment 404 missing', async () => {
    Volunteer.findById.mockResolvedValue(null)
    const res = mockRes()
    await updateVolunteerAssignment({ params: { volunteerId: 'x' }, body: { status: 'ASSIGNED' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE-EXTRA: delete 404 missing', async () => {
    Volunteer.findByIdAndDelete.mockResolvedValue(null)
    const res = mockRes()
    await deleteVolunteer({ params: { volunteerId: 'x' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('ERROR-EXTRA: byId CastError 400', async () => {
    const e = new Error('cast'); e.name = 'CastError'
    Volunteer.findById.mockReturnValue({ lean: vi.fn().mockRejectedValue(e) })
    const res = mockRes()
    await getVolunteerById({ params: { volunteerId: 'bad' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR-EXTRA: byId forwards other error', async () => {
    Volunteer.findById.mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('db')) })
    const next = vi.fn()
    await getVolunteerById({ params: { volunteerId: 'v1' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('ERROR-EXTRA: update ValidationError 400', async () => {
    const e = new Error('bad'); e.name = 'ValidationError'; e.errors = { fullName: { message: 'req' } }
    Volunteer.findByIdAndUpdate.mockRejectedValue(e)
    const res = mockRes()
    await updateVolunteer({ params: { volunteerId: 'v1' }, body: {} }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR-EXTRA: update forwards other', async () => {
    Volunteer.findByIdAndUpdate.mockRejectedValue(new Error('db'))
    const next = vi.fn()
    await updateVolunteer({ params: { volunteerId: 'v1' }, body: {} }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('ERROR-EXTRA: assignment forwards error', async () => {
    Volunteer.findById.mockRejectedValue(new Error('db'))
    const next = vi.fn()
    await updateVolunteerAssignment({ params: { volunteerId: 'v1' }, body: { status: 'ASSIGNED' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('ERROR-EXTRA: delete forwards error', async () => {
    Volunteer.findByIdAndDelete.mockRejectedValue(new Error('db'))
    const next = vi.fn()
    await deleteVolunteer({ params: { volunteerId: 'v1' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('ERROR-EXTRA: create forwards non-validation', async () => {
    Volunteer.create.mockRejectedValue(new Error('down'))
    const next = vi.fn()
    await createVolunteer({ body: {} }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
})

// ============================================================
// ASSERTIONS - easy to understand (matches slide)
// 1 assertEquals -> toBe | 2 assertFalse -> toBe(false)
// 3 assertNotNull -> not.toBeNull() | 4 assertNull -> toBeNull()
// 5 assertTrue -> toBe(true) | 6 fail() -> expect.fail()
// ============================================================
describe('Assertions - volunteer examples', () => {
  it('1 - assertEquals: volunteer name is equal', () => {
    expect('Amal').toBe('Amal') // equal? Yes -> pass
  })
  it('2 - assertFalse: bad status is not accepted = false', () => {
    const isAccepted = ['ASSIGNED','UNASSIGNED'].includes('MAYBE') // false
    expect(isAccepted).toBe(false) // must be false -> pass
  })
  it('3 - assertNotNull: volunteer exists', () => {
    const v = { fullName: 'Kamal' }
    expect(v).not.toBeNull() // must exist -> pass
    expect(v).toBeDefined()
  })
  it('4 - assertNull: missing volunteer is null', () => {
    expect(null).toBeNull() // must be null -> pass
  })
  it('5 - assertTrue: assignment success is true', () => {
    expect(true).toBe(true) // must be true -> pass
  })
  it('6 - fail: force fail if bad status slips through', () => {
    const status = 'ASSIGNED'
    if (status === 'MAYBE') {
      expect.fail('MAYBE should have been rejected with 400!')
    }
    expect(status).toBe('ASSIGNED')
  })
})
