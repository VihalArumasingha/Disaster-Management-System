import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('../../models/Inventory.js', () => ({
  default: { find: vi.fn(), create: vi.fn(), findById: vi.fn(), findByIdAndDelete: vi.fn() }
}))
vi.mock('../../models/TargetInventory.js', () => {
  const Mock = vi.fn(function (d) { Object.assign(this, d || {}); this.save = vi.fn().mockResolvedValue(true) })
  Mock.findOne = vi.fn()
  Mock.create = vi.fn()
  return { default: Mock }
})
import Inventory from '../../models/Inventory.js'
import TargetInventory from '../../models/TargetInventory.js'
import { getInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, getTargetInventory, updateTargetInventory } from '../../roles/ngoManager/controllers/inventoryController.js'
const mockRes = () => { const r = {}; r.status = vi.fn().mockReturnValue(r); r.json = vi.fn().mockReturnValue(r); return r }
beforeEach(() => vi.clearAllMocks())
describe('inventoryController part1', () => {
// ==================== POSITIVE TESTS ====================
  it('POSITIVE: getInventory returns items', async () => {
    Inventory.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([{ _id: 'i1', item: 'water', quantity: 10 }]) })
    const res = mockRes()
    await getInventory({}, res, vi.fn())
    expect(Inventory.find).toHaveBeenCalledWith({})
    expect(res.json.mock.calls[0][0].items[0].quantity).toBe(10)
  })
  it('POSITIVE: add creates valid item', async () => {
    Inventory.create.mockResolvedValue({ _id: 'n1' })
    const res = mockRes()
    await addInventoryItem({ body: { item: 'water', quantity: 50 } }, res, vi.fn())
    expect(Inventory.create).toHaveBeenCalledWith(expect.objectContaining({ item: 'water', quantity: 50 }))
    expect(res.status).toHaveBeenCalledWith(201)
  })
  it('POSITIVE: update changes quantity', async () => {
    const doc = { quantity: 10, save: vi.fn().mockResolvedValue(true) }
    Inventory.findById.mockResolvedValue(doc)
    const res = mockRes()
    await updateInventoryItem({ params: { itemId: 'i1' }, body: { quantity: 25 } }, res, vi.fn())
    expect(doc.quantity).toBe(25)
  })
  it('POSITIVE: delete removes item', async () => {
    Inventory.findByIdAndDelete.mockResolvedValue({ _id: 'i1' })
    const res = mockRes()
    await deleteInventoryItem({ params: { itemId: 'i1' } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
// ==================== NEGATIVE TESTS ====================
  it('NEGATIVE: add rejects bad item', async () => {
    const res = mockRes()
    await addInventoryItem({ body: { item: 'gold', quantity: 5 } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE: add rejects zero qty', async () => {
    const res = mockRes()
    await addInventoryItem({ body: { item: 'water', quantity: 0 } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE: add rejects bad date', async () => {
    const res = mockRes()
    await addInventoryItem({ body: { item: 'water', quantity: 5, date: 'xx' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE: update 404 missing', async () => {
    Inventory.findById.mockResolvedValue(null)
    const res = mockRes()
    await updateInventoryItem({ params: { itemId: 'x' }, body: {} }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
  it('NEGATIVE: delete 404 missing', async () => {
    Inventory.findByIdAndDelete.mockResolvedValue(null)
    const res = mockRes()
    await deleteInventoryItem({ params: { itemId: 'x' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(404)
  })
// ==================== EDGE CASES ====================
  it('EDGE: empty list []', async () => {
    Inventory.find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) })
    const res = mockRes()
    await getInventory({}, res, vi.fn())
    expect(res.json.mock.calls[0][0].items).toEqual([])
  })
  it('EDGE: zero qty allowed on update', async () => {
    const doc = { quantity: 10, save: vi.fn().mockResolvedValue(true) }
    Inventory.findById.mockResolvedValue(doc)
    const res = mockRes()
    await updateInventoryItem({ params: { itemId: 'i1' }, body: { quantity: 0 } }, res, vi.fn())
    expect(doc.quantity).toBe(0)
  })
// ==================== ERROR CASES ====================
  it('ERROR: get forwards DB failure', async () => {
    Inventory.find.mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('db')) })
    const next = vi.fn()
    await getInventory({}, mockRes(), next)
    expect(next).toHaveBeenCalledWith(expect.any(Error))
  })
  it('ERROR: delete forwards DB failure', async () => {
    Inventory.findByIdAndDelete.mockRejectedValue(new Error('fail'))
    const next = vi.fn()
    await deleteInventoryItem({ params: { itemId: 'i1' } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
// ==================== EXTRA BRANCH COVERAGE (unit, mocked) ====================
  it('POSITIVE-EXTRA: add with all optional fields', async () => {
    Inventory.create.mockResolvedValue({ _id: 'n1' })
    const res = mockRes()
    await addInventoryItem({ body: { item: 'medical', quantity: '10', unit: '  boxes ', center: ' Galle ', date: '2026-01-01', donorName: 'D', notes: 'n' } }, res, vi.fn())
    expect(Inventory.create).toHaveBeenCalledWith(expect.objectContaining({ item: 'medical', quantity: 10 }))
    expect(res.status).toHaveBeenCalledWith(201)
  })
  it('NEGATIVE-EXTRA: add missing item', async () => {
    const res = mockRes()
    await addInventoryItem({ body: { quantity: 5 } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE-EXTRA: add missing quantity', async () => {
    const res = mockRes()
    await addInventoryItem({ body: { item: 'water' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR-EXTRA: add forwards DB failure', async () => {
    Inventory.create.mockRejectedValue(new Error('db'))
    const next = vi.fn()
    await addInventoryItem({ body: { item: 'water', quantity: 5 } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('POSITIVE-EXTRA: update all fields', async () => {
    const doc = { item: 'water', quantity: 5, unit: '', center: '', save: vi.fn().mockResolvedValue(true) }
    Inventory.findById.mockResolvedValue(doc)
    const res = mockRes()
    await updateInventoryItem({ params: { itemId: 'i1' }, body: { item: 'clothing', quantity: 7, unit: ' pcs ', center: ' Matara ', date: '2026-02-01', donorName: 'X', notes: 'ok' } }, res, vi.fn())
    expect(doc.item).toBe('clothing')
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('NEGATIVE-EXTRA: update rejects bad item', async () => {
    Inventory.findById.mockResolvedValue({ quantity: 1, save: vi.fn() })
    const res = mockRes()
    await updateInventoryItem({ params: { itemId: 'i1' }, body: { item: 'gold' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE-EXTRA: update rejects negative qty', async () => {
    Inventory.findById.mockResolvedValue({ quantity: 1, save: vi.fn() })
    const res = mockRes()
    await updateInventoryItem({ params: { itemId: 'i1' }, body: { quantity: -3 } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('NEGATIVE-EXTRA: update rejects bad date', async () => {
    Inventory.findById.mockResolvedValue({ quantity: 1, save: vi.fn() })
    const res = mockRes()
    await updateInventoryItem({ params: { itemId: 'i1' }, body: { date: 'not-a-date' } }, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })
  it('ERROR-EXTRA: update forwards save failure', async () => {
    Inventory.findById.mockResolvedValue({ quantity: 1, save: vi.fn().mockRejectedValue(new Error('save')) })
    const next = vi.fn()
    await updateInventoryItem({ params: { itemId: 'i1' }, body: { quantity: 3 } }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('POSITIVE-EXTRA: getTarget returns existing', async () => {
    const doc = { _id: 't1', water: 5 }
    TargetInventory.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(doc) })
    const res = mockRes()
    await getTargetInventory({}, res, vi.fn())
    expect(res.json).toHaveBeenCalledWith(doc)
  })
  it('POSITIVE-EXTRA: getTarget seeds when missing', async () => {
    TargetInventory.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) })
    TargetInventory.create.mockResolvedValue({ _id: 'seed' })
    const res = mockRes()
    await getTargetInventory({}, res, vi.fn())
    expect(TargetInventory.create).toHaveBeenCalled()
  })
  it('ERROR-EXTRA: getTarget forwards failure', async () => {
    TargetInventory.findOne.mockReturnValue({ lean: vi.fn().mockRejectedValue(new Error('db')) })
    const next = vi.fn()
    await getTargetInventory({}, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
  it('POSITIVE-EXTRA: updateTarget applies valid ignores bad', async () => {
    const target = { save: vi.fn().mockResolvedValue(true) }
    TargetInventory.findOne.mockResolvedValue(target)
    const res = mockRes()
    await updateTargetInventory({ body: { water: 100, medical: -5, bedding: 'abc', dry_rations: 10 } }, res, vi.fn())
    expect(target.water).toBe(100)
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('POSITIVE-EXTRA: updateTarget creates when missing', async () => {
    TargetInventory.findOne.mockResolvedValue(null)
    const res = mockRes()
    await updateTargetInventory({ body: { water: 5 } }, res, vi.fn())
    expect(res.json.mock.calls[0][0].success).toBe(true)
  })
  it('ERROR-EXTRA: updateTarget forwards failure', async () => {
    TargetInventory.findOne.mockRejectedValue(new Error('db'))
    const next = vi.fn()
    await updateTargetInventory({ body: {} }, mockRes(), next)
    expect(next).toHaveBeenCalled()
  })
})
